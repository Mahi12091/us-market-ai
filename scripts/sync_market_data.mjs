const required = ['MASSIVE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is not configured in GitHub Actions secrets.`);
}

const massive = async (path) => {
  const url = new URL(`https://api.massive.com${path}`);
  url.searchParams.set('apiKey', process.env.MASSIVE_API_KEY);
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.text();
  if (!response.ok) throw new Error(`Massive ${response.status}: ${body}`);
  return JSON.parse(body);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

      const delay = Math.min(1500 * 2 ** (attempt - 1), 10000);
      console.log(`Supabase ${response.status} on ${table}; retry ${attempt + 1}/${maxAttempts} in ${delay}ms`);
      await sleep(delay);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const message = lastError.message;
      const retryableNetwork = /fetch failed|network|socket|timeout|timed out/i.test(message);
      if (!retryableNetwork || attempt === maxAttempts) throw lastError;

      const delay = Math.min(1500 * 2 ** (attempt - 1), 10000);
      console.log(`Supabase network error on ${table}; retry ${attempt + 1}/${maxAttempts} in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error(`Supabase ${table} request failed`);
};

const integerVolume = (value) => Math.round(Number(value ?? 0));
const isoDate = (date) => date.toISOString().slice(0, 10);
const to = new Date();
const from = new Date(to.getTime() - 5 * 24 * 60 * 60 * 1000);
const HISTORY_BATCH_SIZE = 2;
const STOCK_BATCH_SIZE = 40;
const INTER_STOCK_DELAY_MS = 100;

// Pull the active universe from Supabase so adding a stock automatically adds it
// to the ingestion pipeline. This replaces the temporary 5-symbol test list.
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

const results = [];

for (let batchStart = 0; batchStart < stocks.length; batchStart += STOCK_BATCH_SIZE) {
  const batch = stocks.slice(batchStart, batchStart + STOCK_BATCH_SIZE);
  console.log(`Processing stocks ${batchStart + 1}-${batchStart + batch.length} of ${stocks.length}.`);

  for (const stock of batch) {
    const { symbol } = stock;

    try {
      const aggregateResponse = await massive(
        `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${isoDate(from)}/${isoDate(to)}?adjusted=true&sort=asc&limit=50000`,
      );
      const bars = aggregateResponse.results ?? [];
      if (!bars.length) throw new Error('Massive returned no daily aggregate bars');

      const latestBar = bars.at(-1);
      const previousClose = bars.length >= 2 ? bars.at(-2).c : latestBar.c;
      const change = latestBar.c - previousClose;
      const changePercent = previousClose ? (change / previousClose) * 100 : null;
      const now = new Date().toISOString();

      await supabase('latest_quotes', {
        method: 'POST',
        params: { on_conflict: 'stock_id' },
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: [{
          stock_id: stock.id,
          price: latestBar.c,
          open: latestBar.o,
          high: latestBar.h,
          low: latestBar.l,
          previous_close: previousClose,
          change,
          change_percent: changePercent,
          volume: integerVolume(latestBar.v),
          market_status: 'eod',
          quote_timestamp: new Date(latestBar.t).toISOString(),
          data_source: 'massive-github-actions',
          updated_at: now,
        }],
      });

      const historyRows = bars.map((bar) => ({
        stock_id: stock.id,
        timeframe: '1d',
        timestamp: new Date(bar.t).toISOString(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: integerVolume(bar.v),
        data_source: 'massive-github-actions',
      }));

      for (let index = 0; index < historyRows.length; index += HISTORY_BATCH_SIZE) {
        const batchRows = historyRows.slice(index, index + HISTORY_BATCH_SIZE);
        await supabase('price_history', {
          method: 'POST',
          params: { on_conflict: 'stock_id,timeframe,timestamp' },
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: batchRows,
        });
      }

      results.push({ symbol, ok: true, price: latestBar.c, historyRows: historyRows.length });
    } catch (error) {
      results.push({ symbol, ok: false, error: error instanceof Error ? error.message : String(error) });
    }

    await sleep(INTER_STOCK_DELAY_MS);
  }
}

const synced = results.filter((result) => result.ok).length;
const failed = results.length - synced;

console.log(JSON.stringify({
  mode: 'github-direct-active-universe',
  tested: stocks.length,
  synced,
  failed,
  results,
}, null, 2));

if (failed > 0) process.exit(1);
