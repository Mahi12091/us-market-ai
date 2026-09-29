import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is not configured.');
const sql = neon(process.env.NEON_DATABASE_URL);

const qid = (x) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(x)) throw new Error(`Unsafe identifier: ${x}`);
  return `"${x}"`;
};

async function query(table, columns = '*', where = [], order = '', limit = 5000) {
  const values = [];
  const filters = where.map(([column, op, value]) => {
    values.push(value);
    return `${qid(column)} ${op} $${values.length}`;
  });
  let text = `SELECT ${columns === '*' ? '*' : columns.split(',').map((x) => qid(x.trim())).join(',')} FROM ${qid(table)}`;
  if (filters.length) text += ` WHERE ${filters.join(' AND ')}`;
  if (order) text += ` ORDER BY ${order}`;
  text += ` LIMIT ${Math.max(1, Number(limit))}`;
  return sql.query(text, values);
}

async function insertPredictions(rows) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const values = [];
  const tuples = rows.map((row) => `(${keys.map((key) => { values.push(row[key] ?? null); return `$${values.length}`; }).join(',')})`).join(',');
  await sql.query(`INSERT INTO "predictions" (${keys.map(qid).join(',')}) VALUES ${tuples}`, values);
}

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const clamp = (v, min = -1, max = 1) => Math.max(min, Math.min(max, v));
const scoreAround = (value, scale) => value == null ? null : clamp(value / scale);
const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

function factor(name, score, weight, value = null) {
  return score == null || !Number.isFinite(score) ? null : { name, score: clamp(score), weight, value };
}

function buildPrediction({ price, tech, fund, history, horizon }) {
  const current = price ?? history.at(-1)?.close;
  if (!(current > 0)) return null;

  const technical = [];
  const fundamental = [];
  const t = tech ?? {};
  const f = fund ?? {};

  const ema20 = n(t.ema_20), ema50 = n(t.ema_50), sma50 = n(t.sma_50), sma200 = n(t.sma_200);
  const rsi = n(t.rsi), macdHist = n(t.macd_histogram), momentum = n(t.momentum);
  const volatility = n(t.volatility), support = n(t.support_level), resistance = n(t.resistance_level);

  if (ema20) technical.push(factor('price-vs-ema20', scoreAround((current / ema20 - 1) * 100, 5), 1.20, current / ema20 - 1));
  if (ema50) technical.push(factor('price-vs-ema50', scoreAround((current / ema50 - 1) * 100, 8), 1.00, current / ema50 - 1));
  if (sma50) technical.push(factor('price-vs-sma50', scoreAround((current / sma50 - 1) * 100, 8), 0.90, current / sma50 - 1));
  if (sma200) technical.push(factor('price-vs-sma200', scoreAround((current / sma200 - 1) * 100, 12), 0.70, current / sma200 - 1));
  if (ema20 && ema50) technical.push(factor('ema-alignment', ema20 > ema50 ? 0.55 : -0.55, 0.90, ema20 - ema50));
  if (rsi != null) technical.push(factor('rsi-regime', rsi < 30 ? 0.75 : rsi > 70 ? -0.75 : (rsi - 50) / 20, 1.10, rsi));
  if (macdHist != null) technical.push(factor('macd-histogram', scoreAround((macdHist / current) * 100, 0.35), 1.10, macdHist));
  if (momentum != null) technical.push(factor('momentum', scoreAround(momentum, 10), 1.00, momentum));
  if (support && resistance && resistance > support) {
    const position = clamp(((current - support) / (resistance - support)) * 2 - 1);
    technical.push(factor('support-resistance-position', position, 0.50, (current - support) / (resistance - support)));
  }

  const revenueGrowth = n(f.revenue_growth);
  const epsGrowth = n(f.eps_growth);
  const roe = n(f.roe);
  const roa = n(f.roa);
  const debtEquity = n(f.debt_equity);
  const fcf = n(f.free_cash_flow);
  const revenue = n(f.revenue);
  const pe = n(f.pe_ratio);
  const peg = n(f.peg_ratio);

  if (revenueGrowth != null) fundamental.push(factor('revenue-growth', scoreAround(revenueGrowth, 20), 1.00, revenueGrowth));
  if (epsGrowth != null) fundamental.push(factor('eps-growth', scoreAround(epsGrowth, 25), 1.00, epsGrowth));
  if (roe != null) fundamental.push(factor('roe', scoreAround(roe, 20), 0.85, roe));
  if (roa != null) fundamental.push(factor('roa', scoreAround(roa, 10), 0.55, roa));
  if (revenue > 0 && fcf != null) fundamental.push(factor('fcf-margin', scoreAround((fcf / revenue) * 100, 20), 0.80, fcf / revenue));
  if (debtEquity != null) fundamental.push(factor('leverage', scoreAround(1 - debtEquity, 1), 0.70, debtEquity));
  // Valuation is deliberately low-weight because sector differences can make raw multiples misleading.
  if (pe != null && pe > 0) fundamental.push(factor('pe-valuation', clamp((25 - pe) / 25), 0.35, pe));
  if (peg != null && peg > 0) fundamental.push(factor('peg-valuation', clamp((1.8 - peg) / 1.8), 0.30, peg));

  const cleanTechnical = technical.filter(Boolean);
  const cleanFundamental = fundamental.filter(Boolean);
  if (!cleanTechnical.length && !cleanFundamental.length) return null;

  const weighted = (items) => {
    const total = items.reduce((s, x) => s + x.weight, 0);
    return total ? items.reduce((s, x) => s + x.score * x.weight, 0) / total : null;
  };

  const technicalScore = weighted(cleanTechnical);
  const fundamentalScore = weighted(cleanFundamental);
  const technicalWeight = technicalScore == null ? 0 : 0.65;
  const fundamentalWeight = fundamentalScore == null ? 0 : 0.35;
  const weightTotal = technicalWeight + fundamentalWeight;
  const combinedScore = weightTotal ? ((technicalScore ?? 0) * technicalWeight + (fundamentalScore ?? 0) * fundamentalWeight) / weightTotal : 0;

  const allFactors = [...cleanTechnical, ...cleanFundamental];
  const agreement = allFactors.length ? 1 - Math.min(1, avg(allFactors.map((x) => Math.abs(x.score - combinedScore))) / 2) : 0;
  const dataQuality = clamp((Math.min(history.length, 252) / 252) * 0.55 + (cleanTechnical.length / 9) * 0.25 + (cleanFundamental.length / 8) * 0.20, 0, 1);
  const annualizedVol = volatility != null ? Math.max(5, volatility) / 100 : 0.30;

  const cfg = {
    '24h': { days: 1, multiplier: 0.65, cap: 0.045 },
    '7d': { days: 7, multiplier: 1.00, cap: 0.10 },
    '30d': { days: 30, multiplier: 1.55, cap: 0.22 },
    '90d': { days: 90, multiplier: 2.25, cap: 0.38 },
  }[horizon];

  const rawReturn = combinedScore * annualizedVol * Math.sqrt(cfg.days / 252) * cfg.multiplier;
  const predictedChange = clamp(rawReturn, -cfg.cap, cfg.cap);
  const predictedPrice = current * (1 + predictedChange);
  const direction = predictedChange > 0.012 ? 'bullish' : predictedChange < -0.012 ? 'bearish' : 'neutral';
  const confidence = clamp(45 + agreement * 20 + dataQuality * 15 + Math.min(1, Math.abs(combinedScore)) * 10, 45, 80);

  return {
    stock_id: Number(arguments[0]?.stockId ?? 0),
    model_version: 'quant-v2.0',
    prediction_time: new Date().toISOString(),
    horizon,
    current_price: Number(current.toFixed(4)),
    predicted_price: Number(predictedPrice.toFixed(4)),
    predicted_change_percent: Number((predictedChange * 100).toFixed(3)),
    direction,
    confidence: Number(confidence.toFixed(1)),
    signal: direction === 'bullish' ? 'positive-quant-score' : direction === 'bearish' ? 'negative-quant-score' : 'mixed-quant-score',
    feature_summary: {
      model: 'quant-v2.0',
      methodology: '65% technical signals + 35% fundamental signals; volatility scales the horizon return; confidence reflects factor agreement and data coverage.',
      technical_score: technicalScore,
      fundamental_score: fundamentalScore,
      combined_score: Number(combinedScore.toFixed(4)),
      agreement: Number(agreement.toFixed(4)),
      data_quality: Number(dataQuality.toFixed(4)),
      annualized_volatility: volatility,
      horizon_days: cfg.days,
      factors: allFactors,
      note: 'Quantitative estimate, not financial advice. No guarantee of future returns.',
    },
  };
}

const stocks = await query('stocks', 'id,symbol', [['is_active', '=', true], ['asset_type', '=', 'stock']], 'id ASC', 5000);
const horizons = ['24h', '7d', '30d', '90d'];
let generated = 0;
let skipped = 0;

for (const stock of stocks) {
  const [quotes, techRows, fundRows, history] = await Promise.all([
    query('latest_quotes', 'price', [['stock_id', '=', stock.id]], '', 1),
    query('technical_indicators', '*', [['stock_id', '=', stock.id], ['timeframe', '=', '1d']], '', 1),
    query('fundamentals', '*', [['stock_id', '=', stock.id]], 'report_date DESC NULLS LAST, updated_at DESC', 1),
    query('price_history', 'timestamp,close,volume', [['stock_id', '=', stock.id], ['timeframe', '=', '1d']], 'timestamp ASC', 252),
  ]);

  const price = n(quotes[0]?.price) ?? n(history.at(-1)?.close);
  const tech = techRows[0] ?? null;
  const fund = fundRows[0] ?? null;
  if (!price || !tech) { skipped += 1; continue; }

  const rows = horizons.map((horizon) => buildPrediction({ price, tech, fund, history, horizon })).filter(Boolean).map((p) => ({ ...p, stock_id: Number(stock.id) }));
  if (!rows.length) { skipped += 1; continue; }
  await insertPredictions(rows);
  generated += rows.length;
  if (generated % 100 === 0) console.log(`[prediction-v2] generated=${generated}`);
}

console.log(JSON.stringify({ model_version: 'quant-v2.0', stocks: stocks.length, predictions_generated: generated, stocks_skipped: skipped, horizons }, null, 2));
