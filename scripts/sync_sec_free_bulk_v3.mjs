import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL);
const UA = process.env.SEC_USER_AGENT || 'US Market AI research admin@example.com';
const MAX = Number(process.env.SEC_MAX_STOCKS || 0);
const BATCH_SIZE = Number(process.env.SEC_BATCH_SIZE || 500);
const CONCURRENCY = Number(process.env.SEC_BATCH_CONCURRENCY || 5);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'usmarketai-sec-v3-'));
const execFileAsync = promisify(execFile);

const date = v => v ? String(v).slice(0, 10) : null;
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const cik = v => String(v || '').replace(/\D/g, '').padStart(10, '0');
const filingUrl = (c, a, d) => 'https://www.sec.gov/Archives/edgar/data/' + Number(c) + '/' + String(a).replace(/-/g, '') + '/' + (d || '');

async function download(url, file) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
  if (!r.ok) throw new Error('SEC ' + r.status + ' ' + url);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(file));
}

async function unzip(file, dir) {
  await fs.promises.mkdir(dir, { recursive: true });
  await execFileAsync('unzip', ['-q', '-o', file, '-d', dir]);
}

async function upsert(table, rows, conflict, chunkSize = 250) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const keys = [...new Set(chunk.flatMap(row => Object.keys(row)))];
    const values = [];
    const tuples = chunk.map(row => '(' + keys.map(key => {
      values.push(row[key] ?? null);
      return '$' + values.length;
    }).join(',') + ')').join(',');
    const conflictCols = conflict.split(',').map(x => x.trim()).filter(Boolean);
    const updates = keys.filter(key => !conflictCols.includes(key))
      .map(key => '"' + key + '"=EXCLUDED."' + key + '"').join(',');
    const q = 'INSERT INTO "' + table + '" (' + keys.map(k => '"' + k + '"').join(',') +
      ') VALUES ' + tuples + ' ON CONFLICT (' + conflictCols.map(k => '"' + k + '"').join(',') +
      ') DO ' + (updates ? 'UPDATE SET ' + updates : 'NOTHING');
    await sql.query(q, values);
  }
}

async function mapCiks() {
  const file = path.join(TMP, 'company_tickers.json');
  await download('https://www.sec.gov/files/company_tickers.json', file);
  const j = JSON.parse(await fs.promises.readFile(file, 'utf8'));
  const map = new Map(Object.values(j).map(x => [String(x.ticker || '').toUpperCase(), cik(x.cik_str)]));
  const stocks = await sql.query(
    'SELECT id,symbol,cik FROM stocks WHERE is_active=true ORDER BY id'
  );

  const updates = [];
  for (const s of stocks) {
    const c = map.get(String(s.symbol || '').toUpperCase());
    if (c && c !== '0000000000') updates.push({ id: s.id, cik: c });
  }
  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500);
    const values = [];
    const tuples = chunk.map(r => {
      values.push(r.id, r.cik);
      return '($' + (values.length - 1) + ',$' + values.length + ')';
    }).join(',');
    await sql.query(
      'UPDATE stocks s SET cik=v.cik,data_last_verified_at=NOW() FROM (VALUES ' + tuples +
      ') AS v(id,cik) WHERE s.id=v.id',
      values
    );
  }
  console.log('CIK mapped', updates.length);
}

async function getUniverse() {
  const rows = await sql.query(
    'SELECT id,symbol,cik FROM stocks WHERE is_active=true AND cik IS NOT NULL ORDER BY id'
  );
  const clean = rows.map(x => ({ ...x, cik: cik(x.cik) })).filter(x => x.cik !== '0000000000');
  return MAX ? clean.slice(0, MAX) : clean;
}

const FORM_RE = /^(10-K|10-Q|8-K|20-F|40-F|6-K|DEF 14A|DEFA14A|DEF 14C|SC 13D|SC 13G|13F-HR|13F-HR\/A|3|3\/A|4|4\/A|5|5\/A|144|S-1|S-3|S-4|424B|11-K)$/i;

async function processBatch(stocks, submissionsDir, companyfactsDir, batchNo, totalBatches) {
  const filingRows = [];
  const earningsRows = [];
  const dividendRows = [];

  for (const s of stocks) {
    const submissionFile = path.join(submissionsDir, 'CIK' + s.cik + '.json');
    if (fs.existsSync(submissionFile)) {
      const j = JSON.parse(await fs.promises.readFile(submissionFile, 'utf8'));
      const r = j.filings?.recent;
      if (r) {
        for (let i = 0; i < r.form.length; i++) {
          const form = r.form[i];
          const accession = r.accessionNumber?.[i];
          if (!accession || !FORM_RE.test(form)) continue;
          const doc = r.primaryDocument?.[i] || null;
          filingRows.push({
            stock_id: s.id,
            cik: s.cik,
            accession_number: accession,
            form_type: form,
            filing_date: date(r.filingDate?.[i]),
            filing_period: date(r.reportDate?.[i]),
            accepted_at: r.accepted?.[i] ? new Date(r.accepted[i]).toISOString() : null,
            primary_document: doc,
            filing_url: filingUrl(s.cik, accession, doc),
            filing_description: r.primaryDocDescription?.[i] || null,
            data_source: 'SEC_EDGAR_BULK',
            created_at: new Date().toISOString()
          });
        }
      }
    }

    const factsFile = path.join(companyfactsDir, 'CIK' + s.cik + '.json');
    if (!fs.existsSync(factsFile)) continue;
    const facts = JSON.parse(await fs.promises.readFile(factsFile, 'utf8')).facts || {};

    const fact = names => {
      for (const n of names) {
        for (const t of ['us-gaap', 'ifrs-full']) {
          const x = facts?.[t]?.[n];
          if (x) return x;
        }
      }
      return null;
    };
    const factRows = x => {
      if (!x?.units) return [];
      const key = Object.keys(x.units)[0];
      return (x.units[key] || []).filter(v => /^(10-Q|10-K|20-F|40-F)$/.test(v.form));
    };

    const eps = factRows(fact(['EarningsPerShareDiluted', 'EarningsPerShareBasic']));
    const rev = factRows(fact(['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues']));
    const div = factRows(fact(['CommonStockDividendsPerShareDeclared', 'PaymentsOfDividendsCommonStock', 'PaymentsOfDividends']));

    const periods = new Map();
    for (const x of [...eps, ...rev]) {
      const key = (x.fy || '') + '|' + (x.fp || '') + '|' + (x.end || '');
      if (!periods.has(key)) periods.set(key, { end: x.end, filed: x.filed, fp: x.fp, eps: null, rev: null });
    }
    for (const x of eps) {
      const key = (x.fy || '') + '|' + (x.fp || '') + '|' + (x.end || '');
      if (periods.has(key)) periods.get(key).eps = num(x.val);
    }
    for (const x of rev) {
      const key = (x.fy || '') + '|' + (x.fp || '') + '|' + (x.end || '');
      if (periods.has(key)) periods.get(key).rev = num(x.val);
    }

    for (const p of periods.values()) {
      if (p.eps == null && p.rev == null) continue;
      earningsRows.push({
        stock_id: s.id,
        earnings_date: date(p.filed || p.end),
        fiscal_period: p.fp || 'reported',
        eps_actual: p.eps,
        revenue_actual: p.rev,
        data_source: 'SEC_XBRL_BULK',
        created_at: new Date().toISOString()
      });
    }

    for (const x of div) {
      if (x.val == null || !x.end) continue;
      dividendRows.push({
        stock_id: s.id,
        ex_date: null,
        declaration_date: date(x.filed || x.end),
        amount: num(x.val),
        currency: 'USD',
        data_source: 'SEC_XBRL_BULK',
        created_at: new Date().toISOString()
      });
    }
  }

  await upsert('sec_filings', filingRows, 'accession_number', 250);
  if (earningsRows.length) await upsert('earnings', earningsRows, 'stock_id,earnings_date,fiscal_period', 250);
  if (dividendRows.length) await upsert('dividends', dividendRows, 'stock_id,declaration_date,amount', 250);

  console.log(
    'BATCH ' + batchNo + '/' + totalBatches +
    ' stocks=' + stocks.length +
    ' filings=' + filingRows.length +
    ' earnings=' + earningsRows.length +
    ' dividends=' + dividendRows.length
  );
  return { filings: filingRows.length, earnings: earningsRows.length, dividends: dividendRows.length };
}

async function main() {
  if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required');

  console.log('SEC v3: download once -> local parse -> parallel DB batches');
  await mapCiks();

  const submissionsZip = path.join(TMP, 'submissions.zip');
  const companyfactsZip = path.join(TMP, 'companyfacts.zip');
  const submissionsDir = path.join(TMP, 'submissions');
  const companyfactsDir = path.join(TMP, 'companyfacts');

  console.log('Downloading submissions.zip once...');
  await download('https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip', submissionsZip);
  await unzip(submissionsZip, submissionsDir);

  console.log('Downloading companyfacts.zip once...');
  await download('https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip', companyfactsZip);
  await unzip(companyfactsZip, companyfactsDir);

  const universe = await getUniverse();
  const batches = [];
  for (let i = 0; i < universe.length; i += BATCH_SIZE) batches.push(universe.slice(i, i + BATCH_SIZE));

  console.log('SEC universe', universe.length, 'batches', batches.length, 'batch_size', BATCH_SIZE, 'parallel', CONCURRENCY);

  let cursor = 0;
  const totals = { filings: 0, earnings: 0, dividends: 0 };
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= batches.length) return;
      const result = await processBatch(batches[index], submissionsDir, companyfactsDir, index + 1, batches.length);
      totals.filings += result.filings;
      totals.earnings += result.earnings;
      totals.dividends += result.dividends;
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));

  console.log('SEC v3 complete', JSON.stringify(totals));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
