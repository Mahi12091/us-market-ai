import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.NEON_DATABASE_URL;
if (!databaseUrl) throw new Error('NEON_DATABASE_URL is not configured.');
const sql = neon(databaseUrl);
const clean = (value) => value == null || String(value).trim() === '' ? null : String(value).trim();
const norm = (value) => String(value ?? '').toLowerCase().replace(/&/g, ' and ').replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|holdings|holding|class [a-z]|ordinary shares)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const yearOf = (value) => {
  const match = String(value ?? '').match(/^([+-]?\d{4,})-/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1600 && year <= new Date().getFullYear() ? year : null;
};
const similarity = (a, b) => {
  const x = new Set(norm(a).split(/\s+/).filter((w) => w.length > 1));
  const y = new Set(norm(b).split(/\s+/).filter((w) => w.length > 1));
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const word of x) if (y.has(word)) common += 1;
  return common / Math.max(x.size, y.size);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const headers = {
  'User-Agent': 'USMarketAI/1.0 (company metadata enrichment; https://usmarketai.com)',
  'Accept': 'application/json'
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
console.log(`[wikipedia] Candidate stocks with one or more missing fields: ${stocks.length}`);

const counts = { candidates: stocks.length, wikipedia_pages_found: 0, wikidata_entities_found: 0, stocks_updated: 0, ceo_filled: 0, founded_year_filled: 0, headquarters_filled: 0, website_filled: 0, logo_filled: 0, description_filled: 0, unmatched: 0, errors: 0 };
const poolSize = 5;
let cursor = 0;
let completed = 0;

async function fetchJson(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  return response.json();
}
function claimValue(entity, property) {
  const claim = entity?.claims?.[property]?.find((item) => item.rank === 'preferred') ?? entity?.claims?.[property]?.[0];
  const value = claim?.mainsnak?.datavalue?.value;
  if (!value) return null;
  if (typeof value === 'object' && value.id) return value.id;
  if (typeof value === 'object' && value.time) return value.time;
  if (typeof value === 'object' && value.text) return value.text;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}
async function getEntity(entityId) {
  const data = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(entityId)}.json`);
  return data.entities?.[entityId] ?? null;
}
async function getLabel(entityId) {
  try {
    const data = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(entityId)}&props=labels&languages=en&format=json`);
    return clean(data.entities?.[entityId]?.labels?.en?.value);
  } catch { return null; }
}
async function processStock(stock) {
  const name = clean(stock.company_name);
  if (!name) { counts.unmatched++; return; }
  try {
    // Search by company name instead of ticker-property matching, which covers very few listed companies.
    const params = new URLSearchParams({
      action: 'query', list: 'search', srsearch: name, srnamespace: '0',
      srlimit: '5', format: 'json', origin: '*'
    });
    const wiki = await fetchJson(`https://en.wikipedia.org/w/api.php?${params}`);
    const pages = wiki.query?.search ?? [];
    let wikiSummary = null;
    let bestPage = null;
    let bestScore = 0;
    for (const page of pages) {
      const score = similarity(name, page.title);
      if (score > bestScore) { bestScore = score; bestPage = page; }
    }
    if (bestPage && bestScore >= 0.55) {
      counts.wikipedia_pages_found++;
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestPage.title.replace(/ /g, '_'))}`;
      try { wikiSummary = await fetchJson(summaryUrl); } catch {}
    }

    // Search Wikidata by company name; then verify the returned entity label before using its claims.
    const wdParams = new URLSearchParams({
      action: 'wbsearchentities', search: name, language: 'en', uselang: 'en',
      type: 'item', limit: '5', format: 'json'
    });
    const search = await fetchJson(`https://www.wikidata.org/w/api.php?${wdParams}`);
    const entities = (search.search ?? []).map((e) => ({
      id: e.id, label: clean(e.label), description: clean(e.description),
      score: similarity(name, e.label)
    })).sort((a, b) => b.score - a.score);
    const best = entities[0];
    let entity = null;
    if (best && best.score >= 0.55 && (!entities[1] || best.score - entities[1].score >= 0.05)) {
      entity = await getEntity(best.id);
      if (entity) counts.wikidata_entities_found++;
    }

    let ceo = null, foundedYear = null, headquarters = null, website = null, logo = null, description = null;
    if (entity) {
      const claims = entity.claims ?? {};
      const ceoId = claimValue(entity, 'P169');
      const hqId = claimValue(entity, 'P159');
      if (ceoId?.startsWith('Q')) ceo = await getLabel(ceoId);
      if (hqId?.startsWith('Q')) headquarters = await getLabel(hqId);
      foundedYear = yearOf(claimValue(entity, 'P571'));
      website = claimValue(entity, 'P856');
      const logoFile = claimValue(entity, 'P154');
      if (logoFile) logo = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(logoFile)}`;
      description = clean(entity.descriptions?.en?.value);
    }
    if (!description && wikiSummary?.type === 'standard') description = clean(wikiSummary.extract);
    if (!logo && wikiSummary?.thumbnail?.source) logo = wikiSummary.thumbnail.source;
    if (!website && wikiSummary?.content_urls?.desktop?.page) {
      // Do not treat the Wikipedia page itself as the company's official website.
      website = null;
    }

    const values = {
      ceo: ceo && !/^unknown$/i.test(ceo) ? ceo : null,
      founded_year: foundedYear,
      headquarters,
      website_url: website,
      logo_url: logo,
      description
    };
    const filled = {
      ceo: !clean(stock.ceo) && values.ceo,
      founded_year: stock.founded_year == null && values.founded_year,
      headquarters: !clean(stock.headquarters) && values.headquarters,
      website_url: !clean(stock.website_url) && values.website_url,
      logo_url: !clean(stock.logo_url) && values.logo_url,
      description: !clean(stock.description) && values.description
    };
    if (Object.values(filled).some(Boolean)) {
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
      counts.stocks_updated++;
      for (const field of ['ceo', 'founded_year', 'headquarters', 'website_url', 'logo_url', 'description']) {
        if (filled[field]) counts[field === 'website_url' ? 'website_filled' : field === 'logo_url' ? 'logo_filled' : field === 'founded_year' ? 'founded_year_filled' : field === 'headquarters' ? 'headquarters_filled' : field === 'description' ? 'description_filled' : 'ceo_filled']++;
      }
    } else if (!entity && !wikiSummary) counts.unmatched++;
  } catch (error) {
    counts.errors++;
    if (counts.errors <= 20) console.warn(`[wikipedia] ${stock.symbol}: ${error.message}`);
  }
}

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= stocks.length) return;
    await processStock(stocks[index]);
    completed++;
    if (completed % 50 === 0 || completed === stocks.length) {
      console.log(`[wikipedia] processed ${completed}/${stocks.length}; updated ${counts.stocks_updated}; Wikipedia pages ${counts.wikipedia_pages_found}; Wikidata entities ${counts.wikidata_entities_found}`);
    }
    await sleep(150);
  }
}
await Promise.all(Array.from({ length: poolSize }, worker));

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
