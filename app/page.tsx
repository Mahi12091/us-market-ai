import { createClient } from '@/lib/supabase/server';

const news = [
  { tag: 'MARKET NEWS', title: 'AI demand keeps the US market in focus', text: 'Market intelligence, price action and the stories moving investors today.', tone: 'news-blue' },
  { tag: 'EARNINGS', title: 'What investors should watch this earnings season', text: 'Key results, estimates and surprises in one research view.', tone: 'news-purple' },
  { tag: 'CRYPTO', title: 'Bitcoin and digital assets remain in focus', text: 'Track momentum, volatility and the latest crypto market signals.', tone: 'news-gold' },
  { tag: 'ECONOMY', title: 'Fed outlook remains central to markets', text: 'Rates, inflation and economic data can reshape the next move.', tone: 'news-green' },
];

const movers = [
  ['NVDA', '124.53', '+4.36%'], ['TSLA', '248.17', '+3.52%'], ['AMZN', '185.35', '+2.27%'], ['META', '527.84', '+2.05%'], ['AAPL', '231.41', '+1.82%'],
];

export default async function Home() {
  const supabase = await createClient();
  const { data: stocks } = await supabase.from('stocks').select('symbol,slug,company_name').eq('is_active',true).eq('is_indexable',true).order('market_cap',{ascending:false}).limit(8);

  return <div className="home-page">
    <div className="market-strip"><div className="container market-strip-inner">
      {[['S&P 500','5,622.45','+0.43%'],['Nasdaq 100','19,345.12','+0.58%'],['Dow Jones','41,563.22','-0.06%'],['Russell 2000','2,178.31','+0.71%'],['VIX','16.23','-4.92%']].map(([name,value,change],i)=><div className="ticker-mini" key={name}><span>{name}</span><strong>{value}</strong><em className={change.startsWith('-') && i!==4 ? 'down' : 'up'}>{change}</em></div>)}<a href="/markets" className="market-link">View all markets →</a>
    </div></div>

    <main className="container">
      <section className="hero-light">
        <div className="hero-copy">
          <div className="eyebrow">US MARKET INTELLIGENCE</div>
          <h1>Smarter insights.<br/><span>Better decisions.</span></h1>
          <p>Real market data, in-depth analysis and AI-powered insights for US stocks and crypto. Less noise. More conviction.</p>
          <div className="button-row"><a className="button primary" href="/stocks">Explore US Stocks →</a><a className="button" href="/crypto">Explore Crypto</a></div>
          <div className="hero-features"><div><b>◈ AI Predictions</b><span>24H, 7D, 30D &amp; 90D forecasts</span></div><div><b>▤ Market News</b><span>Stories that move markets</span></div><div><b>↗ Research</b><span>Technical &amp; fundamental analysis</span></div></div>
        </div>
        <div className="hero-art"><div className="wall-card"><span>11–21</span><strong>WALL<br/>ST</strong></div><div className="hero-quote">“Markets move fast.<br/><b>Stay ahead of the signal.</b>”</div></div>
      </section>

      <section className="section news-section"><div className="section-head"><div><h2>Latest market news</h2><p className="muted">Stories, events and analysis worth knowing.</p></div><a href="/news">View all news →</a></div><div className="news-layout"><article className="featured-news"><div className="news-image news-blue"><span>MARKET<br/>INTELLIGENCE</span></div><div className="featured-news-body"><div className="eyebrow">FEATURED STORY</div><h3>What is moving US markets today?</h3><p>Follow the biggest market themes, company developments and macro signals from one clean research dashboard.</p><a href="/news">Read the story →</a></div></article><div className="article-list">{news.slice(1,4).map(n=><a href="/news" className="article-row" key={n.title}><div className={`article-thumb ${n.tone}`}></div><div><small>{n.tag}</small><h3>{n.title}</h3><span>5 min read · Latest</span></div></a>)}</div><aside className="movers panel-light"><div className="section-head"><h2>Market movers</h2><a href="/markets/gainers">View all →</a></div><div className="tabs"><span className="active">Gainers</span><span>Losers</span><span>Most Active</span></div>{movers.map(([symbol,price,change])=><a href={`/stocks/${symbol.toLowerCase()}`} className="mover" key={symbol}><b>{symbol}</b><span>${price}</span><em>{change}</em></a>)}</aside></div></section>

      <section className="section insight-cards"><a className="insight-card blue" href="/predictions"><div className="icon">▥</div><div><small>AI STOCK PREDICTIONS</small><h3>See what the model sees</h3><p>24H, 7D, 30D and 90D forecasts powered by quantitative signals.</p><b>View predictions →</b></div></a><a className="insight-card green" href="/analysis"><div className="icon">↗</div><div><small>TECHNICAL ANALYSIS</small><h3>Read the market structure</h3><p>RSI, MACD, moving averages, volatility and momentum.</p><b>Explore analysis →</b></div></a><a className="insight-card orange" href="/news"><div className="icon">▤</div><div><small>IN-DEPTH RESEARCH</small><h3>Understand the story</h3><p>News, fundamentals, earnings and AI-written market analysis.</p><b>Start research →</b></div></a></section>

      <section className="section assets-section"><div className="assets-main"><div className="section-head"><div><h2>Popular US stocks</h2><p className="muted">Explore the companies investors watch most.</p></div><a href="/stocks">View all →</a></div><div className="category-tabs"><span className="active">Tech</span><span>Finance</span><span>Healthcare</span><span>Consumer</span><span>Energy</span></div><div className="stock-grid">{(stocks ?? []).map(s=><a className="stock-light" href={`/stocks/${s.slug}`} key={s.symbol}><div className="stock-logo">{s.symbol.slice(0,1)}</div><div><b>{s.symbol}</b><small>{s.company_name}</small></div><em>—</em></a>)}</div></div><aside className="crypto-panel panel-light"><div className="section-head"><h2>Popular crypto</h2><a href="/crypto">View all →</a></div>{[['BTC','Bitcoin'],['ETH','Ethereum'],['SOL','Solana'],['XRP','XRP'],['ADA','Cardano']].map(([s,n],i)=><a className="crypto-row" href="/crypto" key={s}><b>{s}</b><small>{n}</small><span>—</span><em>+{[1.88,1.81,3.05,1.67,1.18][i]}%</em></a>)}</aside></section>

      <section className="section analysis-section"><div className="section-head"><div><div className="eyebrow">LATEST ANALYSIS</div><h2>Research beyond the headline.</h2><p className="muted">Deep-dive articles connecting price action, fundamentals, earnings, news and AI signals.</p></div><a href="/analysis">View all analysis →</a></div><div className="analysis-grid">{news.map((n,i)=><a className="analysis-card" href="/analysis" key={n.title}><div className={`analysis-image ${n.tone}`}><span>{i===0?'AI':i===1?'EARNINGS':i===2?'CRYPTO':'MACRO'}</span></div><div><small>{n.tag}</small><h3>{n.title}</h3><p>{n.text}</p><span>5 min read →</span></div></a>)}</div></section>

      <section className="research-banner"><div className="banner-icon">▥</div><div><small>BUILT FOR RESEARCH</small><h2>One platform. A complete market view.</h2><p>Every stock page brings price action, technicals, fundamentals, earnings, news, forecasts and AI analysis together.</p></div><a className="button primary" href="/stocks">Explore a stock →</a></section>
    </main>
  </div>;
}
