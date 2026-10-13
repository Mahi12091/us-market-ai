import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createDatabaseClient } from '@/lib/neon';
import PriceChart, { type ChartPoint } from '@/components/price-chart';

export const revalidate = 300;

const finite = (v: unknown): number | null => { if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const money = (v: unknown, digits = 2) => { const n = finite(v); return n === null ? '—' : `${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`; };
const pct = (v: unknown) => { const n = finite(v); return n === null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; };
const compactMoney = (v: unknown) => { const n = finite(v); return n === null ? '—' : `${n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`; };
const number = (v: unknown, digits = 2) => { const n = finite(v); return n === null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits }); };
const dateLabel = (v: unknown) => { if (!v) return '—'; const d = new Date(String(v)); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
const metricExplanation = (label: string) => (({
  'Revenue': 'Total sales reported for the period; compare growth across several periods.',
  'Revenue growth': 'How quickly sales are expanding or contracting versus the comparison period.',
  'Gross margin': 'Share of revenue left after direct costs; higher margins can indicate pricing power.',
  'Operating margin': 'Share of revenue left after operating expenses, before interest and taxes.',
  'Net margin': 'Share of revenue that remains as profit after expenses and taxes.',
  'EPS': 'Earnings allocated to each share; check whether growth is recurring and diluted.',
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

  const [{ data: quote }, { data: tech }, { data: predictions }, { data: article }, { data: aiResearch }, { data: fundamentals }, { data: financialMetrics }, { data: earnings }, { data: earningsRevisions }, { data: news }, { data: history }, { data: results }, { data: related }, { data: financialStatements }, { data: dividends }, { data: ownership }, { data: institutionalHolders }, { data: insiderTransactions }, { data: monthlyResearch }, { data: quarterlyResearch }, { data: threeSpreadMetrics }, { data: threeSpreadRatios }, { data: performance }, { data: risks }, { data: valuations }, { data: secFilings }, { data: identifiers }, { data: peerMetrics }, { data: provenance }, { data: quality }, { data: longTerm }] = await Promise.all([
    db.from('latest_quotes').select('*').eq('stock_id', stock.id).maybeSingle(),
    db.from('technical_indicators').select('*').eq('stock_id', stock.id).eq('timeframe', '1d').order('calculated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('predictions').select('*').eq('stock_id', stock.id).eq('model_version', 'quant-v3.0').order('prediction_time', { ascending: false }).limit(8),
    db.from('ai_articles').select('title,summary,content,updated_at').eq('stock_id', stock.id).eq('is_published', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('ai_research').select('*').eq('stock_id', stock.id).order('updated_at', { ascending: false }).limit(3),
    db.from('fundamentals').select('*').eq('stock_id', stock.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('financial_metrics').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(12),
    db.from('earnings').select('*').eq('stock_id', stock.id).order('earnings_date', { ascending: false }).limit(6),
    db.from('earnings_revisions').select('*').eq('stock_id', stock.id).order('revision_date', { ascending: false }).limit(12),
    db.from('news').select('id,title,summary,url,source,published_at,sentiment').eq('stock_id', stock.id).order('published_at', { ascending: false }).limit(5),
    db.from('price_history').select('timestamp,close,high,low').eq('stock_id', stock.id).eq('timeframe', '1d').order('timestamp', { ascending: false }).limit(250),
    db.from('prediction_results').select('id,horizon,predicted_price,actual_price,percentage_error,hit,evaluated_at').eq('stock_id', stock.id).order('evaluated_at', { ascending: false }).limit(8),
    db.from('stocks').select('id,symbol,slug,company_name,sector,industry,market_cap').eq('is_active', true).eq(stock.sector && String(stock.sector).toLowerCase() !== 'other' ? 'sector' : 'industry', stock.sector && String(stock.sector).toLowerCase() !== 'other' ? stock.sector : (stock.industry ?? '')).neq('id', stock.id).order('market_cap', { ascending: false, nullsFirst: false }).limit(4),
    db.from('financial_statements').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).order('statement_type', { ascending: true }).limit(36),
    db.from('dividends').select('*').eq('stock_id', stock.id).order('ex_date', { ascending: false }).limit(12),
    db.from('ownership_snapshots').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(8),
    db.from('institutional_holders').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(20),
    db.from('insider_transactions').select('*').eq('stock_id', stock.id).order('transaction_date', { ascending: false }).limit(20),
    db.from('monthly_stock_research').select('*').eq('stock_id', stock.id).order('research_month', { ascending: false }).limit(6),
    db.from('quarterly_stock_research').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(4),
    db.from('threespread_metrics').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(100),
    db.from('threespread_ratios').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(100),
    db.from('stock_performance').select('*').eq('stock_id', stock.id).order('calculation_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('risk_metrics').select('*').eq('stock_id', stock.id).order('calculation_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('valuation_snapshots').select('*').eq('stock_id', stock.id).order('valuation_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('sec_filings').select('*').eq('stock_id', stock.id).order('filing_date', { ascending: false }).limit(12),
    db.from('stock_identifiers').select('*').eq('stock_id', stock.id).limit(20),
    db.from('peer_metrics').select('*').eq('stock_id', stock.id).order('metric_date', { ascending: false }).limit(24),
    db.from('data_provenance').select('*').eq('stock_id', stock.id).order('retrieved_at', { ascending: false }).limit(24),
    db.from('data_quality').select('*').eq('stock_id', stock.id).order('check_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('long_term_predictions').select('*').eq('stock_id', stock.id).eq('model_version', 'long-term-v1.0').order('target_year', { ascending: true }),
  ]);

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
  const marketCap = quote?.market_cap ?? fundamentals?.market_cap ?? stock.market_cap;
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
  const graphJsonLd = { '@context': 'https://schema.org', '@graph': [datasetJsonLd, breadcrumbJsonLd, ...(articleJsonLd ? [articleJsonLd] : [])] };

  const cleanHistory = orderedHistory.filter(x => finite(x.close) !== null && Number.isFinite(new Date(x.timestamp).getTime()));
  const quoteTimestamp = quote?.quote_timestamp && Number.isFinite(new Date(quote.quote_timestamp).getTime()) ? new Date(quote.quote_timestamp) : null;
  const valuationPe = finite(valuations?.pe) ?? finite(fundamentals?.pe_ratio);
  const valuationForwardPe = finite(valuations?.forward_pe) ?? finite(fundamentals?.forward_pe);
  const valuationPs = finite(fundamentals?.price_sales);
  const valuationPb = finite(fundamentals?.price_book);
  const rsi = finite(tech?.rsi);
  const sma20 = finite(tech?.sma_20), sma50 = finite(tech?.sma_50), sma200 = finite(tech?.sma_200);
  const stockTerms = [String(stock.symbol ?? '').toLowerCase(), String(stock.company_name ?? '').toLowerCase(), ...String(stock.company_name ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((part: string) => part.length >= 4)].filter(Boolean);
  const visibleNews = (news ?? []).filter((n: any) => {
    const title = String(n.title ?? '').toLowerCase();
    return title.trim() && stockTerms.some(term => title.includes(term));
  }).slice(0, 8);
  const shortForecastRows = livePredictions.filter(p => finite(p.predicted_price) !== null).map(p => [String(p.horizon).toUpperCase(), money(p.predicted_price), pct(p.predicted_change_percent), p.direction ?? '—', finite(p.confidence) === null ? '—' : number(p.confidence, 0)]);
  const longForecastRows = (longTerm ?? []).filter((p: any) => finite(p.target_year) !== null && finite(p.predicted_price) !== null).map((p: any) => [String(p.target_year), money(p.predicted_price), pct(p.predicted_return_percent ?? p.expected_return_percent), p.model_version ?? 'long-term-v1.0']);
  const table = (headers: string[], rows: any[][]) => {
    const clean = rows.filter(row => row.filter(value => value !== null && value !== undefined && value !== '' && value !== '—').length >= 2);
    if (!clean.length) return <div className="sd-empty">No verified records available for this section yet.</div>;
    return <div className="sd-table-scroll"><table className="sd-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{clean.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value == null || value === '' ? '—' : String(value)}</td>)}</tr>)}</tbody></table></div>;
  };
  const metricCards = [
    ['Market cap', compactMoney(marketCap)], ['P/E ratio', number(valuationPe)], ['Forward P/E', number(valuationForwardPe)],
    ['52-week high', money(week52High)], ['52-week low', money(week52Low)], ['Average volume', quote?.volume == null ? '—' : Number(quote.volume).toLocaleString('en-US')],
  ].filter(([, value]) => value !== '—');
  const financialCards = [
    ['Revenue', compactMoney(fundamentals?.revenue)], ['Revenue growth', pct(fundamentals?.revenue_growth)],
    ['Gross margin', pct(fundamentals?.gross_margin)], ['Operating margin', pct(fundamentals?.operating_margin)],
    ['Net margin', pct(fundamentals?.net_margin)], ['EPS', money(fundamentals?.eps)],
    ['Debt / equity', number(fundamentals?.debt_equity)], ['Free cash flow', compactMoney(fundamentals?.free_cash_flow)],
    ['Return on equity', pct(fundamentals?.roe)], ['Return on invested capital', pct(fundamentals?.roic)],
  ].filter(([, value]) => value !== '—');
  const technicalCards = [
    ['RSI (14)', number(rsi)], ['SMA 20', money(sma20)], ['SMA 50', money(sma50)], ['SMA 200', money(sma200)],
    ['MACD histogram', number(tech?.macd_histogram)], ['ATR', number(tech?.atr)], ['ADX', number(tech?.adx)], ['Trend', technicalTrend],
  ].filter(([, value]) => value !== '—' && value !== 'Not available yet');
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
    [`Does ${stock.symbol} pay a dividend, and what is its dividend history?`, (dividends ?? []).length ? `The database contains ${dividends.length} dividend event record(s). See the dividend history table for stored ex-dates, payment dates and amounts; coverage may be incomplete.` : 'No dividend records are currently stored for this stock. That absence does not prove the company pays no dividend.'],
    [`When is ${stock.symbol}'s next earnings report?`, earnings?.[0]?.earnings_date ? `The most recent earnings record in this database is dated ${dateLabel(earnings[0].earnings_date)}. This is not a confirmed next-report date; check company investor relations for the official upcoming earnings date.` : 'An earnings date is not currently available in the stored earnings records. Check the company’s investor-relations website for its official calendar.'],
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
          <div className={finite(quote?.change) !== null && finite(quote?.change)! >= 0 ? 'sd-positive' : 'sd-negative'}>{finite(quote?.change) !== null ? `${finite(quote?.change)! >= 0 ? '+' : ''}${money(quote?.change)}` : 'Change unavailable'} <span>({pct(dailyChange)})</span></div>
          <small>{quoteTimestamp ? `Quote updated ${quoteTimestamp.toLocaleString('en-US')}` : 'Latest quote timestamp unavailable'}</small>
        </div>
      </header>

      <nav className="sd-jumpnav" aria-label="On this page">
        <a href="#overview">Overview</a><a href="#chart">Chart</a><a href="#forecast">Forecast</a><a href="#fundamentals">Fundamentals</a><a href="#technicals">Technicals</a><a href="#financials">Financials</a><a href="#news">News</a><a href="#research-data">Research data</a>
      </nav>

      <section className="sd-market-strip" id="overview" aria-label="Market snapshot">
        <div><span>Previous close</span><strong>{money(quote?.previous_close)}</strong></div><div><span>Open</span><strong>{money(quote?.open)}</strong></div><div><span>Day range</span><strong>{quote?.low != null && quote?.high != null ? `${money(quote.low)} – ${money(quote.high)}` : '—'}</strong></div><div><span>52-week range</span><strong>{week52Low != null && week52High != null ? `${money(week52Low)} – ${money(week52High)}` : '—'}</strong></div><div><span>Volume</span><strong>{quote?.volume == null ? '—' : Number(quote.volume).toLocaleString('en-US')}</strong></div><div><span>Market cap</span><strong>{compactMoney(marketCap)}</strong></div>
      </section>

      <section className="sd-layout-main">
        <div className="sd-primary-column">
          <section className="sd-card sd-chart-card" id="chart">
            <div className="sd-section-heading"><div><span className="sd-kicker">PRICE HISTORY</span><h2>Stock price history and performance <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Explain the actual chart: selected period return, notable rises/falls, volatility, drawdown and comparison benchmark only when verified data is available. Do not narrate a chart without calculating its values.</p><p>Daily closing prices from the stored market history.</p></div><span className="sd-count">{cleanHistory.length} sessions</span></div>
            {chart.length ? <PriceChart data={chart}/> : <div className="sd-empty sd-chart-empty">Historical price data is not available for this ticker yet.</div>}
          </section>

          <article className="sd-card sd-editorial" id="research-article">
            <div className="sd-section-heading">
              <div>
                <span className="sd-kicker">STOCK RESEARCH · EDITORIAL ANALYSIS</span>
                <h2>{article?.title || `${stock.company_name} (${stock.symbol}): Investment Research & Business Outlook`}</h2>
                <p>A research-led explanation of the company, its financial evidence, valuation context and risks—not just a list of market numbers.</p><p className="sd-ai-placeholder">(AI TEXT) Write a company-specific research introduction: what the company does, how it makes money, the main business drivers, what has recently changed, and the key questions investors should investigate. Use verified company data and cite the period/source.</p>
              </div>
              <span className="sd-count">Research note</span>
            </div>
            {article?.summary && <p className="sd-editorial-lede">{article.summary}</p>}
            {(article?.content || (aiResearch ?? []).some((r: any) => r.content || r.analysis || r.summary)) ? (
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
                <h3>What the available evidence tells us <span className="sd-ai-placeholder">(AI TEXT)</span></h3>
                <p>The latest stored quote for {stock.company_name} ({stock.symbol}) is {money(quote?.price)}{quoteTimestamp ? `, timestamped ${quoteTimestamp.toLocaleString('en-US')}` : ''}. A quote is a point-in-time observation; it does not, by itself, explain why the price moved or establish whether the shares are attractive.</p>
                <h3>Business and financial quality <span className="sd-ai-placeholder">(AI TEXT)</span></h3>
                <p>{stock.description ? stock.description : `The company is classified in ${stock.industry ?? stock.sector ?? 'the available company profile'} in the current stock database.`} {fundamentals ? `Stored fundamentals include ${financialCards.length} usable headline metrics. These should be read across several reporting periods and compared with peers before drawing a conclusion about business quality.` : 'A sufficiently complete fundamentals snapshot is not available in the database yet, so this page avoids making unsupported claims about profitability, growth or balance-sheet strength.'}</p>
                <h3>Valuation: context matters <span className="sd-ai-placeholder">(AI TEXT)</span></h3>
                <p>{valuationPe !== null ? `The stored trailing P/E ratio is ${number(valuationPe)}. P/E compares a company’s share price with its earnings, but it should be interpreted alongside expected growth, earnings quality, cyclicality and comparable companies.` : 'A usable trailing P/E value is not currently stored. Without a verified valuation metric and a relevant comparison set, this page does not label the stock cheap or expensive.'} {valuationForwardPe !== null ? `The stored forward P/E is ${number(valuationForwardPe)}; forward multiples depend on earnings estimates and can change when those estimates are revised.` : ''}</p>
                <h3>Price trend and quantitative outlook <span className="sd-ai-placeholder">(AI TEXT)</span></h3>
                <p>{cleanHistory.length ? `The chart is based on ${cleanHistory.length} stored daily price observations. Historical performance describes what happened over that period; it is not a guarantee of future returns.` : 'Historical daily price observations are not currently available, so a trend assessment cannot be supported by the chart.'} {livePredictions.length ? `The current stored quantitative model signal is “${direction}”. Treat model outputs as scenarios with uncertainty, not as certain targets or personalized advice.` : 'No current short-term quantitative forecast is stored for this stock. The page will not invent a target price.'}</p>
                <h3>Key risks and what to watch next <span className="sd-ai-placeholder">(AI TEXT)</span></h3>
                <p>{risks ? 'Risk records exist for this company; review the risk and performance section below for the available volatility, drawdown and risk-adjusted measures.' : 'A current risk-metrics snapshot is not available. Investors should independently examine business concentration, competition, balance-sheet exposure, market conditions and upcoming company disclosures relevant to this issuer.'} The next useful evidence to review is the company’s next reported financial results, any changes in forward estimates, and primary-source disclosures. These can strengthen or weaken an investment thesis; none should be replaced by a single metric.</p>
                <p className="sd-editorial-source-note">Editorial integrity: this summary uses fields available in the current database. Missing evidence is called out rather than filled with invented facts. Review the financial tables, source records and methodology below before relying on any conclusion.</p>
              </div>
            )}
            <section className="sd-thesis-block" aria-label="Evidence-led investment thesis">
              <h3>What the numbers mean for investors <span className="sd-ai-placeholder">(AI TEXT)</span></h3><p className="sd-ai-placeholder"> (AI TEXT) Generate a ticker-specific synthesis of the latest verified fundamentals; explain why each metric matters, what changed versus prior periods, and what evidence would confirm or weaken the thesis.</p>
              <div className="sd-thesis-grid">
                <div><span>Business quality</span><p>{finite(fundamentals?.revenue_growth) !== null && finite(fundamentals?.revenue_growth)! > 0 ? `Reported revenue growth is ${pct(fundamentals?.revenue_growth)}. Growth is encouraging, but investors should confirm it is recurring and understand what product, geography or customer group is driving it.` : 'A reliable revenue-growth reading is not available or is not positive in the latest stored snapshot. Review multiple reporting periods before judging the growth trajectory.'}</p></div>
                <div><span>Profitability</span><p>{finite(fundamentals?.gross_margin) !== null && finite(fundamentals?.operating_margin) !== null ? `Gross margin is ${pct(fundamentals?.gross_margin)} and operating margin is ${pct(fundamentals?.operating_margin)}. The gap helps show how much operating costs absorb after direct costs; compare the trend with prior periods and sector peers.` : 'Margin data is incomplete. Revenue alone cannot show whether the company converts sales into sustainable profit.'}</p></div>
                <div><span>Valuation</span><p>{valuationPe !== null ? `The stored P/E is ${number(valuationPe)}. A multiple is not a verdict by itself: interpret it alongside expected earnings growth, cyclicality, cash flow, and comparable companies.` : 'A usable P/E value is not stored. Avoid calling the shares cheap or expensive until earnings and valuation data can be verified.'}</p></div>
                <div><span>Price trend</span><p>{sma20 !== null && sma50 !== null && sma200 !== null && finite(quote?.price) !== null ? `The latest quote can be compared with the 20-, 50- and 200-day moving averages (${money(sma20)}, ${money(sma50)}, and ${money(sma200)}). Moving averages describe trend, not intrinsic value, and can lag sudden market changes.` : 'Moving-average context is incomplete, so this page avoids asserting a confirmed trend from missing indicators.'}</p></div>
              </div>
              <h3>Bull case, bear case and evidence to watch <span className="sd-ai-placeholder">(AI TEXT)</span></h3>
              <div className="sd-case-grid">
                <div className="sd-case sd-case-bull"><strong>Bull case</strong><p>{finite(fundamentals?.revenue_growth) !== null && finite(fundamentals?.revenue_growth)! > 0 && finite(fundamentals?.free_cash_flow) !== null && finite(fundamentals?.free_cash_flow)! > 0 ? 'The stored snapshot combines positive revenue growth with positive free cash flow. If future reports sustain both, it would support—but not guarantee—the case for durable business momentum.' : 'The bullish case needs confirmation from reported revenue growth, cash generation, and future company disclosures; the current snapshot does not establish those conditions together.'}</p></div>
                <div className="sd-case sd-case-bear"><strong>Bear case</strong><p>{valuationPe !== null && valuationPe > 30 ? `The stored P/E of ${number(valuationPe)} means expectations matter: a slowdown, weaker margins or downward earnings revisions could pressure the valuation.` : 'Potential downside still includes weaker demand, margin compression, competition, execution issues, or a broad market sell-off. Company-specific evidence is needed to quantify these risks.'}</p></div>
                <div className="sd-case sd-case-watch"><strong>What to watch next</strong><p>Track the next earnings release, changes in revenue and margin trends, cash flow, management guidance, analyst estimate revisions, and primary-source filings. Update the thesis when new evidence arrives rather than relying on one ratio or forecast.</p></div>
              </div>
              <p className="sd-editorial-source-note">These interpretations are rule-based explanations of the stored fields, not independently verified company-specific forecasts. Missing data is not treated as zero; all investment cases remain conditional on new evidence.</p>
            </section>
            <div className="sd-editorial-meta">US Market AI Research Desk · {modifiedDate ? `Data/research timestamp: ${dateLabel(modifiedDate)}` : 'Research timestamp unavailable'} · <a href="/disclaimer">Methodology & disclaimer</a></div>
          </article>

          <section className="sd-card" id="forecast">
            <div className="sd-section-heading"><div><span className="sd-kicker">QUANTITATIVE RESEARCH</span><h2>Stock forecast and analysis: price outlook <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Explain each available forecast horizon, model signal, confidence/uncertainty and main assumptions. Clearly distinguish model output from analyst consensus and never invent targets for missing years.</p><p>Forecasts are model outputs, not promises or personalized investment advice.</p></div><span className={direction === 'Bullish' ? 'sd-status-positive' : direction === 'Bearish' ? 'sd-status-negative' : 'sd-status-neutral'}>{direction}</span></div>
            {table(['Horizon','Model target','Expected change','Signal','Confidence score'], shortForecastRows)}
            {longForecastRows.length > 0 && <><h3 className="sd-subheading">Long-term model scenarios</h3><p className="sd-muted">Only years with stored model outputs are shown. Long-range scenarios carry substantial uncertainty.</p>{table(['Target year','Model target','Model return','Model version'], longForecastRows)}</>}
            {longForecastRows.length === 0 && <p className="sd-footnote">Long-term forecast records are not available yet; no values are fabricated or extrapolated on this page.</p>}
          </section>

          <section className="sd-card" id="fundamentals">
            <div className="sd-section-heading"><div><span className="sd-kicker">COMPANY FUNDAMENTALS</span><h2>Financial performance and company fundamentals <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Summarize multi-period revenue, earnings, margins, cash flow, debt and returns. Explain direction and possible drivers only when supported by filings or source data.</p><p>Reported fields from the current fundamentals snapshot.</p></div></div>
            {stock.description && <p className="sd-description">{stock.description}</p>}
            {financialCards.length ? <div className="sd-metric-grid">{financialCards.map(([label, value]) => <div className="sd-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{metricExplanation(String(label))}</small></div>)}</div> : <div className="sd-empty">Fundamental metrics have not been populated for this stock yet.</div>}
            {metricCards.length > 0 && <div className="sd-metric-grid sd-metric-grid-muted">{metricCards.map(([label, value]) => <div className="sd-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{metricExplanation(String(label))}</small></div>)}</div>}
          </section>

          <section className="sd-card" id="technicals">
            <div className="sd-section-heading"><div><span className="sd-kicker">TECHNICALS</span><h2>Technical indicators <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Translate RSI, moving averages, MACD, ATR and ADX into a balanced trend explanation. Explain conflicting signals and avoid direct buy/sell instructions.</p><p>Latest stored daily indicator snapshot; unavailable indicators are omitted.</p></div><span className="sd-count">{tech?.calculated_at ? dateLabel(tech.calculated_at) : 'No timestamp'}</span></div>
            {technicalCards.length ? <div className="sd-metric-grid">{technicalCards.map(([label, value]) => <div className="sd-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{metricExplanation(String(label))}</small></div>)}</div> : <div className="sd-empty">Technical indicator data is not available yet.</div>}
          </section>

          <section className="sd-card" id="financials">
            <div className="sd-section-heading"><div><span className="sd-kicker">REPORTED RESULTS</span><h2>Financial statements, earnings history and estimate revisions <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Summarize the latest earnings surprise, revenue/EPS trends, guidance and estimate revisions when actual and consensus values exist. State the fiscal period and data timestamp.</p><p>Recent normalized financial statement records.</p></div></div>
            {table(['Period','Statement','Revenue','Net income','Total assets','Free cash flow'], (financialStatements ?? []).slice(0, 12).map((row: any) => [dateLabel(row.period_end), String(row.statement_type ?? '—').replaceAll('_', ' '), compactMoney(row.revenue), compactMoney(row.net_income), compactMoney(row.total_assets), compactMoney(row.free_cash_flow)]))}
            <h3 className="sd-subheading">Financial metric history</h3>{table(['Period','Revenue growth','Gross margin','Operating margin','Net margin','ROE','ROIC'], (financialMetrics ?? []).slice(0, 8).map((m: any) => [dateLabel(m.period_end), pct(m.revenue_growth), pct(m.gross_margin), pct(m.operating_margin), pct(m.net_margin), pct(m.roe), pct(m.roic)]))}
            <h3 className="sd-subheading">Earnings history</h3>
            {table(['Report date','Fiscal period','EPS actual','EPS estimate','Revenue actual','Revenue estimate'], (earnings ?? []).map((e: any) => [dateLabel(e.earnings_date), e.fiscal_period ?? '—', money(e.eps_actual), money(e.eps_estimate), compactMoney(e.revenue_actual), compactMoney(e.revenue_estimate)]))}
            {(earningsRevisions ?? []).length > 0 && <><h3 className="sd-subheading">Analyst estimate revisions</h3>{table(['Revision date','Period','EPS estimate','Revenue estimate','Analyst count'], (earningsRevisions ?? []).slice(0, 8).map((e: any) => [dateLabel(e.revision_date), e.fiscal_period ?? e.period ?? '—', money(e.eps_estimate), compactMoney(e.revenue_estimate), number(e.analyst_count, 0)]))}</>}
          </section>

          <section className="sd-card" id="valuation">
            <div className="sd-section-heading"><div><span className="sd-kicker">VALUATION</span><h2>Stock valuation: P/E, forward P/E and multiples <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Explain whether valuation is high/low only against verified historical or peer benchmarks; state the comparison date, peer set and limitations. No unsupported “overvalued/undervalued” verdict.</p><p>Multiples shown only when the database has a usable value.</p></div></div>
            {(() => { const vals = [['P/E ratio', number(valuationPe)], ['Forward P/E', number(valuationForwardPe)], ['Price / sales', number(valuationPs)], ['Price / book', number(valuationPb)], ['PEG ratio', number(fundamentals?.peg_ratio)], ['Enterprise value', compactMoney(fundamentals?.enterprise_value)]] .filter(([, value]) => value !== '—'); return vals.length ? <div className="sd-metric-grid">{vals.map(([label, value]) => <div className="sd-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div> : <div className="sd-empty">Valuation multiples are not available yet.</div>; })()}
            {(peerMetrics ?? []).length > 0 && <><h3 className="sd-subheading">Peer context</h3>{table(['Metric','Company','Peer median','Peer average','Percentile'], (peerMetrics ?? []).slice(0, 12).map((p: any) => [p.metric_name ?? '—', number(p.company_value), number(p.peer_median), number(p.peer_average), p.percentile == null ? '—' : `${number(p.percentile)}%`]))}</>}
          </section>

          <section className="sd-card" id="news">
            <div className="sd-section-heading"><div><span className="sd-kicker">LATEST DEVELOPMENTS</span><h2>News and company updates <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Summarize only verified ticker/company-linked news, explain potential business/financial relevance, and separate reported facts from interpretation. If no relevant news exists, do not substitute unrelated market stories.</p><p>Stories linked to this stock in the current database.</p></div></div>
            {visibleNews.length ? <div className="sd-news-list">{visibleNews.map((item: any) => <article className="sd-news-item" key={item.id}><div className="sd-news-meta"><span>{item.source ?? 'News source'}</span><span>{dateLabel(item.published_at)}</span></div><h3>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a> : item.title}</h3>{item.summary && <p>{item.summary}</p>}{item.sentiment && <span className="sd-news-sentiment">{item.sentiment}</span>}</article>)}</div> : <div className="sd-empty">No ticker-linked news records are available yet.</div>}
          </section>

          <section className="sd-card" id="dividends">
            <div className="sd-section-heading"><div><span className="sd-kicker">SHAREHOLDER RETURNS</span><h2>Dividend history and shareholder payments <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Explain dividend frequency, latest amount, yield only if correctly calculated from verified price and annualized dividends, changes/cuts and payout sustainability when data supports it.</p><p>Stored dividend events, where available.</p></div></div>
            {table(['Ex-date','Payment date','Dividend / share','Frequency','Currency'], (dividends ?? []).slice(0, 10).map((d: any) => [dateLabel(d.ex_date), dateLabel(d.payment_date), d.amount == null ? '—' : money(d.amount, 4), d.frequency ?? '—', d.currency ?? 'USD']))}
          </section>

          <section className="sd-card" id="risk">
            <div className="sd-section-heading"><div><span className="sd-kicker">RISK CONTEXT</span><h2>Risk and performance profile <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Explain volatility, beta, drawdown, Sharpe/Sortino and period returns in plain English; compare only with a valid benchmark and state the measurement window.</p><p>Computed risk/performance records; not a recommendation.</p></div></div>
            {(() => { const riskItems = [['Volatility', pct(risks?.volatility)], ['Beta', number(risks?.beta)], ['Maximum drawdown', pct(risks?.max_drawdown)], ['Sharpe ratio', number(risks?.sharpe_ratio)], ['Sortino ratio', number(risks?.sortino_ratio)], ['Liquidity risk', risks?.liquidity_risk], ['1-month return', pct(performance?.return_1m)], ['3-month return', pct(performance?.return_3m)], ['1-year return', pct(performance?.return_1y)]] .filter(([, value]) => value !== null && value !== undefined && value !== '—'); return riskItems.length ? <div className="sd-metric-grid">{riskItems.map(([label, value]) => <div className="sd-metric" key={String(label)}><span>{label}</span><strong>{String(value)}</strong></div>)}</div> : <div className="sd-empty">Risk metrics have not been calculated for this stock yet.</div>; })()}
          </section>

          <section className="sd-card" id="research-data">
            <div className="sd-section-heading"><div><span className="sd-kicker">RESEARCH EVIDENCE</span><h2>Source data and research records <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Add a concise source/methodology note explaining provider, reporting period, last update, missing-data coverage and how model outputs are produced. Do not imply independent verification unless performed.</p><p>Expandable evidence tables keep the main page focused while preserving detailed data.</p></div></div>
            <details className="sd-details"><summary>Institutional holders and ownership</summary>{table(['Period','Holder','Shares','Value','Ownership'], (institutionalHolders ?? []).slice(0, 12).map((h: any) => [dateLabel(h.period_end), h.holder_name ?? h.institution_name ?? '—', number(h.shares, 0), compactMoney(h.market_value ?? h.value), pct(h.ownership_percent)]))}{table(['Period','Shares outstanding','Institutional ownership','Insider ownership'], (ownership ?? []).slice(0, 8).map((o: any) => [dateLabel(o.period_end), number(o.shares_outstanding, 0), pct(o.institutional_ownership), pct(o.insider_ownership)]))}</details>
            <details className="sd-details"><summary>Insider transactions</summary>{table(['Date','Insider','Title','Transaction','Shares','Price'], (insiderTransactions ?? []).slice(0, 12).map((t: any) => [dateLabel(t.transaction_date), t.insider_name ?? '—', t.insider_title ?? '—', t.transaction_type ?? '—', number(t.shares, 0), money(t.price)]))}</details>
            <details className="sd-details"><summary>SEC filings</summary>{table(['Filed','Form','Description','Accession'], (secFilings ?? []).slice(0, 12).map((f: any) => [dateLabel(f.filing_date), f.form_type ?? f.form ?? '—', f.description ?? f.title ?? '—', f.accession_number ?? '—']))}</details>
            <details className="sd-details"><summary>Published AI research</summary>{table(['Updated','Title','Summary'], (aiResearch ?? []).map((r: any) => [dateLabel(r.updated_at), r.title ?? r.research_type ?? 'Research note', r.summary ?? r.content ?? r.analysis ?? '—']))}{article?.summary && <p className="sd-detail-copy">Latest published article: {article.summary}</p>}</details>
            <details className="sd-details"><summary>Quarterly and monthly research</summary>{table(['Period','Research summary'], (quarterlyResearch ?? []).map((r: any) => [dateLabel(r.period_end), r.summary ?? r.research_summary ?? r.content ?? '—']))}{table(['Month','Research summary'], (monthlyResearch ?? []).map((r: any) => [dateLabel(r.research_month), r.summary ?? r.research_summary ?? r.content ?? '—']))}</details>
            <details className="sd-details"><summary>Third-party metrics and ratios</summary>{table(['Period','Metric','Value','Source'], (threeSpreadMetrics ?? []).slice(0, 15).map((m: any) => [dateLabel(m.period_end), m.metric_name ?? m.metric_key ?? '—', number(m.value), m.data_source ?? '3Spread']))}{table(['Period','Ratio','Value','Source'], (threeSpreadRatios ?? []).slice(0, 15).map((m: any) => [dateLabel(m.period_end), m.ratio_name ?? m.ratio_key ?? '—', number(m.value), m.data_source ?? '3Spread']))}</details>
            <details className="sd-details"><summary>Data quality and provenance</summary><p className="sd-detail-copy">This page does not fill gaps with sample data. Values shown above come from the connected market-data and research tables.</p>{table(['Check date','Status','Completeness','Issues'], quality ? [[dateLabel(quality.check_date), quality.status ?? '—', pct(quality.completeness_score), number(quality.issue_count, 0)]] : [])}{table(['Retrieved','Dataset','Provider','Status'], (provenance ?? []).slice(0, 12).map((p: any) => [dateLabel(p.retrieved_at), p.dataset_name ?? p.table_name ?? '—', p.provider ?? p.source ?? '—', p.status ?? '—']))}</details>
            <details className="sd-details"><summary>Identifiers and model evaluation</summary>{table(['Identifier','Value','Source'], (identifiers ?? []).map((i: any) => [i.identifier_type ?? i.type ?? '—', i.identifier_value ?? i.value ?? '—', i.source ?? '—']))}{table(['Evaluated','Horizon','Predicted','Actual','Error','Hit'], (results ?? []).map((p: any) => [dateLabel(p.evaluated_at), p.horizon ?? '—', money(p.predicted_price), money(p.actual_price), pct(p.percentage_error), p.hit == null ? '—' : p.hit ? 'Yes' : 'No']))}</details>
          </section>

          <section className="sd-card" id="faq">
            <div className="sd-section-heading"><div><span className="sd-kicker">QUICK ANSWERS</span><h2>Frequently asked questions <span className="sd-ai-placeholder">(AI TEXT)</span></h2><p className="sd-ai-placeholder">(AI TEXT) Create 15–20 additional unique, data-aware FAQs from real Search Console queries and stock-specific data gaps; avoid duplicating existing questions or manufacturing search demand.</p></div></div>
            {faq.map(([question, answer]) => <details className="sd-faq" key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </section>
        </div>

        <aside className="sd-sidebar">
          <section className="sd-card sd-sidebar-card"><span className="sd-kicker">AT A GLANCE</span><h2>Research snapshot</h2><div className="sd-signal-row"><span>Quant model</span><strong>{direction}</strong></div><div className="sd-signal-row"><span>Technical trend</span><strong>{technicalTrend}</strong></div><div className="sd-signal-row"><span>Financial data</span><strong>{fundamentals ? 'Available' : 'Not populated'}</strong></div><div className="sd-signal-row"><span>Latest earnings</span><strong>{earnings?.[0] ? dateLabel(earnings[0].earnings_date) : '—'}</strong></div><div className="sd-signal-row"><span>Long-term scenarios</span><strong>{longForecastRows.length ? `${longForecastRows.length} years` : 'Unavailable'}</strong></div></section>
          <section className="sd-card sd-sidebar-card"><span className="sd-kicker">COMPANY PROFILE</span><h2>About {stock.symbol}</h2><p>{stock.description || 'A detailed company description has not been provided in the current stock profile.'}</p><dl className="sd-profile-list">{[['Sector',stock.sector],['Industry',stock.industry],['Headquarters',stock.headquarters],['Employees',stock.employees == null ? null : Number(stock.employees).toLocaleString('en-US')],['Founded',stock.founded_year],['CEO',stock.ceo]].filter(([,v]) => v !== null && v !== undefined && v !== '').map(([label,value]) => <div key={String(label)}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl></section>
          <section className="sd-card sd-sidebar-card sd-disclaimer"><span className="sd-kicker">IMPORTANT</span><h2>Use forecasts carefully</h2><p>Market prices can change quickly. Quantitative estimates and historical metrics are informational only, may be incomplete, and are not guarantees of future performance or personalized financial advice.</p><a href="/disclaimer">Read full disclaimer ↗</a></section>
        </aside>
      </section>

      {related?.length ? <section className="sd-related"><div className="sd-section-heading"><div><span className="sd-kicker">KEEP EXPLORING</span><h2>Related {displaySector ?? 'market'} stocks</h2><p>Other active stocks in this sector. This is a directory, not a performance ranking.</p></div><a href="/stocks">Browse all stocks ↗</a></div><div className="sd-related-grid">{related.map((item: any) => <a className="sd-related-card" href={`/stocks/${item.slug}`} key={item.id}><span>{item.symbol}</span><strong>{item.company_name}</strong><small>{item.sector && String(item.sector).toLowerCase() !== 'other' ? item.sector : (item.industry ?? 'US equity')}</small><b>{compactMoney(item.market_cap)} market cap</b></a>)}</div></section> : null}
      <footer className="sd-footer-note"><span>US MARKET AI · STOCK RESEARCH</span><p>Data availability varies by company and provider. Missing values are omitted rather than estimated. Forecasts are model outputs and should be independently evaluated.</p><small>Research updated {modifiedDate ? dateLabel(modifiedDate) : 'when data is available'} · <a href="/research-author">Research methodology</a> · <a href="/disclaimer">Disclaimer</a></small></footer>
    </div>
  </main>;
}
