import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_DATABASE_URL;
const CONTACT_EMAIL = process.env.SEC_CONTACT_EMAIL;
if (!DATABASE_URL) throw new Error('NEON_DATABASE_URL is not configured.');
if (!CONTACT_EMAIL) throw new Error('SEC_CONTACT_EMAIL is not configured.');

const sql = neon(DATABASE_URL);
const USER_AGENT = process.env.SEC_USER_AGENT || `US Market AI company data research contact ${CONTACT_EMAIL}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => value == null || String(value).trim() === '' ? null : String(value).trim();
const delayMs = Math.max(150, Number(process.env.SEC_REQUEST_DELAY_MS || 250));

async function fetchSubmissions(cik) {
  const normalized = String(cik).replace(/\D/g, '').padStart(10, '0');
  const url = `https://data.sec.gov/submissions/CIK${normalized}.json`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'From': CONTACT_EMAIL, Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' },
    });
    const body = await response.text();
    if (response.ok) return body ? JSON.parse(body) : {};
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 5) {
      throw new Error(`SEC HTTP ${response.status}: ${body.slice(0, 250)}`);
    }
    await sleep(response.status === 429 ? 5000 * attempt : 1000 * attempt);
  }
  return {};
}

function addressLine(address) {
  if (!address || typeof address !== 'object') return null;
  const parts = [
    address.street1,
    address.street2,
    address.city,
    address.stateOrCountryDescription || address.stateOrCountry,
    address.zipCode,
  ].map(clean).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

const stocks = await sql.query(`
  SELECT id, symbol, cik, headquarters, city, state
  FROM public.stocks
  WHERE is_active IS TRUE AND asset_type = 'stock' AND cik IS NOT NULL
    AND (headquarters IS NULL OR btrim(headquarters) = '' OR city IS NULL OR btrim(city) = '' OR state IS NULL OR btrim(state) = '')
  ORDER BY symbol
`);

let fetched = 0;
let filledHeadquarters = 0;
let filledCity = 0;
let filledState = 0;
let noAddress = 0;
const failures = [];

for (const stock of stocks) {
  try {
    const data = await fetchSubmissions(stock.cik);
    const addresses = data.addresses || {};
    const business = addresses.business || {};
    const mailing = addresses.mailing || {};
    const chosen = Object.keys(business).some((key) => clean(business[key])) ? business : mailing;
    const headquarters = addressLine(chosen);
    const city = clean(chosen.city);
    const state = clean(chosen.stateOrCountryDescription || chosen.stateOrCountry);
    if (!headquarters && !city && !state) noAddress += 1;
    if (!stock.headquarters && headquarters) filledHeadquarters += 1;
    if (!stock.city && city) filledCity += 1;
    if (!stock.state && state) filledState += 1;

    await sql.query(`
      UPDATE public.stocks SET
        headquarters = COALESCE(NULLIF(headquarters, ''), $1),
        city = COALESCE(NULLIF(city, ''), $2),
        state = COALESCE(NULLIF(state, ''), $3),
        updated_at = CASE WHEN ($1 IS NOT NULL AND (headquarters IS NULL OR btrim(headquarters)=''))
                            OR ($2 IS NOT NULL AND (city IS NULL OR btrim(city)=''))
                            OR ($3 IS NOT NULL AND (state IS NULL OR btrim(state)=''))
                          THEN now() ELSE updated_at END
      WHERE id = $4
    `, [headquarters, city, state, Number(stock.id)]);
    fetched += 1;
    if (fetched % 250 === 0) console.log(`[SEC profile] processed ${fetched}/${stocks.length}`);
  } catch (error) {
    failures.push({ symbol: stock.symbol, error: String(error.message).slice(0, 250) });
  }
  await sleep(delayMs);
}

const audit = await sql.query(`
  SELECT count(*) total,
    count(*) FILTER (WHERE headquarters IS NOT NULL AND btrim(headquarters) <> '') headquarters_filled,
    count(*) FILTER (WHERE city IS NOT NULL AND btrim(city) <> '') city_filled,
    count(*) FILTER (WHERE state IS NOT NULL AND btrim(state) <> '') state_filled
  FROM public.stocks WHERE is_active IS TRUE AND asset_type='stock'
`);
console.log(JSON.stringify({
  provider: 'SEC submissions (company-reported business/mailing address)',
  eligible_stocks: stocks.length,
  submissions_fetched: fetched,
  filled_headquarters: filledHeadquarters,
  filled_city: filledCity,
  filled_state: filledState,
  no_address_records: noAddress,
  failed_requests: failures.length,
  failure_samples: failures.slice(0, 20),
  final_coverage: audit[0] ?? null,
  note: 'SEC submissions do not reliably provide CEO or company founding year; those fields are not inferred from IPO or incorporation dates.',
}, null, 2));
