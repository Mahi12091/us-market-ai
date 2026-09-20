import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PriceChart, { type ChartPoint } from '@/components/price-chart';
import StockSeoContent from '@/components/stock-seo-content';

export const revalidate = 300;

const money = (v: unknown, digits = 2) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const num = (v: unknown, digits = 2) => v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (v: unknown) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const compactMoney = (v: unknown) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(Number(v));
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: stock } = await supabase.from('stocks').select('company_name,symbol,description,sector,industry').eq('slug', slug).maybeSingle();
  if (!stock) return { title: 'Stock Not Found', robots: { index: false, follow: true } };
  const description = stock.description ?? `${stock.company_name} (${stock.symbol}) stock price, technical analysis, AI predictions, 2026, 2030, 2035, 2040 and 2050 forecast research, market news and company analysis.`;
  return {
    title: `${stock.company_name} (${stock.symbol}) Stock Price, Forecast, Prediction & Analysis`,
    description: `${stock.company_name} (${stock.symbol}) stock price, stock forecast, stock prediction, price target, technical analysis, financials, earnings, valuation, dividend, news and market research.`,
    keywords: [stock.symbol, `${stock.company_name} stock`, `${stock.symbol} stock price`, `${stock.symbol} stock prediction`, `${stock.symbol} forecast 2026`, `${stock.symbol} forecast 2030`, `${stock.symbol} forecast 2035`, `${stock.symbol} forecast 2040`, `${stock.symbol} forecast 2050`, stock.sector, stock.industry].filter(Boolean) as string[],
    alternates: { canonical: `/stocks/${slug}` },
    robots: { index: true, follow: true },
    openGraph: { title: `${stock.company_name} (${stock.symbol}) Stock Analysis & Prediction`, description, type: 'article', url: `/stocks/${slug}` },
    twitter: { card: 'summary', title: `${stock.company_name} (${stock.symbol}) Stock Analysis`, description },
  };
}

export default async function StockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: stock } = await supabase.from('stocks').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (!stock) notFound();

  const [{ data: quote }, { data: tech }, { data: predictions }, { data: article }, { data: fundamentals }, { data: earnings }, { data: news }, { data: history }, { data: results }, { data: related }] = await Promise.all([
    supabase.from('latest_quotes').select('*').eq('stock_id', stock.id).maybeSingle(),
    supabase.from('technical_indicators').select('*').eq('stock_id', stock.id).eq('timeframe', '1d').maybeSingle(),
    supabase.from('predictions').select('*').eq('stock_id', stock.id).order('prediction_time', { ascending: false }).limit(4),
    supabase.from('ai_articles').select('title,summary,content,updated_at').eq('stock_id', stock.id).eq('is_published', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('fundamentals').select('*').eq('stock_id', stock.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('earnings').select('*').eq('stock_id', stock.id).order('earnings_date', { ascending: false }).limit(4),
    supabase.from('news').select('id,title,summary,url,source,published_at,sentiment').eq('stock_id', stock.id).order('published_at', { ascending: false }).limit(5),
    supabase.from('price_history').select('timestamp,close').eq('stock_id', stock.id).eq('timeframe', '1d').order('timestamp', { ascending: true }).limit(250),
    supabase.from('prediction_results').select('id,horizon,predicted_price,actual_price,percentage_error,hit,evaluated_at').eq('stock_id', stock.id).order('evaluated_at', { ascending: false }).limit(8),
    supabase.from('stocks').select('id,symbol,slug,company_name,sector,market_cap').eq('is_active', true).eq('sector', stock.sector ?? '').neq('id', stock.id).order('market_cap', { ascending: false, nullsFirst: false }).limit(4),
  ]);

  const chart: ChartPoint[] = (history ?? []).filter(x => x.close != null).map(x => ({ time: new Date(x.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), close: Number(x.close) }));
  const dailyChange = quote?.change_percent;
  const latestPrediction = predictions?.[0];
  const direction = latestPrediction?.direction ?? 'neutral';
  const pageUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/stocks/${stock.slug}` : `/stocks/${stock.slug}`;
  const modifiedDate = article?.updated_at ?? quote?.quote_timestamp ?? tech?.calculated_at ?? undefined;


  const breadcrumbJsonLd = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: process.env.NEXT_PUBLIC_SITE_URL || '/' },
      { '@type': 'ListItem', position: 2, name: 'US Stocks', item: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/stocks` : '/stocks' },
      { '@type': 'ListItem', position: 3, name: stock.symbol, item: pageUrl },
    ],
  };
  const datasetJsonLd = {
    '@type': 'Dataset',
    name: `${stock.company_name} (${stock.symbol}) market research data`,
    description: `${stock.company_name} stock price, technical indicators, quantitative forecasts and market news.`,
    url: pageUrl,
    temporalCoverage: history?.length ? `${new Date(history[0].timestamp).toISOString().slice(0, 10)}/${new Date(history.at(-1)?.timestamp ?? history[0].timestamp).toISOString().slice(0, 10)}` : undefined,
    spatialCoverage: 'United States',
    isAccessibleForFree: true,
  };
  const articleJsonLd = {
    '@type': 'Article',
    headline: `${stock.company_name} (${stock.symbol}) Stock Analysis & Price Prediction 2026–2050`,
    description: `Research page for ${stock.company_name} covering price data, technical analysis, quantitative predictions, long-term forecast framework, company information, news and FAQs.`,
    mainEntityOfPage: pageUrl,
    dateModified: modifiedDate,
    author: { '@type': 'Organization', name: 'US Market AI Research Desk', url: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/about` : '/about' },
    publisher: { '@type': 'Organization', name: 'US Market AI', url: process.env.NEXT_PUBLIC_SITE_URL || '/' },
  };
  const graphJsonLd = { '@context': 'https://schema.org', '@graph': [articleJsonLd, breadcrumbJsonLd, datasetJsonLd] };

  return <div className="stock-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graphJsonLd) }} />
    <div className="container">
      <nav className="stock-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/stocks">US Stocks</a><span>/</span><span>{stock.sector ?? 'Market'}</span><span>/</span><b>{stock.symbol}</b></nav>

      <section className="stock-hero">
        <div className="stock-title-block">
          <div className="stock-logo">{stock.symbol.slice(0, 1)}</div>
          <div><div className="eyebrow">{stock.exchange ?? 'US MARKET'} · {stock.sector ?? 'EQUITY'}</div><h1>{stock.company_name}</h1><div className="stock-symbol">{stock.symbol} · {stock.industry ?? 'Public company'}</div></div>
        </div>
        <div className="quote-block"><div className="quote-price">{money(quote?.price)}</div><div className={Number(dailyChange) >= 0 ? 'positive quote-change' : 'negative quote-change'}>{quote?.change != null ? `${Number(quote.change) >= 0 ? '+' : ''}${money(quote.change)} · ${pct(dailyChange)}` : 'Quote unavailable'}</div><small className="muted">{quote?.quote_timestamp ? `Updated ${new Date(quote.quote_timestamp).toLocaleString('en-US')}` : 'Waiting for market feed'}</small></div>
      </section>

      <section className="stock-actions"><a className="button primary" href="#analysis">AI Analysis</a><a className="button" href="#predictions">View Predictions</a><a className="button" href="#long-term">Long-Term Forecast</a><a className="button" href="#news">Latest News</a></section>

      <section className="stock-grid-top">
        <div className="panel chart-panel"><div className="panel-head"><div><h2>Price performance</h2><p className="muted">Daily closing price · {chart.length || 0} sessions</p></div><div className="range-tabs"><span className="active">1Y</span><span>6M</span><span>3M</span></div></div>{chart.length ? <PriceChart data={chart}/> : <div className="empty-state">Historical price data is not available yet.</div>}</div>
        <div className="panel prediction-card" id="predictions"><div className="panel-head"><div><div className="eyebrow">QUANT MODEL</div><h2>AI outlook</h2></div><span className={`signal ${direction}`}>{direction}</span></div><p className="muted">Quantitative price outlook based on available market signals. Not financial advice.</p><div className="prediction-list">{(predictions ?? []).length ? predictions?.map(p => <div className="prediction-row" key={p.id}><div><b>{String(p.horizon).toUpperCase()}</b><small>{p.signal ?? 'Quantitative forecast'}</small></div><div className="prediction-right"><strong>{money(p.predicted_price)}</strong><span className={Number(p.predicted_change_percent) >= 0 ? 'positive' : 'negative'}>{pct(p.predicted_change_percent)}</span></div></div>) : <div className="empty-state">Forecasts will appear after the quantitative model runs.</div>}</div></div>
      </section>


      <StockSeoContent stock={stock} quote={quote} tech={tech} predictions={predictions ?? []} fundamentals={fundamentals} earnings={earnings ?? []} news={news ?? []} results={results ?? []} article={article} />

      
      <section className="section disclaimer-section" id="disclaimer">
        <div className="panel">
          <div className="eyebrow">RESEARCH NOTE</div>
          <h2>Stock Forecast Disclaimer</h2>
          <p className="seo-prose">US Market AI forecasts and AI-generated analysis are estimates based on available market data and quantitative models. They are not guaranteed and are not personalized financial advice.</p>
          <a className="button" href="/disclaimer">Read full disclaimer →</a>
        </div>
      </section>

      <section className="section author-section" id="research-author">
        <div className="panel author-card">
          <div className="author-avatar">US</div>
          <div>
            <div className="eyebrow">RESEARCH AUTHOR</div>
            <h2>US Market AI Research Desk</h2>
            <p>Research and editorial team responsible for presenting the platform's market data, quantitative model outputs, methodology and stock research pages.</p>
            <div className="author-meta"><span>Data-driven research</span><span>Quantitative methodology</span><span>Updated {modifiedDate ? new Date(modifiedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'with available data'}</span></div>
          </div>
          <a className="button" href="/research-author">About the research desk →</a>
        </div>
      </section>

    </div>
  </div>;
}

