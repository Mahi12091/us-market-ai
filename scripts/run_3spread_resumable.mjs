import { neon } from '@neondatabase/serverless';
import { spawn } from 'node:child_process';

for (const name of ['THREESPREAD_API_KEY', 'NEON_DATABASE_URL']) {
  if (!process.env[name]) throw new Error(`${name} is not configured.`);
}

const sql = neon(process.env.NEON_DATABASE_URL);
const batchNumber = Math.max(1, Number(process.env.SYNC_BATCH_NUMBER || 1));
const batchSize = Math.max(1, Number(process.env.SYNC_BATCH_SIZE_INPUT || 250));
const start = (batchNumber - 1) * batchSize;
const delayMs = Math.max(0, Number(process.env.SYNC_BATCH_DELAY_MS || 75));

await sql`
  CREATE TABLE IF NOT EXISTS public.three_spread_sync_progress (
    stock_id bigint PRIMARY KEY REFERENCES public.stocks(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
    attempts integer NOT NULL DEFAULT 0,
    last_error text,
    completed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

await sql`
  INSERT INTO public.three_spread_sync_progress (stock_id, status, completed_at, updated_at)
  SELECT DISTINCT stock_id, 'completed', now(), now()
  FROM public.threespread_financial_statements
  WHERE stock_id IS NOT NULL
  ON CONFLICT (stock_id) DO NOTHING
`;
await sql`
  INSERT INTO public.three_spread_sync_progress (stock_id, status, completed_at, updated_at)
  SELECT DISTINCT stock_id, 'completed', now(), now()
  FROM public.fundamentals
  WHERE stock_id IS NOT NULL
  ON CONFLICT (stock_id) DO NOTHING
`;

const stocks = await sql`
  SELECT id, symbol, market_cap
  FROM public.stocks
  WHERE is_active = true AND asset_type = 'stock'
  ORDER BY id ASC
  OFFSET ${start}
  LIMIT ${batchSize}
`;

if (!stocks.length) {
  console.log(`[3spread-resumable] No stocks found for batch ${batchNumber} (offset ${start}).`);
  process.exit(0);
}

console.log(`[3spread-resumable] batch=${batchNumber} size=${batchSize} range=${start + 1}-${start + stocks.length}`);

function runOne(offset) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/sync_fundamentals_3spread_v2.mjs'], {
      env: { ...process.env, THREESPREAD_API_KEY: process.env.THREESPREAD_API_KEY, SYNC_START_OFFSET: String(offset), SYNC_STOCK_LIMIT: '1', SYNC_DELAY_MS: String(delayMs) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { const s = chunk.toString(); stdout += s; process.stdout.write(s); });
    child.stderr.on('data', chunk => { const s = chunk.toString(); stderr += s; process.stderr.write(s); });
    child.on('error', error => resolve({ exitCode: 1, stdout, stderr: `${stderr}\n${error.message}` }));
    child.on('close', (code, signal) => resolve({ exitCode: code ?? 1, signal, stdout, stderr }));
  });
}

function parseResult(stdout) {
  const idx = stdout.lastIndexOf('{\n  "source": "3spread"');
  if (idx >= 0) { try { return JSON.parse(stdout.slice(idx)); } catch {} }
  const matches = [...stdout.matchAll(/\{\s*"source"\s*:\s*"3spread"[\s\S]*\}\s*$/g)];
  if (matches.length) { try { return JSON.parse(matches.at(-1)[0]); } catch {} }
  return null;
}

let completed = 0;
let skipped = 0;
let failed = 0;
let rateLimited = false;

for (let i = 0; i < stocks.length; i++) {
  const stock = stocks[i];
  const [existing] = await sql`SELECT status, attempts FROM public.three_spread_sync_progress WHERE stock_id = ${stock.id}`;

  if (existing?.status === 'completed') {
    skipped++;
    console.log(`[3spread-resumable] ${i + 1}/${stocks.length} ${stock.symbol} already completed; skip`);
    continue;
  }

  await sql`
    INSERT INTO public.three_spread_sync_progress (stock_id, status, attempts, updated_at)
    VALUES (${stock.id}, 'pending', 1, now())
    ON CONFLICT (stock_id) DO UPDATE SET status='pending', attempts=public.three_spread_sync_progress.attempts+1, last_error=NULL, updated_at=now()
  `;

  const absoluteOffset = start + i;
  console.log(`[3spread-resumable] ${i + 1}/${stocks.length} ${stock.symbol} start (global offset ${absoluteOffset})`);
  const result = await runOne(absoluteOffset);
  const parsed = parseResult(result.stdout);
  const ok = result.exitCode === 0 && parsed?.completed === 1 && parsed?.failed === 0;
  const output = `${result.stdout}\n${result.stderr}`;
  const is429 = output.includes('3spread 429') || /HTTP\s*429|status.?429|Too Many Requests/i.test(output);

  if (ok) {
    await sql`UPDATE public.three_spread_sync_progress SET status='completed', last_error=NULL, completed_at=now(), updated_at=now() WHERE stock_id=${stock.id}`;
    completed++;
    console.log(`[3spread-resumable] ${stock.symbol} checkpoint saved`);
  } else {
    const errorText = (parsed?.summary?.find?.(x => !x.ok)?.error || result.stderr || '3spread sync failed').slice(0, 2000);
    await sql`UPDATE public.three_spread_sync_progress SET status='failed', last_error=${errorText}, updated_at=now() WHERE stock_id=${stock.id}`;
    failed++;
    console.error(`[3spread-resumable] ${stock.symbol} not completed; checkpoint remains retryable`);
    if (is429) {
      rateLimited = true;
      console.error('[3spread-resumable] API rate limit detected; stopping without advancing the checkpoint.');
      break;
    }
  }

  if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
}

console.log(JSON.stringify({ batch_number: batchNumber, batch_size: batchSize, batch_start_offset: start, stocks_in_batch: stocks.length, completed, skipped, failed, rate_limited: rateLimited }, null, 2));
if (rateLimited) process.exit(2);
