import { neon } from '@neondatabase/serverless';

const url = process.env.NEON_DATABASE_URL;
if (!url) throw new Error('NEON_DATABASE_URL is not configured.');
const sql = neon(url);

const tables = await sql.query(`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);
console.log('=== TABLE ROW COUNTS ===');
for (const row of tables) {
  const table = row.table_name;
  try {
    const result = await sql.query(`SELECT COUNT(*)::bigint AS rows FROM public."${table.replace(/"/g, '""')}"`);
    console.log(JSON.stringify({ table, rows: String(result[0].rows) }));
  } catch (e) {
    console.log(JSON.stringify({ table, error: e.message }));
  }
}

const stockColumns = await sql.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='stocks'
  ORDER BY ordinal_position
`);
console.log('=== STOCKS TABLE COLUMN AUDIT ===');
console.log(JSON.stringify({ columns: stockColumns.map(c => ({name:c.column_name,type:c.data_type})) }));

const exists = new Set(stockColumns.map(c => c.column_name));
const activeFilter = exists.has('is_active') && exists.has('asset_type')
  ? "WHERE is_active IS TRUE AND asset_type = 'stock'"
  : exists.has('is_active') ? 'WHERE is_active IS TRUE' : '';
const countResult = await sql.query(`SELECT COUNT(*)::bigint AS total FROM public.stocks ${activeFilter}`);
const total = Number(countResult[0].total);
console.log(JSON.stringify({ audit: 'stocks', active_stock_rows: total }));

const fields = [];
for (const c of stockColumns) {
  if (['id','created_at','updated_at','is_active','asset_type'].includes(c.column_name)) continue;
  const name = c.column_name.replace(/"/g, '""');
  const textType = ['text','character varying','character','USER-DEFINED'].includes(c.data_type);
  const empty = textType
    ? `NULLIF(BTRIM("${name}"::text), '') IS NULL`
    : `"${name}" IS NULL`;
  fields.push({name:c.column_name, type:c.data_type, empty});
}
const select = fields.map((f, i) =>
  `COUNT(*) FILTER (WHERE ${f.empty})::bigint AS c${i}`
).join(',\n');
if (fields.length) {
  const rows = await sql.query(`SELECT ${select} FROM public.stocks ${activeFilter}`);
  const missing = fields.map((f, i) => ({ field:f.name, type:f.type, missing:Number(rows[0][`c${i}`]), filled:total-Number(rows[0][`c${i}`]), coverage_pct:total ? Number(((total-Number(rows[0][`c${i}`]))/total*100).toFixed(2)) : 0 }))
    .sort((a,b) => b.missing-a.missing);
  console.log('=== MISSING STOCK FIELDS (ACTIVE STOCKS) ===');
  console.log(JSON.stringify(missing, null, 2));
}

const knownTables = ['stock_fundamentals','fundamentals','financial_statements','technical_indicators','risk_metrics','predictions','long_term_predictions','institutional_holders','insider_transactions','earnings','dividends','news','sec_filings','daily_prices','stock_prices','quotes'];
const actualNames = new Set(tables.map(t => t.table_name));
console.log('=== STOCK DATA TABLE COVERAGE ===');
for (const table of knownTables.filter(t => actualNames.has(t))) {
  const cols = await sql.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1
  `, [table]);
  const colNames = new Set(cols.map(c => c.column_name));
  const symbolCol = ['symbol','ticker','stock_symbol'].find(c => colNames.has(c));
  const fkCol = ['stock_id','stocks_id'].find(c => colNames.has(c));
  let coverage = null;
  try {
    if (symbolCol) {
      const result = await sql.query(`SELECT COUNT(*)::bigint AS rows, COUNT(DISTINCT "${symbolCol}")::bigint AS distinct_symbols FROM public."${table}"`);
      coverage = {rows:String(result[0].rows),distinct_symbols:String(result[0].distinct_symbols),key:symbolCol};
    } else if (fkCol) {
      const result = await sql.query(`SELECT COUNT(*)::bigint AS rows, COUNT(DISTINCT "${fkCol}")::bigint AS distinct_stock_ids FROM public."${table}"`);
      coverage = {rows:String(result[0].rows),distinct_stock_ids:String(result[0].distinct_stock_ids),key:fkCol};
    }
  } catch (e) { coverage = {error:e.message}; }
  console.log(JSON.stringify({table,columns:[...colNames],coverage}));
}
