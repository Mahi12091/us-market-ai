import type { Metadata } from 'next';
import Link from 'next/link';
import PriceChart, { type ChartPoint } from '@/components/price-chart';
import { createDatabaseClient } from '@/lib/neon';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Market Overview', description: 'US market overview covering tracked market proxies, breadth, sector momentum and volatility.' };

type StockRow = { id: string; symbol: string; slug: string | null; company_name: string; sector: string | null; market_cap: number | null };
type ProxyRow = { id: string; symbol: string; company_name: string };
type QuoteRow = { stock_id: string; price: number | null; change_percent: number | null; volume: number | null };
type HistoryRow = { timestamp: string; close: number | null };

const proxies = [['SPY','S&P 500 proxy'],['QQQ','Nasdaq 100 proxy'],['DIA','Dow Jones proxy'],['IWM','Russell 2000 proxy']] as const;
const sectors = ['Technology','Financials','Healthcare','Consumer','Industrials','Energy','Communication','Real Estate'];
const pct = (v: unknown) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

export default async function MarketsPage() {
  const supabase = createDatabaseClient();
  const [{ data: rawProxyStocks }, { data: rawStocks }] = await Promise.all([
    supabase.from('stocks').select('id,symbol,company_name').eq('is_active', true).in('symbol', proxies.map(p => p[0])),
    supabase.from('stocks').select('id,symbol,slug,company_name,sector,market_cap').eq('is_active', true).eq('asset_type','stock').limit(5000),
  ]);
  const proxyStocks = (rawProxyStocks ?? []) as ProxyRow[];
  const stocks = (rawStocks ?? []) as StockRow[];
  const ids = stocks.map(s => s.id);
  const [{ data: rawQuotes }, { data: rawHistory }] = await Promise.all([
    ids.length ? supabase.from('latest_quotes').select('stock_id,price,change_percent,volume').in('stock_id', ids) : Promise.resolve({data: []}),
    (() => { const spy = proxyStocks.find(s => s.symbol === 'SPY'); return spy ? supabase.from('price_history').select('timestamp,close').eq('stock_id', spy.id).eq('timeframe','1d').order('timestamp',{ascending:true}).limit(180) : Promise.resolve({data: []}); })(),
  ]);
  const quotes = (rawQuotes ?? []) as QuoteRow[];
  const history = (rawHistory ?? []) as HistoryRow[];
  const idsToQuote = new Map(quotes.map(q => [q.stock_id,q]));
  const proxyMap = new Map(proxyStocks.map(s => [s.symbol,{...s,quote:idsToQuote.get(s.id)}]));
  const validQuotes = stocks.map(s => ({...s,quote:idsToQuote.get(s.id)})).filter(s => s.quote?.change_percent != null);
  const advancers = validQuotes.filter(s => Number(s.quote?.change_percent) > 0).length;
  const decliners = validQuotes.filter(s => Number(s.quote?.change_percent) < 0).length;
  const unchanged = validQuotes.length - advancers - decliners;
  const volume = validQuotes.reduce((sum,s)=>sum + Number(s.quote?.volume ?? 0),0);
  const sectorRows = sectors.map(sector => { const rows=validQuotes.filter(s=>s.sector===sector); const avg=rows.length ? rows.reduce((sum,s)=>sum+Number(s.quote?.change_percent ?? 0),0)/rows.length : null; return {sector,avg,count:rows.length}; }).filter(s=>s.count);
  const chart: ChartPoint[] = history.filter(x=>x.close!=null).map(x=>({time:new Date(x.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'}),close:Number(x.close)}));
  const latest = chart.at(-1)?.close;
  const first = chart[0]?.close;
  const periodChange = latest != null && first ? ((latest-first)/first)*100 : null;

  return <div className="container market-page"><div className="market-shell">
    <section className="page-hero"><div className="page-hero-content"><div className="eyebrow">US Markets · Verified Data</div><h1>Market Overview</h1><p>Live-ready market context built from the tracked stock universe: market proxies, breadth, sector momentum and price history. Values are shown only when the backend has verified data.</p><div className="hero-actions"><Link className="blue-btn" href="/stocks">Explore US Stocks</Link><Link className="outline-btn" href="/predictions">View AI Predictions</Link></div></div></section>
    <section><div className="section-card-head" style={{paddingLeft:0,paddingRight:0}}><div><h2>Major market gauges</h2><p>ETF proxies for major US benchmarks</p></div><span className="muted" style={{fontSize:10}}>EOD feed</span></div><div className="market-index-grid">{proxies.map(([symbol,name])=>{const item=proxyMap.get(symbol);return <div className="index-card" key={symbol}><div className="index-top"><div><div className="index-name">{name}</div><div className="index-symbol">{symbol}</div></div><span className="index-status">{item?.quote ? 'VERIFIED' : 'PENDING'}</span></div><div className="index-value">{item?.quote?.price != null ? `$${Number(item.quote.price).toLocaleString('en-US',{maximumFractionDigits:2})}` : '—'}</div><div className={Number(item?.quote?.change_percent ?? 0)>=0?'positive index-pending':'negative index-pending'}>{item?.quote ? pct(item.quote.change_percent) : 'Awaiting verified quote'}</div></div>})}</div></section>
    <section className="market-layout"><div className="section-card chart-panel"><div className="section-card-head" style={{padding:0}}><div><h2>SPY price history</h2><p>Stored daily closing prices · {chart.length} sessions{periodChange!=null ? ` · ${pct(periodChange)} over displayed period` : ''}</p></div><span className="muted">1D history</span></div>{chart.length ? <PriceChart data={chart}/> : <div className="fake-chart"><div className="chart-empty"><strong>SPY history not available yet</strong><span>No numerical chart is fabricated.</span></div></div>}</div><div className="section-card breadth-card"><div><h2 style={{margin:0,fontSize:20}}>Market breadth</h2><p className="muted" style={{fontSize:11,margin:'5px 0 0'}}>Across tracked active stocks</p></div><div className="breadth-item"><div className="breadth-row"><span>Advancers</span><strong>{advancers || '—'}</strong></div><div className="breadth-track"><div className="breadth-fill" style={{width:`${validQuotes.length ? advancers/validQuotes.length*100 : 0}%`}}/></div></div><div className="breadth-item"><div className="breadth-row"><span>Decliners</span><strong>{decliners || '—'}</strong></div><div className="breadth-track"><div className="breadth-fill" style={{width:`${validQuotes.length ? decliners/validQuotes.length*100 : 0}%`}}/></div></div><div className="breadth-item"><div className="breadth-row"><span>Unchanged</span><strong>{unchanged || '—'}</strong></div><div className="breadth-note">Tracked quotes: {validQuotes.length || '—'} · Total volume: {volume ? volume.toLocaleString() : '—'}</div></div></div></section>
    <section className="section-card"><div className="section-card-head"><div><h2>US sector dashboard</h2><p>Average daily move across tracked stocks with sector labels</p></div><span className="muted" style={{fontSize:10}}>{sectorRows.length} sectors with data</span></div><div className="sector-grid">{sectors.map(sector=>{const row=sectorRows.find(s=>s.sector===sector);return <div className="sector-card" key={sector}><strong>{sector}</strong><span>{row ? `${row.count} tracked stocks · ${pct(row.avg)}` : 'No verified sector quotes yet'}</span><div className="sector-bar"><i style={{width:`${row?.avg == null ? 0 : Math.min(100,Math.abs(row.avg)*10)}%`}} /></div></div>})}</div></section>
    <section className="market-note"><div className="note-card"><small>BREADTH</small><h3>{validQuotes.length ? `${advancers} up · ${decliners} down` : 'Waiting for quotes'}</h3><p>Participation is calculated from the currently tracked stock universe.</p></div><div className="note-card"><small>VOLATILITY</small><h3>Technical layer ready</h3><p>Individual stock volatility and ATR values are available on research pages after the indicator job runs.</p></div><div className="note-card"><small>RESEARCH</small><h3>From market context to stock detail</h3><p>Use the market overview as context, then drill into individual stock pages for forecasts and fundamentals.</p></div></section>
  </div></div>;
}
