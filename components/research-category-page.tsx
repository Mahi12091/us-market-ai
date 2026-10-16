import Link from 'next/link';
import { createDatabaseClient } from '@/lib/neon';
import { filterCommonEquityRows } from '@/lib/stock-universe';
import ResearchCategoryControls from '@/components/research-category-controls';

type Row = Record<string, any>;
type Mode = 'screener'|'compare'|'sectors'|'earnings'|'dividends'|'rankings'|'etfs'|'ipo';
const cfg: Record<Mode,{title:string;eyebrow:string;description:string;explain:string;columns:string[]}> = {
  screener:{title:'US Stock Screener',eyebrow:'Discover · Filter · Research',description:'Filter the currently indexed US stock universe by company, sector and market capitalization using available stored data.',explain:'Filters use stored company metadata and market capitalization. Stale or missing source values are not replaced with estimates.',columns:['symbol','company_name','sector','industry','exchange','market_cap']},
  compare:{title:'Compare US Stocks',eyebrow:'Side-by-side research',description:'Select up to four US-listed companies and compare available company facts side by side before opening deeper research.',explain:'The comparison uses available company metadata and market capitalization only. Missing values stay unavailable; this is not an investment recommendation.',columns:['symbol','company_name','sector','industry','exchange','market_cap']},
  sectors:{title:'US Sector Analysis',eyebrow:'Market structure',description:'Browse sectors and industries represented in the tracked US stock universe.',explain:'Sector groups come from company metadata. Returns are not fabricated when quote coverage is missing.',columns:['sector','industry','symbol','company_name','market_cap']},
  earnings:{title:'Earnings Research',eyebrow:'Company results',description:'Explore reported earnings periods, EPS and revenue values from available company filings.',explain:'Reported period dates are not the same as a confirmed upcoming earnings calendar. Review the reporting period and source before drawing conclusions.',columns:['symbol','company_name','earnings_date','fiscal_period','eps_actual','eps_estimate','eps_surprise','revenue_actual','revenue_estimate','data_source']},
  dividends:{title:'Dividend Research',eyebrow:'Income · Yield · History',description:'Review dividend events only where source data includes a dated, interpretable record.',explain:'Raw SEC aggregate distribution values are not treated as per-share dividends. Dividend records do not promise future payments.',columns:['symbol','company_name','ex_date','payment_date','amount','frequency','dividend_yield','payout_ratio','data_source']},
  rankings:{title:'Stock Rankings',eyebrow:'Evidence-led discovery',description:'Browse tracked stocks ordered by available market capitalization, then inspect underlying fundamentals and risks.',explain:'This is a coverage-aware directory ordered by stored market cap, not a prediction or guarantee of outperformance.',columns:['symbol','company_name','sector','market_cap','exchange']},
  etfs:{title:'ETF Research',eyebrow:'Funds & market proxies',description:'Browse tracked exchange-traded funds when validated ETF records are available in the database.',explain:'The current stock universe is not assumed to be an ETF universe. Holdings, fees and flows require dedicated validated fund data.',columns:['symbol','company_name','exchange','market_cap','asset_type']},
  ipo:{title:'IPO & Recent Listing Research',eyebrow:'New listings',description:'Explore tracked companies with recorded listing dates from the last five years. This is historical coverage, not an upcoming IPO calendar.',explain:'Dates come from the stored company dataset and should be verified against issuer or exchange filings. Future dates and older legacy listings are excluded from this recent-listing view.',columns:['symbol','company_name','exchange','sector','ipo_listing_date']},
};
const ETF_PROXY_GUIDE = [
  {symbol:'SPY',name:'SPDR S&P 500 ETF Trust',benchmark:'S&P 500',role:'Broad large-cap US equity market proxy.'},
  {symbol:'QQQ',name:'Invesco QQQ Trust',benchmark:'Nasdaq-100',role:'Large non-financial Nasdaq-listed companies proxy.'},
  {symbol:'DIA',name:'SPDR Dow Jones Industrial Average ETF Trust',benchmark:'Dow Jones Industrial Average',role:'Price-weighted blue-chip US equities proxy.'},
  {symbol:'IWM',name:'iShares Russell 2000 ETF',benchmark:'Russell 2000',role:'Small-cap US equities proxy.'},
] as const;

const fmt = (key:string,value:any) => {
  if(value==null||value==='') return '—';
  if((key==='market_cap'||key==='amount'||key==='revenue_actual'||key==='revenue_estimate')&&Number.isFinite(Number(value))) return '$'+Number(value).toLocaleString('en-US',{maximumFractionDigits:2});
  if(key.startsWith('eps_')&&Number.isFinite(Number(value))) return '$'+Number(value).toFixed(2);
  if((key.includes('percent')||key.includes('yield')||key==='payout_ratio')&&Number.isFinite(Number(value))) return Number(value).toFixed(2)+'%';
  if((key.endsWith('_date')||key.endsWith('_at'))&&Number.isFinite(new Date(String(value)).getTime())) return new Date(String(value)).toLocaleDateString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'});
  return String(value);
};
async function attachStockInfo(rows:Row[],db:ReturnType<typeof createDatabaseClient>) {
  const ids=[...new Set(rows.map(row=>row.stock_id).filter(value=>value!=null).map(String))];
  if(!ids.length) return {rows,failed:false};
  const {data,error}=await db.from('stocks').select('id,symbol,slug,company_name').in('id',ids);
  if(error) return {rows,failed:true};
  const byId=new Map((data??[]).map((stock:Row)=>[String(stock.id),stock]));
  return {rows:rows.map(row=>({...row,...(byId.get(String(row.stock_id))??{})})),failed:false};
}
export async function ResearchCategoryPage({mode}:{mode:Mode}) {
  const c=cfg[mode],db=createDatabaseClient();
  let rows:Row[]=[],queryFailed=false;
  if(mode==='earnings') {
    const result=await db.from('earnings').select('id,stock_id,earnings_date,fiscal_period,eps_actual,eps_estimate,eps_surprise,revenue_actual,revenue_estimate,data_source').order('earnings_date',{ascending:false}).limit(150);
    queryFailed=Boolean(result.error); rows=Array.isArray(result.data)?result.data:rows;
    const enriched=await attachStockInfo(rows,db); rows=enriched.rows; queryFailed=queryFailed||enriched.failed;
  } else if(mode==='dividends') {
    const result=await db.from('dividends').select('id,stock_id,ex_date,payment_date,amount,frequency,dividend_yield,payout_ratio,data_source').neq('data_source','SEC_XBRL_BULK').order('ex_date',{ascending:false}).limit(1000);
    queryFailed=Boolean(result.error);
    rows=(Array.isArray(result.data)?result.data:[]).filter((row:Row)=>Boolean(row.ex_date)&&row.amount!=null);
    const enriched=await attachStockInfo(rows,db); rows=enriched.rows; queryFailed=queryFailed||enriched.failed;
  } else {
    const q=db.from('stocks').select('id,symbol,slug,company_name,sector,industry,exchange,market_cap,asset_type,ipo_listing_date,founded_year').eq('is_active',true).eq('is_indexable',true);
    if(mode==='etfs') q.eq('asset_type','etf'); else q.eq('asset_type','stock');
    const result=await q.order('market_cap',{ascending:false,nullsFirst:false}).limit(mode==='screener'||mode==='compare'?6000:1500);
    queryFailed=Boolean(result.error);
    const stockRows = (Array.isArray(result.data) ? result.data : []) as Row[];
    // ETF records are funds, not common equities. Do not pass them through the
    // common-equity filter, which correctly excludes non-stock instruments.
    rows = mode === 'etfs'
      ? stockRows.filter(row => String(row.asset_type ?? '').toLowerCase() === 'etf')
      : filterCommonEquityRows(stockRows);
  }
  if(mode==='sectors') rows.sort((a,b)=>String(a.sector??'').localeCompare(String(b.sector??''))||String(a.symbol).localeCompare(String(b.symbol)));
  if(mode==='ipo') { const now=Date.now(); const cutoff=new Date(); cutoff.setFullYear(cutoff.getFullYear()-5); rows=rows.filter(row=>{const time=row.ipo_listing_date?new Date(String(row.ipo_listing_date)).getTime():NaN;return Number.isFinite(time)&&time>=cutoff.getTime()&&time<=now;}).sort((a,b)=>new Date(String(b.ipo_listing_date)).getTime()-new Date(String(a.ipo_listing_date)).getTime()); }
  if(mode!=='screener'&&mode!=='compare') rows=rows.slice(0,150);
  const headers=c.columns.filter(key=>rows.some(row=>key in row)||['symbol','company_name'].includes(key));
  const interactiveDirectory=mode==='screener'||mode==='compare';
  return <main className="container research-category">
    <section className="page-hero"><div className="page-hero-content"><div className="eyebrow">{c.eyebrow}</div><h1>{c.title}</h1><p>{c.description}</p><div className="hero-actions"><Link className="blue-btn" href="/stocks">Browse all stocks</Link><Link className="outline-btn" href="/markets">Market overview</Link></div></div></section>
    <section className="research-explainer"><div><span className="research-label">HOW TO USE THIS PAGE</span><h2>Research before you decide</h2><p>{c.explain}</p></div><div className="research-count"><strong>{rows.length.toLocaleString('en-US')}</strong><span>records available</span><small>Database-backed records</small></div></section>
    {interactiveDirectory&&rows.length>0
      ? <ResearchCategoryControls rows={rows} headers={headers} mode={mode as 'screener'|'compare'}/>
      : <section className="research-table-card"><div className="research-table-heading"><div><h2>{mode==='sectors'?'Companies by sector':mode==='earnings'?'Recent reported earnings':mode==='dividends'?'Verified dividend events':'Research directory'}</h2><p>Values not available in the source are shown as —.</p></div><span>{rows.length} rows</span></div>
        {rows.length>0?<div className="research-table-scroll"><table><thead><tr>{headers.map(key=><th key={key}>{key.replaceAll('_',' ')}</th>)}<th>Research</th></tr></thead><tbody>{rows.map((row,index)=><tr key={String(row.id??row.symbol??index)}>{headers.map(key=><td key={key}>{key==='symbol'&&row.slug?<Link className="research-symbol" href={'/stocks/'+row.slug}>{fmt(key,row[key])}</Link>:fmt(key,row[key])}</td>)}<td>{row.slug?<Link href={'/stocks/'+row.slug} className="research-open">Open stock →</Link>:'—'}</td></tr>)}</tbody></table></div>
        :<div className="research-empty"><strong>{queryFailed?'Research data is temporarily unavailable':mode==='dividends'?'No validated dividend events are available yet':mode==='etfs'?'No ETF records are currently classified in the tracked database':mode==='ipo'?'No recent listing records with valid dates are available yet':'No verified records available yet'}</strong><p>{queryFailed?'The data request did not complete successfully. Please try again later.':mode==='dividends'?'Raw SEC aggregate distribution amounts are intentionally withheld rather than presented as per-share dividends.':mode==='etfs'?'ETF-specific records are not currently available. The stock universe is not relabeled as an ETF universe.':mode==='ipo'?'Only recorded listing dates within the last five years are included. Verify any date against issuer or exchange filings.':'This category needs source data before it can display results. No placeholder market numbers are generated.'}</p><Link href="/stocks" className="research-open">Browse available stocks →</Link></div>}</section>}
    {mode==='etfs' && <section className="research-table-card etf-proxy-guide"><div className="research-table-heading"><div><h2>Common US market ETF proxies</h2><p>Reference guide only. These benchmark descriptions are not live fund quotes, holdings, fees or performance data.</p></div><span>REFERENCE</span></div><div className="etf-proxy-grid">{ETF_PROXY_GUIDE.map(fund=><article className="etf-proxy-card" key={fund.symbol}><div className="etf-proxy-top"><strong>{fund.symbol}</strong><span>Benchmark proxy</span></div><h3>{fund.name}</h3><p>{fund.role}</p><small>Benchmark: {fund.benchmark}</small><Link href="/markets">View market context →</Link></article>)}</div><p className="research-empty-note">Fund-level holdings, expense ratios, flows, distribution history and real-time quotes are not available in the current ETF data feed. Verify current fund documents with the issuer before investing.</p></section>}
    <p className="research-disclaimer">Data availability varies by company and provider. Informational research only; not individualized investment advice.</p>
  </main>;
}

export async function StockResearchSubpage({slug,section}:{slug:string;section:'financials'|'valuation'|'ownership'|'forecast'|'news'}){
 const db=createDatabaseClient(),{data:stock}=await db.from('stocks').select('*').eq('slug',slug).eq('is_active',true).maybeSingle();
 if(!stock)return <main className="container research-category"><section className="research-empty"><h1>Stock not found</h1><p>This stock may be inactive or the URL may have changed.</p><Link href="/stocks">Browse stocks</Link></section></main>;
 const tables={financials:'financial_statements',valuation:'valuation_snapshots',ownership:'institutional_holders',forecast:'long_term_predictions',news:'news'};
 const titles={financials:'Financial Statements',valuation:'Valuation Analysis',ownership:'Ownership & Institutional Holders',forecast:'Forecast Lab',news:'Stock News & Events'};
 const descriptions={financials:'Reported statement data with reporting periods and sources preserved.',valuation:'Available valuation snapshots and ratios; unavailable metrics remain blank.',ownership:'Reported institutional positions. Filing dates and sources matter.',forecast:'Long-term model outputs are estimates, not guarantees or price targets.',news:'Recent company-linked news records available in the database.'};
 const order={financials:'period_end',valuation:'valuation_date',ownership:'period_end',forecast:'target_year',news:'published_at'} as const;
 const {data}=await db.from(tables[section]).select('*').eq('stock_id',stock.id).order(order[section],{ascending:section==='forecast'}).limit(80);
 const rows:Row[]=Array.isArray(data)?data:[],omit=new Set(['id','stock_id','created_at','updated_at','raw_payload']),keys=[...new Set(rows.flatMap(r=>Object.keys(r)))].filter(k=>!omit.has(k)).slice(0,10);
 return <main className="container research-category"><section className="page-hero"><div className="page-hero-content"><div className="eyebrow">{stock.symbol} · Company research</div><h1>{stock.company_name} ({stock.symbol}): {titles[section]}</h1><p>{descriptions[section]}</p><div className="hero-actions"><Link className="blue-btn" href={'/stocks/'+slug}>Main stock research</Link><Link className="outline-btn" href="/compare">Compare stocks</Link></div></div></section><nav className="research-subnav" aria-label="Stock research sections">{(['financials','valuation','ownership','forecast','news'] as const).map(k=><Link key={k} aria-current={k===section?'page':undefined} href={'/stocks/'+slug+'/'+k}>{titles[k]}</Link>)}</nav>
 <section className="research-explainer"><div><span className="research-label">RESEARCH CONTEXT</span><h2>Understand the numbers</h2><p>{descriptions[section]} Use period, currency, units and source fields when interpreting values.</p></div><div className="research-count"><strong>{rows.length}</strong><span>records available</span><small>{stock.sector??stock.industry??'Sector not classified'}</small></div></section><section className="research-table-card"><div className="research-table-heading"><div><h2>{titles[section]} data</h2><p>Database-backed records only</p></div><span>{rows.length} rows</span></div>{rows.length?<div className="research-table-scroll"><table><thead><tr>{keys.map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={String(r.id??i)}>{keys.map(k=><td key={k}>{k.includes('url')&&r[k]?<a className="research-open" href={String(r[k])} target="_blank" rel="noreferrer">View source ↗</a>:fmt(k,r[k])}</td>)}</tr>)}</tbody></table></div>:<div className="research-empty"><strong>No records available for this stock yet</strong><p>The database does not currently return records for this section. This is not an estimate of zero.</p></div>}</section><p className="research-disclaimer">Informational research only, not financial advice. Forecasts are uncertain and can be wrong.</p></main>
}
