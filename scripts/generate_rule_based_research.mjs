import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required');
const sql = neon(process.env.NEON_DATABASE_URL);

console.log('[rule-research] Backfilling current-month research from verified database data (no AI/API spend).');
const monthly = await sql`
WITH active AS (
  SELECT id, symbol, company_name, sector, industry
  FROM stocks
  WHERE is_active = true AND asset_type = 'stock'
),
quote AS (
  SELECT DISTINCT ON (stock_id) stock_id, price, change_percent, quote_timestamp
  FROM latest_quotes
  ORDER BY stock_id, quote_timestamp DESC NULLS LAST, updated_at DESC
),
tech AS (
  SELECT DISTINCT ON (stock_id) stock_id, rsi, macd, sma_50, sma_200, trend, volatility
  FROM technical_indicators
  WHERE timeframe = '1d'
  ORDER BY stock_id, calculated_at DESC
),
fund AS (
  SELECT DISTINCT ON (stock_id) stock_id, fiscal_period, report_date, revenue, revenue_growth,
    eps, eps_growth, gross_margin, operating_margin, net_margin, pe_ratio, free_cash_flow, debt_equity
  FROM fundamentals
  ORDER BY stock_id, report_date DESC NULLS LAST, updated_at DESC
),
risk AS (
  SELECT DISTINCT ON (stock_id) stock_id, volatility, maximum_drawdown
  FROM risk_metrics
  ORDER BY stock_id, calculation_date DESC
),
month_prices AS (
  SELECT stock_id,
    (array_agg(close ORDER BY "timestamp" DESC))[1] AS latest_close,
    (array_agg(close ORDER BY "timestamp" ASC))[1] AS first_close
  FROM price_history
  WHERE timeframe = '1d' AND close > 0
    AND "timestamp" >= date_trunc('month', CURRENT_DATE)
  GROUP BY stock_id
),
recent_news AS (
  SELECT stock_id, count(*)::int AS n,
    jsonb_agg(title ORDER BY published_at DESC) FILTER (WHERE title IS NOT NULL) AS titles
  FROM (
    SELECT stock_id, title, published_at,
      row_number() OVER (PARTITION BY stock_id ORDER BY published_at DESC NULLS LAST) rn
    FROM news
    WHERE published_at >= CURRENT_DATE - INTERVAL '30 days'
  ) x
  WHERE rn <= 5
  GROUP BY stock_id
),
upcoming AS (
  SELECT DISTINCT ON (stock_id) stock_id, earnings_date
  FROM earnings
  WHERE earnings_date >= CURRENT_DATE
  ORDER BY stock_id, earnings_date ASC
),
source AS (
  SELECT a.id AS stock_id, date_trunc('month', CURRENT_DATE)::date AS research_month,
    CASE WHEN mp.first_close > 0 THEN (mp.latest_close / mp.first_close - 1) * 100 END AS month_return,
    CASE WHEN t.rsi IS NOT NULL OR t.macd IS NOT NULL OR t.trend IS NOT NULL
      THEN concat_ws(' ', 'Rule-based technical snapshot:',
        CASE WHEN t.trend IS NOT NULL THEN 'Trend: ' || t.trend || '.' END,
        CASE WHEN t.rsi IS NOT NULL THEN 'RSI(14): ' || round(t.rsi::numeric, 2)::text || '.' END,
        CASE WHEN t.macd IS NOT NULL THEN 'MACD: ' || round(t.macd::numeric, 4)::text || '.' END,
        CASE WHEN t.sma_50 IS NOT NULL AND t.sma_200 IS NOT NULL THEN
          CASE WHEN t.sma_50 > t.sma_200 THEN '50-day SMA is above 200-day SMA.' ELSE '50-day SMA is at or below 200-day SMA.' END END)
    END AS technical_summary,
    CASE WHEN f.stock_id IS NOT NULL THEN concat_ws(' ',
      'Latest fundamentals record (' || coalesce(f.fiscal_period, f.report_date::text, 'period unavailable') || ').',
      CASE WHEN f.revenue IS NOT NULL THEN 'Revenue: $' || round(f.revenue::numeric, 0)::text || '.' END,
      CASE WHEN f.revenue_growth IS NOT NULL THEN 'Revenue growth: ' || round(f.revenue_growth::numeric, 2)::text || '%.' END,
      CASE WHEN f.eps IS NOT NULL THEN 'EPS: $' || round(f.eps::numeric, 3)::text || '.' END,
      CASE WHEN f.eps_growth IS NOT NULL THEN 'EPS growth: ' || round(f.eps_growth::numeric, 2)::text || '%.' END,
      CASE WHEN f.gross_margin IS NOT NULL THEN 'Gross margin: ' || round(f.gross_margin::numeric, 2)::text || '%.' END,
      CASE WHEN f.operating_margin IS NOT NULL THEN 'Operating margin: ' || round(f.operating_margin::numeric, 2)::text || '%.' END,
      CASE WHEN f.net_margin IS NOT NULL THEN 'Net margin: ' || round(f.net_margin::numeric, 2)::text || '%.' END,
      CASE WHEN f.pe_ratio IS NOT NULL THEN 'P/E: ' || round(f.pe_ratio::numeric, 2)::text || '.' END,
      CASE WHEN f.free_cash_flow IS NOT NULL THEN 'Free cash flow: $' || round(f.free_cash_flow::numeric, 0)::text || '.' END)
    END AS fundamental_summary,
    CASE WHEN coalesce(n.n, 0) > 0 THEN 'Found ' || n.n::text || ' recent news headline(s) in the last 30 days. Latest: ' || coalesce(n.titles->>0, 'headline unavailable') ELSE 'No recent news headline found in the last 30 days.' END AS news_summary,
    CASE WHEN r.volatility IS NOT NULL OR r.maximum_drawdown IS NOT NULL OR f.debt_equity IS NOT NULL
      THEN concat_ws(' ',
        CASE WHEN r.volatility IS NOT NULL THEN 'Reported annualized volatility: ' || round(r.volatility::numeric, 2)::text || '%.' END,
        CASE WHEN r.maximum_drawdown IS NOT NULL THEN 'Recorded maximum drawdown: ' || round(r.maximum_drawdown::numeric, 2)::text || '%.' END,
        CASE WHEN f.debt_equity IS NOT NULL THEN 'Debt/equity: ' || round(f.debt_equity::numeric, 2)::text || '.' END)
    END AS risk_summary,
    CASE WHEN u.earnings_date IS NOT NULL THEN 'Next scheduled earnings date recorded in database: ' || u.earnings_date::text || '.' END AS catalyst_summary,
    coalesce(n.titles, '[]'::jsonb) AS key_events,
    md5(concat_ws('|', a.symbol, q.price, q.quote_timestamp, f.fiscal_period, f.report_date, f.revenue, f.eps, t.rsi, t.macd, n.titles::text)) AS source_hash
  FROM active a
  LEFT JOIN quote q ON q.stock_id = a.id
  LEFT JOIN tech t ON t.stock_id = a.id
  LEFT JOIN fund f ON f.stock_id = a.id
  LEFT JOIN risk r ON r.stock_id = a.id
  LEFT JOIN month_prices mp ON mp.stock_id = a.id
  LEFT JOIN recent_news n ON n.stock_id = a.id
  LEFT JOIN upcoming u ON u.stock_id = a.id
)
INSERT INTO monthly_stock_research (
  stock_id, research_month, price_change_percent, technical_summary, fundamental_summary,
  news_summary, risk_summary, catalyst_summary, key_events, model, source_data_hash, generated_at, updated_at
)
SELECT stock_id, research_month, month_return, technical_summary, fundamental_summary,
  news_summary, risk_summary, catalyst_summary, key_events, 'rule-based-v1 (not AI)', source_hash, now(), now()
FROM source
ON CONFLICT (stock_id, research_month) DO UPDATE SET
  price_change_percent = COALESCE(monthly_stock_research.price_change_percent, EXCLUDED.price_change_percent),
  technical_summary = COALESCE(monthly_stock_research.technical_summary, EXCLUDED.technical_summary),
  fundamental_summary = COALESCE(monthly_stock_research.fundamental_summary, EXCLUDED.fundamental_summary),
  news_summary = COALESCE(monthly_stock_research.news_summary, EXCLUDED.news_summary),
  risk_summary = COALESCE(monthly_stock_research.risk_summary, EXCLUDED.risk_summary),
  catalyst_summary = COALESCE(monthly_stock_research.catalyst_summary, EXCLUDED.catalyst_summary),
  key_events = CASE WHEN monthly_stock_research.key_events IS NULL OR monthly_stock_research.key_events = '[]'::jsonb THEN EXCLUDED.key_events ELSE monthly_stock_research.key_events END,
  model = COALESCE(monthly_stock_research.model, EXCLUDED.model),
  source_data_hash = COALESCE(monthly_stock_research.source_data_hash, EXCLUDED.source_data_hash),
  updated_at = now()
RETURNING stock_id
`;
console.log('[rule-research] monthly rows inserted/updated:', monthly.length);

const quarterly = await sql`
WITH active AS (
  SELECT id, symbol, company_name FROM stocks WHERE is_active = true AND asset_type = 'stock'
),
fund AS (
  SELECT DISTINCT ON (stock_id) stock_id, fiscal_period, report_date, revenue, revenue_growth,
    eps, eps_growth, gross_margin, operating_margin, net_margin, pe_ratio, free_cash_flow, debt_equity
  FROM fundamentals
  WHERE fiscal_period IS NOT NULL
  ORDER BY stock_id, report_date DESC NULLS LAST, updated_at DESC
),
earn AS (
  SELECT DISTINCT ON (stock_id) stock_id, earnings_date, fiscal_period, eps_actual, eps_surprise,
    revenue_actual, revenue_surprise, data_source
  FROM earnings
  ORDER BY stock_id, earnings_date DESC NULLS LAST, created_at DESC
),
risk AS (
  SELECT DISTINCT ON (stock_id) stock_id, volatility, maximum_drawdown
  FROM risk_metrics ORDER BY stock_id, calculation_date DESC
),
recent_headline AS (
  SELECT stock_id, title FROM (
    SELECT stock_id, title, row_number() OVER (PARTITION BY stock_id ORDER BY published_at DESC NULLS LAST) rn
    FROM news WHERE published_at >= CURRENT_DATE - INTERVAL '30 days'
  ) n WHERE rn = 1
),
source AS (
  SELECT a.id stock_id, f.fiscal_period, f.report_date,
    concat_ws(' ',
      'Latest reported fundamentals for fiscal period ' || f.fiscal_period || '.',
      CASE WHEN f.revenue IS NOT NULL THEN 'Revenue: $' || round(f.revenue::numeric, 0)::text || '.' END,
      CASE WHEN f.revenue_growth IS NOT NULL THEN 'Revenue growth: ' || round(f.revenue_growth::numeric, 2)::text || '%.' END,
      CASE WHEN f.eps IS NOT NULL THEN 'EPS: $' || round(f.eps::numeric, 3)::text || '.' END,
      CASE WHEN f.eps_growth IS NOT NULL THEN 'EPS growth: ' || round(f.eps_growth::numeric, 2)::text || '%.' END,
      CASE WHEN f.gross_margin IS NOT NULL THEN 'Gross margin: ' || round(f.gross_margin::numeric, 2)::text || '%.' END,
      CASE WHEN f.operating_margin IS NOT NULL THEN 'Operating margin: ' || round(f.operating_margin::numeric, 2)::text || '%.' END,
      CASE WHEN f.net_margin IS NOT NULL THEN 'Net margin: ' || round(f.net_margin::numeric, 2)::text || '%.' END,
      CASE WHEN f.free_cash_flow IS NOT NULL THEN 'Free cash flow: $' || round(f.free_cash_flow::numeric, 0)::text || '.' END) financial_summary,
    CASE WHEN e.stock_id IS NOT NULL THEN concat_ws(' ',
      'Latest earnings record dated ' || coalesce(e.earnings_date::text, 'date unavailable') || '.',
      CASE WHEN e.eps_actual IS NOT NULL THEN 'EPS actual: $' || round(e.eps_actual::numeric, 3)::text || '.' END,
      CASE WHEN e.eps_surprise IS NOT NULL THEN 'EPS surprise: ' || round(e.eps_surprise::numeric, 2)::text || '%.' END,
      CASE WHEN e.revenue_actual IS NOT NULL THEN 'Revenue actual: $' || round(e.revenue_actual::numeric, 0)::text || '.' END,
      CASE WHEN e.revenue_surprise IS NOT NULL THEN 'Revenue surprise: ' || round(e.revenue_surprise::numeric, 2)::text || '%.' END)
    ELSE 'Earnings actuals or estimates are unavailable in the current database record.' END earnings_summary,
    CASE WHEN r.volatility IS NOT NULL OR r.maximum_drawdown IS NOT NULL OR f.debt_equity IS NOT NULL
      THEN concat_ws(' ',
        CASE WHEN r.volatility IS NOT NULL THEN 'Annualized volatility: ' || round(r.volatility::numeric, 2)::text || '%.' END,
        CASE WHEN r.maximum_drawdown IS NOT NULL THEN 'Maximum drawdown: ' || round(r.maximum_drawdown::numeric, 2)::text || '%.' END,
        CASE WHEN f.debt_equity IS NOT NULL THEN 'Debt/equity: ' || round(f.debt_equity::numeric, 2)::text || '.' END)
    END risks_summary,
    CASE WHEN u.earnings_date IS NOT NULL THEN 'Next scheduled earnings date recorded in database: ' || u.earnings_date::text || '.' END catalysts_summary,
    CASE WHEN n.title IS NOT NULL THEN 'Recent headline: ' || n.title ELSE 'No recent headline found in the last 30 days.' END yoy_summary,
    md5(concat_ws('|',a.symbol,f.fiscal_period,f.report_date,f.revenue,f.eps,e.earnings_date,e.eps_actual,e.revenue_actual,n.title)) source_hash
  FROM active a
  JOIN fund f ON f.stock_id = a.id
  LEFT JOIN earn e ON e.stock_id = a.id
  LEFT JOIN risk r ON r.stock_id = a.id
  LEFT JOIN recent_headline n ON n.stock_id = a.id
  LEFT JOIN LATERAL (
    SELECT earnings_date FROM earnings x WHERE x.stock_id=a.id AND x.earnings_date>=CURRENT_DATE ORDER BY x.earnings_date ASC LIMIT 1
  ) u ON true
)
INSERT INTO quarterly_stock_research (
 stock_id, fiscal_period, period_end, earnings_summary, financial_summary, risks_summary,
 catalysts_summary, yoy_summary, model, source_data_hash, generated_at, updated_at
)
SELECT stock_id, fiscal_period, report_date, earnings_summary, financial_summary, risks_summary,
 catalysts_summary, yoy_summary, 'rule-based-v1 (not AI)', source_hash, now(), now()
FROM source
ON CONFLICT (stock_id, fiscal_period) DO UPDATE SET
 period_end = COALESCE(quarterly_stock_research.period_end, EXCLUDED.period_end),
 earnings_summary = COALESCE(quarterly_stock_research.earnings_summary, EXCLUDED.earnings_summary),
 financial_summary = COALESCE(quarterly_stock_research.financial_summary, EXCLUDED.financial_summary),
 risks_summary = COALESCE(quarterly_stock_research.risks_summary, EXCLUDED.risks_summary),
 catalysts_summary = COALESCE(quarterly_stock_research.catalysts_summary, EXCLUDED.catalysts_summary),
 yoy_summary = COALESCE(quarterly_stock_research.yoy_summary, EXCLUDED.yoy_summary),
 model = COALESCE(quarterly_stock_research.model, EXCLUDED.model),
 source_data_hash = COALESCE(quarterly_stock_research.source_data_hash, EXCLUDED.source_data_hash),
 updated_at = now()
RETURNING stock_id
`;
console.log('[rule-research] quarterly rows inserted/updated:', quarterly.length);
