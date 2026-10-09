import { neon } from '@neondatabase/serverless';

const required = ['NEON_DATABASE_URL'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured.`);

const sql = neon(process.env.NEON_DATABASE_URL);
const FMP_KEY = process.env.FMP_API_KEY || '';
const MASSIVE_KEY = process.env.MASSIVE_API_KEY || '';
const FMP_BASE = 'https://financialmodelingprep.com/stable';
const MASSIVE_BASE = 'https://api.massive.com';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (v) => v == null || String(v).trim() === '' || String(v).trim().toLowerCase() === 'null' ? null : String(v).trim();
const positive = (v) => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;

async function get(url, provider, attempts = 4) {
  let last = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, { headers: { Accept: 'application/json,text/csv,*/*' }, cache: 'no-store' });
    const body = await response.text();
    if (response.ok) return { response, body };
    last = `${provider} HTTP ${response.status}: ${body.slice(0, 350)}`;
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === attempts) throw new Error(last);
    await sleep(response.status === 429 ? 60000 : 2000 * attempt);
  }
  throw new Error(last || `${provider} request failed`);
}

function parseCsv(text) {
  const lines = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) lines.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); lines.push(row); }
  if (lines.length < 2) return [];
  const headers = lines[0].map((x) => x.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])));
}

function parseProviderBody(body) {
  const trimmed = body.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.results)) return data.results;
    return [];
  }
  return parseCsv(trimmed);
}

function normalizeExchange(value) {
  const raw = clean(value);
  if (!raw) return null;
  const key = raw.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const aliases = {
    'NASDAQ': 'XNAS',
    'NASDAQ GLOBAL SELECT': 'XNAS',
    'NASDAQ GLOBAL MARKET': 'XNAS',
    'NASDAQ CAPITAL MARKET': 'XNAS',
    'NASDAQ GM': 'XNAS',
    'NASDAQ CM': 'XNAS',
    'NEW YORK STOCK EXCHANGE': 'XNYS',
    'NYSE': 'XNYS',
    'NYSE ARCA': 'ARCX',
    'NYSE AMERICAN': 'XASE',
    'AMERICAN STOCK EXCHANGE': 'XASE',
    'NYSE MKT': 'XASE',
    'BATS': 'BATS',
    'CBOE BZX': 'BATS',
    'IEX': 'IEXG',
    'INVESTORS EXCHANGE': 'IEXG',
    'OTC MARKETS': 'OTCM',
    'OTC': 'OTCM',
  };
  return aliases[key] ?? raw;
}

function normalizeFmp(row) {
  const symbol = clean(row.symbol)?.toUpperCase();
  if (!symbol) return null;
  return {
    symbol,
    company_name: clean(row.companyName ?? row.company_name),
    exchange: normalizeExchange(row.exchangeShortName ?? row.exchange ?? row.exchangeFullName),
    sector: clean(row.sector),
    industry: clean(row.industry),
    description: clean(row.description),
    website_url: clean(row.website ?? row.website_url),
    logo_url: clean(row.image ?? row.logo_url),
    market_cap: positive(row.marketCap ?? row.market_cap),
    currency: clean(row.currency)?.toUpperCase(),
    country: clean(row.country),
    source: 'FMP profile bulk',
  };
}

function normalizeMassive(row) {
  const symbol = clean(row.ticker)?.toUpperCase();
  if (!symbol) return null;
  return {
    symbol,
    company_name: clean(row.name),
    exchange: clean(row.primary_exchange),
    sector: null,
    industry: clean(row.sic_description),
    description: clean(row.description),
    website_url: clean(row.homepage_url),
    logo_url: clean(row.branding?.logo_url),
    market_cap: positive(row.market_cap),
    currency: clean(row.currency_name)?.toUpperCase(),
    country: null,
    sic_code: clean(row.sic_code),
    source: 'Massive reference ticker details',
  };
}

function classifySector(industry, description) {
  const text = `${industry || ''} ${description || ''}`.toLowerCase();
  const has = (...words) => words.some((word) => text.includes(word));
  if (has('bank', 'financial', 'insurance', 'capital markets', 'investment', 'credit', 'mortgage', 'asset management', 'brokerage', 'lending')) return 'Financial Services';
  if (has('pharma', 'biotech', 'medical', 'health', 'hospital', 'therapeutic', 'drug', 'diagnostic', 'life sciences')) return 'Healthcare';
  if (has('software', 'semiconductor', 'computer', 'electronics', 'technology', 'data processing', 'cloud services', 'internet services')) return 'Technology';
  if (has('oil', 'gas', 'petroleum', 'energy', 'drilling', 'pipeline', 'refining', 'coal')) return 'Energy';
  if (has('utility', 'electric services', 'water supply', 'natural gas distribution')) return 'Utilities';
  if (has('telecommunication', 'telecommunications', 'wireless', 'broadcasting', 'media', 'entertainment', 'publishing')) return 'Communication Services';
  if (has('real estate', 'reit', 'property trust', 'realty')) return 'Real Estate';
  if (has('retail', 'restaurant', 'apparel', 'food store', 'grocery', 'beverage', 'consumer products', 'household products', 'personal products', 'hotel', 'leisure')) return 'Consumer';
  if (has('mining', 'metal', 'steel', 'chemical', 'materials', 'paper', 'forest products', 'gold', 'silver', 'copper')) return 'Basic Materials';
  if (has('aerospace', 'machinery', 'industrial', 'transportation', 'railroad', 'trucking', 'airline', 'construction', 'manufacturing', 'defense', 'engineering')) return 'Industrials';
  return null;
}

function classifySectorFromSic(sicCode) {
  const sic = Number(String(sicCode ?? '').replace(/\\D/g, ''));
  if (!Number.isFinite(sic) || sic <= 0) return null;
  if (sic >= 100 && sic < 1000) return 'Consumer Staples';
  if (sic >= 1000 && sic < 1300) return 'Basic Materials';
  if (sic >= 1300 && sic < 1400) return 'Energy';
  if (sic >= 1400 && sic < 1800) return 'Industrials';
  if (sic >= 2000 && sic < 2100) return 'Consumer Staples';
  if (sic >= 2800 && sic < 2840) return 'Basic Materials';
  if (sic >= 2830 && sic < 2840) return 'Healthcare';
  if (sic >= 3500 && sic < 3600) return 'Technology';
  if (sic >= 3600 && sic < 3700) return 'Technology';
  if (sic >= 3700 && sic < 3800) return 'Industrials';
  if (sic >= 3800 && sic < 3900) return 'Healthcare';
  if (sic >= 4000 && sic < 4800) return 'Industrials';
  if (sic >= 4800 && sic < 4900) return 'Communication Services';
  if (sic >= 4900 && sic < 5000) return 'Utilities';
  if (sic >= 5000 && sic < 5200) return 'Industrials';
  if (sic >= 5200 && sic < 6000) return 'Consumer Discretionary';
  if (sic >= 6000 && sic < 6500) return 'Financial Services';
  if (sic >= 6500 && sic < 6800) return 'Real Estate';
  if (sic >= 7000 && sic < 7400) return 'Consumer Discretionary';
  if (sic >= 8000 && sic < 8100) return 'Healthcare';
  if (sic >= 8700 && sic < 8800) return 'Industrials';
  return 'Other';
}

const stocks = await sql.query(`
  SELECT id, symbol, company_name, exchange, sector, industry, description, website_url, logo_url, market_cap, currency, country, data_last_verified_at
  FROM public.stocks
  WHERE asset_type = 'stock' AND is_active IS TRUE
  ORDER BY symbol
`);
const bySymbol = new Map(stocks.map((s) => [String(s.symbol).toUpperCase(), s]));
if (!bySymbol.size) throw new Error('No active stocks found in Neon.');

const profiles = new Map();
let fmpParts = 0;
let fmpUnavailable = false;
if (FMP_KEY) {
  // FMP bulk endpoint returns profile records in numbered parts. Stop at the first empty part.
  for (let part = 0; part < 30; part += 1) {
    try {
      const url = new URL(`${FMP_BASE}/profile-bulk`);
      url.searchParams.set('part', String(part));
      url.searchParams.set('apikey', FMP_KEY);
      const { body } = await get(url, 'FMP profile bulk');
      const rows = parseProviderBody(body).map(normalizeFmp).filter(Boolean);
      if (!rows.length) break;
      for (const row of rows) if (bySymbol.has(row.symbol)) profiles.set(row.symbol, { ...(profiles.get(row.symbol) || {}), ...Object.fromEntries(Object.entries(row).filter(([k, v]) => k !== 'symbol' && v != null)) });
      fmpParts += 1;
      console.log(`[metadata] FMP part ${part}: ${rows.length} provider rows, ${profiles.size} target matches`);
      if (part < 29) await sleep(60000);
    } catch (error) {
      console.warn(`[metadata] FMP bulk stopped at part ${part}: ${error.message}`);
      fmpUnavailable = true;
      break;
    }
  }
} else {
  console.warn('[metadata] FMP_API_KEY is not configured; using Massive and existing database values.');
}

let massivePages = 0;
let massiveMatches = 0;
let massiveUnavailable = false;
if (MASSIVE_KEY) {
  let lastRequestAt = 0;
  let next = '/v3/reference/tickers?market=stocks&type=CS&active=true&order=asc&sort=ticker&limit=1000';
  while (next) {
    const wait = 13000 - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    const url = new URL(next, MASSIVE_BASE);
    url.searchParams.set('apiKey', MASSIVE_KEY);
    try {
      lastRequestAt = Date.now();
      const { body } = await get(url, 'Massive reference tickers');
      const data = JSON.parse(body);
      massivePages += 1;
      for (const raw of data.results ?? []) {
        const row = normalizeMassive(raw);
        if (!row || !bySymbol.has(row.symbol)) continue;
        const previous = profiles.get(row.symbol) || {};
        const merged = { ...previous };
        for (const [key, value] of Object.entries(row)) if (key !== 'symbol' && value != null && (merged[key] == null || key === 'market_cap')) merged[key] = value;
        profiles.set(row.symbol, merged);
        massiveMatches += 1;
      }
      next = data.next_url ? new URL(data.next_url).pathname + new URL(data.next_url).search : null;
      console.log(`[metadata] Massive page ${massivePages}: ${(data.results ?? []).length} records; matched ${massiveMatches}`);
    } catch (error) {
      console.warn(`[metadata] Massive reference lookup stopped: ${error.message}`);
      massiveUnavailable = true;
      break;
    }
  }
} else {
  console.warn('[metadata] MASSIVE_API_KEY is not configured; skipped Massive fallback.');
}


const detailCandidates = stocks.filter((stock) => {
  const symbol = String(stock.symbol).toUpperCase();
  const provider = profiles.get(symbol) || {};
  const required = ['sector', 'industry', 'description', 'website_url', 'logo_url'];
  const hasMissing = required.some((field) => !clean(provider[field] ?? stock[field]));
  const verifiedAt = stock.data_last_verified_at ? new Date(stock.data_last_verified_at).getTime() : 0;
  const recentlyChecked = verifiedAt > Date.now() - 30 * 24 * 60 * 60 * 1000;
  return hasMissing && !recentlyChecked;
}).slice(0, Math.max(1, Number(process.env.MASSIVE_DETAILS_BATCH_SIZE || 350)));

let detailsAttempted = 0;
let lastDetailsRequestAt = 0;
if (MASSIVE_KEY && detailCandidates.length) {
  console.log(`[metadata] Fetching detailed Massive profiles for ${detailCandidates.length} stocks (resume-safe batch).`);
  for (const stock of detailCandidates) {
    const symbol = String(stock.symbol).toUpperCase();
    const wait = 12500 - (Date.now() - lastDetailsRequestAt);
    if (wait > 0) await sleep(wait);
    try {
      const url = new URL(`/v3/reference/tickers/${encodeURIComponent(symbol)}`, MASSIVE_BASE);
      url.searchParams.set('apiKey', MASSIVE_KEY);
      lastDetailsRequestAt = Date.now();
      const { body } = await get(url, 'Massive ticker details');
      const payload = JSON.parse(body);
      const raw = payload.results;
      if (raw && typeof raw === 'object') {
        const detail = normalizeMassive(raw);
        if (detail) {
          const previous = profiles.get(symbol) || {};
          const merged = { ...previous };
          for (const [key, value] of Object.entries(detail)) {
            if (key !== 'symbol' && value != null && (merged[key] == null || ['industry', 'description', 'website_url', 'logo_url', 'sic_code', 'exchange'].includes(key))) merged[key] = value;
          }
          profiles.set(symbol, merged);
        }
      }
    } catch (error) {
      console.warn(`[metadata] Detail lookup failed for ${symbol}: ${error.message}`);
    }
    detailsAttempted += 1;
    if (detailsAttempted % 25 === 0) console.log(`[metadata] detailed profiles checked ${detailsAttempted}/${detailCandidates.length}`);
  }
}

let updated = 0;
let fieldsFilled = { exchange: 0, sector: 0, industry: 0, description: 0, website_url: 0, logo_url: 0 };
for (const stock of stocks) {
  const provider = profiles.get(String(stock.symbol).toUpperCase()) || {};
  const industry = provider.industry ?? stock.industry ?? null;
  const description = provider.description ?? stock.description ?? null;
  const sector = provider.sector ?? stock.sector ?? classifySector(industry, description) ?? classifySectorFromSic(provider.sic_code);
  const website = provider.website_url ?? stock.website_url ?? null;
  // If a provider supplies the official site but not a hosted logo, use the site's favicon as a visual fallback.
  const domain = website ? (() => { try { return new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, ''); } catch { return null; } })() : null;
  const logo = provider.logo_url ?? stock.logo_url ?? (domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : null);
  const exchange = provider.exchange ?? stock.exchange ?? null;
  const name = provider.company_name ?? stock.company_name;
  const marketCap = provider.market_cap ?? (positive(stock.market_cap));
  const currency = provider.currency ?? stock.currency ?? null;
  const country = provider.country ?? stock.country ?? null;

  for (const [key, value] of Object.entries({ exchange, sector, industry, description, website_url: website, logo_url: logo })) {
    if ((stock[key] == null || String(stock[key]).trim() === '') && value != null && String(value).trim() !== '') fieldsFilled[key] += 1;
  }
  await sql.query(`
    UPDATE public.stocks SET
      company_name = COALESCE(NULLIF($1, ''), company_name),
      exchange = COALESCE(NULLIF($2, ''), exchange),
      sector = COALESCE(NULLIF($3, ''), sector),
      industry = COALESCE(NULLIF($4, ''), industry),
      description = COALESCE(NULLIF($5, ''), description),
      website_url = COALESCE(NULLIF($6, ''), website_url),
      logo_url = COALESCE(NULLIF($7, ''), logo_url),
      market_cap = COALESCE($8, market_cap),
      currency = COALESCE(NULLIF($9, ''), currency),
      country = COALESCE(NULLIF($10, ''), country),
      data_last_verified_at = CASE WHEN $12::boolean THEN now() ELSE data_last_verified_at END,
      updated_at = now()
    WHERE id = $11
  `, [name ?? null, exchange, sector, industry, description, website, logo, marketCap, currency, country, stock.id, detailsAttempted > 0 && detailCandidates.some((candidate) => candidate.id === stock.id)]);
  updated += 1;
  if (updated % 500 === 0) console.log(`[metadata] updated ${updated}/${stocks.length}`);
}

const audit = await sql.query(`
  SELECT
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock') AS active_stocks,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND (exchange IS NULL OR btrim(exchange)='')) AS missing_exchange,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND (sector IS NULL OR btrim(sector)='')) AS missing_sector,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND (industry IS NULL OR btrim(industry)='')) AS missing_industry,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND (description IS NULL OR btrim(description)='')) AS missing_description,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND (website_url IS NULL OR btrim(website_url)='')) AS missing_website,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND (logo_url IS NULL OR btrim(logo_url)='')) AS missing_logo
  FROM public.stocks
`);
const result = {
  target_stocks: stocks.length,
  updated,
  fmp_parts: fmpParts,
  fmp_unavailable: fmpUnavailable,
  fmp_profile_matches: [...profiles.values()].filter((p) => p.website_url || p.description || p.sector || p.industry).length,
  massive_pages: massivePages,
  massive_matched_records: massiveMatches,
  massive_unavailable: massiveUnavailable,
  massive_detail_candidates: detailCandidates.length,
  massive_details_attempted: detailsAttempted,
  newly_filled_by_field: fieldsFilled,
  remaining_missing: audit[0] ?? null,
};
console.log(JSON.stringify(result, null, 2));
if (Number(audit[0]?.missing_exchange ?? 0) > 0 || Number(audit[0]?.missing_sector ?? 0) > 0 || Number(audit[0]?.missing_industry ?? 0) > 0 || Number(audit[0]?.missing_description ?? 0) > 0 || Number(audit[0]?.missing_website ?? 0) > 0 || Number(audit[0]?.missing_logo ?? 0) > 0) {
  console.warn('[metadata] Some fields remain missing because neither configured provider supplied verified values. See remaining_missing above; do not fabricate official company data.');
}
