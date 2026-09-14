import { createClient } from '@/lib/supabase/server';

const news = [
  { tag: 'MARKET NEWS', title: 'What is moving US markets today?', text: 'Market intelligence, price action and the stories moving investors today.', tone: 'news-blue' },
  { tag: 'EARNINGS', title: 'What investors should watch this earnings season', text: 'Key results, estimates and surprises in one research view.', tone: 'news-purple' },
  { tag: 'CRYPTO', title: 'Bitcoin and digital assets remain in focus', text: 'Track momentum, volatility and the latest crypto market signals.', tone: 'news-gold' },
  { tag: 'ECONOMY', title: 'Fed outlook remains central to markets', text: 'Rates, inflation and economic data can reshape the next move.', tone: 'news-green' },
];

const marketLabels: Record<string, string> = {
  SPY: 'S&P 500', QQQ: 'Nasdaq 100', DIA: 'Dow Jones', IWM: 'Russell 2000', VIX: 'VIX',
};

function formatPrice(value: number | null | undefined) {
  return value == null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatChange(value: number | null | undefined) {
  return value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export default async function Home() {
  const supabase = await createClient();
  const { data: stocks } = await supabase
    .from('stocks')
    .select('id,symbol,slug,company_name')
    .eq('is_active', true)
    .eq('is_indexable', true)
    .order('market_cap', { ascending: false })
    .limit(8);

  const stockIds = (stocks ?? []).map((stock) => stock.id);
  const [{ data: quotes }, { data: snapshots }] = await Promise.all([
    stockIds.length
      ? supabase.from('latest_quotes').select('stock_id,price,change_percent').in('stock_id', stockIds)
      : Promise.resolve({ data: [] }),
    supabase.from('market_snapshots').select('symbol,price,change_percent,timestamp').in('symbol', Object.keys(marketLabels)).order('timestamp', { ascending: false }).limit(20),
  ]);

  const quoteMap = new Map((quotes ?? []).map((quote) => [quote.stock_id, quote]));
  const marketMap = new Map<string, { price: number | null; change_percent: number | null }>();
  for (const snapshot of snapshots ?? []) {
    if (!marketMap.has(snapshot.symbol)) {
      marketMap.set(snapshot.symbol, { price: snapshot.price, change_percent: snapshot.change_percent });
    }
  }

  const movers = (stocks ?? [])
    .map((stock) => ({ ...stock, quote: quoteMap.get(stock.id) }))
    .filter((stock) => stock.quote?.price != null && stock.quote?.change_percent != null)
    .sort((a, b) => (b.quote?.change_percent ?? 0) - (a.quote?.change_percent ?? 0))
    .slice(0, 5);

  const forecastStocks = (stocks ?? []).slice(0, 6);

  return <div className="home-page">
    <div className="market-strip"><div className="container market-strip-inner">
      {Object.entries(marketLabels).map(([symbol, name]) => {
        const market = marketMap.get(symbol);
        return <div className="ticker-mini" key={symbol}><span>{name}</span><strong>{formatPrice(market?.price)}</strong><em className={(market?.change_percent ?? 0) >= 0 ? 'up' : 'down'}>{formatChange(market?.change_percent)}</em></div>;
      })}
      <a href="/markets" className="market-link">View all markets →</a>
    </div></div>

    <main className="container">
      <section className="hero-light">
        <div className="hero-copy">
          <div className="eyebrow">US MARKET INTELLIGENCE</div>
          <h1>Smarter insights.<br/><span>Better decisions.</span></h1>
          <p>Real market data, in-depth analysis and quantitative AI-powered insights for US stocks and crypto. Less noise. More signal.</p>
          <div className="button-row"><a className="button primary" href="/stocks">Explore US Stocks →</a><a className="button" href="/predictions">Explore AI Predictions</a></div>
          <div className="hero-features"><div><b>◈ AI Predictions</b><span>24H, 7D, 30D &amp; 90D forecasts</span></div><div><b>▤ Market News</b><span>Stories that move markets</span></div><div><b>↗ Research</b><span>Technical &amp; fundamental analysis</span></div></div>
        </div>
        <div className="hero-art"><div className="wall-card"><span>11–21</span><strong>WALL<br/>ST</strong></div><div className="hero-quote">“Markets move fast.<br/><b>Stay ahead of the signal.</b>”</div></div>
      </section>

      <section className="section forecast-home-section">
        <div className="section-head"><div><div className="eyebrow">SEO FORECAST HUB</div><h2>Stock Price Predictions 2026–2050</h2><p className="muted">Long-term forecasts built from market data, quantitative signals and validated prediction history.</p></div><a href="/blog">Explore forecast research →</a></div>
        <div className="forecast-home-grid">
          {forecastStocks.map((stock) => <a className="forecast-home-card" href={`/blog/${stock.slug}-stock-price-prediction-2026-2050`} key={stock.symbol}><div className="stock-logo">{stock.symbol.slice(0, 1)}</div><div><small>{stock.symbol}</small><h3>{stock.company_name}</h3><span>2026–2050 forecast →</span></div></a>)}
        </div>
      </section>

      <section className="section news-section"><div className="section-head"><div><h2>Latest market news</h2><p className="muted">Stories, events and analysis worth knowing.</p></div><a href="/news">View all news →</a></div><div className="news-layout"><article className="featured-news"><div className="news-image news-blue"><span>MARKET<br/>INTELLIGENCE</span></div><div className="featured-news-body"><div className="eyebrow">FEATURED STORY</div><h3>{news[0].title}</h3><p>Follow the biggest market themes, company developments and macro signals from one clean research dashboard.</p><a href="/news">Read the story →</a></div></article><div className="article-list">{news.slice(1,4).map(n=><a href="/news" className="article-row" key={n.title}><div className={`article-thumb ${n.tone}`}></div><div><small>{n.tag}</small><h3>{n.title}</h3><span>5 min read · Latest</span></div></a>)}</div><aside className="movers panel-light"><div className="section-head"><h2>Market movers</h2><a href="/markets">View all →</a></div><div className="tabs"><span className="active">Gainers</span><span>Losers</span><span>Most Active</span></div>{movers.length ? movers.map((stock)=><a href={`/stocks/${stock.slug}`} className="mover" key={stock.symbol}><b>{stock.symbol}</b><span>${formatPrice(stock.quote?.price)}</span><em>{formatChange(stock.quote?.change_percent)}</em></a>) : <div className="empty-state"><strong>Live movers are preparing</strong><span>Connect the market feed to show verified price action here.</span></div>}</aside></div></section>

      <section className="section insight-cards"><a className="insight-card blue" href="/predictions"><div className="icon">▥</div><div><small>AI STOCK PREDICTIONS</small><h3>See what the model sees</h3><p>24H, 7D, 30D and 90D forecasts powered by quantitative signals.</p><b>View predictions →</b></div></a><a className="insight-card green" href="/analysis"><div className="icon">↗</div><div><small>TECHNICAL ANALYSIS</small><h3>Read the market structure</h3><p>RSI, MACD, moving averages, volatility and momentum.</p><b>Explore analysis →</b></div></a><a className="insight-card orange" href="/blog"><div className="icon">▤</div><div><small>FORECAST RESEARCH</small><h3>Go beyond the headline</h3><p>Long-term stock forecasts connected directly to live stock research.</p><b>Read forecast research →</b></div></a></section>

      <section className="section assets-section"><div className="assets-main"><div className="section-head"><div><h2>Popular US stocks</h2><p className="muted">Explore the companies investors watch most.</p></div><a href="/stocks">View all →</a></div><div className="category-tabs"><span className="active">Tech</span><span>Finance</span><span>Healthcare</span><span>Consumer</span><span>Energy</span></div><div className="stock-grid">{(stocks ?? []).map(s=><a className="stock-light" href={`/stocks/${s.slug}`} key={s.symbol}><div className="stock-logo">{s.symbol.slice(0,1)}</div><div><b>{s.symbol}</b><small>{s.company_name}</small></div><em>{quoteMap.get(s.id)?.price != null ? `$${formatPrice(quoteMap.get(s.id)?.price)}` : '—'}</em></a>)}</div></div><aside className="crypto-panel panel-light"><div className="section-head"><h2>Popular crypto</h2><a href="/crypto">View all →</a></div>{[['BTC','Bitcoin'],['ETH','Ethereum'],['SOL','Solana'],['XRP','XRP'],['ADA','Cardano']].map(([s,n])=><a className="crypto-row" href="/crypto" key={s}><b>{s}</b><small>{n}</small><span>Live</span><em>View →</em></a>)}</aside></section>

      <section className="section analysis-section"><div className="section-head"><div><div className="eyebrow">LATEST RESEARCH</div><h2>Research beyond the headline.</h2><p className="muted">Deep-dive research connecting price action, fundamentals, earnings, news and AI signals.</p></div><a href="/analysis">View all analysis →</a></div><div className="analysis-grid">{news.map((n,i)=><a className="analysis-card" href={i === 0 ? '/analysis' : '/news'} key={n.title}><div className={`analysis-image ${n.tone}`}><span>{i===0?'AI':i===1?'EARNINGS':i===2?'CRYPTO':'MACRO'}</span></div><div><small>{n.tag}</small><h3>{n.title}</h3><p>{n.text}</p><span>Research →</span></div></a>)}</div></section>

      <section className="research-banner"><div className="banner-icon">▥</div><div><small>BUILT FOR RESEARCH</small><h2>One platform. A complete market view.</h2><p>Every stock page brings price action, technicals, fundamentals, earnings, news, forecasts and AI analysis together.</p></div><a className="button primary" href="/stocks">Explore a stock →</a></section>
    </main>
  </div>;
}
