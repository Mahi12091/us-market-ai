import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.NEON_DATABASE_URL;
if (!databaseUrl) throw new Error('NEON_DATABASE_URL is not configured.');
const sql = neon(databaseUrl);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => value == null || String(value).trim() === '' ? null : String(value).trim();
const norm = (value) => String(value ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const yearOf = (value) => {
  const match = String(value ?? '').match(/^([+-]?\d{4,})-/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1600 && year <= new Date().getFullYear() ? year : null;
};
const similarity = (a, b) => {
  const x = new Set(norm(a).split(/\s+/).filter((w) => w.length > 2));
  const y = new Set(norm(b).split(/\s+/).filter((w) => w.length > 2));
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const word of x) if (y.has(word)) common += 1;
  return common / Math.max(x.size, y.size);
};

const stocks = await sql.query(`
  SELECT id, symbol, company_name, ceo, founded_year, headquarters, website_url, logo_url, description
  FROM public.stocks
  WHERE asset_type = 'stock' AND is_active IS TRUE
    AND (
      NULLIF(BTRIM(ceo), '') IS NULL OR founded_year IS NULL
      OR NULLIF(BTRIM(headquarters), '') IS NULL
      OR NULLIF(BTRIM(website_url), '') IS NULL
      OR NULLIF(BTRIM(logo_url), '') IS NULL
      OR NULLIF(BTRIM(description), '') IS NULL
    )
  ORDER BY symbol
`);
console.log(`[wikidata] Candidate stocks with one or more missing fields: ${stocks.length}`);

const byTicker = new Map();
for (const stock of stocks) {
  const ticker = String(stock.symbol ?? '').trim().toUpperCase();
  if (!ticker || !/^[A-Z0-9.\-^]+$/.test(ticker)) continue;
  if (!byTicker.has(ticker)) byTicker.set(ticker, []);
  byTicker.get(ticker).push(stock);
}
const tickers = [...byTicker.keys()];
const counts = { tickers_queried: 0, wikidata_entities_matched: 0, stocks_updated: 0, ceo_filled: 0, founded_year_filled: 0, headquarters_filled: 0, website_filled: 0, logo_filled: 0, description_filled: 0, ambiguous_or_low_confidence: 0, errors: 0 };

async function queryWikidata(batch) {
  const values = batch.map((ticker) => JSON.stringify(ticker)).join(' ');
  const query = `
SELECT ?ticker ?item ?itemLabel ?itemDescription ?ceoLabel ?inception ?hqLabel ?website ?logo WHERE {
  VALUES ?ticker { ${values} }
  ?item wdt:P249 ?ticker .
  OPTIONAL { ?item wdt:P169 ?ceo . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P159 ?hq . }
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P154 ?logo . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  OPTIONAL { ?item schema:description ?itemDescription . FILTER(LANG(?itemDescription) = "en") }
}`;
  const url = new URL('https://query.wikidata.org/sparql');
  url.searchParams.set('query', query);
  url.searchParams.set('format', 'json');
  const response = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'USMarketAI/1.0 (stock metadata enrichment; https://usmarketai.com)'
    }
  });
  if (!response.ok) throw new Error(`Wikidata HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`);
  return (await response.json()).results?.bindings ?? [];
}

for (let offset = 0; offset < tickers.length; offset += 20) {
  const batch = tickers.slice(offset, offset + 20);
  let bindings;
  try {
    bindings = await queryWikidata(batch);
  } catch (error) {
    counts.errors += 1;
    console.warn(`[wikidata] Batch ${offset + 1}-${Math.min(offset + batch.length, tickers.length)} failed: ${error.message}`);
    await sleep(5000);
    continue;
  }
  const candidates = new Map();
  for (const row of bindings) {
    const ticker = clean(row.ticker?.value)?.toUpperCase();
    if (!ticker || !byTicker.has(ticker)) continue;
    const entity = {
      uri: row.item?.value,
      name: clean(row.itemLabel?.value),
      description: clean(row.itemDescription?.value),
      ceo: clean(row.ceoLabel?.value),
      inception: clean(row.inception?.value),
      headquarters: clean(row.hqLabel?.value),
      website: clean(row.website?.value),
      logo: clean(row.logo?.value),
    };
    if (!candidates.has(ticker)) candidates.set(ticker, []);
    const list = candidates.get(ticker);
    const old = list.find((item) => item.uri === entity.uri);
    if (!old) list.push(entity);
    else for (const [key, value] of Object.entries(entity)) if (!old[key] && value) old[key] = value;
  }

  for (const ticker of batch) {
    const stockRows = byTicker.get(ticker) ?? [];
    const entities = candidates.get(ticker) ?? [];
    if (!entities.length) continue;
    for (const stock of stockRows) {
      const ranked = entities.map((entity) => ({ entity, score: similarity(stock.company_name, entity.name) })).sort((a, b) => b.score - a.score);
      const best = ranked[0];
      const second = ranked[1];
      // Conservative matching: avoid writing a ticker collision into the wrong company.
      if (!best || best.score < 0.45 || (second && best.score - second.score < 0.15)) {
        counts.ambiguous_or_low_confidence += 1;
        continue;
      }
      const e = best.entity;
      counts.wikidata_entities_matched += 1;
      const year = yearOf(e.inception);
      const values = {
        ceo: e.ceo && !/^unknown$/i.test(e.ceo) ? e.ceo : null,
        founded_year: year,
        headquarters: e.headquarters,
        website_url: e.website,
        logo_url: e.logo,
        description: e.description,
      };
      const filled = {
        ceo: !clean(stock.ceo) && values.ceo,
        founded_year: stock.founded_year == null && values.founded_year,
        headquarters: !clean(stock.headquarters) && values.headquarters,
        website_url: !clean(stock.website_url) && values.website_url,
        logo_url: !clean(stock.logo_url) && values.logo_url,
        description: !clean(stock.description) && values.description,
      };
      if (!Object.values(filled).some(Boolean)) continue;
      await sql.query(`
        UPDATE public.stocks SET
          ceo = COALESCE(NULLIF(BTRIM(ceo), ''), $1),
          founded_year = COALESCE(founded_year, $2),
          headquarters = COALESCE(NULLIF(BTRIM(headquarters), ''), $3),
          website_url = COALESCE(NULLIF(BTRIM(website_url), ''), $4),
          logo_url = COALESCE(NULLIF(BTRIM(logo_url), ''), $5),
          description = COALESCE(NULLIF(BTRIM(description), ''), $6),
          updated_at = now()
        WHERE id = $7
      `, [values.ceo, values.founded_year, values.headquarters, values.website_url, values.logo_url, values.description, stock.id]);
      counts.stocks_updated += 1;
      if (filled.ceo) counts.ceo_filled += 1;
      if (filled.founded_year) counts.founded_year_filled += 1;
      if (filled.headquarters) counts.headquarters_filled += 1;
      if (filled.website_url) counts.website_filled += 1;
      if (filled.logo_url) counts.logo_filled += 1;
      if (filled.description) counts.description_filled += 1;
    }
  }
  counts.tickers_queried += batch.length;
  if ((offset + batch.length) % 100 === 0 || offset + batch.length === tickers.length) {
    console.log(`[wikidata] queried ${Math.min(offset + batch.length, tickers.length)}/${tickers.length} tickers; updated ${counts.stocks_updated} stocks so far`);
  }
  await sleep(1200);
}

const audit = await sql.query(`
  SELECT
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock') AS active_stocks,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND NULLIF(BTRIM(website_url),'') IS NULL) AS missing_website,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND NULLIF(BTRIM(logo_url),'') IS NULL) AS missing_logo,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND NULLIF(BTRIM(ceo),'') IS NULL) AS missing_ceo,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND founded_year IS NULL) AS missing_founded_year,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND NULLIF(BTRIM(headquarters),'') IS NULL) AS missing_headquarters,
    COUNT(*) FILTER (WHERE is_active AND asset_type='stock' AND NULLIF(BTRIM(description),'') IS NULL) AS missing_description
  FROM public.stocks
`);
console.log(JSON.stringify({ ...counts, remaining_missing: audit[0] }, null, 2));
