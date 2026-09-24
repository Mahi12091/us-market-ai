import { neon } from '@neondatabase/serverless';

const required = ['NEON_DATABASE_URL'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured in GitHub Actions secrets.`);
const sql = neon(process.env.NEON_DATABASE_URL);

async function supabase(table, options = {}) {
  const ident = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const qid = (x) => { if (!ident.test(x)) throw new Error(`Unsafe identifier: ${x}`); return '"'+x+'"'; };
  const params = options.params ?? {};
  const values = [];
  const filters = [];
  for (const [key, raw] of Object.entries(params)) {
    if (['select','limit','offset','order','on_conflict'].includes(key)) continue;
    const m = String(raw).match(/^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/);
    if (!m) continue;
    const [, op, val] = m;
    const col = qid(key);
    if (op === 'is') filters.push(val === 'null' ? col+' IS NULL' : val === 'true' ? col+' IS TRUE' : val === 'false' ? col+' IS FALSE' : '1=0');
    else if (op === 'in') {
      const items = val.replace(/^\(|\)$/g,'').split(',').filter(Boolean);
      const ph = items.map((item) => { values.push(item.replace(/^["']|["']$/g,'')); return '$'+values.length; }).join(',');
      filters.push(col+' IN ('+(ph||'NULL')+')');
    } else {
      values.push(val);
      filters.push(col+' '+({eq:'=',neq:'<>',gt:'>',gte:'>=',lt:'<',lte:'<='}[op])+' $'+values.length);
    }
  }
  const where = filters.length ? ' WHERE '+filters.join(' AND ') : '';
  if ((options.method ?? 'GET') === 'GET') {
    const columns = params.select === '*' || !params.select ? '*' : String(params.select).split(',').map((x)=>qid(x.trim())).join(',');
    let q = 'SELECT '+columns+' FROM '+qid(table)+where;
    if (params.order) q += ' ORDER BY '+String(params.order).split(',').map((part)=>{const [col,dir]=part.split('.');return qid(col)+' '+(dir==='desc'?'DESC':'ASC');}).join(', ');
    if (params.limit != null) q += ' LIMIT '+Math.max(0,Number(params.limit));
    if (params.offset != null) q += ' OFFSET '+Math.max(0,Number(params.offset));
    return await sql.query(q,values);
  }
  if ((options.method ?? 'GET') === 'POST') {
    const rows = Array.isArray(options.body) ? options.body : [options.body ?? {}];
    if (!rows.length) return [];
    const keys = [...new Set(rows.flatMap((r)=>Object.keys(r)))];
    const vals=[]; const tuples=rows.map((row)=>'('+keys.map((k)=>{vals.push(row[k]??null);return '$'+vals.length;}).join(',')+')').join(',');
    let q='INSERT INTO '+qid(table)+' ('+keys.map(qid).join(',')+') VALUES '+tuples;
    const conflict=String(params.on_conflict||'').split(',').map((x)=>x.trim()).filter(Boolean);
    if(conflict.length){
      const updates=keys.filter((k)=>!conflict.includes(k)).map((k)=>qid(k)+'=EXCLUDED.'+qid(k)).join(',');
      q+=' ON CONFLICT ('+conflict.map(qid).join(',')+') DO '+(updates?'UPDATE SET '+updates:'NOTHING');
    }
    return await sql.query(q+' RETURNING *',vals);
  }
  throw new Error('Unsupported method '+(options.method ?? 'GET'));
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
