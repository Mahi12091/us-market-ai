const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is not configured in GitHub Actions secrets.`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function supabase(table, options = {}) {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(options.params ?? {})) url.searchParams.set(key, value);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: options.prefer ?? 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const text = await response.text();
      if (response.ok) return text ? JSON.parse(text) : null;
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 4) {
        throw new Error(`Supabase ${response.status} ${table}: ${text}`);
      }
    } catch (error) {
      if (attempt === 4) throw error;
    }
    await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function signScore(value, scale) {
  const n = num(value);
  return n == null ? null : clamp(n / scale, -1, 1);
}

function buildPrediction(price, technical, history, horizon) {
  const t = technical ?? {};
  const rows = (history ?? []).map((r) => ({ close: num(r.close), volume: num(r.volume) ?? 0 })).filter((r) => r.close != null);
  const latest = rows.at(-1)?.close ?? price;
  const current = price ?? latest;
  if (!current || current <= 0) return null;

  const factors = [];
  const add = (name, score, weight, value = null) => {
    if (score == null || !Number.isFinite(score)) return;
    factors.push({ name, score: clamp(score, -1, 1), weight, value });
  };

  const ema20 = num(t.ema_20);
  const ema50 = num(t.ema_50);
  const sma20 = num(t.sma_20);
  const sma50 = num(t.sma_50);
  const rsi = num(t.rsi);
  const macdHist = num(t.macd_histogram);
  const momentum = num(t.momentum);
  const volatility = num(t.volatility);
  const support = num(t.support_level);
  const resistance = num(t.resistance_level);
  const obv = num(t.obv);

  if (ema20) add('ema20-trend', signScore((current / ema20 - 1) * 100, 5), 1.4, current / ema20 - 1);
  if (ema50) add('ema50-trend', signScore((current / ema50 - 1) * 100, 8), 1.1, current / ema50 - 1);
  if (sma20) add('sma20-trend', signScore((current / sma20 - 1) * 100, 5), 0.9, current / sma20 - 1);
  if (sma50) add('sma50-trend', signScore((current / sma50 - 1) * 100, 8), 0.8, current / sma50 - 1);
  if (rsi != null) {
    const rsiScore = rsi < 30 ? 0.8 : rsi > 70 ? -0.8 : (rsi - 50) / 20;
    add('rsi-regime', rsiScore, 1.2, rsi);
  }
  if (macdHist != null) add('macd-histogram', signScore(macdHist / current * 100, 0.35), 1.2, macdHist);
  if (momentum != null) add('momentum10', signScore(momentum, 10), 1.1, momentum);
  if (support && resistance && resistance > support) {
    const range = resistance - support;
    const position = (current - support) / range;
    add('range-position', clamp((position - 0.5) * 2, -1, 1), 0.6, position);
  }
  if (obv != null && rows.length >= 10) {
    const priorVolumes = rows.slice(-11, -1).map((r) => r.volume);
    const avgVolume = priorVolumes.length ? priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length : 0;
    add('volume-pressure', avgVolume > 0 ? signScore(rows.at(-1).volume / avgVolume - 1, 1) : null, 0.45, rows.at(-1).volume);
  }
  if (ema20 && ema50) add('moving-average-alignment', ema20 > ema50 ? 0.55 : -0.55, 0.8, ema20 - ema50);

  if (!factors.length) return null;

  const weightTotal = factors.reduce((sum, f) => sum + f.weight, 0);
  const score = factors.reduce((sum, f) => sum + f.score * f.weight, 0) / weightTotal;
  const agreement = 1 - Math.min(1, factors.reduce((sum, f) => sum + Math.abs(f.score - score), 0) / factors.length / 2);
  const dataQuality = clamp(rows.length / 60, 0, 1);
  const baseVol = volatility != null ? Math.max(5, volatility / 100) : 0.30;

  const horizonConfig = {
    '24h': { days: 1, multiplier: 0.65, cap: 0.045 },
    '7d': { days: 7, multiplier: 1.00, cap: 0.10 },
    '30d': { days: 30, multiplier: 1.55, cap: 0.22 },
    '90d': { days: 90, multiplier: 2.25, cap: 0.38 },
  }[horizon];

  const rawReturn = score * baseVol * Math.sqrt(horizonConfig.days / 252) * horizonConfig.multiplier;
  const predictedChange = clamp(rawReturn, -horizonConfig.cap, horizonConfig.cap);
  const predictedPrice = current * (1 + predictedChange);
  const direction = predictedChange > 0.012 ? 'bullish' : predictedChange < -0.012 ? 'bearish' : 'neutral';
  const confidence = clamp(45 + agreement * 25 + dataQuality * 15 + Math.min(1, Math.abs(score)) * 10, 45, 85);

  return {
    current_price: current,
    predicted_price: Number(predictedPrice.toFixed(4)),
    predicted_change_percent: Number((predictedChange * 100).toFixed(3)),
    direction,
    confidence: Number(confidence.toFixed(1)),
    signal: direction === 'bullish' ? 'positive-quant-score' : direction === 'bearish' ? 'negative-quant-score' : 'mixed-quant-score',
    feature_summary: {
      model: 'quant-v1.0',
      score: Number(score.toFixed(4)),
      agreement: Number(agreement.toFixed(4)),
      data_quality: Number(dataQuality.toFixed(4)),
      annualized_volatility: volatility,
      horizon_days: horizonConfig.days,
      factors,
      note: 'Quantitative estimate from market price history and technical indicators. Not financial advice.',
    },
  };
}

const stocks = await supabase('stocks', {
  params: { select: 'id,symbol', is_active: 'eq.true', order: 'id.asc', limit: 5000 },
});

const stockList = stocks ?? [];
let generated = 0;
let skipped = 0;
const horizons = ['24h', '7d', '30d', '90d'];

for (const stock of stockList) {
  const [quoteRows, technicalRows, historyRows] = await Promise.all([
    supabase('latest_quotes', { params: { select: 'price', stock_id: `eq.${stock.id}`, limit: 1 } }),
    supabase('technical_indicators', { params: { select: '*', stock_id: `eq.${stock.id}`, timeframe: 'eq.1d', limit: 1 } }),
    supabase('price_history', { params: { select: 'timestamp,close,volume', stock_id: `eq.${stock.id}`, timeframe: 'eq.1d', order: 'timestamp.asc', limit: 500 } }),
  ]);

  const price = num(quoteRows?.[0]?.price) ?? num(historyRows?.at(-1)?.close);
  const technical = technicalRows?.[0] ?? null;
  if (!price || !technical) {
    skipped += 1;
    continue;
  }

  const predictions = horizons.map((horizon) => {
    const prediction = buildPrediction(price, technical, historyRows, horizon);
    return prediction ? {
      stock_id: Number(stock.id),
      model_version: 'quant-v1.0',
      prediction_time: new Date().toISOString(),
      horizon,
      ...prediction,
    } : null;
  }).filter(Boolean);

  if (!predictions.length) {
    skipped += 1;
    continue;
  }

  await supabase('predictions', {
    method: 'POST',
    prefer: 'return=minimal',
    body: predictions,
  });
  generated += predictions.length;
}

console.log(JSON.stringify({
  mode: 'quantitative-prediction-engine',
  model_version: 'quant-v1.0',
  stocks: stockList.length,
  predictions_generated: generated,
  stocks_skipped: skipped,
  horizons,
}, null, 2));
