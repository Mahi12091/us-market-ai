import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createDatabaseClient } from '@/lib/neon';

const SUFFIX = '-stock-price-prediction-2026-2050';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
type AnyRow = Record<string, any>;

type StaticArticleSection = { heading: string; body: string };
type StaticArticle = { title: string; description: string; category: string; sections: StaticArticleSection[] };

const STATIC_ARTICLES: Record<string, StaticArticle> = {
  'read-stock-valuation-metrics': {
    title: 'How to Read Stock Valuation Metrics',
    description: 'A practical framework for interpreting P/E, cash flow, growth, debt and valuation comparisons without treating one ratio as a buy signal.',
    category: 'Fundamentals · 7 min read',
    sections: [
      { heading: 'Start with the business, not the multiple', body: 'A valuation ratio is a comparison tool, not a verdict. Before comparing numbers, understand how the company earns revenue, whether demand is cyclical, how much capital the business needs, and what could change its competitive position. Two companies with the same P/E can have very different growth, debt, margins and risks.' },
      { heading: 'Use P/E with earnings quality and growth', body: 'Price-to-earnings compares market value with reported earnings. It becomes less useful when earnings are temporarily depressed, unusually high, negative or affected by one-off items. Compare the company with relevant peers and its own history, and examine whether earnings growth is supported by revenue, margins and cash generation rather than accounting adjustments alone.' },
      { heading: 'Check cash flow and the balance sheet', body: 'Free cash flow can help show whether reported profits translate into cash after operating needs and capital expenditure. Review debt maturities, interest costs, liquidity and share-count changes as well. A low multiple may reflect a genuine risk, a declining business, or a temporary market discount; the ratio alone cannot tell you which explanation is correct.' },
      { heading: 'Compare like with like', body: 'Use the same reporting period, currency and metric definition when comparing companies. Trailing and forward P/E are not interchangeable, and forward estimates can change. Sector differences matter: banks, utilities, software companies and early-stage businesses have different economics, so a single universal “cheap” threshold is unreliable.' },
      { heading: 'A disciplined valuation checklist', body: 'Ask what assumptions the current price implies, what evidence would invalidate those assumptions, how sensitive value is to growth and margins, and what downside scenarios look like. Treat missing or stale fundamentals as unknown, not zero. Valuation can support research, but it cannot remove business risk or guarantee future returns.' },
    ],
  },
  'interpret-earnings-reports': {
    title: 'How to Interpret a Company Earnings Report',
    description: 'Learn how to read revenue, earnings, margins, guidance and reporting dates while separating source facts from market expectations.',
    category: 'Earnings · 6 min read',
    sections: [
      { heading: 'Read revenue and earnings together', body: 'Revenue describes sales recognized for a period, while earnings reflect costs and accounting rules as well. Revenue growth with falling margins can signal pricing pressure or rising costs; earnings growth without corresponding cash generation deserves closer inspection. Compare year-over-year and sequential changes carefully because seasonality can distort short-term comparisons.' },
      { heading: 'Understand the margin story', body: 'Gross, operating and net margins help explain how much of each dollar of sales remains after different cost layers. Look for management explanations of mix, pricing, input costs, compensation and restructuring. A single quarter can contain unusual expenses or benefits, so compare reported results with the company’s own historical pattern and the notes in its filing.' },
      { heading: 'Separate fiscal periods from announcement dates', body: 'A fiscal period end, a filing date and an earnings-release date are different things. A database row derived from a filing does not automatically establish the date of the company’s next earnings announcement. Confirm event dates with the issuer’s investor-relations calendar or an exchange-approved source before planning around them.' },
      { heading: 'Guidance and expectations are not the same', body: 'A company can report strong results and still see its shares fall if expectations were higher or forward guidance disappointed. Conversely, weak reported numbers may be received positively if the outlook improves. Guidance is management’s estimate, not a promise, and consensus estimates can be incomplete or revised after publication.' },
      { heading: 'Verify the original evidence', body: 'Check the earnings release, filed financial statements and any reconciliation between GAAP and non-GAAP measures. Confirm units, period labels and currency. Automated summaries can omit important qualifications, so use them as navigation aids rather than substitutes for the primary document.' },
    ],
  },
  'understand-ai-stock-predictions': {
    title: 'How to Evaluate AI Stock Predictions',
    description: 'Understand forecast horizons, model confidence, historical validation and the difference between a quantitative estimate and investment advice.',
    category: 'Quantitative research · 7 min read',
    sections: [
      { heading: 'A forecast is an estimate, not a promise', body: 'A quantitative model estimates possible outcomes from selected inputs and assumptions. It does not know the future and cannot account perfectly for unexpected earnings, regulation, macroeconomic shocks or market liquidity. A prediction should be accompanied by its horizon, timestamp, inputs and limitations so readers can understand what it does—and does not—claim.' },
      { heading: 'Keep horizons separate', body: 'A 24-hour estimate and a multi-year outlook answer different questions. Short-horizon signals may depend on price action, volatility and recent momentum; long-horizon scenarios require assumptions about growth, margins, capital allocation and valuation. Do not extrapolate a short-term percentage change into a distant price target.' },
      { heading: 'Interpret confidence cautiously', body: 'A model confidence score is meaningful only when its definition is documented and calibrated against outcomes. It is not automatically the probability of making money or the probability that a price target will be reached. If the score has not been tested on out-of-sample data, treat it as a model-specific indicator rather than a validated probability.' },
      { heading: 'Demand historical validation', body: 'Forecasts should be recorded before outcomes are known and evaluated after the forecast horizon matures. Useful reporting includes sample size, hit rate, error distribution, baseline comparisons, missing outcomes and performance across market regimes. Avoid relying on cherry-picked examples or a backtest that ignores survivorship, transaction costs and data leakage.' },
      { heading: 'Use forecasts as one input', body: 'Compare model outputs with company fundamentals, technical conditions, source-linked news and downside risks. Verify the underlying data and note when it is stale or missing. A forecast is not individualized financial advice and should never replace independent judgment about objectives, time horizon and risk tolerance.' },
    ],
  },
  'market-breadth-and-sector-rotation': {
    title: 'Market Breadth and Sector Rotation Explained',
    description: 'Learn why index performance can hide uneven participation, how sector moves are summarized and where market breadth measures can mislead.',
    category: 'Market structure · 6 min read',
    sections: [
      { heading: 'An index move is only part of the picture', body: 'A major index can rise while many tracked stocks fall if a small number of large constituents carry the index. Breadth adds context by counting advancing, declining and unchanged securities in a defined universe. Always check the universe and timestamp: a sample of tracked companies is not the same as every US-listed stock.' },
      { heading: 'Read breadth with its methodology', body: 'Advancer and decliner counts depend on the quote timestamp, treatment of unchanged prices and the securities included. Missing quotes should not silently become zero returns. Breadth is a participation measure, not a forecast, and can change substantially around the market open, close or a data refresh.' },
      { heading: 'Sector performance needs context', body: 'Sector averages can show whether gains are broad or concentrated, but a simple average gives a small company the same weight as a mega-cap company. Market-cap-weighted sector returns answer a different question. Compare the methodology, coverage and weighting before interpreting differences between sector dashboards.' },
      { heading: 'Benchmark proxies are not official index values', body: 'Exchange-traded funds such as SPY, QQQ, DIA and IWM are commonly used as proxies for broad large-cap, Nasdaq-100, Dow Jones and small-cap exposure. Their prices reflect fund structure, expenses and trading conditions, so they are not identical to official index levels. Verify the timestamp and whether a displayed value is delayed.' },
      { heading: 'Build a balanced market view', body: 'Combine breadth with index direction, volatility, sector participation, volume and event context. Check whether readings use the same trading session and whether the source data is fresh. One dashboard metric rarely explains the whole market, and historical relationships may change during unusual conditions.' },
    ],
  },
};

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
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }} />
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
