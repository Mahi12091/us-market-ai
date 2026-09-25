import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createDatabaseClient } from '@/lib/neon';

const SUFFIX = '-stock-price-prediction-2026-2050';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
type AnyRow = Record<string, any>;

async function getStock(stockSlug: string): Promise<AnyRow | null> {
  const supabase = createDatabaseClient();
  const result = await supabase.from('stocks').select('*').eq('slug', stockSlug).eq('is_active', true).eq('is_indexable', true).maybeSingle();
  return (result.data ?? null) as AnyRow | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!slug.endsWith(SUFFIX)) return { title: 'Forecast Research', robots: { index: false, follow: true } };
  const stock = await getStock(slug.slice(0, -SUFFIX.length));
  if (!stock) return { title: 'Forecast Research', robots: { index: false, follow: true } };
  const title = `${stock.company_name} Stock Price Prediction 2026–2050`;
  const description = `${stock.company_name} (${stock.symbol}) long-term stock forecast research for 2026–2050, including methodology, technicals, fundamentals, risks and live stock intelligence.`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { title, description, type: 'article', ...(siteUrl ? { url: `${siteUrl}/blog/${slug}` } : {}) },
  };
}

export default async function ForecastArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug.endsWith(SUFFIX)) notFound();
  const stockSlug = slug.slice(0, -SUFFIX.length);
  const stock = await getStock(stockSlug);
  if (!stock) notFound();

  const supabase = createDatabaseClient();
  const results = await Promise.all([
    supabase.from('latest_quotes').select('price,change_percent,quote_timestamp').eq('stock_id', stock.id).maybeSingle(),
    supabase.from('fundamentals').select('revenue,revenue_growth,eps,eps_growth,pe_ratio,forward_pe,free_cash_flow,roe,report_date').eq('stock_id', stock.id).order('report_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('technical_indicators').select('rsi,macd,sma_50,sma_200,volatility,momentum,support_level,resistance_level,calculated_at').eq('stock_id', stock.id).eq('timeframe', '1d').maybeSingle(),
    supabase.from('stocks').select('symbol,slug,company_name,sector').eq('is_active', true).eq('is_indexable', true).eq('sector', stock.sector).neq('id', stock.id).order('market_cap', { ascending: false }).limit(4),
  ]);
  const quote = (results[0].data ?? null) as AnyRow | null;
  const fundamentals = (results[1].data ?? null) as AnyRow | null;
  const technicals = (results[2].data ?? null) as AnyRow | null;
  const related = (Array.isArray(results[3].data) ? results[3].data : []) as AnyRow[];

  const pageUrl = siteUrl ? `${siteUrl}/blog/${slug}` : `/blog/${slug}`;
  const articleJsonLd = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: `${stock.company_name} Stock Price Prediction 2026–2050`,
    description: `Long-term forecast research framework for ${stock.symbol}.`,
    author: { '@type': 'Organization', name: 'US Market AI Research Desk', url: siteUrl ? `${siteUrl}/about` : '/about' },
    publisher: { '@type': 'Organization', name: 'US Market AI', url: siteUrl || '/' },
    mainEntityOfPage: pageUrl,
  };
  const breadcrumbJsonLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl || '/' }, { '@type': 'ListItem', position: 2, name: 'Forecasts', item: siteUrl ? `${siteUrl}/blog` : '/blog' }, { '@type': 'ListItem', position: 3, name: stock.company_name, item: pageUrl }] };

  return <main className="blog-article-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    <div className="container">
      <nav className="article-breadcrumb"><a href="/">Home</a><span>›</span><a href="/blog">Forecasts</a><span>›</span><span>{stock.symbol}</span></nav>
      <header className="article-hero">
        <div className="eyebrow">{stock.symbol} · LONG-TERM FORECAST</div>
        <h1>{stock.company_name} Stock Price Prediction <span>2026–2050</span></h1>
        <p>Long-term research framework connecting current market data, technical signals, fundamentals, company context and future model validation.</p>
        <div className="article-links"><a className="button primary" href={`/stocks/${stock.slug}`}>Open {stock.symbol} Stock Page →</a><a className="button" href="/predictions">Prediction Dashboard</a></div>
      </header>

      <section className="article-summary-grid">
        <div><small>Current price</small><strong>{quote?.price != null ? `$${Number(quote.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Live data pending'}</strong><span>{quote?.change_percent != null ? `${Number(quote.change_percent) >= 0 ? '+' : ''}${Number(quote.change_percent).toFixed(2)}% today` : 'Verified quote unavailable'}</span></div>
        <div><small>Long-term model</small><strong>Preparing</strong><span>Validated 2026–2050 targets are not published until the long-horizon model is ready</span></div>
        <div><small>Sector</small><strong>{stock.sector || 'US market'}</strong><span>{stock.industry || 'Equity research'}</span></div>
      </section>

      <article className="article-body">
        <section><h2>How the {stock.symbol} forecast is built</h2><p>This page is designed to answer long-term stock-price questions with measurable inputs rather than a generic AI opinion. Numerical targets are intentionally withheld until a dedicated long-horizon model has produced and validated them.</p></section>
        <section><h2>{stock.company_name} Stock Price Forecast 2026–2050</h2><div className="forecast-table-placeholder">{[2026,2030,2035,2040,2050].map(year => <div key={year}><b>{year}</b><span>Validated long-term forecast pending</span></div>)}</div></section>
        <section><h2>2026 stock prediction</h2><p>The 2026 research section will combine the latest earnings trajectory, valuation, technical regime, sector conditions, market context and model assumptions. The current 24H–90D quantitative model is not presented as a 2026 price target.</p></section>
        <section><h2>2030 stock prediction</h2><p>The 2030 section will focus on multi-year growth, margins, earnings power, valuation ranges, capital allocation and changing market conditions once the long-horizon model is validated.</p></section>
        <section><h2>2035 stock prediction</h2><p>The 2035 outlook requires explicit long-range assumptions and scenario validation. US Market AI will show a target only when the relevant model output is available.</p></section>
        <section><h2>2040 stock prediction</h2><p>The 2040 research layer will track structural business drivers, industry evolution, long-term valuation assumptions and market regimes instead of extrapolating a short-term signal.</p></section>
        <section><h2>2050 stock prediction</h2><p>The 2050 section is intended as a long-horizon scenario research page. It will remain data-backed and assumption-led rather than presenting an unsupported single-number target.</p></section>
        <section><h2>Technical analysis</h2><div className="article-metrics"><span>RSI <b>{technicals?.rsi ?? '—'}</b></span><span>MACD <b>{technicals?.macd ?? '—'}</b></span><span>SMA 50 <b>{technicals?.sma_50 ?? '—'}</b></span><span>SMA 200 <b>{technicals?.sma_200 ?? '—'}</b></span><span>Volatility <b>{technicals?.volatility ?? '—'}</b></span><span>Momentum <b>{technicals?.momentum ?? '—'}</b></span></div><a href={`/stocks/${stock.slug}`}>See all technical indicators on the {stock.symbol} stock page →</a></section>
        <section><h2>Fundamental analysis</h2><div className="article-metrics"><span>Revenue growth <b>{fundamentals?.revenue_growth ?? '—'}</b></span><span>EPS growth <b>{fundamentals?.eps_growth ?? '—'}</b></span><span>P/E <b>{fundamentals?.pe_ratio ?? '—'}</b></span><span>Forward P/E <b>{fundamentals?.forward_pe ?? '—'}</b></span><span>ROE <b>{fundamentals?.roe ?? '—'}</b></span><span>Free cash flow <b>{fundamentals?.free_cash_flow ?? '—'}</b></span></div></section>
        <section><h2>Prediction methodology</h2><ul><li>Historical price and volume behavior</li><li>Technical indicators and volatility</li><li>Fundamentals and earnings data</li><li>Market, sector and macro context</li><li>News and sentiment signals</li><li>Out-of-sample prediction evaluation</li></ul></section>
        <section><h2>Risks and factors that could change the outlook</h2><p>Forecasts can change as earnings, valuation, macro conditions, volatility, company-specific events and market sentiment change. The model will record meaningful updates rather than silently replacing historical forecasts.</p></section>
        <section><h2>Author and research responsibility</h2><p><strong>US Market AI Research Desk</strong> maintains the research presentation, methodology and data-linked stock pages. Market values and quantitative outputs are displayed from connected data sources; missing values are not fabricated.</p></section>
      </article>

      <section className="related-research"><div className="section-head"><div><div className="eyebrow">INTERNAL RESEARCH NETWORK</div><h2>Related stocks</h2><p className="muted">Continue from this forecast into comparable companies in the same sector.</p></div><a href={`/stocks/${stock.slug}`}>View {stock.symbol} research →</a></div><div className="related-grid">{related.map((item) => <a href={`/stocks/${item.slug}`} key={item.symbol}><b>{item.symbol}</b><span>{item.company_name}</span><small>Stock research →</small></a>)}</div></section>
      <div className="article-disclaimer">This long-term page is currently a research framework and is not indexed while validated long-horizon outputs are unavailable. Forecasts are estimates, not financial advice.</div>
    </div>
  </main>;
}
