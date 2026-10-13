import crypto from 'node:crypto';
import fs from 'node:fs';

const required = ['NEON_REST_URL', 'NEON_API_KEY', 'OPENAI_API_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured.`);

const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const baseUrl = process.env.NEON_REST_URL.replace(/\/$/, '');
const apiKey = process.env.NEON_API_KEY;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const arg = (name, fallback) => { const prefix = `--${name}=`; const value = process.argv.find(item => item.startsWith(prefix)); return value ? value.slice(prefix.length) : fallback; };
const limit = Math.max(1, Number(arg('limit', process.env.STOCK_RESEARCH_BATCH_SIZE || 10)));
const offset = Math.max(0, Number(arg('offset', 0)));
const onlySymbol = String(arg('symbol', process.env.STOCK_RESEARCH_SYMBOL || '')).toUpperCase().trim();
const force = process.argv.includes('--force');

async function db(table, { method = 'GET', params = {}, body, prefer = 'return=representation' } = {}) {
  const url = new URL(`${baseUrl}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { method, headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Prefer: prefer }, body: body ? JSON.stringify(body) : undefined });
      const text = await response.text();
      if (response.ok) return text ? JSON.parse(text) : null;
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 4) throw new Error(`Neon REST ${response.status} on ${table}: ${text.slice(0, 500)}`);
    } catch (error) { if (attempt === 4) throw error; }
    await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
  }
}

function parseCsvLine(line) {
  const out = []; let value = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { out.push(value); value = ''; }
    else value += char;
  }
  out.push(value); return out;
}
function readGscQueries() {
  const file = process.env.GSC_QUERIES_CSV || arg('gsc', '');
  if (!file || !fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(x => x.trim().toLowerCase());
  const idx = name => headers.findIndex(h => h === name.toLowerCase());
  const qi = idx('Top queries'), ci = idx('Clicks'), ii = idx('Impressions'), pi = idx('Position');
  if (qi < 0) return [];
  return lines.slice(1).map(line => parseCsvLine(line)).map(row => ({ query: row[qi]?.trim() || '', clicks: Number(row[ci] || 0), impressions: Number(row[ii] || 0), position: Number(row[pi] || 0) })).filter(row => row.query);
}
const gscRows = readGscQueries();
function relatedGsc(stock) {
  const terms = [stock.symbol, stock.company_name, ...String(stock.company_name || '').split(/[^a-z0-9]+/i).filter(x => x.length >= 4)].filter(Boolean).map(x => x.toLowerCase());
  return gscRows.filter(row => { const q = row.query.toLowerCase(); return terms.some(term => q.includes(term)); }).sort((a,b) => b.impressions-a.impressions).slice(0, 35);
}
function sha(data) { return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'); }
function safeJson(text) {
  const clean = String(text).replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(clean);
}
async function generate(data) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, temperature: 0.2, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are the senior equity research editor and SEO intent analyst for US Market AI, a US-investor-focused research platform. Output valid JSON only. Use only the supplied company/database evidence for factual claims. Do not invent numbers, causes, dates, guidance, analyst consensus, competitor metrics, citations, or future events. Clearly label interpretations and model scenarios. If evidence is absent, say what is unavailable and what primary-source evidence would be needed. Use US English, precise financial language, plain-English explanations, balanced bull/bear analysis, no guaranteed returns or personalized advice. Avoid repetitive prose and keyword stuffing.' },
        { role: 'user', content: `Create a structured, genuinely useful stock research page from this data for ${data.stock.company_name} (${data.stock.symbol}). This is NOT a generic 500-word article. Return JSON with:
{
 "title": "specific research title",
 "summary": "2-3 sentence evidence-based overview",
 "sections": [
  {"id":"business","heading":"Business model and revenue drivers","body":"3-5 paragraphs as a string, company-specific, fact/inference separated"},
  {"id":"what_changed","heading":"What changed and why it matters","body":"Explain only changes evidenced by the supplied time series, reports, news or revisions. If no comparable history, state that."},
  {"id":"financial_quality","heading":"Revenue, earnings and cash-flow quality","body":"Explain period-specific figures/trends, not just recite values."},
  {"id":"valuation","heading":"Valuation and peer context","body":"Use verified multiples and peer metrics only; otherwise explain what comparison is missing."},
  {"id":"forecast","heading":"Forecast, scenarios and assumptions","body":"Clearly separate stored quantitative model outputs from analyst consensus; explain horizons and limitations."},
  {"id":"technical","heading":"Technical trend in plain English","body":"Explain indicators only if supplied, including mixed/conflicting signals."},
  {"id":"bull_case","heading":"Bull case: what could go right","body":"Conditional, evidence-linked scenario."},
  {"id":"bear_case","heading":"Bear case: what could go wrong","body":"Company-specific only where evidence supports it; distinguish general risks."},
  {"id":"risks","heading":"Key risks and uncertainties","body":"Use filings/metrics when supplied; disclose gaps."},
  {"id":"news","heading":"Recent company developments","body":"Only relevant company-linked items from supplied news; explain possible significance without asserting causation."},
  {"id":"ownership","heading":"Insider and institutional ownership","body":"Use supplied records and their reporting periods; avoid inferring motives."},
  {"id":"dividends","heading":"Dividends and shareholder returns","body":"Use supplied records only; no assumed dividend status."},
  {"id":"watch_next","heading":"What investors should watch next","body":"Data-led indicators and confirmed dated events only; never invent an upcoming event."},
  {"id":"methodology","heading":"Data coverage and methodology","body":"Explain supplied source coverage, timestamps, limitations and missing fields."}
 ],
 "faqs":[{"question":"...","answer":"..."}],
 "keyword_opportunities":[{"query":"...","intent":"forecast|price|valuation|financials|earnings|technical|risk|dividend|business|comparison|ownership|news","source":"gsc_observed|research_idea","reason":"brief intent explanation","section_id":"..."}],
 "quality_notes":["missing evidence, contradictions or coverage limitations"]
}
Requirements:
- Produce 30-40 DISTINCT relevant keyword opportunities total, never count duplicates or tiny grammatical variants as distinct.
- GSC rows below are the only observed GSC queries; preserve their metrics and mark source gsc_observed. Do NOT claim research_idea phrases were observed in GSC or that search volume is known.
- Research ideas should be plausible US investor questions and specific to this company/sector. Do not add irrelevant keywords just to reach the count.
- FAQs: 8-12 unique questions, each answered with supplied evidence and no unsupported claims. Do not just duplicate keyword phrases.
- Each section body 2-4 short paragraphs. Make explanations useful: what a metric means, why it matters, what could change the interpretation. Do not repeat the same thesis across sections.
- If peer_metrics is empty or peer_metrics_withheld_count > 0, explain that verified peer comparisons are unavailable until a comparable peer group is validated; never infer rankings from unknown or withheld groups.
- If data is insufficient for a section, explain the exact missing evidence rather than writing filler.
- JSON only. DATA PAYLOAD: ${JSON.stringify(data)}` }
      ]
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${text.slice(0, 700)}`);
  const output = safeJson(JSON.parse(text).choices?.[0]?.message?.content || '{}');
  const requiredSections = ['business','what_changed','financial_quality','valuation','forecast','technical','bull_case','bear_case','risks','news','ownership','dividends','watch_next','methodology'];
  if (!output.title || !output.summary || !Array.isArray(output.sections) || !Array.isArray(output.faqs) || !Array.isArray(output.keyword_opportunities)) throw new Error('AI output missing required structured fields.');
  const sectionIds = new Set(output.sections.map(x => x.id));
  const missing = requiredSections.filter(id => !sectionIds.has(id));
  if (missing.length) throw new Error(`AI output missing sections: ${missing.join(',')}`);
  const normalized = output.keyword_opportunities.map(item => ({ ...item, query: String(item.query || '').trim() })).filter(item => item.query);
  const unique = [...new Map(normalized.map(item => [item.query.toLowerCase(), item])).values()];
  if (unique.length < 30 || unique.length > 40) throw new Error(`Expected 30-40 distinct keyword opportunities; received ${unique.length}.`);
  const faqKeys = new Set();
  output.faqs = output.faqs.filter(item => item?.question && item?.answer && !faqKeys.has(String(item.question).toLowerCase()) && faqKeys.add(String(item.question).toLowerCase())).slice(0, 12);
  output.keyword_opportunities = unique;
  output.research_version = 'stock-page-research-v1';
  output.generated_at = new Date().toISOString();
  output.model = model;
  output.source_data_hash = data.source_data_hash;
  return output;
}

const allStocks = await db('stocks', { params: { select: 'id,symbol,slug,company_name,description,sector,industry,exchange,asset_type,market_cap,is_active,is_indexable', is_active: 'eq.true', asset_type: 'eq.stock', order: 'market_cap.desc.nullslast', limit: 5000 } });
let stocks = (allStocks || []).filter(s => !onlySymbol || String(s.symbol).toUpperCase() === onlySymbol);
stocks = stocks.slice(offset, offset + limit);
let generated = 0, skipped = 0, failed = 0;
for (const stock of stocks) {
  try {
    const [quote, history, technical, fundamentals, metrics, statements, earnings, revisions, news, predictions, longTerm, dividends, risks, performance, valuations, peers, ownership, holders, insiders, filings, provenance] = await Promise.all([
      db('latest_quotes', { params: { select: '*', stock_id: `eq.${stock.id}`, limit: 1 } }),
      db('price_history', { params: { select: 'timestamp,close,high,low,volume', stock_id: `eq.${stock.id}`, timeframe: 'eq.1d', order: 'timestamp.desc', limit: 260 } }),
      db('technical_indicators', { params: { select: '*', stock_id: `eq.${stock.id}`, timeframe: 'eq.1d', order: 'calculated_at.desc', limit: 1 } }),
      db('fundamentals', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'updated_at.desc', limit: 4 } }),
      db('financial_metrics', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'period_end.desc', limit: 12 } }),
      db('financial_statements', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'period_end.desc', limit: 20 } }),
      db('earnings', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'earnings_date.desc', limit: 8 } }),
      db('earnings_revisions', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'revision_date.desc', limit: 12 } }),
      db('news', { params: { select: 'title,summary,source,url,published_at,sentiment,sentiment_score,relevance_score', stock_id: `eq.${stock.id}`, order: 'published_at.desc', limit: 10 } }),
      db('predictions', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'prediction_time.desc', limit: 12 } }),
      db('long_term_predictions', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'target_year.asc', limit: 10 } }),
      db('dividends', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'ex_date.desc', limit: 12 } }),
      db('risk_metrics', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'calculation_date.desc', limit: 1 } }),
      db('stock_performance', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'calculation_date.desc', limit: 1 } }),
      db('valuation_snapshots', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'valuation_date.desc', limit: 1 } }),
      db('peer_metrics', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'metric_date.desc', limit: 40 } }),
      db('ownership_snapshots', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'period_end.desc', limit: 8 } }),
      db('institutional_holders', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'period_end.desc', limit: 15 } }),
      db('insider_transactions', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'transaction_date.desc', limit: 15 } }),
      db('sec_filings', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'filing_date.desc', limit: 12 } }),
      db('data_provenance', { params: { select: '*', stock_id: `eq.${stock.id}`, order: 'retrieved_at.desc', limit: 12 } })
    ]);
    const gsc = relatedGsc(stock);
    const verifiedPeers = (peers || []).filter(row => {
      const group = String(row.peer_group_key || '').trim().toLowerCase();
      const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
      return group && !['unknown', 'n/a', 'none', 'unclassified'].includes(group)
        && ['company_value', 'peer_median', 'peer_average', 'percentile'].every(key => finite(row[key]))
        && Number(row.percentile) >= 0 && Number(row.percentile) <= 100
        && Math.abs(Number(row.company_value)) < 1e6
        && Math.abs(Number(row.peer_median)) < 1e6
        && Math.abs(Number(row.peer_average)) < 1e6;
    });
    const payload = { stock, quote: quote?.[0] || null, price_history: (history || []).reverse(), technical: technical?.[0] || null, fundamentals: fundamentals || [], financial_metrics: metrics || [], financial_statements: statements || [], earnings: earnings || [], estimate_revisions: revisions || [], company_news: news || [], quantitative_predictions: predictions || [], long_term_scenarios: longTerm || [], dividends: dividends || [], risk_metrics: risks?.[0] || null, performance: performance?.[0] || null, valuation: valuations?.[0] || null, peer_metrics: verifiedPeers, peer_metrics_withheld_count: (peers || []).length - verifiedPeers.length, ownership_snapshots: ownership || [], institutional_holders: holders || [], insider_transactions: insiders || [], sec_filings: filings || [], data_provenance: provenance || [], gsc_queries: gsc };
    const inputHash = sha(payload);
    const existing = await db('ai_articles', { params: { select: 'id,source_data_hash,content', stock_id: `eq.${stock.id}`, article_type: 'eq.market_analysis', order: 'updated_at.desc', limit: 1 } });
    if (!force && existing?.[0]?.source_data_hash === inputHash && String(existing?.[0]?.content || '').includes('stock-page-research-v1')) { skipped++; console.log(`SKIP ${stock.symbol}: unchanged source data`); continue; }
    payload.source_data_hash = inputHash;
    const research = await generate(payload);
    const content = JSON.stringify(research);
    const articleRow = { stock_id: stock.id, article_type: 'market_analysis', title: research.title, slug: `${String(stock.symbol).toLowerCase()}-investment-research`, content, summary: research.summary, model, source_data_hash: inputHash, generated_at: research.generated_at, updated_at: research.generated_at, is_published: true };
    if (existing?.[0]?.id != null) {
      await db('ai_articles', { method: 'PATCH', params: { id: `eq.${existing[0].id}` }, body: articleRow, prefer: 'return=minimal' });
    } else {
      await db('ai_articles', { method: 'POST', body: [articleRow], prefer: 'return=minimal' });
    }
    generated++;
    console.log(`OK ${stock.symbol}: ${research.sections.length} sections, ${research.keyword_opportunities.length} keyword opportunities, ${research.faqs.length} FAQs`);
  } catch (error) { failed++; console.error(`FAIL ${stock.symbol}: ${error.message}`); }
  await sleep(Number(process.env.AI_REQUEST_DELAY_MS || 1000));
}
console.log(JSON.stringify({ requested: stocks.length, generated, skipped, failed, offset, limit, gscRowsLoaded: gscRows.length, model }, null, 2));
