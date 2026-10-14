import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required');
const sql = neon(process.env.NEON_DATABASE_URL);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const n = (value) => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const round = (value, places = 6) => value == null ? null : Number(Number(value).toFixed(places));

async function yahooHistory(symbol) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?range=1y&interval=1d&events=div%2Csplits';
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; USMarketAI/1.0; +https://usmarketai.com)',
      'Accept': 'application/json'
    }
  });
  if (!response.ok) throw new Error('Yahoo chart HTTP ' + response.status);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  if (!result || payload?.chart?.error) throw new Error(payload?.chart?.error?.description || 'No chart data returned');
  const timestamps = result.timestamp || [];
  const bars = result.indicators?.quote?.[0] || {};
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
  const history = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = n(bars.close?.[i]);
    if (!timestamps[i] || close == null || close <= 0) continue;
    history.push({
      stock_id: null, timeframe: '1d', timestamp: new Date(new Date(timestamps[i] * 1000).toISOString().slice(0, 10) + 'T04:00:00.000Z').toISOString(),
      open: n(bars.open?.[i]), high: n(bars.high?.[i]), low: n(bars.low?.[i]), close,
      volume: bars.volume?.[i] == null ? null : Math.trunc(Number(bars.volume[i])),
      adjusted_close: n(adjusted[i]), data_source: 'YAHOO_FINANCE_CHART_FREE'
    });
  }
  if (!history.length) throw new Error('Yahoo returned no usable daily bars');
  return history;
}

async function stooqHistory(symbol) {
  const url = 'https://stooq.com/q/d/l/?s=' + encodeURIComponent(symbol.toLowerCase() + '.us') + '&i=d';
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; USMarketAI/1.0; +https://usmarketai.com)', 'Accept': 'text/csv,*/*' }
  });
  if (!response.ok) throw new Error('Stooq CSV HTTP ' + response.status);
  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2 || !/^Date,Open,High,Low,Close,Volume/i.test(lines[0])) throw new Error('Stooq returned no daily CSV data');
  const history = [];
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 400);
  for (const line of lines.slice(1)) {
    const [date, open, high, low, close, volume] = line.split(',');
    const c = n(close);
    if (!date || Date.parse(date) < cutoff.getTime() || c == null || c <= 0) continue;
    history.push({
      stock_id: null, timeframe: '1d', timestamp: new Date(date + 'T04:00:00.000Z').toISOString(),
      open: n(open), high: n(high), low: n(low), close: c,
      volume: volume ? Math.trunc(Number(volume)) : null, adjusted_close: null, data_source: 'STOOQ_FREE'
    });
  }
  if (!history.length) throw new Error('Stooq returned no usable daily bars');
  return history;
}

async function fetchHistory(symbol) {
  try { return { history: await yahooHistory(symbol), source: 'YAHOO_FINANCE_CHART_FREE' }; }
  catch (yahooError) {
    try { return { history: await stooqHistory(symbol), source: 'STOOQ_FREE' }; }
    catch (stooqError) {
      throw new Error(String(yahooError?.message || yahooError) + '; ' + String(stooqError?.message || stooqError));
    }
  }
}

const missing = await sql`
  SELECT s.id, s.symbol, s.asset_type, q.quote_timestamp,
    (SELECT MAX(ph."timestamp") FROM price_history ph WHERE ph.stock_id=s.id AND ph.timeframe='1d') AS latest_history_ts
  FROM stocks s
  LEFT JOIN latest_quotes q ON q.stock_id = s.id
  WHERE s.is_active = true AND (
    q.stock_id IS NULL OR
    (q.quote_timestamp IS NOT NULL AND q.quote_timestamp::date < CURRENT_DATE - 2) OR
    (EXISTS (SELECT 1 FROM price_history ph WHERE ph.stock_id=s.id AND ph.timeframe='1d')
      AND (SELECT MAX(ph."timestamp") FROM price_history ph WHERE ph.stock_id=s.id AND ph.timeframe='1d')::date < CURRENT_DATE - 2)
  )
  ORDER BY s.asset_type, s.symbol
`;
if (!missing.length) {
  console.log('[yahoo-backfill] No missing/stale quotes or stale daily histories found.');
  process.exit(0);
}

let quoteRows = 0;
let historyRows = 0;
let failed = 0;
let skipped = 0;
const marketSnapshots = [];

for (const stock of missing) {
  try {
    const fetched = await fetchHistory(stock.symbol);
    const history = fetched.history.map((bar) => ({ ...bar, stock_id: Number(stock.id), data_source: fetched.source }));
    const existingTs = stock.latest_history_ts ? Date.parse(stock.latest_history_ts) : -Infinity;
    const newHistory = history.filter((bar) => Date.parse(bar.timestamp) > existingTs);

    for (let i = 0; i < newHistory.length; i += 250) {
      const chunk = newHistory.slice(i, i + 250);
      const res = await sql.query(
        'INSERT INTO price_history(stock_id,timeframe,"timestamp",open,high,low,close,volume,adjusted_close,data_source) ' +
        'SELECT x.stock_id,x.timeframe,x.ts,x.open,x.high,x.low,x.close,x.volume,x.adjusted_close,x.data_source ' +
        'FROM jsonb_to_recordset($1::jsonb) AS x(stock_id bigint,timeframe text,ts timestamptz,open numeric,high numeric,low numeric,close numeric,volume bigint,adjusted_close numeric,data_source text) ' +
        'ON CONFLICT(stock_id,timeframe,"timestamp") DO UPDATE SET ' +
        'open=COALESCE(EXCLUDED.open,price_history.open),high=COALESCE(EXCLUDED.high,price_history.high),low=COALESCE(EXCLUDED.low,price_history.low), ' +
        'close=EXCLUDED.close,volume=COALESCE(EXCLUDED.volume,price_history.volume),adjusted_close=COALESCE(EXCLUDED.adjusted_close,price_history.adjusted_close),data_source=EXCLUDED.data_source RETURNING stock_id',
        [JSON.stringify(chunk.map((x) => ({...x, ts: x.timestamp, timestamp: undefined})))]
      );
      historyRows += res.length;
    }

    const last = history.at(-1);
    const prev = history.length > 1 ? history.at(-2) : null;
    const lastDate = last.timestamp.slice(0, 10);
    const ageDays = (Date.now() - Date.parse(last.timestamp)) / 86400000;
    if (ageDays > 4) {
      skipped += 1;
      console.warn('[yahoo-backfill] skipped ' + stock.symbol + ' latest bar is stale (' + lastDate + ')');
      continue;
    }
    if (newHistory.length === 0 && stock.quote_timestamp && Date.parse(stock.quote_timestamp) >= Date.parse(last.timestamp)) {
      skipped += 1;
      continue;
    }
    const avgVolume = history.slice(-20).filter((x) => x.volume != null).reduce((sum, x, _, arr) => sum + x.volume / arr.length, 0);
    const high52 = history.slice(-252).reduce((v, x) => x.high == null ? v : Math.max(v, x.high), -Infinity);
    const low52 = history.slice(-252).reduce((v, x) => x.low == null ? v : Math.min(v, x.low), Infinity);
    const price = last.close;
    const previousClose = prev?.close ?? null;
    const change = previousClose != null ? price - previousClose : null;
    const changePercent = previousClose > 0 ? (price / previousClose - 1) * 100 : null;
    const quoteTimestamp = last.timestamp;
    const quote = {
      stock_id: Number(stock.id),
      price: round(price), open: last.open, high: last.high, low: last.low,
      previous_close: round(previousClose), change: round(change), change_percent: round(changePercent),
      volume: last.volume, market_status: lastDate < new Date().toISOString().slice(0, 10) ? 'closed' : 'open',
      quote_timestamp: quoteTimestamp, data_source: fetched.source,
      average_volume: avgVolume > 0 ? Math.round(avgVolume) : null,
      dollar_volume: last.volume != null ? round(price * last.volume, 2) : null,
      week_52_high: Number.isFinite(high52) ? round(high52) : null,
      week_52_low: Number.isFinite(low52) ? round(low52) : null
    };
    const qres = await sql.query(
      'INSERT INTO latest_quotes(stock_id,price,open,high,low,previous_close,"change",change_percent,volume,market_status,quote_timestamp,data_source,average_volume,dollar_volume,week_52_high,week_52_low,updated_at) ' +
      'SELECT stock_id,price,open,high,low,previous_close,change,change_percent,volume,market_status,quote_timestamp,data_source,average_volume,dollar_volume,week_52_high,week_52_low,NOW() ' +
      'FROM jsonb_to_recordset($1::jsonb) AS x(stock_id bigint,price numeric,open numeric,high numeric,low numeric,previous_close numeric,change numeric,change_percent numeric,volume bigint,market_status text,quote_timestamp timestamptz,data_source text,average_volume bigint,dollar_volume numeric,week_52_high numeric,week_52_low numeric) ' +
      'ON CONFLICT(stock_id) DO UPDATE SET price=EXCLUDED.price,open=EXCLUDED.open,high=EXCLUDED.high,low=EXCLUDED.low,previous_close=EXCLUDED.previous_close,"change"=EXCLUDED."change",change_percent=EXCLUDED.change_percent,volume=EXCLUDED.volume,market_status=EXCLUDED.market_status,quote_timestamp=EXCLUDED.quote_timestamp,data_source=EXCLUDED.data_source,average_volume=EXCLUDED.average_volume,dollar_volume=EXCLUDED.dollar_volume,week_52_high=EXCLUDED.week_52_high,week_52_low=EXCLUDED.week_52_low,updated_at=NOW() ' +
      'WHERE latest_quotes.quote_timestamp IS NULL OR EXCLUDED.quote_timestamp > latest_quotes.quote_timestamp RETURNING stock_id',
      [JSON.stringify([quote])]
    );
    quoteRows += qres.length;
    if (stock.asset_type === 'etf') marketSnapshots.push({ symbol: stock.symbol, price: round(price), change_percent: round(changePercent), timestamp: quoteTimestamp });
    console.log(JSON.stringify({symbol: stock.symbol, history_bars_available: history.length, new_bars_upserted: newHistory.length, quote_timestamp: quoteTimestamp, source: fetched.source}));
  } catch (error) {
    const message = String(error?.message || error);
    if (/HTTP 404|no usable daily bars|No chart data returned/i.test(message)) {
      skipped += 1;
      console.warn('[yahoo-backfill] skipped ' + stock.symbol + ' (no usable Yahoo history): ' + message.slice(0, 180));
    } else {
      failed += 1;
      console.error('[yahoo-backfill] ' + stock.symbol + ': ' + message.slice(0, 250));
    }
  }
  await sleep(700);
}

let snapshotsInserted = 0;
if (marketSnapshots.length) {
  const result = await sql.query(
    'WITH src AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(symbol text,price numeric,change_percent numeric,ts timestamptz)), ' +
    'new_rows AS (SELECT src.* FROM src WHERE NOT EXISTS (SELECT 1 FROM market_snapshots m WHERE m.symbol=src.symbol AND m."timestamp"=src.ts)), ' +
    'base AS (SELECT COALESCE(MAX(id),0) max_id FROM market_snapshots), ' +
    'ins AS (INSERT INTO market_snapshots(id,symbol,price,change_percent,"timestamp") ' +
    'SELECT base.max_id+row_number() OVER(ORDER BY new_rows.symbol),new_rows.symbol,new_rows.price,new_rows.change_percent,new_rows.ts FROM new_rows CROSS JOIN base RETURNING id) ' +
    'SELECT count(*)::int count FROM ins',
    [JSON.stringify(marketSnapshots.map((x) => ({...x, ts: x.timestamp, timestamp: undefined})))]
  );
  snapshotsInserted = Number(result[0]?.count || 0);
}

console.log(JSON.stringify({missing_at_start: missing.length, quote_rows_written: quoteRows, history_rows_upserted: historyRows, market_snapshots_inserted: snapshotsInserted, skipped, failed}, null, 2));
if (failed > 0) process.exitCode = 1;
