import { Client } from '@neondatabase/serverless';

const required = ['MASSIVE_API_KEY', 'NEON_DATABASE_URL'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured.`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const base = 'https://api.massive.com';
let lastRequest = 0;

async function fetchWithRetry(url, init = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await fetch(url, init); }
    catch (error) {
      lastError = error;
      if (attempt === attempts) throw lastError;
      await sleep(2000 * attempt);
    }
  }
  throw lastError;
}

async function massive(path) {
  const wait = 13000 - (Date.now() - lastRequest);
  if (wait > 0) await sleep(wait);
  const url = new URL(path, base);
  url.searchParams.set('apiKey', process.env.MASSIVE_API_KEY);
  lastRequest = Date.now();
  const response = await fetchWithRetry(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`Massive ${response.status}: ${text}`);
  return JSON.parse(text);
}

const client = new Client(process.env.NEON_DATABASE_URL);
await client.connect();

try {
  const targets = await client.query(`
    SELECT symbol FROM public.stocks
    WHERE is_active = true AND asset_type = 'stock'
    ORDER BY id LIMIT 500
  `);
  const wanted = new Set(targets.rows.map((row) => String(row.symbol).toUpperCase()));
  if (!wanted.size) throw new Error('No active stocks found in Neon.');

  let next = '/v3/reference/tickers?market=stocks&type=CS&active=true&order=asc&sort=ticker&limit=1000';
  let matched = 0;
  let pages = 0;

  while (next) {
    const response = await massive(next);
    pages += 1;
    for (const ticker of response.results ?? []) {
      const symbol = String(ticker.ticker ?? '').toUpperCase();
      if (!wanted.has(symbol)) continue;
      await client.query(`
        UPDATE public.stocks SET
          company_name = $1, exchange = $2, market_cap = $3,
          description = $4, website_url = $5, logo_url = $6,
          currency = $7, country = 'US', updated_at = now()
        WHERE symbol = $8
      `, [
        ticker.name ?? symbol,
        ticker.primary_exchange ?? null,
        Number.isFinite(Number(ticker.market_cap)) ? Number(ticker.market_cap) : null,
        ticker.description ?? ticker.sic_description ?? null,
        ticker.homepage_url ?? null,
        ticker.branding?.logo_url ?? null,
        ticker.currency_name?.toUpperCase() ?? 'USD',
        symbol,
      ]);
      matched += 1;
    }
    next = response.next_url ? new URL(response.next_url).pathname + new URL(response.next_url).search : null;
  }

  console.log(JSON.stringify({ targets: wanted.size, matched, pages, database: 'Neon' }, null, 2));
} finally {
  await client.end();
}
