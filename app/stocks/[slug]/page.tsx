import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createDatabaseClient } from '@/lib/neon';
import PriceChart, { type ChartPoint } from '@/components/price-chart';
import StockSeoContent from '@/components/stock-seo-content';
import StockDataExpansion from '@/components/stock-data-expansion';
import StockBackendMetrics from '@/components/stock-backend-metrics';

export const revalidate = 300;

const money = (v: unknown, digits = 2) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (v: unknown) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const horizonOrder: Record<string, number> = { '24h': 1, '7d': 2, '30d': 3, '90d': 4 };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const db = createDatabaseClient();
  const { data: stock } = await db.from('stocks').select('company_name,symbol,description,sector,industry').eq('slug', slug).maybeSingle();
  if (!stock) return { title: 'Stock Not Found', robots: { index: false, follow: true } };

  const fallback = `${stock.company_name} (${stock.symbol}) stock price, financials, valuation, technical analysis, earnings, dividends, market research and quantitative forecasts.`;
  const description = stock.description?.trim() ? stock.description.trim().slice(0, 155) : fallback;
  const title = `${stock.company_name} (${stock.symbol}) Stock Price, Forecast, Analysis & Financials`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  const canonical = siteUrl ? `${siteUrl}/stocks/${slug}` : `/stocks/${slug}`;

  return {
    title,
    description,
    keywords: [stock.symbol, `${stock.company_name} stock`, `${stock.symbol} stock price`, `${stock.symbol} financials`, `${stock.symbol} valuation`, `${stock.symbol} earnings`, `${stock.symbol} dividend`, `${stock.symbol} stock analysis`, stock.sector, stock.industry].filter(Boolean) as string[],
    alternates: { canonical }, robots: { index: true, follow: true },
    openGraph: { title: `${stock.company_name} (${stock.symbol}) Stock Research`, description, type: 'website', url: canonical },
    twitter: { card: 'summary', title: `${stock.company_name} (${stock.symbol}) Stock Research`, description },
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
    db.from('price_history').select('timestamp,close').eq('stock_id', stock.id).eq('timeframe', '1d').order('timestamp', { ascending: true }).limit(250),
    db.from('prediction_results').select('id,horizon,predicted_price,actual_price,percentage_error,hit,evaluated_at').eq('stock_id', stock.id).order('evaluated_at', { ascending: false }).limit(8),
    db.from('stocks').select('id,symbol,slug,company_name,sector,market_cap').eq('is_active', true).eq('sector', stock.sector ?? '').neq('id', stock.id).order('market_cap', { ascending: false, nullsFirst: false }).limit(4),
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

  const chart: ChartPoint[] = (history ?? []).filter(x => x.close != null).map(x => ({ time: new Date(x.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), close: Number(x.close) }));
  const dailyChange = quote?.change_percent;
  const livePredictions = [...(predictions ?? [])].sort((a, b) => (horizonOrder[String(a.horizon)] ?? 99) - (horizonOrder[String(b.horizon)] ?? 99));
  const latestPrediction = livePredictions[0];
  const direction = latestPrediction?.direction ?? 'neutral';
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

  return <div className="stock-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graphJsonLd) }} />
    <div className="container">
      <nav className="stock-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/stocks">US Stocks</a>{stock.sector && <><span>/</span><span>{stock.sector}</span></>}<span>/</span><b>{stock.symbol}</b></nav>
      <section className="stock-hero">
        <div className="stock-title-block"><div className="stock-logo">{stock.symbol.slice(0, 1)}</div><div><div className="eyebrow">{stock.exchange ?? 'US MARKET'} · {stock.sector ?? 'EQUITY'}</div><h1>{stock.company_name}</h1><div className="stock-symbol">{stock.symbol} · {stock.industry ?? 'Public company'}</div></div></div>
        <div className="quote-block"><div className="quote-price">{money(quote?.price)}</div><div className={Number(dailyChange) >= 0 ? 'positive quote-change' : 'negative quote-change'}>{quote?.change != null ? `${Number(quote.change) >= 0 ? '+' : ''}${money(quote.change)} · ${pct(dailyChange)}` : 'Quote unavailable'}</div><small className="muted">{quote?.quote_timestamp ? `Updated ${new Date(quote.quote_timestamp).toLocaleString('en-US')}` : 'Waiting for market feed'}</small></div>
      </section>
      <section className="stock-price-stats" aria-label="Current trading statistics">
        <div className="stock-price-stat"><span>Current Price</span><strong>{money(quote?.price, 2)}</strong></div>
        <div className="stock-price-stat"><span>Open</span><strong>{money(quote?.open, 2)}</strong></div>
        <div className="stock-price-stat"><span>Day High</span><strong>{money(quote?.high, 2)}</strong></div>
        <div className="stock-price-stat"><span>Day Low</span><strong>{money(quote?.low, 2)}</strong></div>
        <div className="stock-price-stat"><span>Previous Close</span><strong>{money(quote?.previous_close, 2)}</strong></div>
        <div className="stock-price-stat"><span>Volume</span><strong>{quote?.volume != null ? Number(quote.volume).toLocaleString('en-US') : '—'}</strong></div>
      </section>
      <section className="stock-actions" aria-label="Stock research sections"><a className="button primary" href="#overview">Start Here</a><a className="button" href="#financials">Financial Health</a><a className="button" href="#valuation">Valuation</a><a className="button" href="#technical-analysis">Technical</a><a className="button" href="#predictions">Forecasts</a><a className="button" href="#risks">Risks</a><a className="button" href="#data-room">Data Room</a></section>
      <section className="stock-grid-top">
        <div className="panel chart-panel"><div className="panel-head"><div><h2>Price performance</h2><p className="muted">Daily closing price · {chart.length || 0} sessions</p></div></div>{chart.length ? <PriceChart data={chart}/> : <div className="empty-state">Historical price data is not available yet.</div>}</div>
        <div className="panel prediction-card" id="predictions"><div className="panel-head"><div><div className="eyebrow">QUANTITATIVE MODEL · V3</div><h2>Live model outlook</h2></div><span className={`signal ${direction}`}>{direction}</span></div><p className="muted">Quantitative estimates from the current v3 ensemble. Confidence is a model-quality score, not a probability of being correct.</p><div className="prediction-list">{livePredictions.length ? livePredictions.map(p => <div className="prediction-row" key={p.id}><div><b>{String(p.horizon).toUpperCase()}</b><small>{p.signal ?? 'Quantitative forecast'}{p.confidence != null ? ` · confidence ${Number(p.confidence).toFixed(0)}` : ''}</small></div><div className="prediction-right"><strong>{money(p.predicted_price)}</strong><span className={Number(p.predicted_change_percent) >= 0 ? 'positive' : 'negative'}>{pct(p.predicted_change_percent)}</span></div></div>) : <div className="empty-state">Fresh quantitative forecasts will appear after the model runs.</div>}</div></div>
      </section>
      <StockSeoContent stock={stock} quote={quote} tech={tech} predictions={livePredictions} fundamentals={fundamentals} financialMetrics={financialMetrics ?? []} earnings={earnings ?? []} earningsRevisions={earningsRevisions ?? []} news={news ?? []} results={results ?? []} article={article} aiResearch={aiResearch ?? []} performance={performance} risks={risks} valuations={valuations} longTerm={longTerm ?? []} peerMetrics={peerMetrics ?? []} />
      <StockDataExpansion financialStatements={financialStatements ?? []} dividends={dividends ?? []} ownership={ownership ?? []} institutionalHolders={institutionalHolders ?? []} insiderTransactions={insiderTransactions ?? []} monthlyResearch={monthlyResearch ?? []} quarterlyResearch={quarterlyResearch ?? []} secFilings={secFilings ?? []} identifiers={identifiers ?? []} provenance={provenance ?? []} quality={quality} />
      <StockBackendMetrics fundamentals={fundamentals} financialMetrics={financialMetrics ?? []} metrics={threeSpreadMetrics ?? []} ratios={threeSpreadRatios ?? []} />
      {related?.length ? <section className="section" id="related-stocks"><div className="panel"><div className="eyebrow">RELATED RESEARCH</div><h2>More {stock.sector ?? 'Market'} Stocks</h2><p className="seo-prose">Explore other active US-listed companies in the same sector. Market-cap ordering is used only to make the directory easier to browse; it is not an investment ranking.</p><div className="stock-directory">{related.map((item: any) => <a className="directory-card" href={`/stocks/${item.slug}`} key={item.id}><div className="directory-top"><div className="ticker-badge">{item.symbol}</div><span className="research-badge">RESEARCH</span></div><div className="directory-symbol">{item.symbol}</div><div className="directory-name">{item.company_name}</div><div className="directory-meta"><span>{item.sector ?? 'US Equity'}</span>{item.market_cap != null && <span>Market cap {money(item.market_cap, 0)}</span>}</div><div className="directory-arrow">→</div></a>)}</div></div></section> : null}
      <section className="section disclaimer-section" id="disclaimer"><div className="panel"><div className="eyebrow">RESEARCH NOTE</div><h2>How to Read This Stock Research</h2><p className="seo-prose">US Market AI separates observed market data, reported financial information and quantitative model outputs. Missing values are not estimated. Forecasts are model estimates, not guarantees or personalized financial advice. For filings and corporate actions, readers should verify the company's investor-relations materials and applicable regulatory filings.</p><a className="button" href="/disclaimer">Read full disclaimer →</a></div></section>
      <section className="section author-section" id="research-author"><div className="panel author-card"><div className="author-avatar">US</div><div><div className="eyebrow">RESEARCH AUTHOR</div><h2>US Market AI Research Desk</h2><p>Research and editorial team responsible for presenting market data, quantitative model outputs, methodology and stock research pages.</p><div className="author-meta"><span>Data-driven research</span><span>Quantitative methodology</span><span>Updated {modifiedDate ? new Date(modifiedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'with available data'}</span></div></div><a className="button" href="/research-author">About the research desk →</a></div></section>
    </div>
  </div>;
}
