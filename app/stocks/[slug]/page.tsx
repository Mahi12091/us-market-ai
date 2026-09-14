import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PriceChart, { type ChartPoint } from '@/components/price-chart';

export const revalidate = 300;

const money = (v: unknown, digits = 2) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const num = (v: unknown, digits = 2) => v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (v: unknown) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: stock } = await supabase.from('stocks').select('company_name,symbol,description').eq('slug', slug).maybeSingle();
  if (!stock) return { title: 'Stock Not Found' };
  return { title: `${stock.company_name} (${stock.symbol})`, description: stock.description ?? `Market intelligence, technical analysis and AI predictions for ${stock.symbol}.`, alternates: { canonical: `/stocks/${slug}` } };
}

export default async function StockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: stock } = await supabase.from('stocks').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (!stock) notFound();

  const [{ data: quote }, { data: tech }, { data: predictions }, { data: article }, { data: fundamentals }, { data: earnings }, { data: news }, { data: history }] = await Promise.all([
    supabase.from('latest_quotes').select('*').eq('stock_id', stock.id).maybeSingle(),
    supabase.from('technical_indicators').select('*').eq('stock_id', stock.id).eq('timeframe', '1d').maybeSingle(),
    supabase.from('predictions').select('*').eq('stock_id', stock.id).order('prediction_time', { ascending: false }).limit(4),
    supabase.from('ai_articles').select('title,summary,content,updated_at').eq('stock_id', stock.id).eq('is_published', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('fundamentals').select('*').eq('stock_id', stock.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('earnings').select('*').eq('stock_id', stock.id).order('earnings_date', { ascending: false }).limit(4),
    supabase.from('news').select('id,title,summary,url,source,published_at,sentiment').eq('stock_id', stock.id).order('published_at', { ascending: false }).limit(5),
    supabase.from('price_history').select('timestamp,close').eq('stock_id', stock.id).eq('timeframe', '1d').order('timestamp', { ascending: true }).limit(180),
  ]);

  const chart: ChartPoint[] = (history ?? []).filter(x => x.close != null).map(x => ({ time: new Date(x.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), close: Number(x.close) }));
  const dailyChange = quote?.change_percent;
  const latestPrediction = predictions?.[0];
  const direction = latestPrediction?.direction ?? 'neutral';

  return <div className="stock-page">
    <div className="container">
      <div className="stock-breadcrumb"><a href="/stocks">US Stocks</a><span>/</span><span>{stock.sector ?? 'Market'}</span><span>/</span><b>{stock.symbol}</b></div>

      <section className="stock-hero">
        <div className="stock-title-block">
          <div className="stock-logo">{stock.symbol.slice(0, 1)}</div>
          <div><div className="eyebrow">{stock.exchange ?? 'US MARKET'} · {stock.sector ?? 'EQUITY'}</div><h1>{stock.company_name}</h1><div className="stock-symbol">{stock.symbol} · {stock.industry ?? 'Public company'}</div></div>
        </div>
        <div className="quote-block"><div className="quote-price">{money(quote?.price)}</div><div className={Number(dailyChange) >= 0 ? 'positive quote-change' : 'negative quote-change'}>{quote?.change != null ? `${Number(quote.change) >= 0 ? '+' : ''}${money(quote.change)} · ${pct(dailyChange)}` : 'Quote unavailable'}</div><small className="muted">{quote?.quote_timestamp ? `Updated ${new Date(quote.quote_timestamp).toLocaleString()}` : 'Waiting for market feed'}</small></div>
      </section>

      <section className="stock-actions"><a className="button primary" href="#analysis">AI Analysis</a><a className="button" href="#predictions">View Predictions</a><a className="button" href="#news">Latest News</a><button className="button" type="button">☆ Add to Watchlist</button></section>

      <section className="stock-grid-top">
        <div className="panel chart-panel"><div className="panel-head"><div><h2>Price performance</h2><p className="muted">Daily closing price · 180 sessions</p></div><div className="range-tabs"><span className="active">6M</span><span>1Y</span><span>5Y</span><span>MAX</span></div></div><PriceChart data={chart}/></div>
        <div className="panel prediction-card" id="predictions"><div className="panel-head"><div><div className="eyebrow">QUANT MODEL</div><h2>AI outlook</h2></div><span className={`signal ${direction}`}>{direction}</span></div><p className="muted">Model-based price outlook. Not financial advice.</p><div className="prediction-list">{(predictions ?? []).length ? predictions?.map(p => <div className="prediction-row" key={p.id}><div><b>{String(p.horizon).toUpperCase()}</b><small>{p.signal ?? 'Quantitative forecast'}</small></div><div className="prediction-right"><strong>{money(p.predicted_price)}</strong><span className={Number(p.predicted_change_percent) >= 0 ? 'positive' : 'negative'}>{pct(p.predicted_change_percent)}</span></div></div>) : <div className="empty-state">Prediction engine will populate this section after model configuration.</div>}</div></div>
      </section>

      <section className="metric-strip"><div><span>Open</span><b>{money(quote?.open)}</b></div><div><span>Day High</span><b>{money(quote?.high)}</b></div><div><span>Day Low</span><b>{money(quote?.low)}</b></div><div><span>Prev. Close</span><b>{money(quote?.previous_close)}</b></div><div><span>Volume</span><b>{quote?.volume ? Number(quote.volume).toLocaleString() : '—'}</b></div><div><span>Market Cap</span><b>{stock.market_cap ? `$${Number(stock.market_cap).toLocaleString()}M` : '—'}</b></div></section>

      <section className="section stock-section"><div className="section-head"><div><div className="eyebrow">TECHNICAL SIGNALS</div><h2>Technical analysis</h2><p className="muted">Key indicators calculated from historical market data.</p></div></div><div className="grid grid-4 indicator-grid">{[['RSI',tech?.rsi,'Momentum'],['MACD',tech?.macd,'Trend'],['SMA 50',tech?.sma_50,'Moving average'],['SMA 200',tech?.sma_200,'Moving average'],['EMA 20',tech?.ema_20,'Moving average'],['ATR',tech?.atr,'Volatility'],['ADX',tech?.adx,'Trend strength'],['Volatility',tech?.volatility,'Risk'],['Bollinger Upper',tech?.bollinger_upper,'Range'],['Stochastic',tech?.stochastic,'Momentum'],['Support',tech?.support_level,'Key level'],['Resistance',tech?.resistance_level,'Key level']].map(([name,value,sub]) => <div className="panel indicator-card" key={String(name)}><span>{name}</span><strong>{num(value)}</strong><small>{sub}</small></div>)}</div></section>

      <section className="section two-column"><div className="panel content-panel"><div className="eyebrow">FUNDAMENTALS</div><h2>Company fundamentals</h2><div className="fund-grid">{[['Revenue',fundamentals?.revenue],['Revenue Growth',pct(fundamentals?.revenue_growth)],['Gross Profit',fundamentals?.gross_profit],['Operating Income',fundamentals?.operating_income],['Net Income',fundamentals?.net_income],['EPS',fundamentals?.eps],['P/E',fundamentals?.pe_ratio],['Forward P/E',fundamentals?.forward_pe],['PEG',fundamentals?.peg_ratio],['Price / Sales',fundamentals?.price_sales],['Debt / Equity',fundamentals?.debt_equity],['ROE',pct(fundamentals?.roe)],['Free Cash Flow',fundamentals?.free_cash_flow],['Dividend Yield',pct(fundamentals?.dividend_yield)]].map(([k,v]) => <div key={String(k)}><span>{k}</span><b>{typeof v === 'string' ? v : num(v)}</b></div>)}</div></div><div className="panel content-panel"><div className="eyebrow">EARNINGS</div><h2>Earnings history</h2>{(earnings ?? []).length ? <div className="earnings-list">{earnings?.map(e => <div className="earn-row" key={e.id}><div><b>{e.earnings_date ? new Date(e.earnings_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</b><small>{e.fiscal_period ?? 'Fiscal period'}</small></div><div><span>EPS</span><b>{num(e.eps_actual)}</b></div><div><span>Estimate</span><b>{num(e.eps_estimate)}</b></div><div className={Number(e.eps_surprise) >= 0 ? 'positive' : 'negative'}><span>Surprise</span><b>{pct(e.eps_surprise)}</b></div></div>)}</div> : <div className="empty-state">Earnings data will appear after the provider is connected.</div>}</div></section>

      <section className="section two-column" id="analysis"><article className="panel article-panel"><div className="eyebrow">AI MARKET ANALYSIS</div><h2>{article?.title ?? `${stock.symbol}: What the data is saying`}</h2><p className="article-summary">{article?.summary ?? 'A verified, data-driven analysis will be generated here from price action, technical indicators, fundamentals, earnings and market context.'}</p>{article?.content ? <div className="article-content">{article.content}</div> : <div className="article-placeholder"><b>Analysis pipeline ready</b><span>The article engine will write and cache research only when verified market inputs are available.</span></div>}</article><aside className="panel about-stock"><div className="eyebrow">ABOUT THE COMPANY</div><h2>{stock.company_name}</h2><p className="muted">{stock.description ?? `Research ${stock.company_name}, including price action, technical signals, fundamentals, earnings and AI-generated market analysis.`}</p><div className="company-meta"><div><span>Symbol</span><b>{stock.symbol}</b></div><div><span>Exchange</span><b>{stock.exchange ?? 'US'}</b></div><div><span>Sector</span><b>{stock.sector ?? '—'}</b></div><div><span>Industry</span><b>{stock.industry ?? '—'}</b></div></div></aside></section>

      <section className="section" id="news"><div className="section-head"><div><div className="eyebrow">MARKET NEWS</div><h2>Latest {stock.symbol} news</h2><p className="muted">Recent headlines and sentiment relevant to this company.</p></div><a className="text-link" href="/news">View all news →</a></div><div className="news-list">{(news ?? []).length ? news?.map(n => <a className="news-item" href={n.url ?? '#'} target={n.url ? '_blank' : undefined} rel={n.url ? 'noreferrer' : undefined} key={n.id}><div><span className="news-source">{n.source ?? 'Market News'} · {n.published_at ? new Date(n.published_at).toLocaleDateString() : 'Latest'}</span><h3>{n.title}</h3><p className="muted">{n.summary ?? 'Read the latest market development.'}</p></div><span className={`signal ${n.sentiment ?? 'neutral'}`}>{n.sentiment ?? 'neutral'}</span></a>) : <div className="panel empty-state">Company news will appear here after the news provider is connected.</div>}</div></section>

      <section className="section"><div className="panel disclaimer-box"><div><div className="eyebrow">RESEARCH NOTE</div><h2>Use predictions as one input, not the whole decision.</h2><p className="muted">US Market AI combines quantitative signals and verified market data to help with research. Forecasts are estimates, can be wrong, and are not financial advice.</p></div><a className="button" href="/disclaimer">Read disclaimer →</a></div></section>
    </div>
  </div>;
}
