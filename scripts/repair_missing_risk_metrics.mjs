import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required.');
const sql = neon(process.env.NEON_DATABASE_URL);

console.log('[risk-repair] calculating trailing 252-session Sharpe/Sortino from adjusted close (fallback: close).');
const result = await sql.query(`
WITH price_rows AS (
  SELECT
    p.stock_id,
    p.timestamp::date AS price_date,
    COALESCE(p.adjusted_close, p.close)::double precision AS price,
    LAG(COALESCE(p.adjusted_close, p.close)::double precision)
      OVER (PARTITION BY p.stock_id ORDER BY p.timestamp) AS previous_price
  FROM public.price_history p
  JOIN public.stocks s ON s.id = p.stock_id
  WHERE s.is_active IS TRUE
    AND s.asset_type = 'stock'
    AND p.timeframe = '1d'
    AND COALESCE(p.adjusted_close, p.close) > 0
),
daily_returns AS (
  SELECT stock_id, price_date,
         (price / previous_price) - 1.0 AS daily_return
  FROM price_rows
  WHERE previous_price > 0
),
rolling AS (
  SELECT
    stock_id,
    price_date,
    COUNT(daily_return) OVER w AS observations,
    AVG(daily_return) OVER w AS avg_return,
    STDDEV_SAMP(daily_return) OVER w AS return_stddev,
    SQRT(AVG(POWER(LEAST(daily_return, 0.0), 2)) OVER w) AS downside_deviation
  FROM daily_returns
  WINDOW w AS (
    PARTITION BY stock_id
    ORDER BY price_date
    ROWS BETWEEN 251 PRECEDING AND CURRENT ROW
  )
),
computed AS (
  SELECT
    stock_id,
    price_date,
    CASE WHEN observations >= 60 AND return_stddev > 0
      THEN (avg_return / return_stddev) * SQRT(252.0) END AS sharpe_ratio,
    CASE WHEN observations >= 60 AND downside_deviation > 0
      THEN (avg_return / downside_deviation) * SQRT(252.0) END AS sortino_ratio
  FROM rolling
),
updated AS (
  UPDATE public.risk_metrics r
  SET sharpe_ratio = COALESCE(r.sharpe_ratio, c.sharpe_ratio),
      sortino_ratio = COALESCE(r.sortino_ratio, c.sortino_ratio),
      methodology_version = COALESCE(r.methodology_version, 'price-return-252d-v1'),
      data_source = COALESCE(r.data_source, 'price_history adjusted_close/close'),
      created_at = COALESCE(r.created_at, now())
  FROM computed c
  WHERE r.stock_id = c.stock_id
    AND r.calculation_date = c.price_date
    AND (r.sharpe_ratio IS NULL OR r.sortino_ratio IS NULL)
    AND (c.sharpe_ratio IS NOT NULL OR c.sortino_ratio IS NOT NULL)
  RETURNING r.stock_id
)
SELECT COUNT(*)::int AS risk_rows_updated,
       COUNT(DISTINCT stock_id)::int AS stocks_updated
FROM updated
`);
console.log(JSON.stringify({ method: '252-session annualized daily-return ratios; risk-free rate assumed 0; no synthetic prices', ...result[0] }, null, 2));

const audit = await sql.query(`
SELECT
  COUNT(*) FILTER (WHERE sharpe_ratio IS NULL) AS missing_sharpe_rows,
  COUNT(*) FILTER (WHERE sortino_ratio IS NULL) AS missing_sortino_rows,
  COUNT(*) FILTER (WHERE sharpe_ratio IS NULL OR sortino_ratio IS NULL) AS rows_missing_either
FROM public.risk_metrics
`);
console.log('[risk-repair] remaining risk metric gaps:', JSON.stringify(audit[0]));
