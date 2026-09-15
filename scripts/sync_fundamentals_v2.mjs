const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const n of required) if(!process.env[n]) throw new Error(`${n} is not configured.`);

const USER_AGENT=process.env.SEC_USER_AGENT||'US Market AI research bot (GitHub: Mahi12091/us-market-ai)';
const SEC='https://data.sec.gov';
const CIK_FALLBACK='https://raw.githubusercontent.com/jadchaar/sec-cik-mapper/main/mappings/stocks/ticker_to_cik.json';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function getJson(url,headers={}){
  for(let attempt=1;attempt<=5;attempt++){
    const r=await fetch(url,{headers:{'User-Agent':USER_AGENT,'Accept':'application/json','Accept-Encoding':'gzip, deflate',...headers}});
    const text=await r.text();
    if(r.ok) return text?JSON.parse(text):{};
    if(![408,429,500,502,503,504].includes(r.status)||attempt===5) throw new Error(`HTTP ${r.status}: ${text.slice(0,500)}`);
    await sleep(r.status===429?5000:Math.min(1000*2**(attempt-1),10000));
  }
}

async function db(table,{method='GET',params={},body,prefer='return=representation'}={}){
  const u=new URL(`${process.env.SUPABASE_URL}/rest/v1/${table}`);
  for(const [k,v] of Object.entries(params)) u.searchParams.set(k,v);
  const r=await fetch(u,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});
  const text=await r.text();
  if(!r.ok) throw new Error(`Supabase ${r.status}: ${text}`);
  return text?JSON.parse(text):null;
}

function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function latestFact(facts,tags,units=['USD','USD/shares','shares']){
  for(const tag of tags){
    const fact=facts?.facts?.['us-gaap']?.[tag]||facts?.facts?.dei?.[tag];
    if(!fact?.units) continue;
    for(const unit of units){
      const rows=(fact.units[unit]||[]).filter(x=>x?.val!=null&&x?.end&&['10-K','10-Q','20-F','6-K'].includes(x.form));
      rows.sort((a,b)=>String(b.end).localeCompare(String(a.end))||String(b.filed||'').localeCompare(String(a.filed||'')));
      if(rows[0]) return rows[0];
    }
  }
  return null;
}
function annualFacts(facts,tags,units=['USD','USD/shares']){
  for(const tag of tags){
    const fact=facts?.facts?.['us-gaap']?.[tag];
    if(!fact?.units) continue;
    for(const unit of units){
      const rows=(fact.units[unit]||[]).filter(x=>x?.val!=null&&x?.end&&x.form==='10-K'&&x.fp==='FY');
      if(rows.length) return rows.sort((a,b)=>String(b.end).localeCompare(String(a.end)));
    }
  }
  return [];
}
function valueAt(facts,tags){return num(latestFact(facts,tags)?.val)}
function growth(a,b){return a!=null&&b!=null&&b!==0?((a/b)-1)*100:null}

const stocks=await db('stocks',{params:{select:'id,symbol,market_cap,asset_type',is_active:'eq.true',limit:5000}});
const quotes=await db('latest_quotes',{params:{select:'stock_id,price',limit:5000}});
const priceById=new Map((quotes||[]).map(q=>[Number(q.stock_id),num(q.price)]));

// The SEC ticker files can return 403 from GitHub-hosted runners. Use the
// maintained CIK map only for identifier resolution; all financial facts
// below still come directly from official SEC data.sec.gov.
let tickerMap=new Map();
try{
  const raw=await getJson(CIK_FALLBACK);
  tickerMap=new Map(Object.entries(raw||{}).map(([ticker,cik])=>[String(ticker).toUpperCase(),String(cik).padStart(10,'0')]).filter(([t,c])=>t&&c!=='0000000000'));
  if(tickerMap.size<100) throw new Error(`unexpected mapping size ${tickerMap.size}`);
  console.log(`Loaded ${tickerMap.size} ticker/CIK associations from fallback map.`);
}catch(e){
  throw new Error(`Unable to load ticker/CIK mapping fallback: ${e.message}`);
}

const eligible=(stocks||[]).filter(s=>s.symbol&&String(s.asset_type||'stock')==='stock');
const rows=[];const failures=[];let processed=0;

for(let offset=0;offset<eligible.length;offset+=5){
  const batch=eligible.slice(offset,offset+5);
  const results=await Promise.all(batch.map(async stock=>{
    const symbol=String(stock.symbol).toUpperCase();
    const cik=tickerMap.get(symbol);
    if(!cik) return {stock,skip:'no-sec-cik'};
    try{
      const facts=await getJson(`${SEC}/api/xbrl/companyfacts/CIK${cik}.json`);
      const revenueFacts=annualFacts(facts,['RevenueFromContractWithCustomerExcludingAssessedTax','SalesRevenueNet','Revenues']);
      const epsFacts=annualFacts(facts,['EarningsPerShareDiluted','EarningsPerShareBasic'],['USD/shares']);
      const revenue=num(revenueFacts[0]?.val),previousRevenue=num(revenueFacts[1]?.val);
      const eps=num(epsFacts[0]?.val),previousEps=num(epsFacts[1]?.val);
      const net=valueAt(facts,['ProfitLoss','NetIncomeLoss','NetIncomeLossAvailableToCommonStockholdersBasic']);
      const gross=valueAt(facts,['GrossProfit']);
      const op=valueAt(facts,['OperatingIncomeLoss']);
      const assets=valueAt(facts,['Assets']);
      const equity=valueAt(facts,['StockholdersEquity','StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']);
      const debtCurrent=valueAt(facts,['LongTermDebtCurrent','ShortTermBorrowings']);
      const debtNonCurrent=valueAt(facts,['LongTermDebtNoncurrent','LongTermDebt']);
      const cfo=valueAt(facts,['NetCashProvidedByUsedInOperatingActivities']);
      const capex=valueAt(facts,['PaymentsToAcquirePropertyPlantAndEquipment','PaymentsToAcquireProductiveAssets']);
      const shares=valueAt(facts,['EntityCommonStockSharesOutstanding','CommonStockSharesOutstanding']);
      const price=priceById.get(Number(stock.id));
      const marketCap=price!=null&&shares!=null?price*shares:num(stock.market_cap);
      const debt=(debtCurrent||0)+(debtNonCurrent||0);
      const fcf=cfo!=null&&capex!=null?cfo-Math.abs(capex):null;
      const pe=price!=null&&eps!=null&&eps>0?price/eps:null;
      const ps=marketCap!=null&&revenue!=null&&revenue>0?marketCap/revenue:null;
      const pb=marketCap!=null&&equity!=null&&equity>0?marketCap/equity:null;
      const de=equity!=null&&equity!==0?debt/equity:null;
      const roe=net!=null&&equity!=null&&equity!==0?(net/equity)*100:null;
      const roa=net!=null&&assets!=null&&assets!==0?(net/assets)*100:null;
      const reportDate=revenueFacts[0]?.end||epsFacts[0]?.end||null;
      if(revenue==null&&net==null&&assets==null) return {stock,skip:'no-standardized-facts'};
      const fiscalPeriod=`annual-${revenueFacts[0]?.fy??epsFacts[0]?.fy??reportDate??'latest'}`;
      return {stock,row:{stock_id:Number(stock.id),fiscal_period:fiscalPeriod,market_cap:marketCap,enterprise_value:null,revenue,revenue_growth:growth(revenue,previousRevenue),gross_profit:gross,operating_income:op,net_income:net,eps,eps_growth:growth(eps,previousEps),pe_ratio:pe,forward_pe:null,peg_ratio:null,price_sales:ps,price_book:pb,debt_equity:de,roe,roa,free_cash_flow:fcf,dividend_yield:null,report_date:reportDate,data_source:'SEC EDGAR'}};
    }catch(error){return {stock,error:error.message};}
  }));
  for(const result of results){processed++;if(result.row)rows.push(result.row);else failures.push({symbol:result.stock.symbol,reason:result.skip||result.error});}
  if(offset+5<eligible.length) await sleep(1000);
}

for(const row of rows){
  await db('fundamentals',{method:'POST',params:{on_conflict:'stock_id,fiscal_period'},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});
}

console.log(JSON.stringify({mode:'fundamentals-sync',stocks:stocks?.length??0,eligible:eligible.length,processed,rows_written:rows.length,skipped_or_failed:failures.length,source:'SEC EDGAR companyfacts',mapping_source:'GitHub fallback',failures:failures.slice(0,20)},null,2));
if(rows.length===0) process.exitCode=1;
