import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const SUFFIX = '-stock-price-prediction-2026-2050';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://us-market-4msyoejtw-mahi12091s-projects.vercel.app';

async function getStock(stockSlug: string) {
  const supabase = await createClient();
  const { data: stock } = await supabase.from('stocks').select('*').eq('slug', stockSlug).eq('is_active', true).eq('is_indexable', true).maybeSingle();
  return stock;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!slug.endsWith(SUFFIX)) return { title: 'Forecast Research' };
  const stock = await getStock(slug.slice(0, -SUFFIX.length));
  if (!stock) return { title: 'Forecast Research' };
  return {
    title: `${stock.company_name} Stock Price Prediction 2026–2050`,
    description: `${stock.company_name} (${stock.symbol}) stock price prediction research for 2026–2050, with technicals, fundamentals, model methodology, risks and links to live stock intelligence.`,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { title: `${stock.company_name} Stock Price Prediction 2026–2050`, description: `Forecast research for ${stock.symbol}.`, type: 'article', url: `${siteUrl}/blog/${slug}` },
  };
}

export default async function ForecastArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug.endsWith(SUFFIX)) notFound();
  const stockSlug = slug.slice(0, -SUFFIX.length);
  const stock = await getStock(stockSlug);
  if (!stock) notFound();

  const supabase = await createClient();
  const [{ data: quote }, { data: fundamentals }, { data: technicals }, { data: related }] = await Promise.all([
    supabase.from('latest_quotes').select('price,change_percent,quote_timestamp').eq('stock_id', stock.id).maybeSingle(),
    supabase.from('fundamentals').select('revenue,revenue_growth,eps,eps_growth,pe_ratio,forward_pe,free_cash_flow,roe,report_date').eq('stock_id', stock.id).order('report_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('technical_indicators').select('rsi,macd,sma_50,sma_200,volatility,momentum,support_level,resistance_level,calculated_at').eq('stock_id', stock.id).eq('timeframe', '1d').maybeSingle(),
    supabase.from('stocks').select('symbol,slug,company_name,sector').eq('is_active', true).eq('is_indexable', true).eq('sector', stock.sector).neq('id', stock.id).order('market_cap', { ascending: false }).limit(4),
  ]);

  const articleJsonLd = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: `${stock.company_name} Stock Price Prediction 2026–2050`,
    description: `Forecast research for ${stock.symbol}.`,
    author: { '@type': 'Organization', name: 'US Market AI', url: siteUrl },
    publisher: { '@type': 'Organization', name: 'US Market AI', url: siteUrl },
    mainEntityOfPage: `${siteUrl}/blog/${slug}`,
  };
  const breadcrumbJsonLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl }, { '@type': 'ListItem', position: 2, name: 'Forecasts', item: `${siteUrl}/blog` }, { '@type': 'ListItem', position: 3, name: stock.company_name, item: `${siteUrl}/blog/${slug}` }] };

  return <main className="blog-article-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    <div className="container">
      <nav className="article-breadcrumb"><a href="/">Home</a><span>›</span><a href="/blog">Forecasts</a><span>›</span><span>{stock.symbol}</span></nav>
      <header className="article-hero">
        <div className="eyebrow">{stock.symbol} · LONG-TERM FORECAST</div>
        <h1>{stock.company_name} Stock Price Prediction <span>2026–2050</span></h1>
        <p>Quantitative forecast research combining price history, technical signals, fundamentals, market context and prediction validation.</p>
        <div className="article-links"><a className="button primary" href={`/stocks/${stock.slug}`}>Open {stock.symbol} Stock Page →</a><a className="button" href="/predictions">Prediction Dashboard</a></div>
      </header>

      <section className="article-summary-grid">
        <div><small>Current price</small><strong>{quote?.price != null ? `$${Number(quote.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Live data pending'}</strong><span>{quote?.change_percent != null ? `${Number(quote.change_percent) >= 0 ? '+' : ''}${Number(quote.change_percent).toFixed(2)}% today` : 'Verified quote unavailable'}</span></div>
        <div><small>AI forecast</small><strong>Preparing</strong><span>Validated model output will appear here</span></div>
        <div><small>Sector</small><strong>{stock.sector || 'US market'}</strong><span>{stock.industry || 'Equity research'}</span></div>
      </section>

      <article className="article-body">
        <section><h2>Apple-style forecast structure, built for {stock.symbol}</h2><p>This forecast page is designed to answer long-term stock-price questions with measurable inputs rather than a generic AI opinion. Once the quantitative model has validated a forecast, this page will show the 2026, 2027–2030, 2035, 2040 and 2050 scenarios alongside the assumptions behind each range.</p></section>
        <section><h2>{stock.company_name} Stock Price Forecast 2026–2050</h2><div className="forecast-table-placeholder"><div><b>2026</b><span>Awaiting validated forecast</span></div><div><b>2027–2030</b><span>Awaiting validated forecast</span></div><div><b>2035</b><span>Awaiting validated forecast</span></div><div><b>2040</b><span>Awaiting validated forecast</span></div><div><b>2050</b><span>Awaiting validated forecast</span></div></div></section>
        <section><h2>Bull, Base and Bear scenarios</h2><p>Scenario ranges will be derived from model features, growth assumptions, valuation context, volatility and market regime. The article will preserve the assumptions and update history so readers can compare earlier forecasts with later outcomes.</p></section>
        <section><h2>Technical analysis</h2><div className="article-metrics"><span>RSI <b>{technicals?.rsi ?? '—'}</b></span><span>MACD <b>{technicals?.macd ?? '—'}</b></span><span>SMA 50 <b>{technicals?.sma_50 ?? '—'}</b></span><span>SMA 200 <b>{technicals?.sma_200 ?? '—'}</b></span><span>Volatility <b>{technicals?.volatility ?? '—'}</b></span><span>Momentum <b>{technicals?.momentum ?? '—'}</b></span></div><a href={`/stocks/${stock.slug}`}>See all technical indicators on the {stock.symbol} stock page →</a></section>
        <section><h2>Fundamental analysis</h2><div className="article-metrics"><span>Revenue growth <b>{fundamentals?.revenue_growth ?? '—'}</b></span><span>EPS growth <b>{fundamentals?.eps_growth ?? '—'}</b></span><span>P/E <b>{fundamentals?.pe_ratio ?? '—'}</b></span><span>Forward P/E <b>{fundamentals?.forward_pe ?? '—'}</b></span><span>ROE <b>{fundamentals?.roe ?? '—'}</b></span><span>Free cash flow <b>{fundamentals?.free_cash_flow ?? '—'}</b></span></div></section>
        <section><h2>Prediction methodology</h2><ul><li>Historical price and volume behavior</li><li>Technical indicators and volatility</li><li>Fundamentals and earnings data</li><li>Market, sector and macro context</li><li>News and sentiment signals</li><li>Out-of-sample prediction evaluation</li></ul></section>
        <section><h2>Risks and factors that could change the outlook</h2><p>Forecasts can change as earnings, valuation, macro conditions, volatility, company-specific events and market sentiment change. The model will record meaningful updates rather than silently replacing historical forecasts.</p></section>
      </article>

      <section className="related-research"><div className="section-head"><div><div className="eyebrow">INTERNAL RESEARCH NETWORK</div><h2>Related stocks</h2><p className="muted">Continue from this forecast into comparable companies in the same sector.</p></div><a href={`/stocks/${stock.slug}`}>View {stock.symbol} research →</a></div><div className="related-grid">{(related ?? []).map((item) => <a href={`/stocks/${item.slug}`} key={item.symbol}><b>{item.symbol}</b><span>{item.company_name}</span><small>Stock research →</small></a>)}</div></section>
      <div className="article-disclaimer">Forecasts are estimates, not financial advice. Past prediction performance does not guarantee future results.</div>
    </div>
  </main>;
}
