import { createClient } from '@/lib/supabase/server';

export const revalidate = 300;

const marketLabels: Record<string, string> = { SPY: 'S&P 500 proxy', QQQ: 'Nasdaq 100 proxy', DIA: 'Dow proxy', IWM: 'Russell 2000 proxy' };
const toneByIndex = ['news-blue', 'news-purple', 'news-gold', 'news-green'];

function formatPrice(value: number | null | undefined) { return value == null ? '—' : Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function formatChange(value: number | null | undefined) { return value == null ? '—' : `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`; }
function formatDate(value: string | null | undefined) { return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Latest'; }

export default async function Home() {
  const supabase = await createClient();
  const [{ data: stocks }, { data: marketStocks }, { data: news }] = await Promise.all([
    supabase.from('stocks').select('id,symbol,slug,company_name,market_cap').eq('is_active', true).eq('is_indexable', true).eq('asset_type', 'stock').order('market_cap', { ascending: false, nullsFirst: false }).limit(8),
    supabase.from('stocks').select('id,symbol,slug,company_name').eq('is_active', true).in('symbol', Object.keys(marketLabels)),
    supabase.from('news').select('id,stock_id,title,summary,source,published_at,sentiment').order('published_at', { ascending: false, nullsFirst: false }).limit(6),
  ]);

  const allIds = [...new Set([...(stocks ?? []).map(s => s.id), ...(marketStocks ?? []).map(s => s.id)])];
  const { data: quotes } = allIds.length ? await supabase.from('latest_quotes').select('stock_id,price,change_percent').in('stock_id', allIds) : { data: [] };
  const quoteMap = new Map((quotes ?? []).map(q => [q.stock_id, q]));
  const marketBySymbol = new Map((marketStocks ?? []).map(s => [s.symbol, { ...s, quote: quoteMap.get(s.id) }]));
  const movers = (stocks ?? []).map(s => ({ ...s, quote: quoteMap.get(s.id) })).filter(s => s.quote?.price != null).sort((a,b) => Number(b.quote?.change_percent ?? -999) - Number(a.quote?.change_percent ?? -999)).slice(0,5);
  const newsItems = news ?? [];
  const newsStockIds = [...new Set(newsItems.map(n => n.stock_id).filter(Boolean))];
  const { data: newsStocks } = newsStockIds.length ? await supabase.from('stocks').select('id,symbol,slug').in('id', newsStockIds) : { data: [] };
  const newsStockMap = new Map((newsStocks ?? []).map(s => [s.id, s]));
  const forecastStocks = (stocks ?? []).slice(0,6);

  return <div className="home-page">
    <div className="market-strip"><div className="container market-strip-inner">
      {Object.entries(marketLabels).map(([symbol, name]) => { const item = marketBySymbol.get(symbol); return <div className="ticker-mini" key={symbol}><span>{name}</span><strong>{formatPrice(item?.quote?.price)}</strong><em className={Number(item?.quote?.change_percent ?? 0) >= 0 ? 'up' : 'down'}>{formatChange(item?.quote?.change_percent)}</em></div>; })}
      <a href="/markets" className="market-link">View market overview →</a>
    </div></div>

    <div className="container">
      <section className="hero-light">
        <div className="hero-copy"><div className="eyebrow">US MARKET INTELLIGENCE</div><h1>Smarter insights.<br/><span>Better decisions.</span></h1><p>Verified market data, technical research, quantitative forecasts and company news for US stocks, with a separate crypto research layer.</p><div className="button-row"><a className="button primary" href="/stocks">Explore US Stocks →</a><a className="button" href="/predictions">Explore AI Predictions</a></div><div className="hero-features"><div><b>◈ AI Predictions</b><span>24H, 7D, 30D &amp; 90D forecasts</span></div><div><b>▤ Market News</b><span>Ticker-linked stories &amp; sentiment</span></div><div><b>↗ Research</b><span>Technicals &amp; fundamentals</span></div></div></div>
        <div className="hero-art"><div className="wall-card"><span>US</span><strong>MARKET<br/>AI</strong></div><div className="hero-quote">“Markets move fast.<br/><b>Stay ahead of the signal.</b>”</div></div>
      </section>

      <section className="section forecast-home-section"><div className="section-head"><div><div className="eyebrow">SEO FORECAST HUB</div><h2>Stock Price Predictions 2026–2050</h2><p className="muted">Long-term research pages connected to individual stock data and forecast methodology.</p></div><a href="/blog">Explore forecast research →</a></div><div className="forecast-home-grid">{forecastStocks.length ? forecastStocks.map(stock => <a className="forecast-home-card" href={`/blog/${stock.slug}-stock-price-prediction-2026-2050`} key={stock.symbol}><div className="stock-logo">{stock.symbol.slice(0,1)}</div><div><small>{stock.symbol}</small><h3>{stock.company_name}</h3><span>2026–2050 forecast →</span></div></a>) : <div className="empty-state">Forecast pages will appear after stock records are available.</div>}</div></section>

      <section className="section news-section"><div className="section-head"><div><h2>Latest market news</h2><p className="muted">Recent stories explicitly associated with tracked US stocks.</p></div><a href="/news">View all news →</a></div><div className="news-layout">
        <article className="featured-news"><div className="news-image news-blue"><span>VERIFIED<br/>NEWS FEED</span></div><div className="featured-news-body"><div className="eyebrow">LATEST STORY</div>{newsItems[0] ? <><h3>{newsItems[0].title}</h3><p>{newsItems[0].summary ?? 'Read the latest ticker-linked market development.'}</p><small>{newsItems[0].source ?? 'Market News'} · {formatDate(newsItems[0].published_at)}</small></> : <><h3>No recent stories yet</h3><p>The news pipeline will populate this section automatically after the next successful sync.</p></>}<a href="/news">Read all news →</a></div></article>
        <div className="article-list">{newsItems.slice(1,4).map((n,i) => { const s = newsStockMap.get(n.stock_id); return <a href={s ? `/stocks/${s.slug}#news` : '/news'} className="article-row" key={n.id}><div className={`article-thumb ${toneByIndex[i+1] ?? 'news-blue'}`}></div><div><small>{s?.symbol ?? 'MARKET NEWS'} · {n.sentiment ?? 'neutral'}</small><h3>{n.title}</h3><span>{n.source ?? 'Market News'} · {formatDate(n.published_at)}</span></div></a>; })}</div>
        <aside className="movers panel-light"><div className="section-head"><h2>Market movers</h2><a href="/markets">View all →</a></div><div className="tabs"><span className="active">Gainers</span><span>Latest</span></div>{movers.length ? movers.map(stock => <a href={`/stocks/${stock.slug}`} className="mover" key={stock.symbol}><b>{stock.symbol}</b><span>${formatPrice(stock.quote?.price)}</span><em>{formatChange(stock.quote?.change_percent)}</em></a>) : <div className="empty-state"><strong>Waiting for market quotes</strong><span>No values are fabricated.</span></div>}</aside>
      </div></section>

      <section className="section insight-cards"><a className="insight-card blue" href="/predictions"><div className="icon">▥</div><div><small>AI STOCK PREDICTIONS</small><h3>See what the model sees</h3><p>24H, 7D, 30D and 90D forecasts from quantitative signals.</p><b>View predictions →</b></div></a><a className="insight-card green" href="/analysis"><div className="icon">↗</div><div><small>TECHNICAL ANALYSIS</small><h3>Read market structure</h3><p>RSI, MACD, moving averages, volatility and momentum.</p><b>Explore analysis →</b></div></a><a className="insight-card orange" href="/blog"><div className="icon">▤</div><div><small>FORECAST RESEARCH</small><h3>Go beyond the headline</h3><p>Long-term stock research connected to individual asset pages.</p><b>Read forecast research →</b></div></a></section>

      <section className="section assets-section"><div className="assets-main"><div className="section-head"><div><h2>Popular US stocks</h2><p className="muted">Largest tracked companies by available market-cap data.</p></div><a href="/stocks">View all →</a></div><div className="stock-grid">{(stocks ?? []).map(s => <a className="stock-light" href={`/stocks/${s.slug}`} key={s.symbol}><div className="stock-logo">{s.symbol.slice(0,1)}</div><div><b>{s.symbol}</b><small>{s.company_name}</small></div><em>{quoteMap.get(s.id)?.price != null ? `$${formatPrice(quoteMap.get(s.id)?.price)}` : '—'}</em></a>)}</div></div><aside className="crypto-panel panel-light"><div className="section-head"><h2>Crypto</h2><a href="/crypto">Research →</a></div><div className="crypto-row"><b>BTC</b><small>Bitcoin</small><span>Separate pipeline</span><em>→</em></div><div className="crypto-row"><b>ETH</b><small>Ethereum</small><span>Separate pipeline</span><em>→</em></div><div className="crypto-row"><b>SOL</b><small>Solana</small><span>Separate pipeline</span><em>→</em></div><p className="muted" style={{fontSize:11,lineHeight:1.5}}>Crypto prices are not displayed until a verified crypto feed is connected.</p></aside></section>

      <section className="section analysis-section"><div className="section-head"><div><div className="eyebrow">LATEST RESEARCH</div><h2>Research beyond the headline.</h2><p className="muted">Connect price action, fundamentals, earnings, news and quantitative signals in one workflow.</p></div><a href="/analysis">View analysis →</a></div><div className="analysis-grid">{newsItems.slice(0,4).map((n,i) => <a className="analysis-card" href={newsStockMap.get(n.stock_id)?.slug ? `/stocks/${newsStockMap.get(n.stock_id)?.slug}#news` : '/news'} key={n.id}><div className={`analysis-image ${toneByIndex[i] ?? 'news-blue'}`}><span>{newsStockMap.get(n.stock_id)?.symbol ?? 'NEWS'}</span></div><div><small>{n.sentiment ?? 'NEUTRAL'} · {n.source ?? 'MARKET NEWS'}</small><h3>{n.title}</h3><p>{n.summary ?? 'Ticker-linked market research.'}</p><span>Research →</span></div></a>)}</div></section>

      <section className="research-banner"><div className="banner-icon">▥</div><div><small>BUILT FOR RESEARCH</small><h2>One platform. A complete market view.</h2><p>Stock pages combine price action, technicals, fundamentals, predictions, evaluated history and ticker-linked news.</p></div><a className="button primary" href="/stocks">Explore a stock →</a></section>
    </div>
  </div>;
}
