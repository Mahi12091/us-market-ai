const required = ['MASSIVE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is not configured in GitHub Actions secrets.`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isoDate = (date) => date.toISOString().slice(0, 10);
const integerVolume = (value) => Math.round(Number(value ?? 0));

// Stocks Basic is limited to 5 API calls/minute. A single ticker aggregate
// request can return an entire year of daily bars, so one request per active
// stock is much more efficient than one request per calendar day.
const MASSIVE_REQUEST_GAP_MS = 13_000;
let lastMassiveRequestAt = 0;

const massive = async (path) => {
  const maxAttempts = 5;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const elapsed = Date.now() - lastMassiveRequestAt;
    if (elapsed < MASSIVE_REQUEST_GAP_MS) await sleep(MASSIVE_REQUEST_GAP_MS - elapsed);

    const url = new URL(`https://api.massive.com${path}`);
    url.searchParams.set('apiKey', process.env.MASSIVE_API_KEY);

    try {
      lastMassiveRequestAt = Date.now();
      const response = await fetch(url, { cache: 'no-store' });
      const body = await response.text();

      if (response.ok) return JSON.parse(body);

      lastError = new Error(`Massive ${response.status}: ${body}`);
      const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === maxAttempts) throw lastError;

      const delay = response.status === 429 ? 65_000 : Math.min(5_000 * 2 ** (attempt - 1), 30_000);
      console.log(`Massive ${response.status}; retry ${attempt + 1}/${maxAttempts} in ${delay}ms`);
      await sleep(delay);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const message = lastError.message;
      const retryableNetwork = /fetch failed|network|socket|timeout|timed out/i.test(message);
      if (!retryableNetwork || attempt === maxAttempts) throw lastError;
      const delay = Math.min(5_000 * 2 ** (attempt - 1), 30_000);
      console.log(`Massive network error; retry ${attempt + 1}/${maxAttempts} in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Massive request failed');
};

const supabase = async (table, options = {}) => {
  const maxAttempts = options.maxAttempts ?? 4;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(options.params ?? {})) url.searchParams.set(key, value);

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

      lastError = new Error(`Supabase ${response.status} ${table}: ${text}`);
      const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === maxAttempts) throw lastError;

      const delay = Math.min(1500 * 2 ** (attempt - 1), 10_000);
      console.log(`Supabase ${response.status} on ${table}; retry ${attempt + 1}/${maxAttempts} in ${delay}ms`);
      await sleep(delay);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const message = lastError.message;
      const retryableNetwork = /fetch failed|network|socket|timeout|timed out/i.test(message);
      if (!retryableNetwork || attempt === maxAttempts) throw lastError;

      const delay = Math.min(1500 * 2 ** (attempt - 1), 10_000);
      console.log(`Supabase network error on ${table}; retry ${attempt + 1}/${maxAttempts} in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error(`Supabase ${table} request failed`);
};

const stockRows = await supabase('stocks', {
  params: {
    select: 'id,symbol',
    is_active: 'eq.true',
    order: 'id.asc',
    limit: 5000,
  },
});

const stocks = (stockRows ?? [])
  .filter((row) => row?.id && row?.symbol)
  .map((row) => ({ id: Number(row.id), symbol: String(row.symbol).toUpperCase() }));

if (!stocks.length) throw new Error('No active stocks found in Supabase.');
console.log(`Loaded ${stocks.length} active stocks from Supabase.`);

// Pull roughly one full market year. This gives SMA 200 and long enough
// history for the stock page without exceeding the Basic plan's request rate.
const today = new Date();
const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
const from = new Date(to);
from.setUTCDate(from.getUTCDate() - 400);
const fromDate = isoDate(from);
const toDate = isoDate(to);

const results = [];
const HISTORY_BATCH_SIZE = 100;

for (const stock of stocks) {
  try {
    console.log(`Fetching ${stock.symbol} daily history ${fromDate} → ${toDate}.`);
    const response = await massive(`/v2/aggs/ticker/${encodeURIComponent(stock.symbol)}/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=50000`);
    const bars = (Array.isArray(response.results) ? response.results : [])
      .filter((bar) => Number.isFinite(Number(bar.c)) && Number.isFinite(Number(bar.t)))
      .sort((a, b) => Number(a.t) - Number(b.t));

    if (!bars.length) throw new Error('No daily aggregate data returned');

    const latestBar = bars.at(-1);
    const previousClose = bars.length >= 2 ? Number(bars.at(-2).c) : Number(latestBar.c);
    const change = Number(latestBar.c) - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : null;
    const now = new Date().toISOString();

    await supabase('latest_quotes', {
      method: 'POST',
      params: { on_conflict: 'stock_id' },
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: [{
        stock_id: stock.id,
        price: Number(latestBar.c),
        open: Number(latestBar.o),
        high: Number(latestBar.h),
        low: Number(latestBar.l),
        previous_close: previousClose,
        change,
        change_percent: changePercent,
        volume: integerVolume(latestBar.v),
        market_status: 'eod',
        quote_timestamp: new Date(Number(latestBar.t)).toISOString(),
        data_source: 'massive-github-actions',
        updated_at: now,
      }],
    });

    const historyRows = bars.map((bar) => ({
      stock_id: stock.id,
      timeframe: '1d',
      timestamp: new Date(Number(bar.t)).toISOString(),
      open: Number(bar.o),
      high: Number(bar.h),
      low: Number(bar.l),
      close: Number(bar.c),
      volume: integerVolume(bar.v),
      data_source: 'massive-github-actions',
    }));

    for (let index = 0; index < historyRows.length; index += HISTORY_BATCH_SIZE) {
      await supabase('price_history', {
        method: 'POST',
        params: { on_conflict: 'stock_id,timeframe,timestamp' },
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: historyRows.slice(index, index + HISTORY_BATCH_SIZE),
      });
    }

    results.push({ symbol: stock.symbol, ok: true, price: Number(latestBar.c), historyRows: historyRows.length });
  } catch (error) {
    results.push({ symbol: stock.symbol, ok: false, error: error instanceof Error ? error.message : String(error) });
    console.error(`Failed ${stock.symbol}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const synced = results.filter((result) => result.ok).length;
const failed = results.length - synced;

console.log(JSON.stringify({
  mode: 'ticker-range-production-market-data',
  activeStocks: stocks.length,
  fromDate,
  toDate,
  tested: results.length,
  synced,
  failed,
  results,
}, null, 2));

if (failed > 0) process.exit(1);
