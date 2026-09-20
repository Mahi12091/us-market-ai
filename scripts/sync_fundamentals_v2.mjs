const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const n of required) if(!process.env[n]) throw new Error(`${n} is not configured.`);

const SEC='https://data.sec.gov';
const CIK_FALLBACK='https://raw.githubusercontent.com/jadchaar/sec-cik-mapper/main/mappings/stocks/ticker_to_cik.json';
const CONTACT_EMAIL=process.env.SEC_CONTACT_EMAIL||process.env.SEC_EMAIL||'';
const USER_AGENT=process.env.SEC_USER_AGENT||'US Market AI research bot';
if(!CONTACT_EMAIL) throw new Error('SEC_CONTACT_EMAIL is not configured. Add a contact email to GitHub repository secrets so SEC requests use a declared User-Agent.');
const DECLARED_USER_AGENT=`${USER_AGENT} ${CONTACT_EMAIL}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function getJson(url,headers={}){
  for(let attempt=1;attempt<=5;attempt++){
    const r=await fetch(url,{headers:{'User-Agent':DECLARED_USER_AGENT,'Accept':'application/json','Accept-Encoding':'gzip, deflate',...headers}});
    const text=await r.text();
    if(r.ok) return text?JSON.parse(text):{};
    if(![408,429,500,502,503,504].includes(r.status)||attempt===5) throw new Error(`HTTP ${r.status}: ${text.slice(0,500)}`);
    await sleep(r.status===429?10000:Math.min(2000*2**(attempt-1),15000));
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
function abs(v){return v==null?null:Math.abs(v);}
function ratio(a,b){return a!=null&&b!=null&&b!==0?a/b:null;}
function pct(a,b){const r=ratio(a,b);return r==null?null:r*100;}
function growth(current,previous){return current!=null&&previous!=null&&previous!==0?(current/previous-1)*100:null;}

function factRows(facts,tags,units=['USD','USD/shares','shares']){
  for(const tag of tags){
    const fact=facts?.facts?.['us-gaap']?.[tag]||facts?.facts?.dei?.[tag];
    if(!fact?.units) continue;
    for(const unit of units){
      const rows=(fact.units[unit]||[]).filter(x=>x?.val!=null&&x?.end);
      if(rows.length) return rows.map(x=>({...x,val:num(x.val)})).filter(x=>x.val!=null);
    }
  }
  return [];
}

function latestInstant(facts,tags,units=['USD','shares']){
  const rows=factRows(facts,tags,units).filter(x=>['10-K','10-Q','20-F','6-K'].includes(x.form));
  rows.sort((a,b)=>String(b.end).localeCompare(String(a.end))||String(b.filed||'').localeCompare(String(a.filed||'')));
  return rows[0]||null;
}

function durationDays(row){
  if(!row.start||!row.end) return null;
  const ms=Date.parse(row.end)-Date.parse(row.start);
  return Number.isFinite(ms)?Math.round(ms/86400000):null;
}

function uniqueByKey(rows,keyFn){
  const map=new Map();
  for(const row of rows){
    const key=keyFn(row);
    const existing=map.get(key);
    if(!existing || String(row.filed||'')>String(existing.filed||'')) map.set(key,row);
  }
  return [...map.values()];
}

function quarterlyRecords(facts,tags,units=['USD','USD/shares']){
  const rows=factRows(facts,tags,units)
    .filter(x=>['10-Q','10-K','20-F','6-K'].includes(x.form))
    .map(x=>({...x,duration:durationDays(x)}))
    .filter(x=>x.duration!=null && x.duration>=70 && x.duration<=110);
  return uniqueByKey(rows,x=>`${x.fy||''}|${x.fp||''}|${x.end}`)
    .sort((a,b)=>String(a.end).localeCompare(String(b.end)));
}

function annualRecords(facts,tags,units=['USD','USD/shares']){
  const rows=factRows(facts,tags,units)
    .filter(x=>['10-K','20-F'].includes(x.form))
    .map(x=>({...x,duration:durationDays(x)}))
    .filter(x=>x.duration==null || (x.duration>=300&&x.duration<=430));
  return uniqueByKey(rows,x=>`${x.fy||''}|${x.end}`)
    .sort((a,b)=>String(a.end).localeCompare(String(b.end)));
}

function valueForPeriod(records,end){ 
  const row=records.filter(x=>x.end===end).sort((a,b)=>String(b.filed||'').localeCompare(String(a.filed||'')))[0];
  return row?.val??null;
}

function statementPeriodKey(row,type){
  return `${type}|${row.end}`;
}

const TAGS={
  revenue:['RevenueFromContractWithCustomerExcludingAssessedTax','SalesRevenueNet','Revenues'],
  cost:['CostOfRevenue','CostOfGoodsAndServicesSold','CostOfGoodsSold'],
  gross:['GrossProfit'],
  operatingIncome:['OperatingIncomeLoss'],
  pretax:['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest','IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'],
  netIncome:['ProfitLoss','NetIncomeLoss','NetIncomeLossAvailableToCommonStockholdersBasic'],
  epsBasic:['EarningsPerShareBasic'],
  epsDiluted:['EarningsPerShareDiluted'],
  sharesBasic:['WeightedAverageNumberOfSharesOutstandingBasic'],
  sharesDiluted:['WeightedAverageNumberOfDilutedSharesOutstanding'],
  assets:['Assets'],
  currentAssets:['AssetsCurrent'],
  liabilities:['Liabilities'],
  currentLiabilities:['LiabilitiesCurrent'],
  debtCurrent:['LongTermDebtCurrent','ShortTermBorrowings','ShortTermDebt'],
  debtNonCurrent:['LongTermDebtNoncurrent','LongTermDebt','LongTermDebtAndFinanceLeaseObligationsNoncurrent'],
  equity:['StockholdersEquity','StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  cash:['CashAndCashEquivalentsAtCarryingValue','CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  cfo:['NetCashProvidedByUsedInOperatingActivities'],
  capex:['PaymentsToAcquirePropertyPlantAndEquipment','PaymentsToAcquireProductiveAssets']
};

function buildStatementRows(facts,stock,price){
  const rows=[];
  const getQ=(key,units)=>quarterlyRecords(facts,TAGS[key],units);
  const getA=(key,units)=>annualRecords(facts,TAGS[key],units);

  const incomeKeys=['revenue','cost','gross','operatingIncome','pretax','netIncome','epsBasic','epsDiluted','sharesBasic','sharesDiluted'];
  const qmaps=Object.fromEntries(incomeKeys.map(k=>[k,getQ(k,k.startsWith('eps')?['USD/shares']:k.startsWith('shares')?['shares']:['USD'])]));
  const ends=[...new Set(Object.values(qmaps).flat().map(x=>x.end))].sort().slice(-12);
  for(const end of ends){
    const q={};
    for(const k of incomeKeys) q[k]=valueForPeriod(qmaps[k],end);
    if(q.revenue==null&&q.netIncome==null&&q.epsDiluted==null) continue;
    rows.push({
      stock_id:Number(stock.id),statement_type:'income_statement',period_type:'quarterly',
      fiscal_period:`Q-${end}`,period_end:end,revenue:q.revenue,cost_of_revenue:abs(q.cost),gross_profit:q.gross,
      operating_income:q.operatingIncome,pretax_income:q.pretax,net_income:q.netIncome,eps_basic:q.epsBasic,
      eps_diluted:q.epsDiluted,shares_basic:q.sharesBasic,shares_diluted:q.sharesDiluted,
      data_source:'SEC EDGAR companyfacts'
    });
  }

  const annualMaps=Object.fromEntries(incomeKeys.map(k=>[k,getA(k,k.startsWith('eps')?['USD/shares']:k.startsWith('shares')?['shares']:['USD'])]));
  const annualEnds=[...new Set(Object.values(annualMaps).flat().map(x=>x.end))].sort().slice(-5);
  for(const end of annualEnds){
    const a={}; for(const k of incomeKeys) a[k]=valueForPeriod(annualMaps[k],end);
    if(a.revenue==null&&a.netIncome==null&&a.epsDiluted==null) continue;
    rows.push({
      stock_id:Number(stock.id),statement_type:'income_statement',period_type:'annual',
      fiscal_period:`FY-${end}`,period_end:end,revenue:a.revenue,cost_of_revenue:abs(a.cost),gross_profit:a.gross,
      operating_income:a.operatingIncome,pretax_income:a.pretax,net_income:a.netIncome,eps_basic:a.epsBasic,
      eps_diluted:a.epsDiluted,shares_basic:a.sharesBasic,shares_diluted:a.sharesDiluted,
      data_source:'SEC EDGAR companyfacts'
    });
  }

  const instantKeys=['assets','currentAssets','liabilities','currentLiabilities','debtCurrent','debtNonCurrent','equity','cash'];
  const imaps=Object.fromEntries(instantKeys.map(k=>[k,factRows(facts,TAGS[k],['USD','shares'])]));
  const instantEnds=[...new Set(Object.values(imaps).flat().filter(x=>['10-Q','10-K','20-F','6-K'].includes(x.form)).map(x=>x.end))].sort().slice(-12);
  for(const end of instantEnds){
    const b={}; for(const k of instantKeys) b[k]=valueForPeriod(imaps[k],end);
    if(b.assets==null&&b.liabilities==null&&b.equity==null&&b.cash==null) continue;
    const debt=(b.debtCurrent||0)+(b.debtNonCurrent||0);
    rows.push({
      stock_id:Number(stock.id),statement_type:'balance_sheet',period_type:'quarterly',
      fiscal_period:`Q-${end}`,period_end:end,cash_and_equivalents:b.cash,total_assets:b.assets,
      current_assets:b.currentAssets,total_liabilities:b.liabilities,current_liabilities:b.currentLiabilities,
      total_debt:debt,shareholders_equity:b.equity,data_source:'SEC EDGAR companyfacts'
    });
  }

  const cashKeys=['cfo','capex'];
  const cmaps=Object.fromEntries(cashKeys.map(k=>[k,quarterlyRecords(facts,TAGS[k],['USD'])]));
  const cashEnds=[...new Set(Object.values(cmaps).flat().map(x=>x.end))].sort().slice(-12);
  for(const end of cashEnds){
    const c={}; for(const k of cashKeys) c[k]=valueForPeriod(cmaps[k],end);
    if(c.cfo==null&&c.capex==null) continue;
    const fcf=c.cfo!=null&&c.capex!=null?c.cfo-abs(c.capex):null;
    rows.push({
      stock_id:Number(stock.id),statement_type:'cash_flow',period_type:'quarterly',
      fiscal_period:`Q-${end}`,period_end:end,operating_cash_flow:c.cfo,
      capital_expenditure:abs(c.capex),free_cash_flow:fcf,data_source:'SEC EDGAR companyfacts'
    });
  }

  return rows;
}

function buildFundamentalRows(facts,stock,price){
  const revenue=annualRecords(facts,TAGS.revenue,['USD']);
  const eps=annualRecords(facts,TAGS.epsDiluted,['USD/shares']);
  const latestRevenue=revenue.at(-1)?.val??null, previousRevenue=revenue.at(-2)?.val??null;
  const latestEps=eps.at(-1)?.val??null, previousEps=eps.at(-2)?.val??null;
  const latestEnd=revenue.at(-1)?.end||eps.at(-1)?.end||null;
  const net=annualRecords(facts,TAGS.netIncome,['USD']).at(-1)?.val??null;
  const gross=annualRecords(facts,TAGS.gross,['USD']).at(-1)?.val??null;
  const op=annualRecords(facts,TAGS.operatingIncome,['USD']).at(-1)?.val??null;
  const assets=latestInstant(facts,TAGS.assets,['USD'])?.val??null;
  const liabilities=latestInstant(facts,TAGS.liabilities,['USD'])?.val??null;
  const equity=latestInstant(facts,TAGS.equity,['USD'])?.val??null;
  const cash=latestInstant(facts,TAGS.cash,['USD'])?.val??null;
  const currentAssets=latestInstant(facts,TAGS.currentAssets,['USD'])?.val??null;
  const currentLiabilities=latestInstant(facts,TAGS.currentLiabilities,['USD'])?.val??null;
  const debtCurrent=latestInstant(facts,TAGS.debtCurrent,['USD'])?.val??null;
  const debtNonCurrent=latestInstant(facts,TAGS.debtNonCurrent,['USD'])?.val??null;
  const cfo=annualRecords(facts,TAGS.cfo,['USD']).at(-1)?.val??null;
  const capex=annualRecords(facts,TAGS.capex,['USD']).at(-1)?.val??null;
  const shares=latestInstant(facts,['EntityCommonStockSharesOutstanding','CommonStockSharesOutstanding'],['shares'])?.val??null;
  const debt=(debtCurrent||0)+(debtNonCurrent||0);
  const fcf=cfo!=null&&capex!=null?cfo-abs(capex):null;
  const marketCap=price!=null&&shares!=null?price*shares:num(stock.market_cap);
  if(latestRevenue==null&&net==null&&assets==null) return null;
  const fiscalYear=Number(revenue.at(-1)?.fy||eps.at(-1)?.fy)||null;
  return {
    stock_id:Number(stock.id),fiscal_period:`annual-${fiscalYear||latestEnd||'latest'}`,fiscal_year:fiscalYear,period_type:'annual',
    market_cap:marketCap,enterprise_value:null,revenue:latestRevenue,revenue_growth:growth(latestRevenue,previousRevenue),
    gross_profit:gross,operating_income:op,net_income:net,eps:latestEps,eps_growth:growth(latestEps,previousEps),
    pe_ratio:price!=null&&latestEps>0?price/latestEps:null,forward_pe:null,peg_ratio:null,
    price_sales:marketCap!=null&&latestRevenue>0?marketCap/latestRevenue:null,
    price_book:marketCap!=null&&equity>0?marketCap/equity:null,
    debt_equity:equity!=null&&equity!==0?debt/equity:null,
    roe:pct(net,equity),roa:pct(net,assets),free_cash_flow:fcf,dividend_yield:null,report_date:latestEnd,
    gross_margin:pct(gross,latestRevenue),operating_margin:pct(op,latestRevenue),net_margin:pct(net,latestRevenue),
    total_assets:assets,total_liabilities:liabilities,cash_and_equivalents:cash,total_debt:debt,
    shareholders_equity:equity,current_assets:currentAssets,current_liabilities:currentLiabilities,
    operating_cash_flow:cfo,capital_expenditure:abs(capex),fcf_margin:pct(fcf,latestRevenue),
    shares_outstanding:shares,enterprise_value_to_revenue:null,enterprise_value_to_ebitda:null,
    earnings_yield:latestEps!=null&&price>0?(latestEps/price)*100:null,data_source:'SEC EDGAR'
  };
}

const stocks=await db('stocks',{params:{select:'id,symbol,market_cap,asset_type',is_active:'eq.true',limit:5000}});
const quotes=await db('latest_quotes',{params:{select:'stock_id,price',limit:5000}});
const priceById=new Map((quotes||[]).map(q=>[Number(q.stock_id),num(q.price)]));

let tickerMap=new Map();
try{
  const raw=await getJson(CIK_FALLBACK);
  tickerMap=new Map(Object.entries(raw||{}).map(([ticker,cik])=>[String(ticker).toUpperCase(),String(cik).padStart(10,'0')]).filter(([t,c])=>t&&c!=='0000000000'));
  if(tickerMap.size<100) throw new Error(`unexpected mapping size ${tickerMap.size}`);
}catch(e){throw new Error(`Unable to load ticker/CIK mapping fallback: ${e.message}`);}

const eligible=(stocks||[]).filter(s=>s.symbol&&String(s.asset_type||'stock')==='stock');
const fundamentalRows=[];const statementRows=[];const ownershipRows=[];const failures=[];let processed=0;
await db('ownership_snapshots',{method:'DELETE',params:{id:'not.is.null'},prefer:'return=minimal'});

for(const stock of eligible){
  processed++;
  const symbol=String(stock.symbol).toUpperCase();
  const cik=tickerMap.get(symbol);
  if(!cik){failures.push({symbol,reason:'no-sec-cik'});continue;}
  try{
    const facts=await getJson(`${SEC}/api/xbrl/companyfacts/CIK${cik}.json`);
    const price=priceById.get(Number(stock.id));
    const fundamental=buildFundamentalRows(facts,stock,price);
    const statements=buildStatementRows(facts,stock,price);
    if(fundamental) { fundamentalRows.push(fundamental); if(fundamental.shares_outstanding!=null && fundamental.report_date) ownershipRows.push({stock_id:Number(stock.id),period_end:fundamental.report_date,shares_outstanding:fundamental.shares_outstanding,data_source:'SEC EDGAR companyfacts'}); }
    statementRows.push(...statements);
    if(!fundamental&&!statements.length) failures.push({symbol,reason:'no-standardized-facts'});
  }catch(error){failures.push({symbol,reason:error.message});}
  await sleep(750);
}

for(const row of fundamentalRows){
  await db('fundamentals',{method:'POST',params:{on_conflict:'stock_id,fiscal_period'},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});
}

for(const row of statementRows){
  await db('financial_statements',{method:'POST',params:{on_conflict:'stock_id,statement_type,period_type,fiscal_period'},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});
}

for(const row of ownershipRows){
  await db('ownership_snapshots',{method:'POST',body:[row],prefer:'return=minimal'});
}

console.log(JSON.stringify({
  mode:'sec-fundamentals-and-statements-sync',
  stocks:stocks?.length??0,eligible:eligible.length,processed,
  fundamentals_written:fundamentalRows.length,financial_statement_rows_written:statementRows.length,
  ownership_rows_written:ownershipRows.length,
  skipped_or_failed:failures.length,source:'SEC EDGAR companyfacts',mapping_source:'GitHub fallback',
  user_agent_declared:true,failures:failures.slice(0,20)
},null,2));

if(fundamentalRows.length===0&&statementRows.length===0) console.warn('No SEC fundamentals/statements were written; continuing without failing the workflow.');
