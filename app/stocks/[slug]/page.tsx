import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createDatabaseClient } from '@/lib/neon';
import PriceChart, { type ChartPoint } from '@/components/price-chart';
import { cleanNewsText, newsSummary, safeNewsUrl } from '@/lib/news-content';

export const revalidate = 300;

const finite = (v: unknown): number | null => { if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const positive = (v: unknown): number | null => { const n = finite(v); return n !== null && n > 0 ? n : null; };
const usableMultiple = (value: unknown, max = 500): number | null => {
  const n = finite(value);
  return n !== null && n > 0 && n <= max ? n : null;
};
const safeRiskMetric = (field: string, value: unknown): number | null => {
  const n = finite(value);
  if (n === null) return null;
  if (field === 'beta' || field === 'sharpe_ratio' || field === 'sortino_ratio') return Math.abs(n) <= 10 ? n : null;
  if (field === 'debt_equity') return n >= 0 && n <= 100 ? n : null;
  if (field === 'current_ratio' || field === 'quick_ratio') return n >= 0 && n <= 100 ? n : null;
  if (field === 'interest_coverage') return n >= -100 && n <= 1000 ? n : null;
  if (field === 'altman_z_score') return Math.abs(n) <= 100 ? n : null;
  if (field === 'volatility' || field === 'atr') return n >= 0 ? n : null;
  return n;
};
const statementMetric = (row: any, field: string): number | null => {
  const value = finite(row?.[field]);
  if (value === null) return null;
  if ((field === 'shares_basic' || field === 'shares_diluted') && value <= 0) return null;
  if (field === 'net_income' && value === 0 && ((finite(row?.eps_basic) ?? 0) > 0 || (finite(row?.eps_diluted) ?? 0) > 0)) return null;
  if ((field === 'eps_basic' || field === 'eps_diluted') && value === 0 && (finite(row?.net_income) ?? 0) > 0) return null;
  return value;
};
const money = (v: unknown, digits = 2) => { const n = finite(v); return n === null ? '—' : `${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`; };
const pct = (v: unknown) => { const n = finite(v); return n === null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; };
const compactMoney = (v: unknown) => { const n = finite(v); return n === null ? '—' : `${n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`; };
// 13F values can be mis-scaled by upstream ingestion. Hide only clearly implausible per-share values; never rewrite stored records here.
const holderValueForDisplay = (holder: any, currentPrice: unknown) => {
  const value = finite(holder?.market_value ?? holder?.value);
  const shares = finite(holder?.shares_held ?? holder?.shares);
  const price = finite(currentPrice);
  if (value === null || value <= 0) return '—';
  if (shares !== null && shares > 0 && price !== null && price > 0) {
    const impliedPrice = value / shares;
    if (impliedPrice > price * 100 || impliedPrice < price / 100) return 'Withheld: value fails validation';
  }
  return compactMoney(value);
};
const number = (v: unknown, digits = 2) => { const n = finite(v); return n === null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits }); };
const dateLabel = (v: unknown) => { if (!v) return '—'; const d = new Date(String(v)); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
const metricExplanation = (label: string) => (({
  'Revenue': 'Total sales reported for the period; compare growth across several periods.',
  'Revenue growth': 'How quickly sales are expanding or contracting versus the comparison period.',
  'Gross margin': 'Share of revenue left after direct costs; higher margins can indicate pricing power.',
  'Operating margin': 'Share of revenue left after operating expenses, before interest and taxes.',
  'Net margin': 'Share of revenue that remains as profit after expenses and taxes.',
  'EPS': 'Earnings per share for the stored reporting period; confirm whether the figure is quarterly, annual or trailing twelve months before comparing it with valuation multiples.',
  'EPS (reported period)': 'Earnings per share for the stored reporting period; confirm whether the figure is quarterly, annual or trailing twelve months before comparing it with valuation multiples.',
  'Debt / equity': 'Debt relative to shareholder equity; definitions may vary by data provider.',
  'Free cash flow': 'Cash remaining after operating needs and capital expenditure; can support investment or shareholder returns.',
  'Return on equity': 'Profit generated relative to book equity; leverage and one-off gains can distort it.',
  'Return on invested capital': 'How effectively the business earns returns on capital used in operations.',
  'Market cap': 'Market value of outstanding shares, not the same as enterprise value.',
  'P/E ratio': 'Share price relative to earnings per share; interpret alongside growth and peers.',
  'Forward P/E': 'Price relative to estimated future earnings; changes when forecasts are revised.',
  '52-week high': 'Highest stored price over the rolling year; not a fair-value estimate.',
  '52-week low': 'Lowest stored price over the rolling year; not a support guarantee.',
  'Average volume': 'Typical shares traded; helps assess liquidity but can change around events.',
  'RSI (14)': 'Momentum oscillator from 0–100; extreme readings are context, not automatic buy/sell signals.',
  'SMA 20': 'Average closing price over about 20 trading sessions; a short-term trend reference.',
  'SMA 50': 'Average closing price over about 50 sessions; often used to assess medium-term direction.',
  'SMA 200': 'Average closing price over about 200 sessions; a longer-term trend reference.',
  'MACD histogram': 'Difference between MACD and its signal line; sign and changes indicate momentum shifts.',
  'ATR': 'Average true range estimates recent price movement size, not direction.',
  'ADX': 'Measures trend strength, not whether the trend is bullish or bearish.',
} as Record<string, string>)[label] ?? 'Interpret alongside the company’s history, sector peers, reporting period and data source.');

const horizonOrder: Record<string, number> = { '24h': 1, '7d': 2, '30d': 3, '90d': 4 };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const db = createDatabaseClient();
  const { data: stock } = await db.from('stocks').select('company_name,symbol,description,sector,industry').eq('slug', slug).maybeSingle();
  if (!stock) return { title: 'Stock Not Found', robots: { index: false, follow: true } };

  const title = `${stock.company_name} (${stock.symbol}) Forecast and Analysis | Stock Price & Financials`;
  const description = `${stock.company_name} (${stock.symbol}) forecast and analysis: stock price, price prediction, valuation, financials, earnings, dividends and risks. See verified data and model outlook.`.slice(0, 160);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  const canonical = siteUrl ? `${siteUrl}/stocks/${slug}` : `/stocks/${slug}`;

  return {
    title,
    description,
    keywords: [stock.symbol, `${stock.company_name} stock`, `${stock.symbol} stock price`, `${stock.symbol} financials`, `${stock.symbol} valuation`, `${stock.symbol} earnings`, `${stock.symbol} dividend`, `${stock.symbol} stock analysis`, stock.sector, stock.industry].filter(Boolean) as string[],
    alternates: { canonical }, robots: { index: true, follow: true },
    openGraph: { title, description, type: 'website', url: canonical },
    twitter: { card: 'summary', title, description },
  };
}

export default async function StockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createDatabaseClient();
  const { data: stock } = await db.from('stocks').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (!stock) notFound();

  const [{ data: quote }, { data: tech }, { data: predictions }, { data: article }, { data: aiResearch }, { data: rawFundamentals }, { data: financialMetrics }, { data: earnings }, { data: earningsRevisions }, { data: news }, { data: history }, { data: results }, { data: related }, { data: financialStatements }, { data: dividends }, { data: ownership }, { data: institutionalHolders }, { data: insiderTransactions }, { data: monthlyResearch }, { data: quarterlyResearch }, { data: threeSpreadMetrics }, { data: threeSpreadRatios }, { data: performance }, { data: risks }, { data: valuations }, { data: secFilings }, { data: identifiers }, { data: peerMetrics }, { data: provenance }, { data: quality }, { data: longTerm }] = await Promise.all([
    db.from('latest_quotes').select('*').eq('stock_id', stock.id).maybeSingle(),
    db.from('technical_indicators').select('*').eq('stock_id', stock.id).eq('timeframe', '1d').order('calculated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('predictions').select('*').eq('stock_id', stock.id).eq('model_version', 'quant-v3.0').order('prediction_time', { ascending: false }).limit(8),
    db.from('ai_articles').select('title,summary,content,updated_at').eq('stock_id', stock.id).eq('is_published', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('ai_research').select('*').eq('stock_id', stock.id).order('updated_at', { ascending: false }).limit(3),
    db.from('fundamentals').select('*').eq('stock_id', stock.id).lte('report_date', new Date().toISOString().slice(0, 10)).order('report_date', { ascending: false, nullsFirst: false }).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('financial_metrics').select('*').eq('stock_id', stock.id).lte('period_end', new Date().toISOString().slice(0, 10)).order('period_end', { ascending: false }).limit(12),
    db.from('earnings').select('*').eq('stock_id', stock.id).order('earnings_date', { ascending: false }).limit(6),
    db.from('earnings_revisions').select('*').eq('stock_id', stock.id).order('revision_date', { ascending: false }).limit(12),
    db.from('news').select('id,title,summary,url,source,published_at,sentiment').eq('stock_id', stock.id).order('published_at', { ascending: false }).limit(5),
    db.from('price_history').select('timestamp,close,high,low').eq('stock_id', stock.id).eq('timeframe', '1d').order('timestamp', { ascending: false }).limit(250),
    db.from('prediction_results').select('id,horizon,predicted_price,actual_price,percentage_error,hit,evaluated_at').eq('stock_id', stock.id).order('evaluated_at', { ascending: false }).limit(8),
    db.from('stocks').select('id,symbol,slug,company_name,sector,industry,market_cap').eq('is_active', true).eq(stock.sector && String(stock.sector).toLowerCase() !== 'other' ? 'sector' : 'industry', stock.sector && String(stock.sector).toLowerCase() !== 'other' ? stock.sector : (stock.industry ?? '')).neq('id', stock.id).order('market_cap', { ascending: false, nullsFirst: false }).limit(4),
    db.from('financial_statements').select('*').eq('stock_id', stock.id).lte('period_end', new Date().toISOString().slice(0, 10)).order('period_end', { ascending: false }).order('statement_type', { ascending: true }).limit(60),
    db.from('dividends').select('*').eq('stock_id', stock.id).order('ex_date', { ascending: false, nullsFirst: false }).order('declaration_date', { ascending: false }).limit(30),
    db.from('ownership_snapshots').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(8),
    db.from('institutional_holders').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(50),
    db.from('insider_transactions').select('*').eq('stock_id', stock.id).order('transaction_date', { ascending: false }).limit(20),
    db.from('monthly_stock_research').select('*').eq('stock_id', stock.id).order('research_month', { ascending: false }).limit(6),
    db.from('quarterly_stock_research').select('*').eq('stock_id', stock.id).lte('period_end', new Date().toISOString().slice(0, 10)).order('period_end', { ascending: false }).limit(4),
    db.from('threespread_metrics').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(100),
    db.from('threespread_ratios').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(100),
    db.from('stock_performance').select('*').eq('stock_id', stock.id).order('calculation_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('risk_metrics').select('*').eq('stock_id', stock.id).order('calculation_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('valuation_snapshots').select('*').eq('stock_id', stock.id).order('valuation_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('sec_filings').select('*').eq('stock_id', stock.id).order('filing_date', { ascending: false }).limit(30),
    db.from('stock_identifiers').select('*').eq('stock_id', stock.id).limit(20),
    db.from('peer_metrics').select('*').eq('stock_id', stock.id).order('metric_date', { ascending: false }).limit(24),
    db.from('data_provenance').select('*').eq('stock_id', stock.id).order('retrieved_at', { ascending: false }).limit(24),
    db.from('data_quality').select('*').eq('stock_id', stock.id).order('check_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('long_term_predictions').select('*').eq('stock_id', stock.id).eq('model_version', 'long-term-v1.0').order('target_year', { ascending: true }),
  ]);

  const fundamentals = rawFundamentals ? { ...rawFundamentals } : null;
  // Reject impossible zero sentinels for positive-only identity/scale fields, and flag internally contradictory earnings facts instead of presenting them as verified financial results.
  if (fundamentals && finite(fundamentals.shares_outstanding) !== null && Number(fundamentals.shares_outstanding) <= 0) fundamentals.shares_outstanding = null;
  if (fundamentals && finite(fundamentals.market_cap) !== null && Number(fundamentals.market_cap) <= 0) fundamentals.market_cap = null;
  if (fundamentals && finite(fundamentals.net_income) === 0 && (finite(fundamentals.eps) ?? 0) > 0) {
    fundamentals.net_income = null;
    if (finite(fundamentals.roe) === 0) fundamentals.roe = null;
    if (finite(fundamentals.roa) === 0) fundamentals.roa = null;
  }

  const orderedHistory = [...(history ?? [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const chart: ChartPoint[] = orderedHistory.filter(x => finite(x.close) !== null && Number.isFinite(new Date(x.timestamp).getTime())).map(x => ({ time: new Date(x.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), close: finite(x.close)! }));
  const derived52WeekHigh = orderedHistory.map(x => finite(x.high)).filter((v): v is number => v !== null).reduce((m, v) => Math.max(m, v), -Infinity);
  const derived52WeekLow = orderedHistory.map(x => finite(x.low)).filter((v): v is number => v !== null).reduce((m, v) => Math.min(m, v), Infinity);
  const week52High = finite(quote?.week_52_high) ?? (Number.isFinite(derived52WeekHigh) ? derived52WeekHigh : null);
  const week52Low = finite(quote?.week_52_low) ?? (Number.isFinite(derived52WeekLow) ? derived52WeekLow : null);
  const dailyChange = quote?.change_percent;
  const livePredictions = [...(predictions ?? [])].filter(p => finite(p.predicted_price) !== null && Number.isFinite(new Date(p.prediction_time).getTime())).sort((a, b) => (horizonOrder[String(a.horizon).toLowerCase()] ?? 99) - (horizonOrder[String(b.horizon).toLowerCase()] ?? 99));
  const latestPrediction = livePredictions[0];
  const direction = latestPrediction?.direction ?? 'Not available yet';
  const securityType = stock.company_name?.toLowerCase().includes('preferred stock') ? 'Preferred Stock' : (stock.asset_type ?? 'Equity');
  const displaySector = stock.sector && String(stock.sector).toLowerCase() !== 'other' ? stock.sector : (stock.industry ?? securityType);
  const marketCap = positive(quote?.market_cap) ?? positive(fundamentals?.market_cap) ?? positive(stock.market_cap);
  const technicalTrend = tech?.trend ?? (() => {
    const price = finite(quote?.price), sma20 = finite(tech?.sma_20), sma50 = finite(tech?.sma_50), sma200 = finite(tech?.sma_200), rsi = finite(tech?.rsi), hist = finite(tech?.macd_histogram);
    if (price === null || sma20 === null || sma50 === null || sma200 === null || rsi === null || hist === null) return 'Not available yet';
    const above = Number(price>sma20) + Number(price>sma50) + Number(price>sma200);
    if (above >= 2 && rsi >= 50 && hist >= 0) return 'Bullish';
    if (above <= 1 && rsi < 50 && hist < 0) return 'Bearish';
    return 'Mixed';
  })();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  const pageUrl = siteUrl ? `${siteUrl}/stocks/${stock.slug}` : `/stocks/${stock.slug}`;
  const modifiedDate = article?.updated_at ?? quote?.quote_timestamp ?? tech?.calculated_at ?? undefined;
  let articleResearch: any = null;
  try { const parsed = JSON.parse(String(article?.content ?? '')); if (parsed?.research_version === 'stock-page-research-v1' && Array.isArray(parsed.sections)) articleResearch = parsed; } catch { /* Legacy plain-text articles remain supported. */ }

  const breadcrumbJsonLd = {
    '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl ? `${siteUrl}/` : '/' },
      { '@type': 'ListItem', position: 2, name: 'US Stocks', item: siteUrl ? `${siteUrl}/stocks` : '/stocks' },
      ...(stock.sector ? [{ '@type': 'ListItem', position: 3, name: stock.sector, item: siteUrl ? `${siteUrl}/stocks?sector=${encodeURIComponent(stock.sector)}` : `/stocks?sector=${encodeURIComponent(stock.sector)}` }] : []),
      { '@type': 'ListItem', position: stock.sector ? 4 : 3, name: stock.symbol, item: pageUrl },
    ],
  };
  const datasetJsonLd = {
    '@type': 'Dataset', name: `${stock.company_name} (${stock.symbol}) stock market research data`, alternateName: `${stock.symbol} stock data`,
    description: `Market research dataset for ${stock.company_name} (${stock.symbol}), including price history, technical indicators, financial statements, fundamentals, earnings, dividends, ownership data and quantitative model outputs when available.`,
    url: pageUrl, spatialCoverage: 'United States', isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: 'US Market AI', url: siteUrl || '/' }, dateModified: modifiedDate ? new Date(modifiedDate).toISOString() : undefined,
  };
  const articleJsonLd = article?.content ? {
    '@type': 'Article', headline: article.title || `${stock.company_name} (${stock.symbol}) Stock Analysis`, description: article.summary || `Research update for ${stock.company_name} (${stock.symbol}).`,
    dateModified: article.updated_at ? new Date(article.updated_at).toISOString() : undefined, author: { '@type': 'Organization', name: 'US Market AI', url: siteUrl || '/' }, mainEntityOfPage: pageUrl,
  } : null;
  const faqJsonLd = articleResearch?.faqs?.length ? { '@type': 'FAQPage', mainEntity: articleResearch.faqs.slice(0, 12).map((item: any) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) } : null;
  const graphJsonLd = { '@context': 'https://schema.org', '@graph': [datasetJsonLd, breadcrumbJsonLd, ...(articleJsonLd ? [articleJsonLd] : []), ...(faqJsonLd ? [faqJsonLd] : [])] };

  const cleanHistory = orderedHistory.filter(x => finite(x.close) !== null && Number.isFinite(new Date(x.timestamp).getTime()));
  const quoteTimestamp = quote?.quote_timestamp && Number.isFinite(new Date(quote.quote_timestamp).getTime()) ? new Date(quote.quote_timestamp) : null;
  // Keep displaying the last stored price with its timestamp, but never present an old daily move as current.
  const quoteIsStale = !quoteTimestamp || Date.now() - quoteTimestamp.getTime() > 4 * 24 * 60 * 60 * 1000;
  const valuationPe = usableMultiple(valuations?.pe) ?? usableMultiple(fundamentals?.pe_ratio);
  const valuationForwardPe = usableMultiple(valuations?.forward_pe) ?? usableMultiple(fundamentals?.forward_pe);
  const valuationPs = usableMultiple(fundamentals?.price_sales);
  const valuationPb = usableMultiple(fundamentals?.price_book);
  const rsi = finite(tech?.rsi);
  const sma20 = finite(tech?.sma_20), sma50 = finite(tech?.sma_50), sma200 = finite(tech?.sma_200);
  const stockTerms = [String(stock.symbol ?? '').toLowerCase(), String(stock.company_name ?? '').toLowerCase(), ...String(stock.company_name ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((part: string) => part.length >= 4)].filter(Boolean);
  const visibleNews = (news ?? []).filter((n: any) => {
    const title = String(n.title ?? '').toLowerCase();
    return title.trim() && stockTerms.some(term => title.includes(term));
  }).slice(0, 8);
  const verifiedPeerMetrics = (peerMetrics ?? []).filter((p: any) => {
    const group = String(p.peer_group_key ?? '').trim().toLowerCase();
    const metric = String(p.metric_name ?? '').trim().toLowerCase();
    const values = [finite(p.company_value), finite(p.peer_median), finite(p.peer_average)];
    const percentile = finite(p.percentile);
    const isPeMetric = metric === 'pe' || metric.includes('pe_ratio') || metric.includes('price_earnings');
    const maxAbs = isPeMetric ? 500 : 1000;
    const returnField = metric.includes('roe') ? 'roe' : metric.includes('roa') ? 'roa' : metric.includes('roic') ? 'roic' : null;
    if (returnField && finite(fundamentals?.[returnField]) === null) return false;
    return group !== '' && !['unknown', 'n/a', 'none', 'unclassified'].includes(group)
      && values.every((value) => value !== null && Math.abs(value) <= maxAbs)
      && percentile !== null && percentile >= 0 && percentile <= 100;
  });
  const hasOwnershipData = (institutionalHolders ?? []).length > 0 || (ownership ?? []).length > 0;
  const hasInsiderTransactions = (insiderTransactions ?? []).length > 0;
  const hasSecFilings = (secFilings ?? []).length > 0;
  const hasPublishedResearch = Boolean(article?.summary || article?.content) || (aiResearch ?? []).some((r: any) => Boolean(r.title || r.summary || r.content || r.analysis));
  const hasPeriodResearch = (quarterlyResearch ?? []).some((r: any) => Boolean(r.ai_summary || r.financial_summary || r.earnings_summary || r.summary || r.research_summary || r.content))
    || (monthlyResearch ?? []).some((r: any) => Boolean(r.ai_summary || r.fundamental_summary || r.technical_summary || r.summary || r.research_summary || r.content));
  const hasThirdPartyData = (threeSpreadMetrics ?? []).some((m: any) => finite(m.value) !== null)
    || (threeSpreadRatios ?? []).some((m: any) => finite(m.value) !== null);
  const hasProvenanceData = Boolean(quality) || (provenance ?? []).length > 0;
  const hasEvaluationData = (identifiers ?? []).length > 0 || (results ?? []).length > 0;
  const hasResearchEvidence = hasOwnershipData || hasInsiderTransactions || hasSecFilings || hasPublishedResearch || hasPeriodResearch || hasThirdPartyData || hasProvenanceData || hasEvaluationData;
  const shortForecastRows = livePredictions.filter(p => finite(p.predicted_price) !== null).map(p => [String(p.horizon).toUpperCase(), money(p.predicted_price), pct(p.predicted_change_percent), p.direction ?? '—', finite(p.confidence) === null ? '—' : number(p.confidence, 0)]);
  // The production schema stores bear/base/bull scenario prices and expected_cagr (in percent units),
  // not predicted_price/predicted_return_percent. Keep only the newest stored scenario for each future year.
  const latestLongTermByYear = new Map<number, any>();
  for (const prediction of longTerm ?? []) {
    const year = finite(prediction.target_year);
    if (year === null || year <= new Date().getUTCFullYear()) continue;
    const current = latestLongTermByYear.get(year);
    const predictionDate = new Date(prediction.prediction_date ?? prediction.updated_at ?? prediction.created_at ?? 0).getTime();
    const currentDate = current ? new Date(current.prediction_date ?? current.updated_at ?? current.created_at ?? 0).getTime() : -Infinity;
    if (!current || predictionDate > currentDate) latestLongTermByYear.set(year, prediction);
  }
  const longForecastRows = [...latestLongTermByYear.values()]
    .filter((prediction: any) => {
      const bear = finite(prediction.bear_price), base = finite(prediction.base_price), bull = finite(prediction.bull_price);
      const cagr = finite(prediction.expected_cagr), confidence = finite(prediction.confidence);
      return bear !== null && base !== null && bull !== null
        && bear > 0 && bear <= base && base <= bull
        && (cagr === null || (cagr >= -100 && cagr <= 100))
        && (confidence === null || (confidence >= 0 && confidence <= 100));
    })
    .sort((a: any, b: any) => Number(a.target_year) - Number(b.target_year))
    .map((prediction: any) => [
      String(prediction.target_year),
      money(prediction.base_price),
      money(prediction.bear_price),
      money(prediction.bull_price),
      finite(prediction.expected_cagr) === null ? '—' : `${number(prediction.expected_cagr, 2)}%`,
      finite(prediction.confidence) === null ? '—' : number(prediction.confidence, 0),
      String(prediction.signal ?? prediction.direction ?? '—'),
    ]);
  const cellHasValue = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '—' && String(value).trim() !== 'null' && String(value).trim() !== 'undefined';
  const table = (headers: string[], rows: any[][]) => {
    // Hide genuinely empty/provider-placeholder rows and exact duplicates before rendering.
    const seen = new Set<string>();
    const clean = rows.filter(row => row.some(cellHasValue) && row.filter(cellHasValue).length >= 2).filter(row => {
      const key = JSON.stringify(row.map(value => value == null ? '' : String(value).trim()));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!clean.length) return <div className="sd-empty">No verified records available for this section yet.</div>;
    return <div className="sd-table-scroll"><table className="sd-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{clean.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value == null || String(value).trim() === '' ? '—' : typeof value === 'object' ? value : String(value)}</td>)}</tr>)}</tbody></table></div>;
  };
  const metricCards = [
    ['Market cap', compactMoney(marketCap)], ['P/E ratio', number(valuationPe)], ['Forward P/E', number(valuationForwardPe)],
    ['52-week high', money(week52High)], ['52-week low', money(week52Low)], ['Average volume', quote?.volume == null ? '—' : Number(quote.volume).toLocaleString('en-US')],
  ].filter(([, value]) => value !== '—');
  const financialCards = [
    ['Revenue', compactMoney(fundamentals?.revenue)], ['Revenue growth', pct(fundamentals?.revenue_growth)],
    ['Gross profit', compactMoney(fundamentals?.gross_profit)], ['Operating income', compactMoney(fundamentals?.operating_income)],
    ['Net income', compactMoney(fundamentals?.net_income)], ['EPS (reported period)', money(fundamentals?.eps)],
    ['EPS growth', pct(fundamentals?.eps_growth)], ['Gross margin', pct(fundamentals?.gross_margin)],
    ['Operating margin', pct(fundamentals?.operating_margin)], ['Net margin', pct(fundamentals?.net_margin)],
    ['EBITDA', compactMoney(fundamentals?.ebitda)], ['EBIT', compactMoney(fundamentals?.ebit)],
    ['Cash & equivalents', compactMoney(fundamentals?.cash_and_equivalents)], ['Short-term investments', compactMoney(fundamentals?.short_term_investments)],
    ['Total assets', compactMoney(fundamentals?.total_assets)], ['Total liabilities', compactMoney(fundamentals?.total_liabilities)],
    ['Total debt', compactMoney(fundamentals?.total_debt)], ['Shareholders equity', compactMoney(fundamentals?.shareholders_equity)],
    ['Current assets', compactMoney(fundamentals?.current_assets)], ['Current liabilities', compactMoney(fundamentals?.current_liabilities)],
    ['Operating cash flow', compactMoney(fundamentals?.operating_cash_flow)], ['Capital expenditure', compactMoney(fundamentals?.capital_expenditure)],
    ['Free cash flow', compactMoney(fundamentals?.free_cash_flow)], ['FCF margin', pct(fundamentals?.fcf_margin)],
    ['Return on equity', pct(fundamentals?.roe)], ['Return on assets', pct(fundamentals?.roa)],
    ['Return on invested capital', pct(fundamentals?.roic)], ['Return on capital employed', pct(fundamentals?.roce)],
    ['Debt / equity', number(safeRiskMetric('debt_equity', fundamentals?.debt_equity))], ['PEG ratio', number(usableMultiple(fundamentals?.peg_ratio, 100))],
    ['Price / sales', number(usableMultiple(fundamentals?.price_sales))], ['Price / book', number(usableMultiple(fundamentals?.price_book))],
    ['EV / revenue', number(usableMultiple(fundamentals?.enterprise_value_to_revenue))], ['EV / EBITDA', number(usableMultiple(fundamentals?.enterprise_value_to_ebitda))],
    ['Price / FCF', number(usableMultiple(fundamentals?.price_to_fcf))], ['Earnings yield', pct(fundamentals?.earnings_yield)],
    ['Dividend yield', pct(fundamentals?.dividend_yield)], ['Payout ratio', pct(fundamentals?.payout_ratio)],
    ['FCF growth', pct(fundamentals?.fcf_growth)], ['3-year CAGR', pct(fundamentals?.three_year_cagr)],
    ['5-year CAGR', pct(fundamentals?.five_year_cagr)], ['10-year CAGR', pct(fundamentals?.ten_year_cagr)],
    ['Shares outstanding', fundamentals?.shares_outstanding == null ? '—' : number(fundamentals?.shares_outstanding, 0)],
    ['Book value / share', money(fundamentals?.book_value_per_share)], ['FCF / share', money(fundamentals?.fcf_per_share)],
  ].filter(([, value]) => value !== '—');
  const technicalCards = [
    ['RSI (14)', number(rsi)], ['SMA 20', money(sma20)], ['SMA 50', money(sma50)], ['SMA 100', money(tech?.sma_100)], ['SMA 200', money(sma200)],
    ['EMA 20', money(tech?.ema_20)], ['EMA 50', money(tech?.ema_50)], ['EMA 200', money(tech?.ema_200)],
    ['MACD', number(tech?.macd)], ['MACD signal', number(tech?.macd_signal)], ['MACD histogram', number(tech?.macd_histogram)],
    ['Bollinger upper', money(tech?.bollinger_upper)], ['Bollinger middle', money(tech?.bollinger_middle)], ['Bollinger lower', money(tech?.bollinger_lower)],
    ['Stochastic', number(tech?.stochastic)], ['Stochastic signal', String(tech?.stochastic_signal ?? '—')], ['Williams %R', number(tech?.williams_r)],
    ['CCI', number(tech?.cci)], ['MFI', number(tech?.mfi)], ['ROC', pct(tech?.roc)], ['OBV', compactMoney(tech?.obv)],
    ['Momentum', number(tech?.momentum)], ['Volatility', pct(tech?.volatility)], ['ATR', number(tech?.atr)], ['ADX', number(tech?.adx)],
    ['Support level', money(tech?.support_level)], ['Resistance level', money(tech?.resistance_level)], ['Trend', technicalTrend],
  ].filter(([, value]) => value !== '—' && value !== 'Not available yet');
  const valuationCards = [
    ['P/E ratio', number(valuationPe)], ['Forward P/E', number(valuationForwardPe)],
    ['Price / sales', number(valuationPs)], ['Price / book', number(valuationPb)],
    ['PEG ratio', number(usableMultiple(fundamentals?.peg_ratio, 100))],
    ['Enterprise value', compactMoney(fundamentals?.enterprise_value)],
  ].filter(([, value]) => value !== '—');
  const riskCards = [
    ['Volatility', pct(safeRiskMetric('volatility', risks?.volatility))],
    ['Beta', number(safeRiskMetric('beta', risks?.beta))],
    ['ATR', number(safeRiskMetric('atr', risks?.atr))],
    ['Maximum drawdown', finite(risks?.maximum_drawdown) === null || Math.abs(finite(risks?.maximum_drawdown) as number) > 100 ? '—' : '-' + Math.abs(finite(risks?.maximum_drawdown) as number).toFixed(2) + '%'],
    ['Sharpe ratio', number(safeRiskMetric('sharpe_ratio', risks?.sharpe_ratio))],
    ['Sortino ratio', number(safeRiskMetric('sortino_ratio', risks?.sortino_ratio))],
    ['Debt / equity', number(safeRiskMetric('debt_equity', risks?.debt_equity))],
    ['Current ratio', number(safeRiskMetric('current_ratio', risks?.current_ratio))],
    ['Quick ratio', number(safeRiskMetric('quick_ratio', risks?.quick_ratio))],
    ['Interest coverage', number(safeRiskMetric('interest_coverage', risks?.interest_coverage))],
    ['Altman Z-score', number(safeRiskMetric('altman_z_score', risks?.altman_z_score))],
    ['Short interest', compactMoney(risks?.short_interest)],
    ['Short % of float', pct(risks?.short_percent_float)],
    ['Liquidity risk', risks?.liquidity_risk],
    ['1-day return', pct(performance?.period_1d)], ['5-day return', pct(performance?.period_5d)],
    ['1-month return', pct(performance?.period_1m)], ['3-month return', pct(performance?.period_3m)],
    ['6-month return', pct(performance?.period_6m)], ['YTD return', pct(performance?.period_ytd)],
    ['1-year return', pct(performance?.period_1y)], ['3-year return', pct(performance?.period_3y)],
    ['5-year return', pct(performance?.period_5y)], ['10-year return', pct(performance?.period_10y)],
    ['All-time return', pct(performance?.period_max)],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '—');
  const hasChartData = chart.length > 0;
  const hasForecastData = shortForecastRows.length > 0 || longForecastRows.length > 0;
  const hasFundamentalsData = financialCards.length > 0 || metricCards.length > 0;
  const hasTechnicalData = technicalCards.length > 0;
  const hasFinancialsData = (financialStatements ?? []).length > 0 || (financialMetrics ?? []).length > 0 || (earnings ?? []).length > 0 || (earningsRevisions ?? []).length > 0;
  const hasValuationData = valuationCards.length > 0 || verifiedPeerMetrics.length > 0;
  const hasNewsData = visibleNews.length > 0;
  const hasDividendData = (dividends ?? []).length > 0;
  const hasRiskData = riskCards.length > 0;
  const faq = [
    [`What is ${stock.symbol} stock's current price?`, `The latest stored quote for ${stock.symbol} is ${money(quote?.price)}. ${quoteTimestamp ? `The quote timestamp is ${quoteTimestamp.toLocaleString('en-US')}.` : 'A verified quote timestamp is not available.'} Prices can change during market hours.`],
    [`What is the ${stock.symbol} stock forecast and analysis?`, livePredictions.length ? `The latest available quantitative model signal is “${direction}”. Review the forecast horizons alongside the company's reported financials, valuation, technical indicators and risks below; model outputs are estimates, not guarantees or personalized investment advice.` : 'A current short-term model forecast is not available in the database yet. The analysis below summarizes available company and market evidence without inventing a price target.'],
    [`What is the ${stock.symbol} stock price target?`, livePredictions.length ? `The forecast table shows stored quantitative model outputs for the available horizons. These are model targets, not necessarily Wall Street analyst consensus; a verified consensus target is not assumed unless explicitly stored.` : 'A verified model price target is not currently available in the database. This page does not substitute an invented target or imply analyst consensus.'],
    [`What is the ${stock.symbol} stock price prediction for 2030?`, (longForecastRows ?? []).some((row: any[]) => String(row[0]) === '2030') ? `A stored long-term model scenario for 2030 is shown in the forecast table. Long-range scenarios are highly uncertain and should be reviewed alongside the model version and assumptions.` : 'A verified 2030 model scenario is not currently stored for this stock. No 2030 price is fabricated or extrapolated.'],
    [`What are the bullish and bearish views on ${stock.symbol}?`, (earningsRevisions ?? []).length ? `The page includes ${earningsRevisions.length} stored analyst estimate revision record(s), which can help show how expectations have changed. These records are not a complete set of analyst opinions; review the revisions table and company disclosures for context.` : 'A sufficiently detailed analyst-opinion dataset is not currently stored for this stock. The bull and bear cases on this page are conditional evidence-based scenarios, not attributed analyst recommendations.'],
    [`What is the ${stock.symbol} stock price prediction for 2026?`, (longForecastRows ?? []).some((row: any[]) => String(row[0]) === '2026') ? `A stored model scenario for 2026 is shown in the long-term forecast table above. It is a model estimate and can differ materially from the eventual market price.` : 'A verified 2026 long-term model output is not currently stored for this stock. Check the forecast section for available horizons rather than relying on an unsupported target.'],
    [`Is ${stock.symbol} stock overvalued or undervalued?`, valuationPe !== null ? `The latest stored trailing P/E is ${number(valuationPe)}${valuationForwardPe !== null ? ` and forward P/E is ${number(valuationForwardPe)}` : ''}. Those multiples alone cannot establish fair value; compare growth, cash flow, earnings quality, risk and relevant peers.` : 'The database does not currently contain a usable trailing P/E value. Without verified valuation inputs and a suitable comparison set, this page cannot responsibly label the shares overvalued or undervalued.'],
    [`What is ${stock.symbol}'s P/E ratio?`, valuationPe !== null ? `The latest stored trailing P/E ratio is ${number(valuationPe)}. P/E compares share price with earnings per share and should be interpreted alongside growth, cyclicality and accounting quality.` : 'A usable trailing P/E ratio is not currently available in the stored valuation data.'],
    [`What is ${stock.symbol}'s 52-week high and low?`, week52High !== null && week52Low !== null ? `The stored 52-week range is ${money(week52Low)} to ${money(week52High)}. This describes the recent trading range, not a forecast or a guaranteed support/resistance level.` : 'A complete 52-week high/low range is not currently available from the stored quote or daily price history.'],
    [`Does ${stock.symbol} pay a dividend, and what is its dividend history?`, (dividends ?? []).length ? ((dividends ?? []).every((d: any) => d.data_source === 'SEC_XBRL_BULK') ? `The database contains ${dividends.length} SEC-reported dividends-per-share fact record(s). These do not confirm an ex-dividend date, record date or payment date and are not a payment calendar.` : `The database contains ${dividends.length} dividend record(s). See the dividend section for event dates and amounts supplied by the source; missing dates are not inferred.`) : 'No dividend records are currently stored for this stock. That absence does not prove the company pays no dividend.'],
    [`When is ${stock.symbol}'s next earnings report?`, earnings?.[0]?.earnings_date ? ((earnings ?? []).every((e: any) => e.data_source === 'SEC_XBRL_BULK') ? `The latest SEC filing/observation date in this database is ${dateLabel(earnings[0].earnings_date)}. This is not a verified earnings announcement date or a confirmed next-report date; check company investor relations for the official calendar.` : `The most recent earnings record in this database is dated ${dateLabel(earnings[0].earnings_date)}. This is not a confirmed next-report date; check company investor relations for the official upcoming earnings date.`) : 'An earnings date is not currently available in the stored earnings records. Check the company’s investor-relations website for its official calendar.'],
    [`How has ${stock.symbol} stock performed recently?`, cleanHistory.length > 1 ? `The price chart uses ${cleanHistory.length} stored daily observations, and the market snapshot includes the latest available quote. Use the chart to inspect the period shown; past performance does not predict future returns.` : 'There are not enough stored daily price observations to describe recent historical performance reliably.'],
    [`Is ${stock.symbol} stock in a bullish or bearish trend?`, technicalTrend !== 'Not available yet' ? `The stored technical snapshot classifies the trend as “${technicalTrend}”. This rule-based label is based on available indicators and is not a standalone buy or sell signal.` : 'The required technical indicator data is incomplete, so a reliable bullish/bearish trend label is not available.'],
    [`What are the main risks of investing in ${stock.symbol}?`, risks ? 'Available risk metrics are shown in the risk and performance section. These metrics do not capture every business, competitive, regulatory or market risk; review company filings and disclosures as well.' : 'A current risk-metrics snapshot is not available. Review the company’s filings, competition, financial statements, business concentration and market exposure before making an investment decision.'],
    [`Where can I find ${stock.symbol}'s financial statements and earnings history?`, 'Use the Financial Statements section for stored statement records, financial metric history, earnings results and estimate revisions. Coverage depends on the data available for this company.'],
    [`Does US Market AI provide a guaranteed ${stock.symbol} price target?`, 'No. Forecasts shown here are quantitative model outputs, not guarantees or personalized financial advice. Missing forecast values are left unavailable rather than filled with invented targets.'],
  ];
  return <main className="stock-page-v2">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graphJsonLd) }} />
    <div className="sd-shell">
      <nav className="sd-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/stocks">US Stocks</a>{displaySector && <><span>›</span><a href={stock.sector && String(stock.sector).toLowerCase() !== 'other' ? `/stocks?sector=${encodeURIComponent(stock.sector)}` : `/stocks`}>{displaySector}</a></>}<span>›</span><b>{stock.symbol}</b></nav>
      <nav className="research-subnav" aria-label="Stock research sections"><a href={`/stocks/${stock.slug}/financials`}>Financials</a><a href={`/stocks/${stock.slug}/valuation`}>Valuation</a><a href={`/stocks/${stock.slug}/ownership`}>Ownership</a><a href={`/stocks/${stock.slug}/forecast`}>Forecast Lab</a><a href={`/stocks/${stock.slug}/news`}>Stock News</a></nav>
      <header className="sd-hero">
        <div className="sd-identity">
          <div className="sd-monogram" aria-hidden="true">{String(stock.symbol).slice(0, 1)}</div>
          <div className="sd-company">
            <div className="sd-kicker">{stock.exchange ?? 'US EQUITY'} <span>•</span> {displaySector}</div>
            <h1>{stock.company_name} <span>({stock.symbol})</span></h1>
            <p>{stock.industry ?? stock.sector ?? securityType}{stock.headquarters ? ` · ${stock.headquarters}` : ''}</p>
            <div className="sd-badges"><span>{stock.exchange ?? 'US Market'}</span><span>{securityType}</span>{stock.is_active && <span className="sd-badge-live">Active listing</span>}</div>
          </div>
        </div>
        <div className="sd-price-block">
          <div className="sd-price">{money(quote?.price)}</div>
          {quoteIsStale ? <div className="sd-quote-stale-note" role="status">Daily change withheld because the stored quote is stale.</div> : <div className={finite(quote?.change) !== null && finite(quote?.change)! >= 0 ? 'sd-positive' : 'sd-negative'}>{finite(quote?.change) !== null ? `${finite(quote?.change)! >= 0 ? '+' : ''}${money(quote?.change)}` : 'Change unavailable'} <span>({pct(dailyChange)})</span></div>}
          <small>{quoteTimestamp ? `${quoteIsStale ? 'Last stored quote' : 'Quote updated'} ${quoteTimestamp.toLocaleString('en-US')}${quoteIsStale ? ' · may not reflect current market conditions' : ''}` : 'Latest quote timestamp unavailable · price freshness cannot be verified'}</small>
        </div>
      </header>

      <nav className="sd-jumpnav" aria-label="On this page">
        <a href="#overview">Overview</a>{hasChartData && <a href="#chart">Chart</a>}{hasForecastData && <a href="#forecast">Forecast</a>}{hasFundamentalsData && <a href="#fundamentals">Fundamentals</a>}{hasTechnicalData && <a href="#technicals">Technicals</a>}{hasFinancialsData && <a href="#financials">Financials</a>}{hasValuationData && <a href="#valuation">Valuation</a>}{hasNewsData && <a href="#news">News</a>}{hasDividendData && <a href="#dividends">Dividends</a>}{hasRiskData && <a href="#risk">Risk</a>}{hasResearchEvidence && <a href="#research-data">Research data</a>}
      </nav>

      <section className="sd-market-strip" id="overview" aria-label="Market snapshot">
        <div><span>Previous close</span><strong>{money(quote?.previous_close)}</strong></div><div><span>Open</span><strong>{money(quote?.open)}</strong></div><div><span>Day range</span><strong>{quote?.low != null && quote?.high != null ? `${money(quote.low)} – ${money(quote.high)}` : '—'}</strong></div><div><span>52-week range</span><strong>{week52Low != null && week52High != null ? `${money(week52Low)} – ${money(week52High)}` : '—'}</strong></div><div><span>Volume</span><strong>{quote?.volume == null ? '—' : Number(quote.volume).toLocaleString('en-US')}</strong></div><div><span>Market cap</span><strong>{compactMoney(marketCap)}</strong></div>
      </section>

      <section className="sd-layout-main">
        <div className="sd-primary-column">
          {hasChartData && <section className="sd-card sd-chart-card" id="chart">
            <div className="sd-section-heading"><div><span className="sd-kicker">PRICE HISTORY</span><h2>Stock price history and performance</h2><p>Daily closing prices from the stored market history.</p></div><span className="sd-count">{cleanHistory.length} sessions</span></div>
            {chart.length ? <PriceChart data={chart}/> : <div className="sd-empty sd-chart-empty">Historical price data is not available for this ticker yet.</div>}
          </section>}

          <article className="sd-card sd-editorial" id="research-article">
            <div className="sd-section-heading">
              <div>
                <span className="sd-kicker">STOCK RESEARCH · EDITORIAL ANALYSIS</span>
                <h2>{article?.title || `${stock.company_name} (${stock.symbol}): Investment Research & Business Outlook`}</h2>
                <p>A research-led explanation of the company, its financial evidence, valuation context and risks—not just a list of market numbers.</p>
              </div>
              <span className="sd-count">Research note</span>
            </div>
            {article?.summary && <p className="sd-editorial-lede">{article.summary}</p>}
            {articleResearch ? (
              <div className="sd-editorial-body sd-research-sections">
                {articleResearch.sections.map((section: any) => (
                  <section className="sd-research-section" id={section.id} key={section.id}>
                    <h3>{section.heading}</h3>
                    {String(section.body ?? '').split(/\n\s*\n/).map((paragraph: string, index: number) => paragraph.trim()).filter(Boolean).map((paragraph: string, index: number) => <p key={index}>{paragraph}</p>)}
                  </section>
                ))}
                {articleResearch.quality_notes?.length > 0 && <div className="sd-research-quality"><strong>Data coverage notes</strong><ul>{articleResearch.quality_notes.map((note: string, index: number) => <li key={index}>{note}</li>)}</ul></div>}
                <p className="sd-editorial-source-note">Research is generated from structured records available to US Market AI at generation time. Historical facts, quantitative model outputs and editorial interpretation are distinct; known data gaps and limitations are disclosed.</p>
              </div>
            ) : (article?.content || (aiResearch ?? []).some((r: any) => r.content || r.analysis || r.summary)) ? (
              <div className="sd-editorial-body">
                {String(article?.content ?? (aiResearch ?? []).find((r: any) => r.content || r.analysis || r.summary)?.content ?? (aiResearch ?? []).find((r: any) => r.analysis)?.analysis ?? (aiResearch ?? []).find((r: any) => r.summary)?.summary ?? '')
                  .replace(/\r/g, '')
                  .split(/\n\s*\n/)
                  .map((paragraph, index) => paragraph.trim())
                  .filter(Boolean)
                  .map((paragraph, index) => <p key={index}>{paragraph.replace(/^#{1,6}\s*/, '')}</p>)}
              </div>
            ) : (
              <div className="sd-editorial-body">
                <h3>What the available evidence tells us</h3>
                <p>The latest stored quote for {stock.company_name} ({stock.symbol}) is {money(quote?.price)}{quoteTimestamp ? ', timestamped ' + quoteTimestamp.toLocaleString('en-US') : ''}. A quote is a point-in-time observation; it does not, by itself, explain why the price moved or establish whether the shares are attractive.</p>
                <h3>Business and financial quality</h3>
                <p>{stock.description ? stock.description : `The company is classified in ${stock.industry ?? stock.sector ?? 'the available company profile'} in the current stock database.`} {fundamentals ? `Stored fundamentals include ${financialCards.length} usable headline metrics. These should be read across several reporting periods and compared with peers before drawing a conclusion about business quality.` : 'A sufficiently complete fundamentals snapshot is not available in the database yet, so this page avoids making unsupported claims about profitability, growth or balance-sheet strength.'}</p>
                <h3>Valuation: context matters</h3>
                <p>{valuationPe !== null ? `The stored trailing P/E ratio is ${number(valuationPe)}. P/E compares a company’s share price with its earnings, but it should be interpreted alongside expected growth, earnings quality, cyclicality and comparable companies.` : 'A usable trailing P/E value is not currently stored. Without a verified valuation metric and a relevant comparison set, this page does not label the shares cheap or expensive.'} {valuationForwardPe !== null ? `The stored forward P/E is ${number(valuationForwardPe)}; forward multiples depend on earnings estimates and can change when those estimates are revised.` : ''}</p>
                <h3>Price trend and quantitative outlook</h3>
                <p>{cleanHistory.length ? `The chart is based on ${cleanHistory.length} stored daily price observations. Historical performance describes what happened over that period; it is not a guarantee of future returns.` : 'Historical daily price observations are not currently available, so a trend assessment cannot be supported by the chart.'} {livePredictions.length ? `The current stored quantitative model signal is “${direction}”. Treat model outputs as scenarios with uncertainty, not as certain targets or personalized advice.` : 'No current short-term quantitative forecast is stored for this stock. The page will not invent a target price.'}</p>
                <h3>Key risks and what to watch next</h3>
                <p>{risks ? 'Risk records exist for this company; review the risk and performance section below for the available volatility, drawdown and risk-adjusted measures.' : 'A current risk-metrics snapshot is not available. Investors should independently examine business concentration, competition, balance-sheet exposure, market conditions and upcoming company disclosures relevant to this issuer.'} The next useful evidence to review is the company’s next reported financial results, changes in forward estimates, and primary-source disclosures.</p>
                <p className="sd-editorial-source-note">Editorial integrity: this summary uses fields available in the current database. Missing evidence is called out rather than filled with invented facts.</p>
              </div>
            )}
            <section className="sd-thesis-block" aria-label="Evidence-led investment thesis">
              <h3>What the numbers mean for investors</h3>
              <div className="sd-thesis-grid">
                <div><span>Business quality</span><p>{finite(fundamentals?.revenue_growth) !== null && finite(fundamentals?.revenue_growth)! > 0 ? `Reported revenue growth is ${pct(fundamentals?.revenue_growth)}. Growth is encouraging, but investors should confirm it is recurring and understand what product, geography or customer group is driving it.` : 'A reliable revenue-growth reading is not available or is not positive in the latest stored snapshot. Review multiple reporting periods before judging the growth trajectory.'}</p></div>
                <div><span>Profitability</span><p>{finite(fundamentals?.gross_margin) !== null && finite(fundamentals?.operating_margin) !== null ? `Gross margin is ${pct(fundamentals?.gross_margin)} and operating margin is ${pct(fundamentals?.operating_margin)}. The gap helps show how much operating costs absorb after direct costs; compare the trend with prior periods and sector peers.` : 'Margin data is incomplete. Revenue alone cannot show whether the company converts sales into sustainable profit.'}</p></div>
                <div><span>Valuation</span><p>{valuationPe !== null ? `The stored P/E is ${number(valuationPe)}. A multiple is not a verdict by itself: interpret it alongside expected earnings growth, cyclicality, cash flow, and comparable companies.` : 'A usable P/E value is not stored. Avoid calling the shares cheap or expensive until earnings and valuation data can be verified.'}</p></div>
                <div><span>Price trend</span><p>{sma20 !== null && sma50 !== null && sma200 !== null && finite(quote?.price) !== null ? `The latest quote can be compared with the 20-, 50- and 200-day moving averages (${money(sma20)}, ${money(sma50)}, and ${money(sma200)}). Moving averages describe trend, not intrinsic value, and can lag sudden market changes.` : 'Moving-average context is incomplete, so this page avoids asserting a confirmed trend from missing indicators.'}</p></div>
              </div>
              <h3>Bull case, bear case and evidence to watch</h3>
              <div className="sd-case-grid">
                <div className="sd-case sd-case-bull"><strong>Bull case</strong><p>{finite(fundamentals?.revenue_growth) !== null && finite(fundamentals?.revenue_growth)! > 0 && finite(fundamentals?.free_cash_flow) !== null && finite(fundamentals?.free_cash_flow)! > 0 ? 'The stored snapshot combines positive revenue growth with positive free cash flow. If future reports sustain both, it would support—but not guarantee—the case for durable business momentum.' : 'The bullish case needs confirmation from reported revenue growth, cash generation, and future company disclosures; the current snapshot does not establish those conditions together.'}</p></div>
                <div className="sd-case sd-case-bear"><strong>Bear case</strong><p>{valuationPe !== null && valuationPe > 30 ? `The stored P/E of ${number(valuationPe)} means expectations matter: a slowdown, weaker margins or downward earnings revisions could pressure the valuation.` : 'Potential downside still includes weaker demand, margin compression, competition, execution issues, or a broad market sell-off. Company-specific evidence is needed to quantify these risks.'}</p></div>
                <div className="sd-case sd-case-watch"><strong>What to watch next</strong><p>Track the next earnings release, changes in revenue and margin trends, cash flow, management guidance, analyst estimate revisions, and primary-source filings. Update the thesis when new evidence arrives rather than relying on one ratio or forecast.</p></div>
              </div>
              <p className="sd-editorial-source-note">These interpretations are rule-based explanations of the stored fields, not independently verified company-specific forecasts. Missing data is not treated as zero; all investment cases remain conditional on new evidence.</p>
            </section>
            <div className="sd-editorial-meta">US Market AI Research Desk · {modifiedDate ? `Data/research timestamp: ${dateLabel(modifiedDate)}` : 'Research timestamp unavailable'} · <a href="/disclaimer">Methodology & disclaimer</a></div>
          </article>

          {hasForecastData && <section className="sd-card" id="forecast">
            <div className="sd-section-heading"><div><span className="sd-kicker">QUANTITATIVE RESEARCH</span><h2>Stock forecast and analysis: price outlook</h2><p>Forecasts are model outputs, not promises or personalized investment advice.</p></div><span className={direction === 'Bullish' ? 'sd-status-positive' : direction === 'Bearish' ? 'sd-status-negative' : 'sd-status-neutral'}>{direction}</span></div>
            {table(['Horizon','Model target','Expected change','Signal','Confidence score'], shortForecastRows)}
            {longForecastRows.length > 0 && <><h3 className="sd-subheading">Long-term model scenarios</h3><p className="sd-muted">Latest stored scenario per future target year. Bear, base and bull prices are model scenarios, not guaranteed targets. The relative model score is not a calibrated probability; uncertainty rises materially for distant years.</p>{table(['Target year','Base case','Bear case','Bull case','Expected CAGR','Relative model score','Signal'], longForecastRows)}</>}
            {longForecastRows.length === 0 && <p className="sd-footnote">No future-year long-term scenario records are available for this stock; no values are fabricated or extrapolated on this page.</p>}
          </section>}

          {hasFundamentalsData && <section className="sd-card" id="fundamentals">
            <div className="sd-section-heading"><div><span className="sd-kicker">COMPANY FUNDAMENTALS</span><h2>Financial performance and company fundamentals</h2><p>Reported fields from the current fundamentals snapshot.</p></div></div>
            {financialCards.length ? <div className="sd-metric-grid">{financialCards.map(([label, value]) => <div className="sd-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{metricExplanation(String(label))}</small></div>)}</div> : <div className="sd-empty">Fundamental metrics have not been populated for this stock yet.</div>}
            {metricCards.length > 0 && <div className="sd-metric-grid sd-metric-grid-muted">{metricCards.map(([label, value]) => <div className="sd-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{metricExplanation(String(label))}</small></div>)}</div>}
          </section>}

          {hasTechnicalData && <section className="sd-card" id="technicals">
            <div className="sd-section-heading"><div><span className="sd-kicker">TECHNICALS</span><h2>Technical indicators</h2><p>Latest stored daily indicator snapshot; unavailable indicators are omitted.</p></div><span className="sd-count">{tech?.calculated_at ? dateLabel(tech.calculated_at) : 'No timestamp'}</span></div>
            {technicalCards.length ? <div className="sd-metric-grid">{technicalCards.map(([label, value]) => <div className="sd-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{metricExplanation(String(label))}</small></div>)}</div> : <div className="sd-empty">Technical indicator data is not available yet.</div>}
          </section>}

          {hasFinancialsData && <section className="sd-card" id="financials">
            <div className="sd-section-heading"><div><span className="sd-kicker">REPORTED RESULTS</span><h2>Financial statements, earnings history and estimate revisions</h2><p>Recent normalized financial statement records.</p></div></div>
            <p className="sd-detail-copy">Showing up to 60 recent statement records. Reported periods and statement types are preserved; blank values are not estimated. Contradictory zero sentinels are withheld instead of presented as verified facts.</p>{table(['Period','Statement','Fiscal period','Basis','Revenue','Cost of revenue','Gross profit','Operating income','Net income','Basic EPS','Diluted EPS','Cash','Total assets','Total liabilities','Debt','Equity','Operating cash flow','Capex','Free cash flow','Source'], (financialStatements ?? []).map((row: any) => [dateLabel(row.period_end), String(row.statement_type ?? '—').replaceAll('_', ' '), row.fiscal_period ?? '—', row.period_type ?? '—', compactMoney(row.revenue), compactMoney(row.cost_of_revenue), compactMoney(row.gross_profit), compactMoney(row.operating_income), compactMoney(statementMetric(row, 'net_income')), money(statementMetric(row, 'eps_basic')), money(statementMetric(row, 'eps_diluted')), compactMoney(row.cash_and_equivalents), compactMoney(row.total_assets), compactMoney(row.total_liabilities), compactMoney(row.total_debt), compactMoney(row.shareholders_equity), compactMoney(row.operating_cash_flow), compactMoney(row.capital_expenditure), compactMoney(row.free_cash_flow), row.data_source ?? '—']))}
            <h3 className="sd-subheading">Financial metric history</h3>{table(['Period','Revenue growth','Gross margin','Operating margin','Net margin','ROE','ROIC'], (financialMetrics ?? []).slice(0, 8).map((m: any) => [dateLabel(m.period_end), pct(m.revenue_growth), pct(m.gross_margin), pct(m.operating_margin), pct(m.net_margin), pct(m.roe), pct(m.roic)]))}
            <h3 className="sd-subheading">Earnings history</h3>
            {(earnings ?? []).length > 0 && (earnings ?? []).every((e: any) => e.data_source === 'SEC_XBRL_BULK') ? <>
              <p className="sd-detail-copy">These are SEC-reported financial facts grouped by fiscal period. The displayed date is the SEC filing/observation date, not a verified earnings announcement or release date. Use the company’s investor-relations calendar for confirmed earnings-release timing.</p>
              {table(['SEC filing / observation date','Fiscal period','EPS reported','EPS estimate','Revenue reported','Revenue estimate'], (earnings ?? []).map((e: any) => [dateLabel(e.earnings_date), e.fiscal_period ?? '—', money(e.eps_actual), money(e.eps_estimate), compactMoney(e.revenue_actual), compactMoney(e.revenue_estimate)]))}
            </> : <>
              <p className="sd-detail-copy">Dates reflect the source’s reported event date where available; dates from filing-based sources should not be interpreted as confirmed earnings-release dates.</p>
              {table(['Report date','Fiscal period','EPS actual','EPS estimate','Revenue actual','Revenue estimate'], (earnings ?? []).map((e: any) => [dateLabel(e.earnings_date), e.fiscal_period ?? '—', money(e.eps_actual), money(e.eps_estimate), compactMoney(e.revenue_actual), compactMoney(e.revenue_estimate)]))}
            </>}
            {(earningsRevisions ?? []).length > 0 && <><h3 className="sd-subheading">Analyst estimate revisions</h3>{table(['Revision date','Period','EPS estimate','Revenue estimate','Analyst count'], (earningsRevisions ?? []).slice(0, 8).map((e: any) => [dateLabel(e.revision_date), e.fiscal_period ?? e.period ?? '—', money(e.eps_estimate), compactMoney(e.revenue_estimate), number(e.analyst_count, 0)]))}</>}
          </section>}

          {hasValuationData && <section className="sd-card" id="valuation">
            <div className="sd-section-heading"><div><span className="sd-kicker">VALUATION</span><h2>Stock valuation: P/E, forward P/E and multiples</h2><p>Multiples shown only when the database has a usable value.</p></div></div>
            {valuationCards.length > 0 && <div className="sd-metric-grid">{valuationCards.map(([label, value]) => <div className="sd-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>}
            {verifiedPeerMetrics.length > 0 ? <><h3 className="sd-subheading">Peer context</h3>{table(['Metric','Company','Peer median','Peer average','Percentile'], verifiedPeerMetrics.slice(0, 12).map((p: any) => [p.metric_name ?? '—', number(p.company_value), number(p.peer_median), number(p.peer_average), `${number(p.percentile)}%`]))}</> : <p className="sd-footnote">Peer comparisons are withheld until a comparable industry group and a reliable peer set are verified.</p>}
          </section>}

          {hasNewsData && <section className="sd-card" id="news">
            <div className="sd-section-heading"><div><span className="sd-kicker">LATEST DEVELOPMENTS</span><h2>News and company updates</h2><p>Stories linked to this stock in the current database.</p></div></div>
            {visibleNews.length ? <div className="sd-news-list">{visibleNews.map((item: any) => <article className="sd-news-item" key={item.id}><div className="sd-news-meta"><span>{cleanNewsText(item.source) || 'News source'}</span><span>{dateLabel(item.published_at)}</span></div><h3>{safeNewsUrl(item.url) ? <a href={safeNewsUrl(item.url)!} target="_blank" rel="noopener noreferrer">{cleanNewsText(item.title) || 'Market story'}</a> : (cleanNewsText(item.title) || 'Market story')}</h3>{newsSummary(item.summary, item.title) && <p>{newsSummary(item.summary, item.title)}</p>}{item.sentiment && <span className="sd-news-sentiment">{item.sentiment}</span>}</article>)}</div> : <div className="sd-empty">No ticker-linked news records are available yet.</div>}
          </section>}

          {hasDividendData && <section className="sd-card" id="dividends">
            <div className="sd-section-heading"><div><span className="sd-kicker">SHAREHOLDER RETURNS</span><h2>Dividend data and payment history</h2><p>Source-specific dividend records, with unavailable event dates left blank.</p></div></div>
            {(dividends ?? []).length > 0 && (dividends ?? []).every((d: any) => d.data_source === 'SEC_XBRL_BULK') ? <>
              <p className="sd-detail-copy">These are SEC-reported dividends-per-share facts. The stored date is the SEC filing/observation date, not a confirmed declaration or ex-dividend date. These records do not establish record dates or payment dates and must not be treated as a dividend payment calendar.</p>
              {table(['SEC filing / observation date','Reported dividend per share','Currency','Source'], (dividends ?? []).map((d: any) => [dateLabel(d.declaration_date), d.amount == null ? '—' : money(d.amount, 4), d.currency ?? 'USD', d.data_source ?? '—']))}
            </> : <>
              <p className="sd-detail-copy">Showing up to 30 recent dividend events. Dates and statistics are shown only when supplied by the source; missing event dates are not inferred.</p>
              {table(['Ex-date','Declaration date','Record date','Payment date','Dividend / share','Frequency','Yield','Payout ratio','5-year CAGR','Growth streak','Currency','Source'], (dividends ?? []).map((d: any) => [dateLabel(d.ex_date), dateLabel(d.declaration_date), dateLabel(d.record_date), dateLabel(d.payment_date), d.amount == null ? '—' : money(d.amount, 4), d.frequency ?? '—', pct(d.dividend_yield), pct(d.payout_ratio), pct(d.five_year_cagr), d.growth_streak_years == null ? '—' : String(d.growth_streak_years), d.currency ?? 'USD', d.data_source ?? '—']))}
            </>}
          </section>}

          {hasRiskData && <section className="sd-card" id="risk">
            <div className="sd-section-heading"><div><span className="sd-kicker">RISK CONTEXT</span><h2>Risk and performance profile</h2><p>Computed risk/performance records; not a recommendation. Mathematically uninterpretable or extreme ratios are withheld rather than displayed as reliable facts.</p></div></div>
            {riskCards.length > 0 ? <div className="sd-metric-grid">{riskCards.map(([label, value]) => <div className="sd-metric" key={String(label)}><span>{label}</span><strong>{String(value)}</strong></div>)}</div> : <div className="sd-empty">Risk metrics have not been calculated for this stock yet.</div>}
          </section>}

          {hasResearchEvidence && <section className="sd-card" id="research-data">
            <div className="sd-section-heading"><div><span className="sd-kicker">RESEARCH EVIDENCE</span><h2>Source data and research records</h2><p>Expandable evidence tables keep the main page focused while preserving detailed data.</p></div></div>
            {hasOwnershipData && <details className="sd-details"><summary>Institutional holders and ownership</summary><p className="sd-detail-copy">Showing up to 50 recent holder records. Values failing a basic implied-price check are withheld, not silently corrected.</p>{table(['Period','Filed','Holder','CIK','Shares','Value','Ownership','Shares change','Change %','Source'], (institutionalHolders ?? []).slice(0, 50).map((h: any) => [dateLabel(h.period_end), dateLabel(h.filing_date), h.holder_name ?? h.institution_name ?? '—', h.cik ?? '—', number(h.shares_held ?? h.shares, 0), holderValueForDisplay(h, quote?.price), pct(h.ownership_percent), number(h.shares_change, 0), pct(h.shares_change_percent), h.data_source ?? '—']))}{table(['Period','Shares outstanding','Institutional ownership','Insider ownership'], (ownership ?? []).slice(0, 8).map((o: any) => [dateLabel(o.period_end), number(o.shares_outstanding, 0), pct(o.institutional_ownership_percent), pct(o.insider_ownership_percent)]))}</details>}
            {hasInsiderTransactions && <details className="sd-details"><summary>Insider transactions</summary><p className="sd-detail-copy">Reported transaction values and remaining holdings are shown only when supplied by the source.</p>{table(['Transaction date','Filed','Insider','Title','Type','Code','Shares','Price','Reported value','Shares after','Filing','Source'], (insiderTransactions ?? []).slice(0, 20).map((t: any) => [dateLabel(t.transaction_date), dateLabel(t.filing_date), t.insider_name ?? '—', t.insider_title ?? '—', t.transaction_type ?? '—', t.transaction_code ?? '—', number(t.shares, 0), money(t.price), compactMoney(t.value), number(t.shares_owned_after, 0), t.filing_url ? <a href={t.filing_url} target="_blank" rel="noreferrer">Open filing</a> : '—', t.data_source ?? '—']))}</details>}
            {hasSecFilings && <details className="sd-details"><summary>SEC filings</summary><p className="sd-detail-copy">Showing up to 30 latest filings. Open the original SEC document when a URL is available.</p>{table(['Filed','Accepted','Form','Description','Reporting period','Accession','SEC document'], (secFilings ?? []).slice(0, 30).map((f: any) => [dateLabel(f.filing_date), dateLabel(f.accepted_at), f.form_type ?? f.form ?? '—', f.filing_description ?? f.description ?? f.title ?? '—', dateLabel(f.filing_period), f.accession_number ?? '—', f.filing_url ? <a href={f.filing_url} target="_blank" rel="noreferrer">View filing</a> : f.primary_document ?? '—']))}</details>}
            {hasPublishedResearch && <details className="sd-details"><summary>Published AI research</summary>{table(['Updated','Title','Summary'], (aiResearch ?? []).map((r: any) => [dateLabel(r.updated_at), r.title ?? r.research_type ?? 'Research note', r.summary ?? r.content ?? r.analysis ?? '—']))}{article?.summary && <p className="sd-detail-copy">Latest published article: {article.summary}</p>}</details>}
            {hasPeriodResearch && <details className="sd-details"><summary>Quarterly and monthly research</summary>{table(['Period','Research summary'], (quarterlyResearch ?? []).map((r: any) => [dateLabel(r.period_end), r.ai_summary ?? r.financial_summary ?? r.earnings_summary ?? r.guidance_summary ?? r.risks_summary ?? r.content ?? '—']))}{table(['Month','Research summary'], (monthlyResearch ?? []).map((r: any) => [dateLabel(r.research_month), r.ai_summary ?? r.fundamental_summary ?? r.technical_summary ?? r.news_summary ?? r.risk_summary ?? r.content ?? '—']))}</details>}
            {hasThirdPartyData && <details className="sd-details"><summary>Third-party metrics and ratios</summary><p className="sd-detail-copy">Showing up to 40 recent metric records and 40 ratio records from the query window. Provider periods, units and validity flags are preserved when available.</p>{table(['Period','Report period','Fiscal year','Quarter','Period type','Category','Value','Unit','Currency','Valid','Source'], (threeSpreadMetrics ?? []).slice(0, 40).map((m: any) => [dateLabel(m.period_end), dateLabel(m.period_of_report), m.fiscal_year ?? '—', m.fiscal_quarter ?? '—', m.period_type ?? '—', m.category ?? m.metric_name ?? m.metric_key ?? 'Unmapped provider metric', number(m.value), m.unit ?? '—', m.currency ?? '—', m.is_valid == null ? '—' : m.is_valid ? 'Yes' : 'No', m.data_source ?? '3Spread']))}{table(['Period','Report period','Fiscal year','Quarter','Period type','Ratio category','Ratio','Value','Percentile','Missing inputs','Valid','Source'], (threeSpreadRatios ?? []).slice(0, 40).map((m: any) => [dateLabel(m.period_end), dateLabel(m.period_of_report), m.fiscal_year ?? '—', m.fiscal_quarter ?? '—', m.period_type ?? '—', m.ratio_category ?? '—', m.ratio_name ?? m.ratio_key ?? 'Unmapped provider ratio', number(m.value), pct(m.value_pctile), m.missing_inputs == null ? '—' : String(m.missing_inputs), m.is_valid == null ? '—' : m.is_valid ? 'Yes' : 'No', m.data_source ?? '3Spread']))}</details>}
            {hasProvenanceData && <details className="sd-details"><summary>Data quality and provenance</summary><p className="sd-detail-copy">This page does not fill gaps with sample data. Values shown above come from the connected market-data and research tables.</p>{table(['Check date','Status','Completeness','Issues'], quality ? [[dateLabel(quality.check_date), quality.status ?? '—', pct(quality.completeness_score), number(quality.issue_count, 0)]] : [])}{table(['Retrieved','Dataset','Provider','Status'], (provenance ?? []).slice(0, 12).map((p: any) => [dateLabel(p.retrieved_at), p.data_field ?? p.entity_type ?? p.table_name ?? '—', p.source_name ?? p.provider ?? p.source ?? '—', p.is_verified == null ? '—' : (p.is_verified ? 'Verified' : 'Unverified')]))}</details>}
            {hasEvaluationData && <details className="sd-details"><summary>Identifiers and model evaluation</summary>{table(['Identifier','Value','Source'], (identifiers ?? []).map((i: any) => [i.identifier_type ?? i.type ?? '—', i.identifier_value ?? i.value ?? '—', i.source ?? '—']))}{table(['Evaluated','Horizon','Predicted','Actual','Error','Hit'], (results ?? []).map((p: any) => [dateLabel(p.evaluated_at), p.horizon ?? '—', money(p.predicted_price), money(p.actual_price), pct(p.percentage_error), p.hit == null ? '—' : p.hit ? 'Yes' : 'No']))}</details>}
          </section>}

          <section className="sd-card" id="faq">
            <div className="sd-section-heading"><div><span className="sd-kicker">QUICK ANSWERS</span><h2>Frequently asked questions</h2></div></div>
            {(articleResearch?.faqs?.length ? articleResearch.faqs.map((item: any) => [item.question, item.answer]) : faq).map(([question, answer]: string[]) => <details className="sd-faq" key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </section>
        </div>

        <aside className="sd-sidebar">
          <section className="sd-card sd-sidebar-card"><span className="sd-kicker">AT A GLANCE</span><h2>Research snapshot</h2><div className="sd-signal-row"><span>Quant model</span><strong>{direction}</strong></div><div className="sd-signal-row"><span>Technical trend</span><strong>{technicalTrend}</strong></div><div className="sd-signal-row"><span>Financial data</span><strong>{fundamentals ? 'Available' : 'Not populated'}</strong></div><div className="sd-signal-row"><span>{(earnings ?? []).length > 0 && (earnings ?? []).every((e: any) => e.data_source === 'SEC_XBRL_BULK') ? 'Latest SEC filing observation' : 'Latest earnings record'}</span><strong>{earnings?.[0] ? dateLabel(earnings[0].earnings_date) : '—'}</strong></div><div className="sd-signal-row"><span>Long-term scenarios</span><strong>{longForecastRows.length ? `${longForecastRows.length} years` : 'Unavailable'}</strong></div></section>
          <section className="sd-card sd-sidebar-card"><span className="sd-kicker">COMPANY PROFILE</span><h2>About {stock.symbol}</h2><p>{stock.description || 'A detailed company description has not been provided in the current stock profile.'}</p><dl className="sd-profile-list">{[['Sector', stock.sector && String(stock.sector).toLowerCase() !== 'other' ? stock.sector : (stock.industry || stock.asset_type || 'Not classified yet')],['Industry',stock.industry],['Headquarters',stock.headquarters],['Employees',stock.employees == null ? null : Number(stock.employees).toLocaleString('en-US')],['Founded',stock.founded_year],['CEO',stock.ceo]].filter(([,v]) => v !== null && v !== undefined && v !== '').map(([label,value]) => <div key={String(label)}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl></section>
          <section className="sd-card sd-sidebar-card sd-disclaimer"><span className="sd-kicker">IMPORTANT</span><h2>Use forecasts carefully</h2><p>Market prices can change quickly. Quantitative estimates and historical metrics are informational only, may be incomplete, and are not guarantees of future performance or personalized financial advice.</p><a href="/disclaimer">Read full disclaimer ↗</a></section>
        </aside>
      </section>

      {related?.length ? <section className="sd-related"><div className="sd-section-heading"><div><span className="sd-kicker">KEEP EXPLORING</span><h2>Related {displaySector ?? 'market'} stocks</h2><p>Other active stocks in this sector. This is a directory, not a performance ranking.</p></div><a href="/stocks">Browse all stocks ↗</a></div><div className="sd-related-grid">{related.map((item: any) => <a className="sd-related-card" href={`/stocks/${item.slug}`} key={item.id}><span>{item.symbol}</span><strong>{item.company_name}</strong><small>{item.sector && String(item.sector).toLowerCase() !== 'other' ? item.sector : (item.industry ?? 'US equity')}</small><b>{compactMoney(item.market_cap)} market cap</b></a>)}</div></section> : null}
      <footer className="sd-footer-note"><span>US MARKET AI · STOCK RESEARCH</span><p>Data availability varies by company and provider. Missing values are omitted rather than estimated. Forecasts are model outputs and should be independently evaluated.</p><small>Research updated {modifiedDate ? dateLabel(modifiedDate) : 'when data is available'} · <a href="/research-author">Research methodology</a> · <a href="/disclaimer">Disclaimer</a></small></footer>
    </div>
  </main>;
}
