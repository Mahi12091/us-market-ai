import { neon } from '@neondatabase/serverless';

const required = ['MASSIVE_API_KEY', 'NEON_DATABASE_URL'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured.`);

const sql = neon(process.env.NEON_DATABASE_URL);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function massive(path) {
  const u = new URL(path, 'https://api.massive.com');
  u.searchParams.set('apiKey', process.env.MASSIVE_API_KEY);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const r = await fetch(u);
    const t = await r.text();
    if (r.ok) return t ? JSON.parse(t) : {};
    if (![408,429,500,502,503,504].includes(r.status) || attempt === 5) throw new Error(`Massive ${r.status}: ${t.slice(0,500)}`);
    await sleep(r.status === 429 ? 65000 : Math.min(15000, 2000 * 2 ** (attempt - 1)));
  }
  return {};
}

const stocks = await sql.query(`SELECT id,symbol FROM public.stocks WHERE is_active=true AND asset_type='stock' ORDER BY id`);
const ids = new Map(stocks.map((s) => [String(s.symbol).toUpperCase(), Number(s.id)]));
const data = await massive('/stocks/v1/dividends?ticker=*&limit=5000&sort=ex_dividend_date.desc');
const results = data.results || [];

let written = 0;
for (let i = 0; i < results.length; i += 500) {
  const rows = results.slice(i, i + 500)
    .filter((d) => ids.has(String(d.ticker || '').toUpperCase()) && d.ex_dividend_date)
    .map((d) => ({
      stock_id: ids.get(String(d.ticker).toUpperCase()),
      ex_date: d.ex_dividend_date || null,
      record_date: d.record_date || null,
      payment_date: d.pay_date || null,
      declaration_date: d.declaration_date || null,
      amount: d.cash_amount ?? null,
      frequency: d.frequency != null ? String(d.frequency) : null,
      currency: d.currency || 'USD',
      data_source: 'Massive /stocks/v1/dividends',
    }));
  for (const row of rows) {
    await sql.query(
      `INSERT INTO public.dividends
       (stock_id,ex_date,record_date,payment_date,declaration_date,amount,frequency,currency,data_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (stock_id,ex_date,payment_date,amount) DO UPDATE SET
         record_date=EXCLUDED.record_date,
         declaration_date=EXCLUDED.declaration_date,
         frequency=EXCLUDED.frequency,
         currency=EXCLUDED.currency,
         data_source=EXCLUDED.data_source`,
      [row.stock_id,row.ex_date,row.record_date,row.payment_date,row.declaration_date,row.amount,row.frequency,row.currency,row.data_source],
    );
    written += 1;
  }
}

console.log(JSON.stringify({mode:'dividend-sync-neon',stocks:ids.size,api_rows:results.length,written,source:'Massive /stocks/v1/dividends'},null,2));
