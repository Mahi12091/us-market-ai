import { neon } from '@neondatabase/serverless';

const url = process.env.NEON_DATABASE_URL;
if (!url) throw new Error('NEON_DATABASE_URL is not configured.');

const sql = neon(url);
const counts = await sql.query(`
  SELECT
    COUNT(*) FILTER (WHERE asset_type='stock') AS stock_rows,
    COUNT(*) FILTER (WHERE asset_type='stock' AND is_active) AS active_stocks,
    COUNT(*) FILTER (WHERE asset_type='stock' AND is_active AND is_indexable) AS active_indexable_stocks,
    COUNT(*) FILTER (WHERE asset_type='etf' AND is_active) AS active_etfs,
    COUNT(DISTINCT symbol) AS distinct_symbols
  FROM public.stocks
`);

const duplicates = await sql.query(`
  SELECT symbol, COUNT(*) AS copies
  FROM public.stocks
  GROUP BY symbol
  HAVING COUNT(*) > 1
  ORDER BY copies DESC, symbol
  LIMIT 20
`);

console.log(JSON.stringify({
  database: 'Neon',
  counts: counts[0] ?? null,
  duplicate_symbols: duplicates,
  target_reached: Number(counts[0]?.active_indexable_stocks ?? 0) >= 2000,
}, null, 2));

if (Number(counts[0]?.active_indexable_stocks ?? 0) < 2000) {
  throw new Error('Fewer than 2,000 active/indexable stocks are present in Neon.');
}
if (duplicates.length) {
  throw new Error(`Duplicate stock symbols detected: ${duplicates.map((x) => x.symbol).join(', ')}`);
}
