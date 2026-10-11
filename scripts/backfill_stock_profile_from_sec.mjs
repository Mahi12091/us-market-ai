import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required');
const sql = neon(process.env.NEON_DATABASE_URL);
const UA = process.env.SEC_USER_AGENT || 'USMarketAI/1.0 contact: support@usmarketai.com';
const execFileAsync = promisify(execFile);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'usmai-sec-metadata-'));
const padCik = (value) => String(value || '').replace(/\D/g, '').padStart(10, '0');
const clean = (value) => String(value || '').trim() || null;

async function download(url, file) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
    if (response.ok) {
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(file));
      return;
    }
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 5) {
      throw new Error('SEC submissions bulk download HTTP ' + response.status);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
}

const zip = path.join(tmp, 'submissions.zip');
const outDir = path.join(tmp, 'submissions');
await download('https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip', zip);
await fs.promises.mkdir(outDir, { recursive: true });
await execFileAsync('unzip', ['-q', '-o', zip, '-d', outDir]);

const stocks = await sql`SELECT id,symbol,cik FROM stocks WHERE cik IS NOT NULL ORDER BY id`;
let parsed = 0;
let missingFile = 0;
let updated = 0;
let batch = [];

async function flush() {
  if (!batch.length) return;
  const payload = JSON.stringify(batch);
  const result = await sql.query(
    'WITH src AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id bigint,headquarters text,city text,state text,industry text,sub_industry text)) ' +
    'UPDATE stocks s SET ' +
    'headquarters=COALESCE(NULLIF(s.headquarters,\'\'),src.headquarters), ' +
    'city=COALESCE(NULLIF(s.city,\'\'),src.city), ' +
    'state=COALESCE(NULLIF(s.state,\'\'),src.state), ' +
    'industry=COALESCE(NULLIF(s.industry,\'\'),src.industry), ' +
    'sub_industry=COALESCE(NULLIF(s.sub_industry,\'\'),CASE WHEN s.industry IS NOT NULL THEN src.sub_industry END), ' +
    'data_last_verified_at=NOW() ' +
    'FROM src WHERE s.id=src.id AND (s.headquarters IS NULL OR s.city IS NULL OR s.state IS NULL OR s.industry IS NULL OR s.sub_industry IS NULL) ' +
    'RETURNING s.id',
    [payload]
  );
  updated += result.length;
  batch = [];
}

for (const stock of stocks) {
  const cik = padCik(stock.cik);
  const file = path.join(outDir, 'CIK' + cik + '.json');
  if (!fs.existsSync(file)) { missingFile += 1; continue; }
  try {
    const company = JSON.parse(await fs.promises.readFile(file, 'utf8'));
    const address = company.addresses?.business || {};
    const headquarters = [
      clean(address.street1), clean(address.street2), clean(address.city),
      clean(address.stateOrCountry), clean(address.zipCode)
    ].filter(Boolean).join(', ') || null;
    const sicDescription = clean(company.sicDescription);
    batch.push({
      id: Number(stock.id),
      headquarters,
      city: clean(address.city),
      state: clean(address.stateOrCountry),
      industry: sicDescription,
      sub_industry: sicDescription
    });
    parsed += 1;
    if (batch.length >= 250) await flush();
  } catch (error) {
    console.error('[sec-metadata] ' + stock.symbol + ': ' + String(error?.message || error).slice(0, 180));
  }
}
await flush();
console.log(JSON.stringify({ source: 'official SEC submissions bulk', stocks_with_cik: stocks.length, parsed, missing_cik_file: missingFile, stock_rows_updated: updated }, null, 2));
