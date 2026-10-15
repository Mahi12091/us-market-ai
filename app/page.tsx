import type { Metadata } from 'next';
import { createDatabaseClient } from '@/lib/neon';
import LongTermResearchSection from '@/components/long-term-research-section';
import { cleanNewsText, dedupeNewsItems, newsSummary, safeNewsUrl } from '@/lib/news-content';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'US Stock Market Research, AI Analysis & Stock Screener',
  description: 'Research US stocks with market overview, company fundamentals, technical indicators, quantitative forecasts, sector analysis, earnings, dividends, ETF research and source-linked market news.',
  alternates: { canonical: 'https://usmarketai.com/' },
  openGraph: {
    title: 'US Market AI | US Stock Research & Market Intelligence',
    description: 'Explore US stocks, market trends, technical and fundamental analysis, quantitative forecasts, sector research and source-linked market news.',
    url: 'https://usmarketai.com/',
    siteName: 'US Market AI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'US Market AI | US Stock Research & Market Intelligence',
    description: 'US stock research, market context, quantitative forecasts and company news in one connected platform.',
  },
};

type StockRow = { id: string; symbol: string; slug: string | null; company_name: string; market_cap: number | null; sector: string | null; logo_url: string | null };
type MarketStockRow = { id: string; symbol: string; slug: string | null; company_name: string };
type NewsRow = { id: string; stock_id: string | null; title: string; summary: string | null; source: string | null; published_at: string | null; sentiment: string | null; url: string | null };
type QuoteRow = { stock_id: string; price: number | null; change_percent: number | null; quote_timestamp: string | null };

const marketLabels: Record<string, string> = { SPY: 'S&P 500 ETF proxy', QQQ: 'Nasdaq 100 ETF proxy', DIA: 'Dow Jones ETF proxy', IWM: 'Russell 2000 ETF proxy' };
const toneByIndex = ['news-blue', 'news-purple', 'news-gold', 'news-green'];
const categoryTiles = [['US Stocks','Company pages, prices, charts and available fundamentals.','/stocks','▥'],['Market Overview','Benchmark ETF proxies, market context and available quotes.','/markets','◒'],['Stock Screener','Explore stocks using available company and market fields.','/screener','⌕'],['Compare Stocks','Review companies side by side.','/compare','⇄'],['Stock Rankings','Browse ranked companies and available scores.','/rankings','↗'],['Sector & Industry','Explore companies by business sector and industry.','/sectors','▦'],['Technical Analysis','Indicators, momentum and trend context.','/analysis','⌁'],['AI Predictions','Quantitative forecast horizons when model data is available.','/predictions','◎'],['Market News','Source-linked headlines and ticker context.','/news','▤'],['Earnings','Upcoming and historical earnings research.','/earnings','▣'],['Dividends','Dividend-related company research.','/dividends','◉'],['ETF Research','Explore tracked exchange-traded funds.','/etfs','◫'],['IPO Research','Browse IPO-related company information.','/ipo','✦'],];
function formatPrice(value: number | null | undefined) { return value == null ? '—' : Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function formatChange(value: number | null | undefined) { return value == null ? '—' : `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`; }
function formatDate(value: string | null | undefined) { return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Latest'; }
function formatQuoteTimestamp(value: string | null | undefined) { if (!value) return 'Timestamp unavailable'; const date = new Date(value); return Number.isFinite(date.getTime()) ? `As of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}` : 'Timestamp unavailable'; }
function quoteIsFresh(value: string | null | undefined) { if (!value) return false; const timestamp = new Date(value).getTime(); return Number.isFinite(timestamp) && Date.now() - timestamp <= 7 * 24 * 60 * 60 * 1000; }
function prettySector(value: string | null | undefined) { return value?.trim() || 'US Stocks'; }

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'US Market AI',
  url: 'https://usmarketai.com/',
};

export default async function Home() {
  const supabase = createDatabaseClient();
  const [{ data: rawStocks }, { data: rawMarketStocks }, { data: rawNews }] = await Promise.all([
    supabase.from('stocks').select('id,symbol,slug,company_name,market_cap,sector,logo_url').eq('is_active', true).eq('is_indexable', true).eq('asset_type', 'stock').order('market_cap', { ascending: false, nullsFirst: false }).limit(500),
    supabase.from('stocks').select('id,symbol,slug,company_name').eq('is_active', true).in('symbol', Object.keys(marketLabels)),
    supabase.from('news').select('id,stock_id,title,summary,source,published_at,sentiment,url').order('published_at', { ascending: false, nullsFirst: false }).limit(80),
  ]);
  const stocks = (rawStocks ?? []) as StockRow[];
  const marketStocks = (rawMarketStocks ?? []) as MarketStockRow[];
  const newsItems = dedupeNewsItems((rawNews ?? []) as NewsRow[], 8);
  const allIds = [...new Set([...stocks.map(s => s.id), ...marketStocks.map(s => s.id)])];
  const { data: rawQuotes } = allIds.length ? await supabase.from('latest_quotes').select('stock_id,price,change_percent,quote_timestamp').in('stock_id', allIds) : { data: [] };
  const quotes = (rawQuotes ?? []) as QuoteRow[];
  const quoteMap = new Map(quotes.map(q => [q.stock_id, q]));
  const marketBySymbol = new Map(marketStocks.map(s => [s.symbol, { ...s, quote: quoteMap.get(s.id) }]));
  const quotedStocks = stocks.map(s => ({ ...s, quote: quoteMap.get(s.id) })).filter(s => s.quote?.price != null && Boolean(s.slug) && s.quote?.change_percent != null && quoteIsFresh(s.quote?.quote_timestamp));
  const movers = [...quotedStocks].sort((a,b) => Number(b.quote?.change_percent) - Number(a.quote?.change_percent)).slice(0,5);
  const losers = [...quotedStocks].sort((a,b) => Number(a.quote?.change_percent) - Number(b.quote?.change_percent)).slice(0,5);
  const newsStockIds = [...new Set(newsItems.map(n => n.stock_id).filter((id): id is string => Boolean(id)))];
  const { data: rawNewsStocks } = newsStockIds.length ? await supabase.from('stocks').select('id,symbol,slug,sector').in('id', newsStockIds) : { data: [] };
  const newsStocks = (rawNewsStocks ?? []) as Pick<StockRow, 'id' | 'symbol' | 'slug' | 'sector'>[];
  const newsStockMap = new Map(newsStocks.map(s => [s.id, s]));
  const sectorMap = new Map<string, StockRow[]>();
  for (const stock of stocks) { const sector = prettySector(stock.sector); const bucket = sectorMap.get(sector) ?? []; if (bucket.length < 6) bucket.push(stock); sectorMap.set(sector, bucket); }
  const sectorSections = [...sectorMap.entries()].filter(([, items]) => items.length >= 4).slice(0,6);
  const popularStocks = stocks.filter(s => s.slug).slice(0,6);
  const sectorNewsMap = new Map<string, NewsRow[]>();
  for (const item of newsItems) {
    const linked = item.stock_id ? newsStockMap.get(item.stock_id) : undefined;
    if (!linked?.sector?.trim()) continue;
    const sector = prettySector(linked.sector);
    const bucket = sectorNewsMap.get(sector) ?? [];
    if (bucket.length < 4) bucket.push(item);
    sectorNewsMap.set(sector, bucket);
  }
  const sectorNewsSections = [...sectorNewsMap.entries()].filter(([,items]) => items.length > 0).slice(0,4);

  return <div className="home-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, '\\u003c') }} />
    <div className="market-strip"><div className="container market-strip-inner">{Object.entries(marketLabels).map(([symbol,name]) => { const item=marketBySymbol.get(symbol); return <div className="ticker-mini" key={symbol}><span>{name}</span><strong>{formatPrice(item?.quote?.price)}</strong><em className={Number(item?.quote?.change_percent ?? 0)>=0?'up':'down'}>{formatChange(item?.quote?.change_percent)}</em><small>{formatQuoteTimestamp(item?.quote?.quote_timestamp)}</small></div>; })}<a href="/markets" className="market-link">View market overview →</a></div></div>
    <div className="container">
      <section className="hero-premium"><div className="hero-premium-copy"><div className="eyebrow-pill">US EQUITY INTELLIGENCE · RESEARCH WORKSPACE</div><h1>See the market.<br/><span>Understand the move.</span></h1><p className="hero-lead">A research workspace for serious US-market exploration. Track major ETF benchmarks, discover leading and lagging stocks, compare companies, study sector trends and connect market headlines with company-level context.</p><div className="hero-value-list"><span><b>01</b> Market pulse &amp; stock movers</span><span><b>02</b> Company fundamentals &amp; technical signals</span><span><b>03</b> Forecasts, sector research &amp; source-linked news</span></div><div className="button-row"><a className="button primary" href="/markets">Explore Market Intelligence →</a><a className="button" href="/screener">Find a Stock ↗</a></div><div className="hero-trust-row"><span>◫ <b>Data-aware context</b></span><span>◈ <b>Quantitative research</b></span><span>✓ <b>Clear risk framing</b></span></div></div><div className="hero-dashboard" aria-label="US Market AI market dashboard preview"><div className="dashboard-top"><span className="live-dot">● {marketBySymbol.get('SPY')?.quote?.price != null ? 'LATEST STORED QUOTE' : 'QUOTE UNAVAILABLE'}</span><small>Market intelligence</small></div><div className="dashboard-main"><div><small>SPY · S&amp;P 500 ETF proxy</small><strong>{formatPrice(marketBySymbol.get('SPY')?.quote?.price)}</strong><em>{formatChange(marketBySymbol.get('SPY')?.quote?.change_percent)}</em></div><div className="dashboard-data-note"><span>Market data snapshot</span><strong>{marketBySymbol.get('SPY')?.quote?.price != null ? formatQuoteTimestamp(marketBySymbol.get('SPY')?.quote?.quote_timestamp) : 'Waiting for quote data'}</strong><small>Prices may be delayed; check the timestamp on the relevant stock page.</small></div></div><div className="dashboard-indexes">{Object.entries(marketLabels).map(([symbol,name])=><div key={symbol}><span>{name}</span><b>{formatPrice(marketBySymbol.get(symbol)?.quote?.price)}</b><em>{formatChange(marketBySymbol.get(symbol)?.quote?.change_percent)}</em></div>)}</div><div className="dashboard-note">Markets move fast. <b>Stay ahead of the signal.</b></div></div></section>
      <section className="market-action-section" aria-label="Top stock gainers and losers">
        <div className="market-action-heading"><div><div className="eyebrow">THE MARKET AT A GLANCE</div><h2>Leaders, laggards &amp; market context.</h2><p>Daily price moves use stored quotes with timestamps no older than seven days. Older quotes are excluded from movers; coverage may not represent the entire US market.</p></div><a href="/markets">Full market overview <span>→</span></a></div>
        <div className="movers-pair">
          <div className="movers-panel gainers-panel"><div className="movers-panel-head"><div><span className="movement-symbol gain">↗</span><div><h3>Top gainers</h3><p>Strongest positive moves</p></div></div><span className="movement-label gain-label">GAINERS</span></div>
            {movers.length ? <div className="movement-list">{movers.map((s,i)=><a className="movement-row" href={'/stocks/' + s.slug} key={s.symbol}><span className="movement-rank">{String(i+1).padStart(2,'0')}</span><span className="movement-company"><b>{s.symbol}</b><small>{s.company_name}</small></span><span className="movement-price"><b>{'$'}{formatPrice(s.quote?.price)}</b><em className="up">{formatChange(s.quote?.change_percent)}</em></span></a>)}</div> : <div className="movement-empty">Gainer data is not available right now.</div>}
          </div>
          <div className="movers-panel losers-panel"><div className="movers-panel-head"><div><span className="movement-symbol loss">↘</span><div><h3>Top losers</h3><p>Largest negative moves</p></div></div><span className="movement-label loss-label">LOSERS</span></div>
            {losers.length ? <div className="movement-list">{losers.map((s,i)=><a className="movement-row" href={'/stocks/' + s.slug} key={s.symbol}><span className="movement-rank">{String(i+1).padStart(2,'0')}</span><span className="movement-company"><b>{s.symbol}</b><small>{s.company_name}</small></span><span className="movement-price"><b>{'$'}{formatPrice(s.quote?.price)}</b><em className="down">{formatChange(s.quote?.change_percent)}</em></span></a>)}</div> : <div className="movement-empty">Loser data is not available right now.</div>}
          </div>
        </div>
      </section>
      <section className="section category-section"><div className="section-head"><div><div className="eyebrow">EXPLORE THE PLATFORM</div><h2>One platform. A complete research workflow.</h2><p className="muted">Start with the market, find a company, compare the numbers and explore the risks—without losing context.</p></div></div><div className="category-grid">{categoryTiles.map(([name,desc,href,icon])=><a className="category-card" href={href} key={href+name}><span className="category-icon">{icon}</span><div><h3>{name}</h3><p>{desc}</p><b>Explore →</b></div></a>)}</div></section>
      <section className="section popular-section"><div className="section-head"><div><div className="eyebrow">MOST WATCHED</div><h2>Largest tracked US stocks</h2><p className="muted">A quick view of tracked companies ranked by available market capitalization, not short-term price momentum.</p></div><a href="/stocks">View all stocks →</a></div><div className="stock-list-grid">{popularStocks.map(s=><a className="stock-market-card" href={`/stocks/${s.slug}`} key={s.symbol}><div className="stock-logo">{s.symbol.slice(0,1)}</div><div className="stock-card-copy"><b>{s.symbol}</b><small>{s.company_name}</small></div><div className="stock-card-price"><strong>{quoteMap.get(s.id)?.price!=null?`$${formatPrice(quoteMap.get(s.id)?.price)}`:'—'}</strong><em className={Number(quoteMap.get(s.id)?.change_percent ?? 0) >= 0 ? "up" : "down"}>{formatChange(quoteMap.get(s.id)?.change_percent)}</em></div></a>)}</div></section>
      <LongTermResearchSection stocks={stocks} />
      {sectorSections.map(([sector,items])=><section className="section sector-section" key={sector}><div className="section-head"><div><div className="eyebrow">STOCK CATEGORY</div><h2>{sector}</h2><p className="muted">Top tracked companies in {sector.toLowerCase()}.</p></div><a href={`/stocks?sector=${encodeURIComponent(sector)}`}>View more →</a></div><div className="stock-list-grid sector-grid">{items.slice(0,6).map(s=><a className="stock-market-card" href={`/stocks/${s.slug}`} key={s.symbol}><div className="stock-logo">{s.symbol.slice(0,1)}</div><div className="stock-card-copy"><b>{s.symbol}</b><small>{s.company_name}</small></div><div className="stock-card-price"><strong>{quoteMap.get(s.id)?.price!=null?`$${formatPrice(quoteMap.get(s.id)?.price)}`:'—'}</strong><em>{formatChange(quoteMap.get(s.id)?.change_percent)}</em></div></a>)}</div></section>)}
      <section className="section news-section"><div className="section-head"><div><div className="eyebrow">LATEST COVERAGE</div><h2>Latest market news</h2><p className="muted">Stories with source, publication date and ticker context when available.</p></div><a href="/news">View all news →</a></div><div className="news-layout"><article className="featured-news"><div className="news-image news-blue thumbnail-placeholder"><span>MARKET BRIEF</span></div><div className="featured-news-body">{newsItems[0]?<><small className="story-meta">{newsItems[0].stock_id?newsStockMap.get(newsItems[0].stock_id)?.symbol??'MARKET':'MARKET'} · {newsItems[0].sentiment??'neutral'}</small><h3>{safeNewsUrl(newsItems[0].url) ? <a href={safeNewsUrl(newsItems[0].url)!} target="_blank" rel="noopener noreferrer">{cleanNewsText(newsItems[0].title) || 'Market story'}</a> : (cleanNewsText(newsItems[0].title) || 'Market story')}</h3><p>{newsSummary(newsItems[0].summary, newsItems[0].title) || 'Publisher summary unavailable. Open the original report for the full details.'}</p><small>{cleanNewsText(newsItems[0].source) || 'Market News'} · {formatDate(newsItems[0].published_at)}</small></>:<><h3>Market news will appear here</h3><p>The verified news pipeline will populate this section automatically.</p></>}<a href="/news">Read all news →</a></div></article><div className="article-list">{newsItems.slice(1,4).map((n,i)=>{const s=n.stock_id?newsStockMap.get(n.stock_id):undefined;const sourceUrl=safeNewsUrl(n.url);return <a href={sourceUrl ?? (s?.slug ? `/stocks/${s.slug}#news` : '/news')} target={sourceUrl ? '_blank' : undefined} rel={sourceUrl ? 'noopener noreferrer' : undefined} className="article-row" key={n.id}><div className={`article-thumb ${toneByIndex[i+1]??'news-blue'} thumbnail-placeholder`}><span>NEWS</span></div><div><small>{s?.symbol??'MARKET'} · {n.sentiment??'neutral'}</small><h3>{cleanNewsText(n.title) || 'Market story'}</h3><span>{cleanNewsText(n.source) || 'Market News'} · {formatDate(n.published_at)}</span></div></a>})}</div><aside className="movers panel-light"><div className="section-head"><h2>Market movers</h2><a href="/markets">View all →</a></div>{movers.length?movers.map(stock=><a href={`/stocks/${stock.slug}`} className="mover" key={stock.symbol}><b>{stock.symbol}</b><span>${formatPrice(stock.quote?.price)}</span><em className={Number(stock.quote?.change_percent ?? 0) >= 0 ? "up" : "down"}>{formatChange(stock.quote?.change_percent)}</em></a>):<div className="empty-state"><strong>Waiting for market quotes</strong><span>No values are fabricated.</span></div>}</aside></div></section>
      
      {sectorNewsSections.length > 0 && <section className="section sector-news-home"><div className="section-head"><div><div className="eyebrow">NEWS BY INDUSTRY</div><h2>What is moving each sector?</h2><p className="muted">Recent headlines grouped by the sector of the linked company. Open the original story for source details.</p></div><a href="/news">All market news →</a></div><div className="sector-news-grid">{sectorNewsSections.map(([sector,items])=><article className="sector-news-card" key={sector}><div className="sector-news-card-top"><span className="sector-news-icon">▦</span><span className="sector-news-kicker">SECTOR BRIEF</span></div><h3>{sector}</h3><div className="sector-news-stories">{items.slice(0,2).map((item)=>{const linked=item.stock_id?newsStockMap.get(item.stock_id):undefined;return <a href={linked?.slug?`/stocks/${linked.slug}#news`:'/news'} key={item.id}><small>{linked?.symbol??'MARKET'} · {formatDate(item.published_at)}</small><b>{cleanNewsText(item.title) || 'Market story'}</b></a>})}</div><a className="sector-news-more" href={`/stocks?sector=${encodeURIComponent(sector)}`}>Explore sector <span>→</span></a></article>)}</div></section>}
      <section className="section insight-cards"><a className="insight-card blue" href="/predictions"><div className="icon">◎</div><div><small>AI STOCK PREDICTIONS</small><h3>See what the model sees</h3><p>24H, 7D, 30D and 90D forecasts from quantitative signals.</p><b>View predictions →</b></div></a><a className="insight-card green" href="/analysis"><div className="icon">↗</div><div><small>TECHNICAL ANALYSIS</small><h3>Read market structure</h3><p>RSI, MACD, moving averages, volatility and momentum.</p><b>Explore analysis →</b></div></a><a className="insight-card orange" href="/stocks"><div className="icon">▤</div><div><small>COMPANY RESEARCH</small><h3>Go beyond the headline</h3><p>Connect company profiles with available financials, valuation context, technical signals and risk.</p><b>Explore company research →</b></div></a></section>
      <section className="section research-workflow"><div className="section-head"><div><div className="eyebrow">A CLEAR RESEARCH WORKFLOW</div><h2>From market signal to company context.</h2><p className="muted">Move from a broad market view to the specific data that matters for your research.</p></div></div><div className="workflow-grid"><a href="/markets"><span>01</span><h3>Understand the market</h3><p>Review major indexes, market context and available sector information.</p><b>Market overview →</b></a><a href="/screener"><span>02</span><h3>Find companies</h3><p>Discover tracked stocks and narrow the universe using available fields.</p><b>Open stock screener →</b></a><a href="/stocks"><span>03</span><h3>Investigate a stock</h3><p>Open company research for quotes, fundamentals, technicals and risk context where available.</p><b>Explore stock research →</b></a><a href="/news"><span>04</span><h3>Follow what changes</h3><p>Read publisher-linked stories and connect headlines with the related company.</p><b>Read market news →</b></a></div></section>
      <section className="research-banner"><div className="banner-icon">▥</div><div><small>BUILT FOR INFORMED RESEARCH</small><h2>Explore the market with more context.</h2><p>Connect market overview, company data, sector research, quantitative signals and publisher-linked news in one place. Always check data availability and risk before making a decision.</p></div><a className="button primary" href="/stocks">Explore US Stocks →</a></section>
      <section className="trust-strip"><div><b>Company profiles</b><span>Tracked US equities</span></div><div><b>Market context</b><span>Available index and quote data</span></div><div><b>Research signals</b><span>Technical and quantitative tools</span></div><div><b>Source-linked news</b><span>Publisher context where available</span></div><div><b>Decision support</b><span>Screen, compare and investigate</span></div></section>
      <section className="section faq-section" id="homepage-faq"><div className="section-head"><div><div className="eyebrow">FREQUENTLY ASKED QUESTIONS</div><h2>About US Market AI</h2><p className="muted">What the platform offers, how to read its data and what to keep in mind.</p></div></div><div className="faq-list">
        <details><summary>What can I do on US Market AI?</summary><p>Explore tracked US stocks, market overview, company research, technical indicators, available fundamentals, sector and industry directories, stock screening and comparison, rankings, quantitative forecasts, earnings and dividend research, ETF and IPO information, crypto coverage and source-linked market news.</p></details>
        <details><summary>Are stock prices and market data real-time?</summary><p>Data availability and update timing can vary by source and instrument. Check the timestamp and source context shown on the relevant page. Do not assume every quote is real-time.</p></details>
        <details><summary>How should I interpret AI predictions?</summary><p>Forecasts are model estimates, not guarantees. Review the horizon, available inputs, assumptions and risk context, and avoid treating a prediction as a certain future price.</p></details>
        <details><summary>Why might some indicators or company fields be unavailable?</summary><p>Coverage depends on the data available for each company and metric. Missing values should be treated as unavailable—not as zero and not as a confirmed signal.</p></details>
        <details><summary>Can I use this website as financial advice?</summary><p>No. US Market AI is a research and information platform, not a personalized financial adviser. Make independent decisions and consider your own objectives, risk tolerance and professional advice where appropriate.</p></details>
        <details><summary>How can I research a specific company?</summary><p>Use the stock directory or screener, open the company's stock page, then review available price context, fundamentals, technical indicators, forecasts, news and related research.</p></details>
      </div></section>

    </div>
  </div>;
}