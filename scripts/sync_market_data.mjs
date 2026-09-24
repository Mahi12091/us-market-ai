import { neon } from '@neondatabase/serverless';

const REQUIRED = ['MASSIVE_API_KEY', 'NEON_DATABASE_URL'];
for (const name of REQUIRED) if (!process.env[name]) throw new Error(`${name} is not configured in GitHub Actions secrets.`);

const sql = neon(process.env.NEON_DATABASE_URL);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isoDate = (date) => date.toISOString().slice(0, 10);
const integerVolume = (value) => Math.round(Number(value ?? 0));
const REQUEST_GAP_MS = 13_000;
let lastRequestAt = 0;

async function massive(path) {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_GAP_MS) await sleep(REQUEST_GAP_MS - elapsed);
  const url = new URL(`https://api.massive.com${path}`);
  url.searchParams.set('apiKey', process.env.MASSIVE_API_KEY);

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      lastRequestAt = Date.now();
      const response = await fetch(url, { cache: 'no-store' });
      const body = await response.text();
      if (response.ok) return body ? JSON.parse(body) : {};
      const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === 5) throw new Error(`Massive ${response.status}: ${body.slice(0, 600)}`);
      await sleep(response.status === 429 ? 65_000 : Math.min(30_000, 3_000 * 2 ** (attempt - 1)));
    } catch (error) {
      if (attempt === 5) throw error;
      await sleep(Math.min(30_000, 3_000 * attempt));
    }
  }
  throw new Error('Massive request failed');
}

const today = new Date();
const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
const from = new Date(to);
from.setUTCDate(from.getUTCDate() - 400);

const stocks = await sql.query(`
  SELECT id, symbol
  FROM public.stocks
  WHERE is_active = true AND asset_type = 'stock'
  ORDER BY id ASC
`);

const results = [];
for (const stock of stocks) {
  try {
    console.log(`Fetching ${stock.symbol} daily history ${isoDate(from)} → ${isoDate(to)}.`);
    const response = await massive(`/v2/aggs/ticker/${encodeURIComponent(stock.symbol)}/range/1/day/${isoDate(from)}/${isoDate(to)}?adjusted=true&sort=asc&limit=50000`);
    const bars = (Array.isArray(response.results) ? response.results : [])
      .filter((bar) => Number.isFinite(Number(bar.c)) && Number.isFinite(Number(bar.t)))
      .sort((a, b) => Number(a.t) - Number(b.t));

    if (!bars.length) throw new Error('No daily aggregate data returned.');

    const latestBar = bars.at(-1);
    const previousClose = bars.length >= 2 ? Number(bars.at(-2).c) : Number(latestBar.c);
    const change = Number(latestBar.c) - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : null;
    const quoteTimestamp = new Date(Number(latestBar.t)).toISOString();

    await sql.query(
      `INSERT INTO public.latest_quotes
       (stock_id, price, open, high, low, previous_close, change, change_percent, volume, market_status, quote_timestamp, data_source, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'eod',$10,'massive-github-actions',now())
       ON CONFLICT (stock_id) DO UPDATE SET
         price=EXCLUDED.price, open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low,
         previous_close=EXCLUDED.previous_close, change=EXCLUDED.change,
         change_percent=EXCLUDED.change_percent, volume=EXCLUDED.volume,
         market_status=EXCLUDED.market_status, quote_timestamp=EXCLUDED.quote_timestamp,
         data_source=EXCLUDED.data_source, updated_at=now()`,
      [stock.id, Number(latestBar.c), Number(latestBar.o), Number(latestBar.h), Number(latestBar.l), previousClose, change, changePercent, integerVolume(latestBar.v), quoteTimestamp],
    );

    for (let index = 0; index < bars.length; index += 100) {
      const chunk = bars.slice(index, index + 100);
      const values = [];
      const tuples = chunk.map((bar) => {
        const base = values.length;
        values.push(stock.id, '1d', new Date(Number(bar.t)).toISOString(), Number(bar.o), Number(bar.h), Number(bar.l), Number(bar.c), integerVolume(bar.v), 'massive-github-actions');
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`;
      }).join(',');
      await sql.query(
        `INSERT INTO public.price_history
         (stock_id,timeframe,timestamp,open,high,low,close,volume,data_source)
         VALUES ${tuples}
         ON CONFLICT (stock_id,timeframe,timestamp) DO UPDATE SET
           open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low,
           close=EXCLUDED.close, volume=EXCLUDED.volume, data_source=EXCLUDED.data_source`,
        values,
      );
    }

    results.push({ symbol: stock.symbol, ok: true, historyRows: bars.length });
  } catch (error) {
    results.push({ symbol: stock.symbol, ok: false, error: error instanceof Error ? error.message : String(error) });
    console.error(`Failed ${stock.symbol}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const synced = results.filter((result) => result.ok).length;
const failed = results.length - synced;
console.log(JSON.stringify({
  mode: 'ticker-range-production-market-data-neon',
  activeStocks: stocks.length,
  fromDate: isoDate(from),
  toDate: isoDate(to),
  tested: results.length,
  synced,
  failed,
}, null, 2));
// Never discard successful work because one ticker failed.
process.exitCode = 0;
