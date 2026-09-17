import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PriceChart, { type ChartPoint } from '@/components/price-chart';

export const revalidate = 300;

const money = (v: unknown, digits = 2) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const num = (v: unknown, digits = 2) => v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (v: unknown) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const compactMoney = (v: unknown) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(Number(v));
};

const forecastYears = [2026, 2030, 2035, 2040, 2050];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: stock } = await supabase.from('stocks').select('company_name,symbol,description,sector,industry').eq('slug', slug).maybeSingle();
  if (!stock) return { title: 'Stock Not Found', robots: { index: false, follow: true } };
  const description = stock.description ?? `${stock.company_name} (${stock.symbol}) stock price, technical analysis, AI predictions, 2026, 2030, 2035, 2040 and 2050 forecast research, market news and company analysis.`;
  return {
    title: `${stock.company_name} (${stock.symbol}) Stock Price, Analysis & Prediction 2026–2050`,
    description,
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

  const faqItems = [
    { q: `What is the current ${stock.symbol} stock price?`, a: quote?.price != null ? `${stock.symbol} is currently shown at ${money(quote.price)} in the latest stored market quote. The page is refreshed from the connected market-data pipeline.` : `The latest verified ${stock.symbol} quote is not currently available.` },
    { q: `What is the ${stock.symbol} stock prediction?`, a: predictions?.length ? `US Market AI currently shows quantitative forecasts for 24H, 7D, 30D and 90D using the stored market signals. The forecasts are estimates and not guarantees.` : `A quantitative forecast is not currently available for ${stock.symbol}.` },
    { q: `What is the ${stock.symbol} stock forecast for 2026?`, a: `The 2026 long-term forecast section is included as a research framework. A numerical 2026 target is shown only after a dedicated long-horizon model has produced and validated it; the current 24H–90D model is not presented as a 2026 target.` },
    { q: `What is the ${stock.symbol} stock forecast for 2030?`, a: `The 2030 section tracks the inputs that a validated long-horizon model should use, including company growth, valuation, earnings, market regime and sector conditions. No unsupported price target is displayed.` },
    { q: `What is the ${stock.symbol} stock forecast for 2035, 2040 and 2050?`, a: `The 2035, 2040 and 2050 sections are reserved for long-term model outputs. US Market AI does not invent numerical targets when validated long-horizon data is unavailable.` },
    { q: `What technical indicators are available for ${stock.symbol}?`, a: `The page can display RSI, MACD, SMA 50, SMA 200, EMA 20, ATR, ADX, volatility, Bollinger levels, stochastic, support and resistance from stored daily price history.` },
    { q: `Does US Market AI provide ${stock.symbol} fundamentals?`, a: fundamentals ? `Yes. Available fields can include revenue, growth, EPS, valuation ratios, return metrics, debt-to-equity, free cash flow and dividend yield.` : `Fundamental data is not currently populated for this stock, so the page does not estimate or fabricate missing values.` },
    { q: `Where can I read the latest ${stock.symbol} news?`, a: `The latest ticker-linked news appears in the Market News section of this page. Stories are shown with source, publication date and sentiment when available.` },
    { q: `How accurate are the ${stock.symbol} predictions?`, a: results?.length ? `Only predictions that have matured are evaluated. Recent evaluated outcomes are shown in the model-validation section; accuracy should be interpreted using the full mature sample rather than a single result.` : `There is not yet enough mature evaluation data on this page to claim a verified accuracy rate.` },
    { q: `Is the ${stock.symbol} forecast financial advice?`, a: `No. US Market AI provides research and model estimates for informational purposes. Forecasts can be wrong and should not be treated as personalized financial advice.` },
  ];

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

      <section className="metric-strip"><div><span>Open</span><b>{money(quote?.open)}</b></div><div><span>Day High</span><b>{money(quote?.high)}</b></div><div><span>Day Low</span><b>{money(quote?.low)}</b></div><div><span>Prev. Close</span><b>{money(quote?.previous_close)}</b></div><div><span>Volume</span><b>{quote?.volume ? Number(quote.volume).toLocaleString() : '—'}</b></div><div><span>Market Cap</span><b>{compactMoney(stock.market_cap)}</b></div></section>

      <section className="section stock-section"><div className="section-head"><div><div className="eyebrow">TECHNICAL SIGNALS</div><h2>Technical analysis</h2><p className="muted">Indicators calculated from the stored daily price history.</p></div></div><div className="grid grid-4 indicator-grid">{[['RSI',tech?.rsi,'Momentum'],['MACD',tech?.macd,'Trend'],['SMA 50',tech?.sma_50,'Moving average'],['SMA 200',tech?.sma_200,'Moving average'],['EMA 20',tech?.ema_20,'Moving average'],['ATR',tech?.atr,'Volatility'],['ADX',tech?.adx,'Trend strength'],['Volatility',tech?.volatility,'Risk'],['Bollinger Upper',tech?.bollinger_upper,'Range'],['Stochastic',tech?.stochastic,'Momentum'],['Support',tech?.support_level,'Key level'],['Resistance',tech?.resistance_level,'Key level']].map(([name,value,sub]) => <div className="panel indicator-card" key={String(name)}><span>{name}</span><strong>{num(value)}</strong><small>{sub}</small></div>)}</div></section>

      <section className="section two-column"><div className="panel content-panel"><div className="eyebrow">FUNDAMENTALS</div><h2>Company fundamentals</h2>{fundamentals ? <div className="fund-grid">{[['Revenue',fundamentals.revenue],['Revenue Growth',pct(fundamentals.revenue_growth)],['Gross Profit',fundamentals.gross_profit],['Operating Income',fundamentals.operating_income],['Net Income',fundamentals.net_income],['EPS',fundamentals.eps],['P/E',fundamentals.pe_ratio],['Forward P/E',fundamentals.forward_pe],['PEG',fundamentals.peg_ratio],['Price / Sales',fundamentals.price_sales],['Debt / Equity',fundamentals.debt_equity],['ROE',pct(fundamentals.roe)],['Free Cash Flow',fundamentals.free_cash_flow],['Dividend Yield',pct(fundamentals.dividend_yield)]].map(([k,v]) => <div key={String(k)}><span>{k}</span><b>{typeof v === 'string' ? v : num(v)}</b></div>)}</div> : <div className="empty-state">Fundamental financial data is temporarily unavailable. No values are estimated or fabricated.</div>}</div><div className="panel content-panel"><div className="eyebrow">EARNINGS</div><h2>Earnings history</h2>{(earnings ?? []).length ? <div className="earnings-list">{earnings?.map(e => <div className="earn-row" key={e.id}><div><b>{e.earnings_date ? new Date(e.earnings_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</b><small>{e.fiscal_period ?? 'Fiscal period'}</small></div><div><span>EPS</span><b>{num(e.eps_actual)}</b></div><div><span>Estimate</span><b>{num(e.eps_estimate)}</b></div><div className={Number(e.eps_surprise) >= 0 ? 'positive' : 'negative'}><span>Surprise</span><b>{pct(e.eps_surprise)}</b></div></div>)}</div> : <div className="empty-state">Earnings history is not currently available from the connected data sources.</div>}</div></section>

      <section className="section two-column" id="analysis"><article className="panel article-panel"><div className="eyebrow">AI MARKET ANALYSIS</div><h2>{article?.title ?? `${stock.symbol}: What the data is saying`}</h2><p className="article-summary">{article?.summary ?? 'A verified, data-driven analysis will be generated here from price action, technical indicators, fundamentals, earnings and market context.'}</p>{article?.content ? <div className="article-content">{article.content}</div> : <div className="article-placeholder"><b>Analysis pipeline ready</b><span>Research articles are generated and cached separately from the market-data workflow.</span></div>}</article><aside className="panel about-stock"><div className="eyebrow">ABOUT THE COMPANY</div><h2>{stock.company_name}</h2><p className="muted">{stock.description ?? `Research ${stock.company_name}, including price action, technical signals, fundamentals, earnings and quantitative market analysis.`}</p>{stock.homepage_url ? <a className="company-site-link" href={stock.homepage_url} target="_blank" rel="noreferrer">Visit company website →</a> : null}<div className="company-meta"><div><span>Symbol</span><b>{stock.symbol}</b></div><div><span>Exchange</span><b>{stock.exchange ?? 'US'}</b></div><div><span>Sector</span><b>{stock.sector ?? '—'}</b></div><div><span>Industry</span><b>{stock.industry ?? '—'}</b></div></div></aside></section>

      <section className="section long-term-forecast-section" id="long-term">
        <div className="section-head"><div><div className="eyebrow">LONG-TERM STOCK FORECAST</div><h2>{stock.company_name} Stock Price Prediction 2026–2050</h2><p className="muted">Dedicated research sections for 2026, 2030, 2035, 2040 and 2050. Numerical targets will appear only after the long-horizon model is validated.</p></div><a href={`/blog/${stock.slug}-stock-price-prediction-2026-2050`}>Open forecast article →</a></div>
        <div className="forecast-year-grid">
          {forecastYears.map((year) => <article className="forecast-year-card" key={year}><div className="forecast-year">{year}</div><h3>{stock.symbol} Prediction for {year}</h3><strong>Validated long-term forecast pending</strong><p>Research inputs: earnings, revenue growth, valuation, technical regime, volatility, sector context and market conditions.</p><a href={`/blog/${stock.slug}-stock-price-prediction-2026-2050`}>Read {year} research →</a></article>)}
        </div>
        <div className="long-term-methodology"><div><b>Why these targets are separated</b><span>Short-term 24H–90D model outputs are not presented as 2026–2050 price targets. Long-horizon forecasts need their own assumptions, validation and update history.</span></div><div><b>What can change the forecast</b><span>Company earnings, growth, valuation, interest rates, market regime, sector conditions, volatility and company-specific events.</span></div></div>
      </section>

      {(results ?? []).length ? <section className="section"><div className="section-head"><div><div className="eyebrow">MODEL VALIDATION</div><h2>Recent evaluated predictions</h2><p className="muted">Historical outcomes are shown only after a prediction has matured and been evaluated.</p></div></div><div className="news-list">{results?.map(r => <div className="news-item" key={r.id}><div><span className="news-source">{String(r.horizon).toUpperCase()} · {r.evaluated_at ? new Date(r.evaluated_at).toLocaleDateString() : 'Evaluated'}</span><h3>{r.actual_price != null ? `Actual $${Number(r.actual_price).toFixed(2)} vs forecast $${Number(r.predicted_price ?? 0).toFixed(2)}` : 'Evaluation recorded'}</h3><p className="muted">{r.percentage_error != null ? `Absolute percentage error: ${Number(r.percentage_error).toFixed(2)}%` : 'No error value recorded.'}</p></div><span className={`signal ${r.hit ? 'bullish' : 'bearish'}`}>{r.hit ? 'HIT' : 'MISS'}</span></div>)}</div></section> : null}

      <section className="section" id="news"><div className="section-head"><div><div className="eyebrow">MARKET NEWS</div><h2>Latest {stock.symbol} news</h2><p className="muted">Only stories explicitly associated with this stock are shown.</p></div><a className="text-link" href="/news">View all news →</a></div><div className="news-list">{(news ?? []).length ? news?.map(n => <a className="news-item" href={n.url ?? '#'} target={n.url ? '_blank' : undefined} rel={n.url ? 'noreferrer' : undefined} key={n.id}><div><span className="news-source">{n.source ?? 'Market News'} · {n.published_at ? new Date(n.published_at).toLocaleDateString() : 'Latest'}</span><h3>{n.title}</h3><p className="muted">{n.summary ?? 'Read the latest market development.'}</p></div><span className={`signal ${n.sentiment ?? 'neutral'}`}>{n.sentiment ?? 'neutral'}</span></a>) : <div className="panel empty-state">No recent {stock.symbol}-specific news is available.</div>}</div></section>

      <section className="section author-section"><div className="panel author-card"><div className="author-avatar">US</div><div><div className="eyebrow">RESEARCH AUTHOR</div><h2>US Market AI Research Desk</h2><p>Research and editorial team responsible for presenting the platform's market data, quantitative model outputs, methodology and stock research pages.</p><div className="author-meta"><span>Data-driven research</span><span>Quantitative methodology</span><span>Updated {modifiedDate ? new Date(modifiedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'with available data'}</span></div></div><a className="button" href="/about">About the research desk →</a></div></section>

      <section className="section faq-section" id="faq"><div className="section-head"><div><div className="eyebrow">FREQUENTLY ASKED QUESTIONS</div><h2>{stock.symbol} stock prediction FAQ</h2><p className="muted">Common questions about price, predictions, long-term forecasts, technicals and research methodology.</p></div></div><div className="faq-list">{faqItems.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div></section>

      {(related ?? []).length ? <section className="section"><div className="section-head"><div><div className="eyebrow">RELATED RESEARCH</div><h2>More {stock.sector ?? 'market'} stocks</h2><p className="muted">Explore other active stocks in the same sector.</p></div></div><div className="grid grid-4">{related?.map(r => <a className="panel indicator-card" href={`/stocks/${r.slug}`} key={r.id}><span>{r.symbol}</span><strong>{r.company_name}</strong><small>{compactMoney(r.market_cap)} market cap</small></a>)}</div></section> : null}

      <section className="section"><div className="panel disclaimer-box"><div><div className="eyebrow">RESEARCH NOTE</div><h2>Use predictions as one input, not the whole decision.</h2><p className="muted">US Market AI combines quantitative signals and verified market data to support research. Forecasts are estimates, can be wrong, and are not financial advice.</p></div><a className="button" href="/disclaimer">Read disclaimer →</a></div></section>
    </div>
  </div>;
}
