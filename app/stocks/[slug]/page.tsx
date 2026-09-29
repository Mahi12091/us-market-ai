import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createDatabaseClient } from '@/lib/neon';
import PriceChart, { type ChartPoint } from '@/components/price-chart';
import StockSeoContent from '@/components/stock-seo-content';
import StockDataExpansion from '@/components/stock-data-expansion';
import StockBackendMetrics from '@/components/stock-backend-metrics';

export const revalidate = 300;

const money = (v: unknown, digits = 2) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const num = (v: unknown, digits = 2) => v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (v: unknown) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const db = createDatabaseClient();
  const { data: stock } = await db.from('stocks').select('company_name,symbol,description,sector,industry').eq('slug', slug).maybeSingle();
  if (!stock) return { title: 'Stock Not Found', robots: { index: false, follow: true } };
  const description = stock.description ?? `${stock.company_name} (${stock.symbol}) stock price, technical analysis, AI predictions, financials and market research.`;
  return { title: `${stock.company_name} (${stock.symbol}) Stock Price, Forecast, Prediction & Analysis`, description, keywords: [stock.symbol, `${stock.company_name} stock`, `${stock.symbol} stock price`, `${stock.symbol} stock prediction`, stock.sector, stock.industry].filter(Boolean) as string[], alternates: { canonical: `/stocks/${slug}` }, robots: { index: true, follow: true }, openGraph: { title: `${stock.company_name} (${stock.symbol}) Stock Analysis & Prediction`, description, type: 'article', url: `/stocks/${slug}` }, twitter: { card: 'summary', title: `${stock.company_name} (${stock.symbol}) Stock Analysis`, description } };
}

export default async function StockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createDatabaseClient();
  const { data: stock } = await db.from('stocks').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (!stock) notFound();

  const [{ data: quote }, { data: tech }, { data: predictions }, { data: article }, { data: fundamentals }, { data: earnings }, { data: news }, { data: history }, { data: results }, { data: related }, { data: financialStatements }, { data: dividends }, { data: ownership }, { data: monthlyResearch }, { data: quarterlyResearch }, { data: threeSpreadMetrics }, { data: threeSpreadRatios }] = await Promise.all([
    db.from('latest_quotes').select('*').eq('stock_id', stock.id).maybeSingle(),
    db.from('technical_indicators').select('*').eq('stock_id', stock.id).eq('timeframe', '1d').maybeSingle(),
    db.from('predictions').select('*').eq('stock_id', stock.id).order('prediction_time', { ascending: false }).limit(4),
    db.from('ai_articles').select('title,summary,content,updated_at').eq('stock_id', stock.id).eq('is_published', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('fundamentals').select('*').eq('stock_id', stock.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('earnings').select('*').eq('stock_id', stock.id).order('earnings_date', { ascending: false }).limit(4),
    db.from('news').select('id,title,summary,url,source,published_at,sentiment').eq('stock_id', stock.id).order('published_at', { ascending: false }).limit(5),
    db.from('price_history').select('timestamp,close').eq('stock_id', stock.id).eq('timeframe', '1d').order('timestamp', { ascending: true }).limit(250),
    db.from('prediction_results').select('id,horizon,predicted_price,actual_price,percentage_error,hit,evaluated_at').eq('stock_id', stock.id).order('evaluated_at', { ascending: false }).limit(8),
    db.from('stocks').select('id,symbol,slug,company_name,sector,market_cap').eq('is_active', true).eq('sector', stock.sector ?? '').neq('id', stock.id).order('market_cap', { ascending: false, nullsFirst: false }).limit(4),
    db.from('financial_statements').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).order('statement_type', { ascending: true }).limit(36),
    db.from('dividends').select('*').eq('stock_id', stock.id).order('ex_date', { ascending: false }).limit(12),
    db.from('ownership_snapshots').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(8),
    db.from('monthly_stock_research').select('*').eq('stock_id', stock.id).order('research_month', { ascending: false }).limit(6),
    db.from('quarterly_stock_research').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(4),
    db.from('threespread_metrics').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(100),
    db.from('threespread_ratios').select('*').eq('stock_id', stock.id).order('period_end', { ascending: false }).limit(100),
  ]);

  const chart: ChartPoint[] = (history ?? []).filter(x => x.close != null).map(x => ({ time: new Date(x.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), close: Number(x.close) }));
  const dailyChange = quote?.change_percent;
  const latestPrediction = predictions?.[0];
  const direction = latestPrediction?.direction ?? 'neutral';
  const pageUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/stocks/${stock.slug}` : `/stocks/${stock.slug}`;
  const modifiedDate = article?.updated_at ?? quote?.quote_timestamp ?? tech?.calculated_at ?? undefined;
  const breadcrumbJsonLd = { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: process.env.NEXT_PUBLIC_SITE_URL || '/' }, { '@type': 'ListItem', position: 2, name: 'US Stocks', item: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/stocks` : '/stocks' }, { '@type': 'ListItem', position: 3, name: stock.symbol, item: pageUrl }] };
  const datasetJsonLd = { '@type': 'Dataset', name: `${stock.company_name} (${stock.symbol}) market research data`, description: `${stock.company_name} stock price, technical indicators, quantitative forecasts and market research.`, url: pageUrl, spatialCoverage: 'United States', isAccessibleForFree: true };
  const graphJsonLd = { '@context': 'https://schema.org', '@graph': [datasetJsonLd, breadcrumbJsonLd] };

  return <div className="stock-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graphJsonLd) }} />
    <div className="container">
      <nav className="stock-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/stocks">US Stocks</a><span>/</span><span>{stock.sector ?? 'Market'}</span><span>/</span><b>{stock.symbol}</b></nav>
      <section className="stock-hero"><div className="stock-title-block"><div className="stock-logo">{stock.symbol.slice(0, 1)}</div><div><div className="eyebrow">{stock.exchange ?? 'US MARKET'} · {stock.sector ?? 'EQUITY'}</div><h1>{stock.company_name}</h1><div className="stock-symbol">{stock.symbol} · {stock.industry ?? 'Public company'}</div></div></div><div className="quote-block"><div className="quote-price">{money(quote?.price)}</div><div className={Number(dailyChange) >= 0 ? 'positive quote-change' : 'negative quote-change'}>{quote?.change != null ? `${Number(quote.change) >= 0 ? '+' : ''}${money(quote.change)} · ${pct(dailyChange)}` : 'Quote unavailable'}</div><small className="muted">{quote?.quote_timestamp ? `Updated ${new Date(quote.quote_timestamp).toLocaleString('en-US')}` : 'Waiting for market feed'}</small></div></section>
      <section className="stock-actions"><a className="button primary" href="#analysis">AI Analysis</a><a className="button" href="#predictions">View Predictions</a><a className="button" href="#long-term">Long-Term Forecast</a><a className="button" href="#backend-fundamentals">Fundamentals</a></section>
      <section className="stock-grid-top"><div className="panel chart-panel"><div className="panel-head"><div><h2>Price performance</h2><p className="muted">Daily closing price · {chart.length || 0} sessions</p></div><div className="range-tabs"><span className="active">1Y</span><span>6M</span><span>3M</span></div></div>{chart.length ? <PriceChart data={chart}/> : <div className="empty-state">Historical price data is not available yet.</div>}</div><div className="panel prediction-card" id="predictions"><div className="panel-head"><div><div className="eyebrow">QUANT MODEL</div><h2>AI outlook</h2></div><span className={`signal ${direction}`}>{direction}</span></div><p className="muted">Quantitative price outlook based on available market signals. Not financial advice.</p><div className="prediction-list">{(predictions ?? []).length ? predictions?.map(p => <div className="prediction-row" key={p.id}><div><b>{String(p.horizon).toUpperCase()}</b><small>{p.signal ?? 'Quantitative forecast'}</small></div><div className="prediction-right"><strong>{money(p.predicted_price)}</strong><span className={Number(p.predicted_change_percent) >= 0 ? 'positive' : 'negative'}>{pct(p.predicted_change_percent)}</span></div></div>) : <div className="empty-state">Forecasts will appear after the quantitative model runs.</div>}</div></div></section>
      <StockSeoContent stock={stock} quote={quote} tech={tech} predictions={predictions ?? []} fundamentals={fundamentals} earnings={earnings ?? []} news={news ?? []} results={results ?? []} article={article} />
      <StockDataExpansion financialStatements={financialStatements ?? []} dividends={dividends ?? []} ownership={ownership ?? []} monthlyResearch={monthlyResearch ?? []} quarterlyResearch={quarterlyResearch ?? []} />
      <StockBackendMetrics fundamentals={fundamentals} metrics={threeSpreadMetrics ?? []} ratios={threeSpreadRatios ?? []} />
      <section className="section disclaimer-section" id="disclaimer"><div className="panel"><div className="eyebrow">RESEARCH NOTE</div><h2>Stock Forecast Disclaimer</h2><p className="seo-prose">US Market AI forecasts and AI-generated analysis are estimates based on available market data and quantitative models. They are not guaranteed and are not personalized financial advice.</p><a className="button" href="/disclaimer">Read full disclaimer →</a></div></section>
      <section className="section author-section" id="research-author"><div className="panel author-card"><div className="author-avatar">US</div><div><div className="eyebrow">RESEARCH AUTHOR</div><h2>US Market AI Research Desk</h2><p>Research and editorial team responsible for presenting the platform's market data, quantitative model outputs, methodology and stock research pages.</p><div className="author-meta"><span>Data-driven research</span><span>Quantitative methodology</span><span>Updated {modifiedDate ? new Date(modifiedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'with available data'}</span></div></div><a className="button" href="/research-author">About the research desk →</a></div></section>
    </div>
  </div>;
}
