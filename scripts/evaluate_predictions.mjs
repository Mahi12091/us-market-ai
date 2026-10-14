import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.NEON_DATABASE_URL;
if (!databaseUrl) throw new Error('NEON_DATABASE_URL is required.');
const sql = neon(databaseUrl);

// Evaluate only predictions whose target horizon has elapsed and whose target price
// exists in stored daily history. Missing actual prices remain unevaluated.
const rows = await sql.query(`
WITH mature AS (
  SELECT p.*,
    p.prediction_time + CASE p.horizon
      WHEN '24h' THEN interval '24 hours'
      WHEN '7d' THEN interval '7 days'
      WHEN '30d' THEN interval '30 days'
      WHEN '90d' THEN interval '90 days'
    END AS target_ts
  FROM public.predictions p
  WHERE p.horizon IN ('24h', '7d', '30d', '90d')
    AND p.current_price > 0
    AND p.predicted_price > 0
    AND p.prediction_time + CASE p.horizon
      WHEN '24h' THEN interval '24 hours'
      WHEN '7d' THEN interval '7 days'
      WHEN '30d' THEN interval '30 days'
      WHEN '90d' THEN interval '90 days'
    END <= now()
),
priced AS (
  SELECT m.id AS prediction_id, m.stock_id, m.horizon, m.prediction_time,
    m.target_ts, m.current_price, m.predicted_price, m.predicted_change_percent,
    m.direction, m.model_name, m.model_version, actual.timestamp AS actual_timestamp,
    actual.close AS actual_price
  FROM mature m
  JOIN LATERAL (
    SELECT h.timestamp, h.close
    FROM public.price_history h
    WHERE h.stock_id = m.stock_id
      AND h.timeframe = '1d'
      AND h.timestamp >= m.target_ts
      AND h.close > 0
    ORDER BY h.timestamp ASC
    LIMIT 1
  ) actual ON true
)
INSERT INTO public.prediction_results (
  prediction_id, stock_id, horizon, predicted_price, actual_price,
  predicted_direction, actual_direction, absolute_error, percentage_error,
  hit, evaluated_at, model_name, model_version, prediction_date, target_date
)
SELECT p.prediction_id, p.stock_id, p.horizon, p.predicted_price, p.actual_price,
  COALESCE(NULLIF(p.direction, ''), CASE
    WHEN p.predicted_change_percent > 1.5 THEN 'bullish'
    WHEN p.predicted_change_percent < -1.5 THEN 'bearish'
    ELSE 'neutral'
  END),
  CASE
    WHEN (p.actual_price / p.current_price - 1) > 0.015 THEN 'bullish'
    WHEN (p.actual_price / p.current_price - 1) < -0.015 THEN 'bearish'
    ELSE 'neutral'
  END,
  abs(p.predicted_price - p.actual_price),
  abs((p.predicted_price - p.actual_price) / p.actual_price) * 100,
  COALESCE(NULLIF(p.direction, ''), CASE
    WHEN p.predicted_change_percent > 1.5 THEN 'bullish'
    WHEN p.predicted_change_percent < -1.5 THEN 'bearish'
    ELSE 'neutral'
  END) = CASE
    WHEN (p.actual_price / p.current_price - 1) > 0.015 THEN 'bullish'
    WHEN (p.actual_price / p.current_price - 1) < -0.015 THEN 'bearish'
    ELSE 'neutral'
  END,
  now(), p.model_name, p.model_version, p.prediction_time::date, p.target_ts::date
FROM priced p
WHERE NOT EXISTS (
  SELECT 1 FROM public.prediction_results r WHERE r.prediction_id = p.prediction_id
)
RETURNING prediction_id
`);
console.log(JSON.stringify({
  mode: 'prediction-evaluation',
  newly_evaluated: rows.length,
  note: 'Only matured horizons with a stored daily close at or after the target timestamp are evaluated.'
}, null, 2));
