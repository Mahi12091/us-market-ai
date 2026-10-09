import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required');
const sql = neon(process.env.NEON_DATABASE_URL);
const UA = process.env.SEC_USER_AGENT || 'USMarketAI/1.0 contact: support@usmarketai.com';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'usmai-13f-'));
const execFileAsync = promisify(execFile);
const norm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/\b(class|series)\s+[a-z0-9]+\b/g, ' ').replace(/\b(the|incorporated|inc|corporation|corp|company|co|limited|ltd|plc|holdings|holding|common|ordinary|shares|stock|depositary|depository|american|receipts|receipt|adr|ads|units|unit|warrants|warrant|rights|right|notes|note|due|convertible|preferred|preference)\b/g, ' ').replace(/[^a-z0-9]/g, '');
const date = s => {
  if (!s) return null;
  const v = String(s).trim();
  const m = v.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) { const d = new Date(m[2] + ' ' + m[1] + ', ' + m[3] + ' UTC'); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null; }
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
};
function parseTsvLine(line) {
  const out = []; let cur = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
    else if (c === '\t' && !quoted) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out;
}
async function* rows(file) {
  const rl = createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let headers = null;
  for await (const line of rl) {
    if (!headers) { headers = parseTsvLine(line).map(x => x.replace(/^\uFEFF/, '')); continue; }
    const vals = parseTsvLine(line); const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    yield row;
  }
}
async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
  if (!r.ok) throw new Error('SEC ' + r.status + ' ' + url);
  return r;
}
async function readMap(file, key) {
  const map = new Map();
  for await (const row of rows(file)) if (row[key]) map.set(row[key], row);
  return map;
}
async function main() {
  const page = await (await get('https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets')).text();
  const links = [...page.matchAll(/href=["']([^"']+\.zip)["']/gi)].map(m => m[1]).filter(x => /form13f\.zip/i.test(x));
  if (!links.length) throw new Error('Could not locate official SEC 13F quarterly ZIP link');
  const url = new URL(links[0], 'https://www.sec.gov').href;
  const zip = path.join(TMP, '13f.zip');
  await pipeline(Readable.fromWeb((await get(url)).body), fs.createWriteStream(zip));
  const dataDir = path.join(TMP, 'data');
  await fs.promises.mkdir(dataDir, { recursive: true });
  await execFileAsync('unzip', ['-q', '-o', zip, '-d', dataDir]);
  const entries = await fs.promises.readdir(dataDir, { recursive: true });
  const files = entries.map(f => path.join(dataDir, f)).filter(f => fs.existsSync(f) && fs.statSync(f).isFile());
  const find = name => files.find(f => ['.TXT', '.CSV', '.TSV'].some(ext => path.basename(f).toUpperCase() === name + ext)) || files.find(f => path.basename(f).toUpperCase() === name);
  const coverFile = find('COVERPAGE'); const infoFile = find('INFOTABLE'); const submissionFile = find('SUBMISSION');
  if (!coverFile || !infoFile || !submissionFile) throw new Error('SEC 13F ZIP missing expected files: ' + files.map(f => path.basename(f)).join(', '));
  const [stocks, submissions, coverpages] = await Promise.all([
    sql.query("SELECT id,symbol,company_name,cik FROM stocks WHERE is_active=true AND asset_type='stock'"),
    readMap(submissionFile, 'ACCESSION_NUMBER'),
    readMap(coverFile, 'ACCESSION_NUMBER')
  ]);
  const stockAliases = await sql.query(
    "SELECT si.stock_id,si.identifier_type,si.identifier_value FROM public.stock_identifiers si"
  );
  const nameMap = new Map();
  const symbolMap = new Map(stocks.map(s => [String(s.symbol || '').toUpperCase().trim(), s]).filter(([k]) => k));
  const cikMap = new Map(stocks.map(s => [String(s.cik || '').replace(/\D/g, '').replace(/^0+/, ''), s]).filter(([k]) => k));
  for (const alias of stockAliases) {
    const value = String(alias.identifier_value || '').trim();
    if (!value) continue;
    const target = stocks.find(s => Number(s.id) === Number(alias.stock_id));
    if (!target) continue;
    if (/cik/i.test(alias.identifier_type)) {
      const key = value.replace(/\D/g, '').replace(/^0+/, '');
      if (key && !cikMap.has(key)) cikMap.set(key, target);
    } else if (/ticker|symbol/i.test(alias.identifier_type)) {
      const key = value.toUpperCase();
      if (key && !symbolMap.has(key)) symbolMap.set(key, target);
    }
  }
  for (const stock of stocks) {
    const key = norm(stock.company_name);
    if (!key) continue;
    if (nameMap.has(key)) nameMap.set(key, null); else nameMap.set(key, stock);
  }
  const stockForIssuer = (issuer, issuerCik = null, issuerTicker = null) => {
    const cikKey = String(issuerCik || '').replace(/\D/g, '').replace(/^0+/, '');
    if (cikKey && cikMap.has(cikKey)) return cikMap.get(cikKey);
    const tickerKey = String(issuerTicker || '').toUpperCase().trim();
    if (tickerKey && symbolMap.has(tickerKey)) return symbolMap.get(tickerKey);
    const key = norm(issuer);
    if (!key) return null;
    if (nameMap.has(key)) return nameMap.get(key);
    let match = null;
    for (const [name, stock] of nameMap) {
      if (!stock || name.length < 7 || key.length < 7 || !(name.includes(key) || key.includes(name))) continue;
      if (match && match.id !== stock.id) return null;
      match = stock;
    }
    return match;
  };
  let scanned = 0, matched = 0, inserted = 0, unmatched = 0;
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const chunk = batch; batch = [];
    const payload = JSON.stringify(chunk);
    const q = "INSERT INTO institutional_holders(stock_id,holder_name,cik,period_end,shares_held,market_value,filing_date,data_source,created_at) " +
      "SELECT DISTINCT ON (v.stock_id,v.holder_name,v.period_end) v.stock_id,v.holder_name,v.cik,v.period_end,v.shares_held,v.market_value,v.filing_date,'SEC_13F_DATASET',NOW() " +
      "FROM jsonb_to_recordset($1::jsonb) AS v(stock_id bigint,holder_name text,cik text,period_end date,shares_held numeric,market_value numeric,filing_date date) " +
      "ORDER BY v.stock_id,v.holder_name,v.period_end,v.market_value DESC NULLS LAST " +
      "ON CONFLICT (stock_id,holder_name,period_end) DO UPDATE SET cik=EXCLUDED.cik,shares_held=EXCLUDED.shares_held,market_value=EXCLUDED.market_value,filing_date=EXCLUDED.filing_date,data_source=EXCLUDED.data_source,created_at=NOW() " +
      "RETURNING stock_id";
    const result = await sql.query(q, [payload]);
    inserted += result.length;
  };
  for await (const row of rows(infoFile)) {
    scanned++;
    const accession = row.ACCESSION_NUMBER;
    const cover = coverpages.get(accession);
    const sub = submissions.get(accession);
    if (!cover || !sub) continue;
    const issuer = row.NAMEOFISSUER;
    const issuerCik = row.ISSUERCIK || row.CIKOFISSUER || row.ISSUER_CIK || row.CIK || null;
    const issuerTicker = row.TICKER || row.SYMBOL || row.TICKER_SYMBOL || null;
    const stock = stockForIssuer(issuer, issuerCik, issuerTicker);
    const shares = Number(String(row.SSHPRNAMT || '').replace(/,/g, ''));
    const val = Number(String(row.VALUE || '').replace(/,/g, ''));
    if (!stock || !issuer || !Number.isFinite(shares) || shares <= 0) { unmatched++; continue; }
    const period = date(cover.REPORTCALENDARORQUARTER) || date(sub.PERIODOFREPORT);
    const filed = date(sub.FILING_DATE);
    if (!period) continue;
    batch.push({
      stock_id: Number(stock.id),
      holder_name: cover.FILINGMANAGER_NAME || ('13F filer ' + sub.CIK),
      cik: String(sub.CIK || '').replace(/^0+/, '') || null,
      period_end: period,
      shares_held: shares,
      market_value: Number.isFinite(val) && val >= 0 ? val * 1000 : null,
      filing_date: filed
    });
    matched++;
    if (batch.length >= 200) await flush();
    if (scanned % 500000 === 0) console.log(JSON.stringify({ scanned, matched, inserted, unmatched }));
  }
  await flush();
  const snapshots = await sql.query(
    "WITH latest_period AS (" +
    " SELECT stock_id,MAX(period_end) AS period_end FROM institutional_holders GROUP BY stock_id" +
    "), inst AS (" +
    " SELECT h.stock_id,h.period_end,SUM(h.shares_held) AS institutional_shares," +
    " jsonb_agg(jsonb_build_object('holder_name',h.holder_name,'cik',h.cik,'shares_held',h.shares_held,'market_value',h.market_value,'period_end',h.period_end) ORDER BY h.market_value DESC NULLS LAST) AS top_holders" +
    " FROM institutional_holders h JOIN latest_period lp ON lp.stock_id=h.stock_id AND lp.period_end=h.period_end GROUP BY h.stock_id,h.period_end" +
    "), insider_latest AS (" +
    " SELECT DISTINCT ON (stock_id,LOWER(COALESCE(insider_name,''))) stock_id,insider_name,shares_owned_after,transaction_date,filing_date" +
    " FROM insider_transactions WHERE shares_owned_after>0 ORDER BY stock_id,LOWER(COALESCE(insider_name,'')),transaction_date DESC NULLS LAST,filing_date DESC NULLS LAST" +
    "), insider AS (" +
    " SELECT stock_id,SUM(shares_owned_after) AS insider_shares FROM insider_latest GROUP BY stock_id" +
    "), cap AS (" +
    " SELECT DISTINCT ON (stock_id) stock_id,shares_outstanding FROM fundamentals" +
    " WHERE shares_outstanding>0 ORDER BY stock_id,report_date DESC NULLS LAST" +
    ") " +
    "INSERT INTO ownership_snapshots(stock_id,period_end,shares_outstanding,institutional_ownership_percent,insider_ownership_percent,float_shares,data_source,created_at,institutional_shares,insider_shares,top_holders) " +
    "SELECT i.stock_id,i.period_end,c.shares_outstanding," +
    " CASE WHEN c.shares_outstanding>0 THEN i.institutional_shares/c.shares_outstanding*100 ELSE NULL END," +
    " CASE WHEN c.shares_outstanding>0 AND x.insider_shares>0 THEN x.insider_shares/c.shares_outstanding*100 ELSE NULL END," +
    " NULL,'SEC_13F_DATASET+SEC_FORM_3_4_5',NOW(),i.institutional_shares,x.insider_shares,i.top_holders " +
    "FROM inst i LEFT JOIN cap c ON c.stock_id=i.stock_id LEFT JOIN insider x ON x.stock_id=i.stock_id " +
    "ON CONFLICT (stock_id,period_end) DO UPDATE SET " +
    "shares_outstanding=COALESCE(EXCLUDED.shares_outstanding,ownership_snapshots.shares_outstanding)," +
    "institutional_ownership_percent=COALESCE(EXCLUDED.institutional_ownership_percent,ownership_snapshots.institutional_ownership_percent)," +
    "insider_ownership_percent=COALESCE(EXCLUDED.insider_ownership_percent,ownership_snapshots.insider_ownership_percent)," +
    "float_shares=COALESCE(EXCLUDED.float_shares,ownership_snapshots.float_shares)," +
    "institutional_shares=COALESCE(EXCLUDED.institutional_shares,ownership_snapshots.institutional_shares)," +
    "insider_shares=COALESCE(EXCLUDED.insider_shares,ownership_snapshots.insider_shares)," +
    "top_holders=COALESCE(EXCLUDED.top_holders,ownership_snapshots.top_holders)," +
    "data_source=EXCLUDED.data_source,created_at=NOW() RETURNING stock_id"
  );
  console.log(JSON.stringify({ source: 'SEC Form 13F quarterly dataset', dataset_url: url, stocks_in_universe: stocks.length, infotable_rows_scanned: scanned, matched_issuer_rows: matched, inserted_holdings: inserted, unmatched_rows: unmatched, ownership_snapshots_added: snapshots.length }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
