import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required.');
const sql = neon(process.env.NEON_DATABASE_URL);

console.log('[beta-repair] calculating missing 252-session beta against SPY; withholding absolute beta estimates above 10 for review.');
const result = await sql.query(`
WITH targets AS (
  SELECT r.stock_id, r.calculation_date
  FROM public.risk_metrics r
  JOIN public.stocks s ON s.id = r.stock_id
  WHERE r.beta IS NULL
    AND s.is_active IS TRUE
    AND s.asset_type = 'stock'
),
bounds AS (
  SELECT MIN(calculation_date) AS min_date, MAX(calculation_date) AS max_date
  FROM targets
),
price_rows AS (
  SELECT
    p.stock_id,
    p.timestamp::date AS price_date,
    COALESCE(p.adjusted_close, p.close)::double precision AS price
  FROM public.price_history p
  JOIN public.stocks s ON s.id = p.stock_id
  CROSS JOIN bounds b
  WHERE p.timeframe = '1d'
    AND COALESCE(p.adjusted_close, p.close) > 0
    AND p.timestamp::date >= b.min_date - 370
    AND p.timestamp::date <= b.max_date
    AND (
      p.stock_id = 201
      OR (s.is_active IS TRUE AND s.asset_type = 'stock'
          AND EXISTS (SELECT 1 FROM targets t WHERE t.stock_id = p.stock_id))
    )
),
daily_returns AS (
  SELECT
    stock_id,
    price_date,
    price / NULLIF(LAG(price) OVER (PARTITION BY stock_id ORDER BY price_date), 0) - 1.0 AS daily_return
  FROM price_rows
),
benchmark AS (
  SELECT price_date, daily_return AS market_return
  FROM daily_returns
  WHERE stock_id = 201 AND daily_return IS NOT NULL
),
paired_returns AS (
  SELECT r.stock_id, r.price_date, r.daily_return AS stock_return, b.market_return
  FROM daily_returns r
  JOIN benchmark b USING (price_date)
  WHERE r.stock_id <> 201
    AND r.daily_return IS NOT NULL
),
beta_estimates AS (
  SELECT
    t.stock_id,
    t.calculation_date,
    COUNT(*)::int AS observations,
    (
      AVG(p.stock_return * p.market_return)
      - AVG(p.stock_return) * AVG(p.market_return)
    ) / NULLIF(
      AVG(p.market_return * p.market_return)
      - AVG(p.market_return) * AVG(p.market_return),
      0
    ) AS beta
  FROM targets t
  JOIN paired_returns p
    ON p.stock_id = t.stock_id
   AND p.price_date <= t.calculation_date
   AND p.price_date >= t.calculation_date - 370
  GROUP BY t.stock_id, t.calculation_date
),
updated AS (
  UPDATE public.risk_metrics r
  SET beta = e.beta,
      methodology_version = CASE
        WHEN COALESCE(r.methodology_version, '') = '' THEN 'beta-spy-252d-v1'
        WHEN POSITION('beta-spy-252d-v1' IN r.methodology_version) > 0 THEN r.methodology_version
        ELSE r.methodology_version || '+beta-spy-252d-v1'
      END,
      data_source = CASE
        WHEN COALESCE(r.data_source, '') = '' THEN 'price_history adjusted_close/close; benchmark SPY'
        WHEN POSITION('benchmark SPY' IN r.data_source) > 0 THEN r.data_source
        ELSE r.data_source || '; beta benchmark SPY from price_history'
      END
  FROM beta_estimates e
  WHERE r.stock_id = e.stock_id
    AND r.calculation_date = e.calculation_date
    AND r.beta IS NULL
    AND e.observations >= 60
    AND e.beta IS NOT NULL
    AND ABS(e.beta) <= 10
  RETURNING r.stock_id
)
SELECT COUNT(*)::int AS risk_rows_updated,
       COUNT(DISTINCT stock_id)::int AS stocks_updated
FROM updated
`);
console.log(JSON.stringify({
  method: 'Population covariance(stock daily returns, SPY daily returns) / population variance(SPY daily returns); up to 252-session lookback, minimum 60 matched daily returns; adjusted_close fallback to close; no synthetic prices; estimates with absolute beta above 10 withheld',
  ...result[0]
}, null, 2));

const audit = await sql.query(`
SELECT
  COUNT(*)::int AS total_risk_rows,
  COUNT(beta)::int AS beta_populated_rows,
  COUNT(*) FILTER (WHERE beta IS NULL)::int AS beta_missing_rows
FROM public.risk_metrics r
JOIN public.stocks s ON s.id = r.stock_id
WHERE s.is_active IS TRUE AND s.asset_type = 'stock'
`);
console.log('[beta-repair] remaining beta gaps:', JSON.stringify(audit[0]));
