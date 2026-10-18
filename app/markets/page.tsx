import type { Metadata } from 'next';
import Link from 'next/link';
import PriceChart, { type ChartPoint } from '@/components/price-chart';
import { createDatabaseClient } from '@/lib/neon';
import { filterCommonEquityRows } from '@/lib/stock-universe';

export const revalidate = 300;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://usmarketai.com').replace(/\/$/, '');
export const metadata: Metadata = {
  title: 'US Stock Market Overview Today: Indexes, Breadth & Sectors',
  description: 'Explore the US stock market with S&P 500, Nasdaq 100, Dow Jones and Russell 2000 proxies, market breadth, sector performance and historical price context from available market data.',
  alternates: { canonical: `${siteUrl}/markets` },
  keywords: ['US stock market overview','US stock market today','S&P 500 market overview','Nasdaq 100 performance','Dow Jones market data','Russell 2000','US stock market breadth','stock market sectors','sector performance','market indices'],
  openGraph: {
    title: 'US Stock Market Overview | US Market AI',
    description: 'Track major US market benchmarks, market breadth, sector performance and historical price context in one research dashboard.',
    url: `${siteUrl}/markets`,
    type: 'website',
  },
};

type StockRow = { id: string; symbol: string; slug: string | null; company_name: string; sector: string | null; market_cap: number | null };
type ProxyRow = { id: string; symbol: string; company_name: string };
type QuoteRow = { stock_id: string; price: number | null; change_percent: number | null; volume: number | null; quote_timestamp: string | null };
type HistoryRow = { timestamp: string; close: number | null };

const proxies = [['SPY','S&P 500','Tracks large-cap US equity performance'],['QQQ','Nasdaq 100','Tracks major non-financial Nasdaq companies'],['DIA','Dow Jones','Tracks 30 prominent US blue-chip companies'],['IWM','Russell 2000','Represents smaller US companies']] as const;
const sectors: { label: string; aliases: string[] }[] = [
  {label:'Technology',aliases:['Technology']},{label:'Financial Services',aliases:['Financial Services','Financials']},
  {label:'Healthcare',aliases:['Healthcare','Health Care']},{label:'Consumer',aliases:['Consumer','Consumer Staples']},
  {label:'Consumer Discretionary',aliases:['Consumer Discretionary']},{label:'Industrials',aliases:['Industrials','Industrial']},{label:'Energy',aliases:['Energy']},
  {label:'Communication Services',aliases:['Communication Services','Communication']},{label:'Real Estate',aliases:['Real Estate']},
  {label:'Basic Materials',aliases:['Basic Materials','Materials']},{label:'Utilities',aliases:['Utilities']},
  {label:'Other / Unclassified',aliases:['Other']},
];
const pct = (v: unknown) => v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const money = (v: unknown) => v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v).toLocaleString('en-US',{maximumFractionDigits:2})}`;
const quoteIsFresh = (value: string | null | undefined) => { if (!value) return false; const time = new Date(value).getTime(); const age = Date.now() - time; return Number.isFinite(time) && age >= 0 && age <= 4 * 24 * 60 * 60 * 1000; };
const quoteDate = (value: string | null | undefined) => { if (!value) return 'Timestamp unavailable'; const d = new Date(value); return Number.isFinite(d.getTime()) ? `As of ${d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}` : 'Timestamp unavailable'; }
const faq = [
  {question:'What does the US Market Overview show?',answer:'The dashboard brings together available data for major US market benchmark proxies, daily market breadth, sector-level price changes and SPY historical closing prices. Coverage depends on the latest records available from the data sources.'},
  {question:'Which market indexes are covered?',answer:'The page uses SPY as an S&P 500 proxy, QQQ for the Nasdaq 100, DIA for the Dow Jones Industrial Average and IWM for the Russell 2000. These are ETF proxies, not the official index values.'},
  {question:'What is market breadth?',answer:'Market breadth measures participation across the tracked stock universe. Advancers have a positive reported daily percentage change, decliners have a negative change, and unchanged stocks have a zero change. It is not a count of every US-listed security.'},
  {question:'How is sector performance calculated?',answer:'Sector performance on this page is the simple average of the reported daily percentage changes for tracked active stocks with a usable quote and a matching sector label. It is not a market-cap-weighted index return.'},
  {question:'Why might some market data be unavailable?',answer:'A quote or chart can be absent when a matching security or price record is not available to the dashboard. Missing values are not estimated or fabricated. Check the individual stock research page for additional available data.'},
  {question:'Is this real-time stock market data?',answer:'The page reflects records available in the platform database. Timing and freshness depend on the underlying provider and ingestion schedule; this page should not be interpreted as a guaranteed real-time exchange feed.'},
  {question:'Can I use this dashboard as investment advice?',answer:'No. Market data and research are informational and are not personalized investment, trading, tax or financial advice. Verify information with primary sources and consider your own objectives and risk tolerance.'},
];

export default async function MarketsPage() {
  const db = createDatabaseClient();
  const [{ data: rawProxyStocks, error: proxyLookupError }, { data: rawStocks, error: stockLookupError }] = await Promise.all([
    db.from('stocks').select('id,symbol,company_name').eq('is_active', true).in('symbol', proxies.map(p => p[0])),
    db.from('stocks').select('id,symbol,slug,company_name,sector,market_cap').eq('is_active', true).eq('asset_type','stock').limit(6000),
  ]);
  // Never log a connection string or credentials; only report configuration state and query errors.
  if (!(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL)) {
    console.error('[markets] No supported database URL environment variable is configured.');
  }
  if (proxyLookupError) console.error('[markets] Benchmark stock lookup failed:', proxyLookupError.message);
  if (stockLookupError) console.error('[markets] Stock universe lookup failed:', stockLookupError.message);
  const proxyStocks = (rawProxyStocks ?? []) as ProxyRow[];
  const stocks = filterCommonEquityRows((rawStocks ?? []) as StockRow[]);
  // Fetch quotes by bounded stock-ID batches. A single unfiltered quote query can
  // be truncated or fail at the data transport layer; the wrapper returns errors
  // as { data: null, error }, so handle each batch explicitly instead of silently
  // turning a failed query into an empty dashboard.
  const ids = [...new Set([...stocks.map(s => String(s.id)), ...proxyStocks.map(s => String(s.id))])];
  const idBatches: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) idBatches.push(ids.slice(i, i + 200));
  const quoteBatchResults = await Promise.all(idBatches.map(async (batch) => {
    const result = await db.from('latest_quotes').select('stock_id,price,change_percent,volume,quote_timestamp').in('stock_id', batch);
    if (result.error) {
      console.error('[markets] Quote batch query failed:', result.error.message);
      return [];
    }
    return (result.data ?? []) as QuoteRow[];
  }));
  const [{ data: rawHistory, error: historyError }] = await Promise.all([
    (() => { const spy = proxyStocks.find(s => s.symbol === 'SPY'); return spy ? db.from('price_history').select('timestamp,close').eq('stock_id', spy.id).eq('timeframe','1d').order('timestamp',{ascending:false}).limit(180) : Promise.resolve({data: [], error: null}); })(),
  ]);
  if (historyError) console.error('[markets] SPY history query failed:', historyError.message);
  const quotes = quoteBatchResults.flat();
  const history = ((rawHistory ?? []) as HistoryRow[]).slice().reverse();
  const byId = new Map(quotes.map(q => [String(q.stock_id),q]));
  const proxyMap = new Map(proxyStocks.map(s => [s.symbol,{...s,quote:byId.get(String(s.id))}]));
  const validQuotes = stocks.map(s => ({...s,quote:byId.get(String(s.id))})).filter(s => s.quote?.price != null && s.quote?.change_percent != null && quoteIsFresh(s.quote?.quote_timestamp));
  const advancers = validQuotes.filter(s => Number(s.quote?.change_percent) > 0).length;
  const decliners = validQuotes.filter(s => Number(s.quote?.change_percent) < 0).length;
  const unchanged = validQuotes.filter(s => Number(s.quote?.change_percent) === 0).length;
  const volume = validQuotes.reduce((sum,s)=>sum + Number(s.quote?.volume ?? 0),0);
  const sectorRows = sectors.map(({label,aliases}) => {
    const rows=validQuotes.filter(s=>aliases.includes(String(s.sector ?? '')));
    const avg=rows.length ? rows.reduce((sum,s)=>sum+Number(s.quote?.change_percent ?? 0),0)/rows.length : null;
    return {sector:label,avg,count:rows.length};
  }).filter(s=>s.count);
  const chart: ChartPoint[] = history.filter(x=>x.close!=null).map(x=>({time:new Date(x.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}),close:Number(x.close)}));
  const latest = chart.at(-1)?.close;
  const first = chart[0]?.close;
  const periodChange = latest != null && first ? ((latest-first)/first)*100 : null;
  const updatedUniverse = validQuotes.length;
  const jsonLd = {'@context':'https://schema.org','@type':'FAQPage','mainEntity':faq.map(x=>({'@type':'Question',name:x.question,acceptedAnswer:{'@type':'Answer',text:x.answer}}))};

  return <div className="container market-page"><div className="market-shell">
    <section className="page-hero market-seo-hero">
      <div className="page-hero-content">
        <div className="eyebrow">US EQUITY MARKETS · DATA-LED RESEARCH</div>
        <h1>US Stock Market Overview</h1>
        <p className="market-lead">Understand the trading day beyond a single index move. Explore major US market benchmarks, stock-market breadth, sector participation and historical price context—then move from the market-wide picture to the individual companies shaping it.</p>
        <div className="hero-actions"><Link className="blue-btn" href="/stocks">Explore US Stocks</Link><Link className="outline-btn" href="/screener">Screen Stocks</Link><Link className="outline-btn" href="/rankings">View Stock Rankings</Link></div>
        <div className="market-hero-points"><span>Benchmark proxies</span><span>Market breadth</span><span>Sector performance</span><span>Historical context</span></div>
      </div>
    </section>

    <section className="market-intro-copy">
      <div><div className="market-section-kicker">THE MARKET IN CONTEXT</div><h2>A broader view of the US stock market</h2></div>
      <div className="market-intro-text"><p>US Market AI’s Market Overview is designed to help investors and researchers understand how different parts of the US equity market are moving—not just whether one headline index is up or down. The dashboard combines benchmark ETF proxies with daily price changes across the active stocks tracked by the platform.</p><p>Use the benchmark cards to orient yourself, market breadth to gauge participation, and the sector dashboard to compare groups of companies. Then follow the links into stock research for company-level fundamentals, valuation, technical indicators and forecast research where available.</p><p className="market-data-note"><strong>Data transparency:</strong> displayed figures come from records available to the platform. ETF prices are proxies for their respective indexes. Market breadth and sector averages exclude quotes older than four days; stale proxy prices may remain visible with their timestamp, but stale daily moves are withheld.</p></div>
    </section>

    <section className="market-data-section">
      <div className="section-card-head market-section-head"><div><div className="market-section-kicker">BENCHMARKS</div><h2>Major US market gauges</h2><p>ETF proxies provide a practical reference for broad-market, large-cap, technology-heavy and small-cap performance.</p></div><span className="market-source-label">Latest available records</span></div>
      <div className="market-index-grid">{proxies.map(([symbol,name,detail])=>{const item=proxyMap.get(symbol);const fresh=quoteIsFresh(item?.quote?.quote_timestamp);return <article className="index-card" key={symbol}><div className="index-top"><div><div className="index-name">{name}</div><div className="index-symbol">{symbol} · ETF proxy</div></div><span className={`index-status ${item?.quote?.price != null ? (fresh ? 'has-data' : 'no-data') : 'no-data'}`}>{item?.quote?.price != null ? (fresh ? 'Fresh quote' : 'Stale quote') : 'No quote'}</span></div><div className="index-value">{money(item?.quote?.price)}</div><div className={fresh && Number(item?.quote?.change_percent ?? 0)>=0?'positive index-pending':'negative index-pending'}>{fresh && item?.quote?.change_percent != null ? pct(item.quote.change_percent) : 'Daily change unavailable'}</div><small>{quoteDate(item?.quote?.quote_timestamp)}</small><p className="market-index-detail">{detail}</p></article>})}</div>
      <p className="market-method-note">These symbols are exchange-traded funds used as market proxies. Their prices and returns can differ from the official index levels and should not be treated as the indexes themselves.</p>
    </section>

    <section className="market-layout market-analysis-layout">
      <div className="section-card chart-panel"><div className="section-card-head market-section-head"><div><div className="market-section-kicker">PRICE HISTORY</div><h2>SPY historical price trend</h2><p>Daily closing prices in the available history{periodChange!=null ? ` · ${pct(periodChange)} across the displayed period` : ''}.</p></div><span className="market-source-label">Daily closes</span></div>{chart.length ? <PriceChart data={chart}/> : <div className="market-empty-state"><strong>SPY historical data is not available in this view.</strong><span>The chart will appear when daily closing-price records are available. No sample or estimated prices are displayed.</span></div>}</div>
      <div className="section-card breadth-card"><div className="market-section-kicker">PARTICIPATION</div><h2>US stock market breadth</h2><p className="muted market-card-description">A count of advancing, declining and unchanged stocks among tracked active companies with valid price and daily-change data.</p>
        <div className="breadth-item"><div className="breadth-row"><span>Advancers</span><strong>{updatedUniverse ? advancers.toLocaleString('en-US') : '—'}</strong></div><div className="breadth-track"><div className="breadth-fill" style={{width:`${updatedUniverse ? advancers/updatedUniverse*100 : 0}%`}}/></div></div>
        <div className="breadth-item"><div className="breadth-row"><span>Decliners</span><strong>{updatedUniverse ? decliners.toLocaleString('en-US') : '—'}</strong></div><div className="breadth-track"><div className="breadth-fill" style={{width:`${updatedUniverse ? decliners/updatedUniverse*100 : 0}%`}}/></div></div>
        <div className="breadth-item"><div className="breadth-row"><span>Unchanged</span><strong>{updatedUniverse ? unchanged.toLocaleString('en-US') : '—'}</strong></div><p className="breadth-note">Stocks with usable daily changes: {updatedUniverse.toLocaleString('en-US')} · Combined reported volume: {volume ? volume.toLocaleString('en-US') : '—'}</p></div>
        {!updatedUniverse && <p className="market-inline-note">Breadth figures are not shown because usable quote records were not returned for the tracked universe.</p>}
      </div>
    </section>

    <section className="section-card market-sector-section"><div className="section-card-head market-section-head"><div><div className="market-section-kicker">RELATIVE PERFORMANCE</div><h2>US stock market sector performance</h2><p>Compare the average reported daily move across tracked stocks in each available sector.</p></div><span className="market-source-label">{sectorRows.length} sectors represented</span></div>
      {sectorRows.length ? <div className="sector-grid">{sectors.map(({label})=>{const row=sectorRows.find(s=>s.sector===label);return <Link href={`/sectors?sector=${encodeURIComponent(label)}`} className="sector-card" key={label} aria-label={`Explore ${label} stocks`}><strong>{label}</strong><span>{row ? `${row.count.toLocaleString('en-US')} stocks · ${pct(row.avg)} average daily move` : 'No matching quote records'}</span><div className="sector-bar"><i className={Number(row?.avg ?? 0)<0?'is-negative':'is-positive'} style={{width:`${row?.avg == null ? 0 : Math.min(100,Math.max(3,Math.abs(row.avg)*10))}%`}}/></div><span className="sector-card-action">Explore sector →</span></Link>})}</div> : <div className="market-empty-state compact"><strong>Sector performance is temporarily unavailable.</strong><span>Sector comparisons will be displayed when valid daily quote records can be matched to the tracked stock universe.</span></div>}
      <p className="market-method-note">Methodology: each sector figure is a simple average of the available daily percentage changes for tracked stocks whose sector label matches the group. It is not a market-cap-weighted sector index. Unclassified companies and unavailable quotes are excluded.</p>
      <Link className="market-text-link" href="/sectors">Explore the sector directory <span aria-hidden="true">→</span></Link>
    </section>

    <section className="market-explainer">
      <div className="market-section-kicker">HOW TO READ THE DASHBOARD</div><h2>What these market indicators can tell you</h2>
      <div className="market-explainer-grid">
        <article><span className="market-step">01</span><h3>Start with the benchmarks</h3><p>SPY, QQQ, DIA and IWM provide different lenses on US equities. Comparing them can help you see whether the move is broad-based or concentrated in a particular part of the market.</p></article>
        <article><span className="market-step">02</span><h3>Check market breadth</h3><p>An index can rise while many individual stocks fall. Advancers versus decliners adds participation context, although this dashboard only covers stocks with usable records in the tracked universe.</p></article>
        <article><span className="market-step">03</span><h3>Compare sectors</h3><p>Sector averages can highlight relative strength or weakness across groups. Treat them as a directional summary, not a substitute for a sector index or a market-cap-weighted return.</p></article>
        <article><span className="market-step">04</span><h3>Investigate individual companies</h3><p>Market-wide moves do not explain every stock. Use company pages to review reported financials, valuation, risk measures, historical performance and available forecasts before drawing conclusions.</p></article>
      </div>
    </section>

    <section className="market-research-cta"><div><div className="market-section-kicker">FROM MARKET VIEW TO COMPANY RESEARCH</div><h2>Turn market context into focused stock research</h2><p>Explore the tracked US stock universe, compare available company metrics and review research pages without assuming that every company has complete coverage.</p></div><div className="market-research-links"><Link href="/stocks">Browse US stocks <span>→</span></Link><Link href="/screener">Explore the stock screener <span>→</span></Link><Link href="/rankings">View stock rankings <span>→</span></Link><Link href="/earnings">Review earnings data <span>→</span></Link><Link href="/dividends">Explore dividend data <span>→</span></Link><Link href="/predictions">View available predictions <span>→</span></Link></div></section>

    <section className="market-faq"><div className="market-section-kicker">MARKET OVERVIEW FAQ</div><h2>Frequently asked questions about the US stock market</h2><div className="market-faq-list">{faq.map((item)=><details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>

    <section className="market-disclaimer"><strong>Important information</strong><p>US Market AI provides market data and research for informational and educational purposes only. Information may be delayed, incomplete or subject to provider corrections. This dashboard is not investment advice, a recommendation to buy or sell securities, or a promise of future performance. Confirm time-sensitive information with your broker or primary data sources before making financial decisions.</p></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,'\\u003c')}} />
  </div></div>;
}
