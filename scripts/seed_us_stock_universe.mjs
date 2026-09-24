const required = ['NEON_DATABASE_URL', 'MASSIVE_API_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured.`);

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL);
const MASSIVE = 'https://api.massive.com';
const PAGE_SIZE = 1000;
const TARGET_STOCKS = 2000;
const REQUEST_GAP_MS = 13000;
let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function massive(path) {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_GAP_MS) await sleep(REQUEST_GAP_MS - elapsed);
  const url = new URL(path, MASSIVE);
  url.searchParams.set('apiKey', process.env.MASSIVE_API_KEY);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    lastRequestAt = Date.now();
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const text = await response.text();
    if (response.ok) return text ? JSON.parse(text) : {};
    const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
    if (!retryable || attempt === 5) throw new Error(`Massive HTTP ${response.status}: ${text.slice(0, 600)}`);
    await sleep(response.status === 429 ? 65000 : Math.min(30000, 3000 * 2 ** (attempt - 1)));
  }
  throw new Error('Massive request failed');
}

const slugify = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const existingRows = await sql.query(
  `SELECT symbol, slug, company_name, exchange, sector, industry, description, logo_url, website_url, country, market_cap, currency, asset_type, is_active, is_indexable
   FROM public.stocks
   WHERE asset_type = 'stock'
   ORDER BY id`
);
const existingBySymbol = new Map(existingRows.map((row) => [String(row.symbol).toUpperCase(), row]));

const discovered = new Map();
let next = `/v3/reference/tickers?market=stocks&type=CS&active=true&order=asc&sort=ticker&limit=${PAGE_SIZE}`;
let pages = 0;
while (next) {
  const body = await massive(next);
  pages += 1;
  for (const ticker of body.results ?? []) {
    const symbol = String(ticker.ticker ?? '').toUpperCase().trim();
    if (!symbol) continue;
    const marketCap = Number(ticker.market_cap);
    discovered.set(symbol, {
      symbol,
      company_name: ticker.name ?? symbol,
      exchange: ticker.primary_exchange ?? null,
      market_cap: Number.isFinite(marketCap) && marketCap > 0 ? marketCap : null,
      description: ticker.description ?? ticker.sic_description ?? null,
      website_url: ticker.homepage_url ?? null,
      logo_url: ticker.branding?.logo_url ?? null,
      country: 'US',
      currency: String(ticker.currency_name ?? 'USD').toUpperCase(),
      asset_type: 'stock',
      is_active: ticker.active !== false,
      is_indexable: true,
    });
  }
  next = body.next_url ? new URL(body.next_url).pathname + new URL(body.next_url).search : null;
}

const ranked = [...discovered.values()].filter((row) => row.is_active).sort((a, b) => {
  const aCap = a.market_cap ?? -1;
  const bCap = b.market_cap ?? -1;
  return bCap - aCap || a.symbol.localeCompare(b.symbol);
});

const selected = [];
const selectedSymbols = new Set();
for (const row of ranked) {
  if (row.market_cap == null) continue;
  selected.push(row);
  selectedSymbols.add(row.symbol);
  if (selected.length >= TARGET_STOCKS) break;
}
for (const row of ranked) {
  if (selected.length >= TARGET_STOCKS) break;
  if (selectedSymbols.has(row.symbol)) continue;
  selected.push(row);
  selectedSymbols.add(row.symbol);
}

// Preserve all existing stock symbols already in Neon, even if they are not in the current top-2,000 ranking.
for (const row of existingBySymbol.values()) {
  if (selectedSymbols.has(String(row.symbol).toUpperCase())) continue;
  selected.push({
    symbol: String(row.symbol).toUpperCase(),
    company_name: row.company_name,
    exchange: row.exchange,
    market_cap: row.market_cap == null ? null : Number(row.market_cap),
    description: row.description,
    website_url: row.website_url,
    logo_url: row.logo_url,
    country: row.country ?? 'US',
    currency: row.currency ?? 'USD',
    asset_type: 'stock',
    is_active: row.is_active !== false,
    is_indexable: row.is_indexable !== false,
  });
  selectedSymbols.add(String(row.symbol).toUpperCase());
}

let insertedOrUpdated = 0;
for (let i = 0; i < selected.length; i += 100) {
  const chunk = selected.slice(i, i + 100);
  for (const row of chunk) {
    const symbol = row.symbol;
    const companyName = row.company_name || symbol;
    const slug = slugify(symbol);
    await sql.query(
      `INSERT INTO public.stocks
        (symbol, slug, company_name, exchange, description, logo_url, website_url, country, market_cap, currency, asset_type, is_active, is_indexable, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'stock',true,true,now())
       ON CONFLICT (symbol) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        exchange = COALESCE(EXCLUDED.exchange, public.stocks.exchange),
        description = COALESCE(EXCLUDED.description, public.stocks.description),
        logo_url = COALESCE(EXCLUDED.logo_url, public.stocks.logo_url),
        website_url = COALESCE(EXCLUDED.website_url, public.stocks.website_url),
        country = COALESCE(EXCLUDED.country, public.stocks.country),
        market_cap = COALESCE(EXCLUDED.market_cap, public.stocks.market_cap),
        currency = COALESCE(EXCLUDED.currency, public.stocks.currency),
        is_active = true,
        is_indexable = true,
        updated_at = now()`,
      [symbol, slug, companyName, row.exchange ?? null, row.description ?? null, row.logo_url ?? null, row.website_url ?? null, row.country ?? 'US', row.market_cap ?? null, row.currency ?? 'USD']
    );
    insertedOrUpdated += 1;
  }
}

// Keep the existing four non-indexable market proxies intact. This script never deletes/deactivates stock rows.
const counts = await sql.query(
  `SELECT
     COUNT(*) FILTER (WHERE asset_type = 'stock') AS stock_rows,
     COUNT(*) FILTER (WHERE asset_type = 'stock' AND is_active) AS active_stocks,
     COUNT(*) FILTER (WHERE asset_type = 'stock' AND is_active AND is_indexable) AS active_indexable_stocks,
     COUNT(*) FILTER (WHERE asset_type = 'etf' AND is_active) AS active_etfs
   FROM public.stocks`
);
console.log(JSON.stringify({
  source: 'Massive /v3/reference/tickers',
  discovered: discovered.size,
  pages,
  selected_target: TARGET_STOCKS,
  selected_stocks: selected.length,
  upserted: insertedOrUpdated,
  database_counts: counts[0] ?? null,
}, null, 2));
