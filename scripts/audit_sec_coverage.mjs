import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL);
if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required');

const rows = await sql.query(`
WITH active AS (
  SELECT id FROM public.stocks WHERE is_active=true
),
coverage AS (
  SELECT 'sec_filings' AS dataset,
         (SELECT COUNT(*) FROM public.sec_filings)::bigint AS rows,
         (SELECT COUNT(DISTINCT stock_id) FROM public.sec_filings WHERE stock_id IS NOT NULL)::bigint AS stocks
  UNION ALL
  SELECT 'earnings',
         (SELECT COUNT(*) FROM public.earnings)::bigint,
         (SELECT COUNT(DISTINCT stock_id) FROM public.earnings WHERE stock_id IS NOT NULL)::bigint
  UNION ALL
  SELECT 'dividends',
         (SELECT COUNT(*) FROM public.dividends)::bigint,
         (SELECT COUNT(DISTINCT stock_id) FROM public.dividends WHERE stock_id IS NOT NULL)::bigint
  UNION ALL
  SELECT 'insider_transactions',
         (SELECT COUNT(*) FROM public.insider_transactions)::bigint,
         (SELECT COUNT(DISTINCT stock_id) FROM public.insider_transactions WHERE stock_id IS NOT NULL)::bigint
)
SELECT
  c.dataset,
  c.rows,
  c.stocks,
  (SELECT COUNT(*) FROM active)::bigint AS active_stocks,
  ((SELECT COUNT(*) FROM active) - c.stocks)::bigint AS missing_stocks,
  ROUND(100.0 * c.stocks / NULLIF((SELECT COUNT(*) FROM active),0), 2) AS coverage_pct
FROM coverage c
ORDER BY c.dataset
`);

console.log('SEC COVERAGE AUDIT');
console.table(rows);

const missing = await sql.query(`
SELECT s.symbol, s.company_name
FROM public.stocks s
WHERE s.is_active=true
  AND NOT EXISTS (SELECT 1 FROM public.sec_filings f WHERE f.stock_id=s.id)
ORDER BY s.symbol
LIMIT 100
`);
console.log('Sample stocks still missing SEC filings (max 100):');
console.table(missing);
