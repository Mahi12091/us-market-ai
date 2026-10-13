import type { Metadata } from 'next';
import Link from 'next/link';
import PriceChart, { type ChartPoint } from '@/components/price-chart';
import { createDatabaseClient } from '@/lib/neon';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Market Overview', description: 'US market overview with verified benchmark prices, market breadth, sector performance and historical price data.' };

type StockRow = { id: string; symbol: string; slug: string | null; company_name: string; sector: string | null; market_cap: number | null };
type ProxyRow = { id: string; symbol: string; company_name: string };
type QuoteRow = { stock_id: string; price: number | null; change_percent: number | null; volume: number | null };
type HistoryRow = { timestamp: string; close: number | null };

const proxies = [['SPY','S&P 500 proxy'],['QQQ','Nasdaq 100 proxy'],['DIA','Dow Jones proxy'],['IWM','Russell 2000 proxy']] as const;
const sectors: { label: string; aliases: string[] }[] = [{label:'Technology',aliases:['Technology']},{label:'Financial Services',aliases:['Financial Services','Financials']},{label:'Healthcare',aliases:['Healthcare','Health Care']},{label:'Consumer',aliases:['Consumer','Consumer Discretionary','Consumer Staples']},{label:'Industrials',aliases:['Industrials','Industrial']},{label:'Energy',aliases:['Energy']},{label:'Communication Services',aliases:['Communication Services','Communication']},{label:'Real Estate',aliases:['Real Estate']},{label:'Basic Materials',aliases:['Basic Materials','Materials']},{label:'Utilities',aliases:['Utilities']}];
const pct = (v: unknown) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

export default async function MarketsPage() {
  const supabase = createDatabaseClient();
  const [{ data: rawProxyStocks }, { data: rawStocks }] = await Promise.all([
    supabase.from('stocks').select('id,symbol,company_name').eq('is_active', true).in('symbol', proxies.map(p => p[0])),
    supabase.from('stocks').select('id,symbol,slug,company_name,sector,market_cap').eq('is_active', true).eq('asset_type','stock').limit(5000),
  ]);
  const proxyStocks = (rawProxyStocks ?? []) as ProxyRow[];
  const stocks = (rawStocks ?? []) as StockRow[];
  const ids = [...new Set([...stocks.map(s => s.id), ...proxyStocks.map(s => s.id)])];
  const [{ data: rawQuotes }, { data: rawHistory }] = await Promise.all([
    ids.length ? supabase.from('latest_quotes').select('stock_id,price,change_percent,volume').in('stock_id', ids) : Promise.resolve({data: []}),
    (() => { const spy = proxyStocks.find(s => s.symbol === 'SPY'); return spy ? supabase.from('price_history').select('timestamp,close').eq('stock_id', spy.id).eq('timeframe','1d').order('timestamp',{ascending:false}).limit(180) : Promise.resolve({data: []}); })(),
  ]);
  const quotes = (rawQuotes ?? []) as QuoteRow[];
  const history = ((rawHistory ?? []) as HistoryRow[]).slice().reverse();
  const idsToQuote = new Map(quotes.map(q => [q.stock_id,q]));
  const proxyMap = new Map(proxyStocks.map(s => [s.symbol,{...s,quote:idsToQuote.get(s.id)}]));
  const validQuotes = stocks.map(s => ({...s,quote:idsToQuote.get(s.id)})).filter(s => s.quote?.price != null && s.quote?.change_percent != null);
  const advancers = validQuotes.filter(s => Number(s.quote?.change_percent) > 0).length;
  const decliners = validQuotes.filter(s => Number(s.quote?.change_percent) < 0).length;
  const unchanged = validQuotes.length - advancers - decliners;
  const volume = validQuotes.reduce((sum,s)=>sum + Number(s.quote?.volume ?? 0),0);
  const sectorRows = sectors.map(({label,aliases}) => { const rows=validQuotes.filter(s=>aliases.includes(String(s.sector ?? ''))); const avg=rows.length ? rows.reduce((sum,s)=>sum+Number(s.quote?.change_percent ?? 0),0)/rows.length : null; return {sector:label,avg,count:rows.length}; }).filter(s=>s.count);
  const chart: ChartPoint[] = history.filter(x=>x.close!=null).map(x=>({time:new Date(x.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'}),close:Number(x.close)}));
  const latest = chart.at(-1)?.close;
  const first = chart[0]?.close;
  const periodChange = latest != null && first ? ((latest-first)/first)*100 : null;

  return <div className="container market-page"><div className="market-shell">
    <section className="page-hero"><div className="page-hero-content"><div className="eyebrow">US Markets · Verified Data</div><h1>Market Overview</h1><p>Market benchmarks, daily market breadth, sector performance and historical prices from the latest available market data.</p><div className="hero-actions"><Link className="blue-btn" href="/stocks">Explore US Stocks</Link><Link className="outline-btn" href="/predictions">View AI Predictions</Link></div></div></section>
    <section><div className="section-card-head" style={{paddingLeft:0,paddingRight:0}}><div><h2>Major market gauges</h2><p>ETF proxies for major US benchmarks</p></div><span className="muted" style={{fontSize:10}}>EOD feed</span></div><div className="market-index-grid">{proxies.map(([symbol,name])=>{const item=proxyMap.get(symbol);return <div className="index-card" key={symbol}><div className="index-top"><div><div className="index-name">{name}</div><div className="index-symbol">{symbol}</div></div>{item?.quote ? <span className="index-status">Data available</span> : <span className="index-status">Unavailable</span>}</div><div className="index-value">{item?.quote?.price != null ? `$${Number(item.quote.price).toLocaleString('en-US',{maximumFractionDigits:2})}` : '—'}</div><div className={Number(item?.quote?.change_percent ?? 0)>=0?'positive index-pending':'negative index-pending'}>{item?.quote ? pct(item.quote.change_percent) : 'Quote unavailable'}</div></div>})}</div></section>
    <section className="market-layout"><div className="section-card chart-panel"><div className="section-card-head" style={{padding:0}}><div><h2>SPY price history</h2><p>Stored daily closing prices · {chart.length} sessions{periodChange!=null ? ` · ${pct(periodChange)} over displayed period` : ''}</p></div><span className="muted">Daily close</span></div>{chart.length ? <PriceChart data={chart}/> : <div className="fake-chart"><div className="chart-empty"><strong>Historical prices are temporarily unavailable</strong><span>Please check back when market data is available.</span></div></div>}</div><div className="section-card breadth-card"><div><h2 style={{margin:0,fontSize:20}}>Market breadth</h2><p className="muted" style={{fontSize:11,margin:'5px 0 0'}}>Across tracked active stocks</p></div><div className="breadth-item"><div className="breadth-row"><span>Advancers</span><strong>{validQuotes.length ? advancers.toLocaleString('en-US') : '—'}</strong></div><div className="breadth-track"><div className="breadth-fill" style={{width:`${validQuotes.length ? advancers/validQuotes.length*100 : 0}%`}}/></div></div><div className="breadth-item"><div className="breadth-row"><span>Decliners</span><strong>{validQuotes.length ? decliners.toLocaleString('en-US') : '—'}</strong></div><div className="breadth-track"><div className="breadth-fill" style={{width:`${validQuotes.length ? decliners/validQuotes.length*100 : 0}%`}}/></div></div><div className="breadth-item"><div className="breadth-row"><span>Unchanged</span><strong>{validQuotes.length ? unchanged.toLocaleString('en-US') : '—'}</strong></div><div className="breadth-note">Tracked quotes: {validQuotes.length.toLocaleString('en-US')} · Total volume: {volume ? volume.toLocaleString('en-US') : '—'}</div></div></div></section>
    <section className="section-card"><div className="section-card-head"><div><h2>US sector dashboard</h2><p>Average daily move across tracked stocks with sector labels</p></div><span className="muted" style={{fontSize:10}}>{sectorRows.length} sectors with data</span></div><div className="sector-grid">{sectors.map(({label})=>{const row=sectorRows.find(s=>s.sector===label);return <div className="sector-card" key={label}><strong>{label}</strong><span>{row ? `${row.count.toLocaleString('en-US')} stocks · ${pct(row.avg)}` : 'Data unavailable'}</span><div className="sector-bar"><i style={{width:`${row?.avg == null ? 0 : Math.min(100,Math.abs(row.avg)*10)}%`}} /></div></div>})}</div></section>
    <section className="market-note"><div className="note-card"><small>BREADTH</small><h3>{validQuotes.length ? `${advancers} up · ${decliners} down` : 'Market breadth'}</h3><p>Participation is calculated from the currently tracked stock universe.</p></div><div className="note-card"><small>VOLATILITY</small><h3>Risk & volatility</h3><p>Review available risk metrics and technical indicators on individual stock research pages.</p></div><div className="note-card"><small>RESEARCH</small><h3>From market context to stock detail</h3><p>Explore available financials, valuation metrics, historical performance and forecast research on stock pages.</p></div></section>
  </div></div>;
}
