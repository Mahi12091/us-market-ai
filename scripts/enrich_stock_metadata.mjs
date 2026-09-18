const required = ['MASSIVE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured.`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const base = 'https://api.massive.com';
let lastRequest = 0;

async function fetchWithRetry(url, init = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw lastError;
      await sleep(2000 * attempt);
    }
  }
  throw lastError;
}

async function massive(path) {
  const wait = 13000 - (Date.now() - lastRequest);
  if (wait > 0) await sleep(wait);
  const url = new URL(path, base);
  url.searchParams.set('apiKey', process.env.MASSIVE_API_KEY);
  lastRequest = Date.now();
  const response = await fetchWithRetry(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`Massive ${response.status}: ${text}`);
  return JSON.parse(text);
}

async function supabase(symbol, patch) {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/stocks`);
  url.searchParams.set('symbol', `eq.${symbol}`);
  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
}

const targets = await (async () => {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/stocks`);
  url.searchParams.set('select', 'symbol');
  url.searchParams.set('is_active', 'eq.true');
  url.searchParams.set('asset_type', 'eq.stock');
  url.searchParams.set('limit', '500');
  const response = await fetchWithRetry(url, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return await response.json();
})();

const wanted = new Set(targets.map((row) => String(row.symbol).toUpperCase()));
let next = '/v3/reference/tickers?market=stocks&type=CS&active=true&order=asc&sort=ticker&limit=1000';
let matched = 0;
let pages = 0;

while (next) {
  const response = await massive(next);
  pages += 1;
  for (const ticker of response.results ?? []) {
    const symbol = String(ticker.ticker ?? '').toUpperCase();
    if (!wanted.has(symbol)) continue;
    const patch = {
      company_name: ticker.name ?? symbol,
      exchange: ticker.primary_exchange ?? null,
      market_cap: Number.isFinite(Number(ticker.market_cap)) ? Number(ticker.market_cap) : null,
      description: ticker.description ?? ticker.sic_description ?? null,
      website_url: ticker.homepage_url ?? null,
      logo_url: ticker.branding?.logo_url ?? null,
      currency: ticker.currency_name?.toUpperCase() ?? 'USD',
      country: 'US',
      updated_at: new Date().toISOString(),
    };
    await supabase(symbol, patch);
    matched += 1;
  }
  next = response.next_url ? new URL(response.next_url).pathname + new URL(response.next_url).search : null;
}

console.log(JSON.stringify({ targets: wanted.size, matched, pages }, null, 2));
