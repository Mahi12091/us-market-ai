import { neon } from '@neondatabase/serverless';

const required = ['NEON_DATABASE_URL'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured in GitHub Actions secrets.`);

const sql = neon(process.env.NEON_DATABASE_URL);
async function db(table, { method='GET', params={}, body }={}) {
  const ident=/^[A-Za-z_][A-Za-z0-9_]*$/;
  const qid=x=>{if(!ident.test(x))throw new Error('Unsafe identifier: '+x);return '"'+x+'"';};
  const filters=[]; const values=[];
  for(const [key,value] of Object.entries(params)){
    if(['select','limit','offset','order','on_conflict'].includes(key)) continue;
    const m=String(value).match(/^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/); if(!m) continue;
    const [,op,raw]=m, col=qid(key);
    if(op==='is') filters.push(raw==='null'?col+' IS NULL':raw==='true'?col+' IS TRUE':raw==='false'?col+' IS FALSE':'1=0');
    else if(op==='in'){
      const items=raw.replace(/^\(|\)$/g,'').split(',').filter(Boolean);
      const ph=items.map(x=>{values.push(x.replace(/^["']|["']$/g,''));return '$'+values.length;}).join(',');
      filters.push(col+' IN ('+(ph||'NULL')+')');
    } else { values.push(raw); filters.push(col+' '+({eq:'=',neq:'<>',gt:'>',gte:'>=',lt:'<',lte:'<='}[op])+' $'+values.length); }
  }
  if(method==='GET'){
    const cols=(params.select||'*')==='*'?'*':String(params.select).split(',').map(x=>qid(x.trim())).join(',');
    let q='SELECT '+cols+' FROM '+qid(table)+(filters.length?' WHERE '+filters.join(' AND '):'');
    if(params.order) q+=' ORDER BY '+String(params.order).split(',').map(part=>{const [col,dir]=part.split('.');return qid(col)+' '+(dir==='desc'?'DESC':'ASC');}).join(', ');
    if(params.limit!=null) q+=' LIMIT '+Math.max(0,Number(params.limit));
    if(params.offset!=null) q+=' OFFSET '+Math.max(0,Number(params.offset));
    return await sql.query(q,values);
  }
  const rows=Array.isArray(body)?body:[body||{}];
  const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  const vals=[]; const tuples=rows.map(row=>'('+keys.map(k=>{vals.push(row[k]??null);return '$'+vals.length;}).join(',')+')').join(',');
  let q='INSERT INTO '+qid(table)+' ('+keys.map(qid).join(',')+') VALUES '+tuples;
  const conflict=String(params.on_conflict||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(conflict.length){
    const updates=keys.filter(k=>!conflict.includes(k)).map(k=>qid(k)+'=EXCLUDED.'+qid(k)).join(',');
    q+=' ON CONFLICT ('+conflict.map(qid).join(',')+') DO '+(updates?'UPDATE SET '+updates:'NOTHING');
  }
  return await sql.query(q+' RETURNING *',vals);
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sma(values, period) {
  if (values.length < period) return null;
  return average(values.slice(-period));
}

function emaSeries(values, period) {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  let previous = average(values.slice(0, period));
  const output = [{ index: period - 1, value: previous }];
  for (let i = period; i < values.length; i += 1) {
    previous = (values[i] - previous) * multiplier + previous;
    output.push({ index: i, value: previous });
  }
  return output;
}

function ema(values, period) {
  const series = emaSeries(values, period);
  return series.length ? series.at(-1).value : null;
}

function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + (avgGain / avgLoss)));
}

function macd(values) {
  const fast = emaSeries(values, 12);
  const slow = emaSeries(values, 26);
  if (!fast.length || !slow.length) return { macd: null, signal: null, histogram: null };

  const macdValues = [];
  for (const slowPoint of slow) {
    const fastPoint = fast.find((point) => point.index === slowPoint.index);
    if (fastPoint) macdValues.push(fastPoint.value - slowPoint.value);
  }
  if (!macdValues.length) return { macd: null, signal: null, histogram: null };
  const signalSeries = emaSeries(macdValues, 9);
  const macdValue = macdValues.at(-1);
  const signal = signalSeries.length ? signalSeries.at(-1).value : null;
  return { macd: macdValue, signal, histogram: signal == null ? null : macdValue - signal };
}

function atr(rows, period = 14) {
  if (rows.length <= period) return null;
  const trs = [];
  for (let i = 1; i < rows.length; i += 1) {
    const previousClose = rows[i - 1].close;
    trs.push(Math.max(
      rows[i].high - rows[i].low,
      Math.abs(rows[i].high - previousClose),
      Math.abs(rows[i].low - previousClose),
    ));
  }
  return sma(trs, period);
}

function adx(rows, period = 14) {
  if (rows.length <= period * 2) return null;
  const tr = [];
  const plusDm = [];
  const minusDm = [];
  for (let i = 1; i < rows.length; i += 1) {
    const up = rows[i].high - rows[i - 1].high;
    const down = rows[i - 1].low - rows[i].low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(rows[i].high - rows[i].low, Math.abs(rows[i].high - rows[i - 1].close), Math.abs(rows[i].low - rows[i - 1].close)));
  }
  const dx = [];
  for (let i = period; i <= tr.length; i += 1) {
    const trSum = average(tr.slice(i - period, i)) * period;
    if (!trSum) continue;
    const plus = (average(plusDm.slice(i - period, i)) * period / trSum) * 100;
    const minus = (average(minusDm.slice(i - period, i)) * period / trSum) * 100;
    const denom = plus + minus;
    if (denom) dx.push(Math.abs(plus - minus) / denom * 100);
  }
  return dx.length >= period ? average(dx.slice(-period)) : null;
}

function bollinger(values, period = 20) {
  if (values.length < period) return { upper: null, middle: null, lower: null };
  const window = values.slice(-period);
  const middle = average(window);
  const variance = average(window.map((value) => (value - middle) ** 2));
  const deviation = Math.sqrt(variance);
  return { upper: middle + 2 * deviation, middle, lower: middle - 2 * deviation };
}

function stochastic(rows, period = 14) {
  if (rows.length < period) return null;
  const window = rows.slice(-period);
  const high = Math.max(...window.map((row) => row.high));
  const low = Math.min(...window.map((row) => row.low));
  return high === low ? 50 : ((rows.at(-1).close - low) / (high - low)) * 100;
}

function obv(rows) {
  if (!rows.length) return null;
  let value = 0;
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].close > rows[i - 1].close) value += rows[i].volume;
    else if (rows[i].close < rows[i - 1].close) value -= rows[i].volume;
  }
  return value;
}

function volatility(values, period = 20) {
  if (values.length <= period) return null;
  const returns = [];
  for (let i = Math.max(1, values.length - period); i < values.length; i += 1) {
    returns.push((values[i] / values[i - 1]) - 1);
  }
  const mean = average(returns);
  const variance = average(returns.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function momentum(values, period = 10) {
  if (values.length <= period) return null;
  const previous = values.at(-(period + 1));
  return previous ? ((values.at(-1) / previous) - 1) * 100 : null;
}

const stocks = await supabase('stocks', {
  params: { select: 'id,symbol', is_active: 'eq.true', order: 'id.asc', limit: 5000 },
});

const stockList = (stocks ?? []).map((row) => ({ id: Number(row.id), symbol: row.symbol }));
let calculated = 0;
let skipped = 0;

for (const stock of stockList) {
  const rows = await supabase('price_history', {
    params: {
      select: 'timestamp,open,high,low,close,volume',
      stock_id: `eq.${stock.id}`,
      timeframe: 'eq.1d',
      order: 'timestamp.asc',
      limit: 500,
    },
  });

  const clean = (rows ?? [])
    .map((row) => ({ open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close), volume: Number(row.volume ?? 0) }))
    .filter((row) => [row.high, row.low, row.close].every(Number.isFinite));

  if (clean.length < 20) {
    skipped += 1;
    continue;
  }

  const closes = clean.map((row) => row.close);
  const macdValues = macd(closes);
  const bands = bollinger(closes);
  const latest = closes.at(-1);
  const support = Math.min(...clean.slice(-20).map((row) => row.low));
  const resistance = Math.max(...clean.slice(-20).map((row) => row.high));

  const payload = [{
    stock_id: stock.id,
    timeframe: '1d',
    rsi: rsi(closes),
    macd: macdValues.macd,
    macd_signal: macdValues.signal,
    macd_histogram: macdValues.histogram,
    sma_20: sma(closes, 20),
    sma_50: sma(closes, 50),
    sma_100: sma(closes, 100),
    sma_200: sma(closes, 200),
    ema_20: ema(closes, 20),
    ema_50: ema(closes, 50),
    atr: atr(clean),
    adx: adx(clean),
    bollinger_upper: bands.upper,
    bollinger_middle: bands.middle,
    bollinger_lower: bands.lower,
    stochastic: stochastic(clean),
    obv: obv(clean),
    volatility: volatility(closes),
    momentum: momentum(closes),
    support_level: support,
    resistance_level: resistance,
    calculated_at: new Date().toISOString(),
  }];

  await supabase('technical_indicators', {
    method: 'POST',
    params: { on_conflict: 'stock_id,timeframe' },
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: payload,
  });
  calculated += 1;
}

console.log(JSON.stringify({
  mode: 'technical-indicator-engine',
  stocks: stockList.length,
  calculated,
  skipped,
  timeframe: '1d',
  indicators: ['RSI14', 'MACD12/26/9', 'SMA20/50/100/200', 'EMA20/50', 'ATR14', 'ADX14', 'Bollinger20', 'Stochastic14', 'OBV', 'annualized-volatility20', 'momentum10', 'support20', 'resistance20'],
}, null, 2));
