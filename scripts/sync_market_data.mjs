const symbols = ['AAPL', 'AMZN', 'MSFT', 'NVDA', 'TSLA'];

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
      const retryable = [408, 409, 429, 500, 502, 503, 504].includes(response.status);
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

const stockRows = await supabase('stocks', {
  params: {
    select: 'id,symbol',
    symbol: `in.(${symbols.join(',')})`,
    is_active: 'eq.true',
  },
});
const stockMap = new Map((stockRows ?? []).map((row) => [row.symbol, row]));

const results = [];
for (const symbol of symbols) {
  const stock = stockMap.get(symbol);
  if (!stock) {
    results.push({ symbol, ok: false, error: 'Active stock not found in Supabase' });
    continue;
  }

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
      const batch = historyRows.slice(index, index + HISTORY_BATCH_SIZE);
      await supabase('price_history', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: batch,
      });
    }

    results.push({ symbol, ok: true, price: latestBar.c, historyRows: historyRows.length });
  } catch (error) {
    results.push({ symbol, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

console.log(JSON.stringify({ mode: 'github-direct-test', tested: symbols.length, synced: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results }, null, 2));

if (results.some((r) => !r.ok)) process.exit(1);
