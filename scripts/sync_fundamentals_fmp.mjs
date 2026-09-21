const required=['FMP_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const n of required) if(!process.env[n]) throw new Error(`${n} is not configured.`);

const BASE='https://financialmodelingprep.com/stable';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const abs=v=>v==null?null:Math.abs(v);
const ratio=(a,b)=>a!=null&&b!=null&&b!==0?a/b:null;
const pct=(a,b)=>{const r=ratio(a,b);return r==null?null:r*100;};
const growth=(a,b)=>a!=null&&b!=null&&b!==0?(a/b-1)*100:null;

async function getJson(path){
  const u=new URL(`${BASE}/${path}`);
  u.searchParams.set('apikey',process.env.FMP_API_KEY);
  for(let attempt=1;attempt<=3;attempt++){
    const r=await fetch(u,{headers:{Accept:'application/json'}});
    const text=await r.text();
    if(r.ok){
      const data=text?JSON.parse(text):[];
      return Array.isArray(data)?data:(data?.data||[]);
    }
    if([429,500,502,503,504].includes(r.status)&&attempt<3){await sleep(1500*attempt);continue;}
    throw new Error(`FMP HTTP ${r.status}: ${text.slice(0,400)}`);
  }
  return [];
}

async function db(table,{method='GET',params={},body,prefer='return=representation'}={}){
  const u=new URL(`${process.env.SUPABASE_URL}/rest/v1/${table}`);
  for(const [k,v] of Object.entries(params)) u.searchParams.set(k,v);
  const r=await fetch(u,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});
  const text=await r.text();
  if(!r.ok) throw new Error(`Supabase ${r.status}: ${text}`);
  return text?JSON.parse(text):null;
}

function firstDefined(...values){return values.find(v=>v!=null&&v!=='')??null;}
function fiscalLabel(row){
  const period=String(row.period||row.fiscalPeriod||'').toUpperCase();
  const fy=row.fiscalYear||row.calendarYear||row.year||'';
  return fy?(`${period||'FY'}-${fy}`):String(row.date||row.filingDate||'latest');
}

function normalizeIncome(row,stockId){
  const revenue=num(firstDefined(row.revenue,row.sales));
  const gross=num(row.grossProfit);
  const op=num(firstDefined(row.operatingIncome,row.operatingIncomeLoss));
  const net=num(firstDefined(row.netIncome,row.netIncomeLoss));
  const eps=num(firstDefined(row.epsDiluted,row.eps));
  const shares=num(firstDefined(row.weightedAverageShsOutDil,row.weightedAverageShsOut));
  if(revenue==null&&net==null&&eps==null) return null;
  return {
    stock_id:Number(stockId),statement_type:'income_statement',
    period_type:String(row.period||'FY').toUpperCase().startsWith('Q')?'quarterly':'annual',
    fiscal_period:fiscalLabel(row),period_end:row.date||row.filingDate||null,
    revenue,cost_of_revenue:abs(num(row.costOfRevenue)),gross_profit:gross,
    operating_income:op,pretax_income:num(firstDefined(row.incomeBeforeTax,row.pretaxIncome)),
    net_income:net,eps_basic:num(row.eps),eps_diluted:eps,
    shares_basic:num(row.weightedAverageShsOut),shares_diluted:shares,
    data_source:'FMP'
  };
}

function normalizeBalance(row,stockId){
  const assets=num(row.totalAssets), liabilities=num(row.totalLiabilities), equity=num(firstDefined(row.totalStockholdersEquity,row.totalEquity));
  const cash=num(firstDefined(row.cashAndCashEquivalents,row.cashAndShortTermInvestments));
  if(assets==null&&liabilities==null&&equity==null&&cash==null) return null;
  const debt=num(firstDefined(row.totalDebt,row.netDebt));
  return {
    stock_id:Number(stockId),statement_type:'balance_sheet',
    period_type:String(row.period||'FY').toUpperCase().startsWith('Q')?'quarterly':'annual',
    fiscal_period:fiscalLabel(row),period_end:row.date||row.filingDate||null,
    cash_and_equivalents:cash,total_assets:assets,current_assets:num(row.totalCurrentAssets),
    total_liabilities:liabilities,current_liabilities:num(row.totalCurrentLiabilities),
    total_debt:debt,shareholders_equity:equity,data_source:'FMP'
  };
}

function normalizeCash(row,stockId){
  const cfo=num(firstDefined(row.operatingCashFlow,row.netCashProvidedByOperatingActivities));
  const capex=abs(num(firstDefined(row.capitalExpenditure,row.investmentsInPropertyPlantAndEquipment)));
  if(cfo==null&&capex==null) return null;
  return {
    stock_id:Number(stockId),statement_type:'cash_flow',
    period_type:String(row.period||'FY').toUpperCase().startsWith('Q')?'quarterly':'annual',
    fiscal_period:fiscalLabel(row),period_end:row.date||row.filingDate||null,
    operating_cash_flow:cfo,capital_expenditure:capex,
    free_cash_flow:cfo!=null&&capex!=null?cfo-capex:null,data_source:'FMP'
  };
}

function buildFundamental(stock,price,inc,balance,cash){
  const latest=inc[0]||{};
  const prev=inc[1]||{};
  const revenue=num(latest.revenue), previousRevenue=num(prev.revenue);
  const eps=num(firstDefined(latest.epsDiluted,latest.eps)), previousEps=num(firstDefined(prev.epsDiluted,prev.eps));
  const net=num(latest.netIncome), gross=num(latest.grossProfit), op=num(latest.operatingIncome);
  const b=balance[0]||{};
  const c=cash[0]||{};
  const equity=num(b.totalStockholdersEquity??b.totalEquity);
  const assets=num(b.totalAssets), liabilities=num(b.totalLiabilities);
  const cashValue=num(firstDefined(b.cashAndCashEquivalents,b.cashAndShortTermInvestments));
  const debt=num(firstDefined(b.totalDebt,b.netDebt));
  const shares=num(firstDefined(latest.weightedAverageShsOutDil,latest.weightedAverageShsOut,b.numberOfShares));
  const marketCap=price!=null&&shares!=null?price*shares:null;
  const fcf=num(c.freeCashFlow);
  if(revenue==null&&net==null&&assets==null) return null;
  return {
    stock_id:Number(stock.id),fiscal_period:fiscalLabel(latest),fiscal_year:num(latest.calendarYear||latest.fiscalYear),
    period_type:String(latest.period||'FY').toUpperCase().startsWith('Q')?'quarterly':'annual',
    market_cap:marketCap,enterprise_value:num(firstDefined(latest.enterpriseValue,b.enterpriseValue)),
    revenue,revenue_growth:growth(revenue,previousRevenue),gross_profit:gross,operating_income:op,net_income:net,
    eps,eps_growth:growth(eps,previousEps),
    pe_ratio:num(firstDefined(latest.peRatio,latest.pe)),forward_pe:null,peg_ratio:num(latest.pegRatio),
    price_sales:marketCap!=null&&revenue>0?marketCap/revenue:null,
    price_book:marketCap!=null&&equity>0?marketCap/equity:null,
    debt_equity:equity!=null&&equity!==0?debt/equity:null,roe:pct(net,equity),roa:pct(net,assets),
    free_cash_flow:fcf,dividend_yield:num(latest.dividendYield),report_date:latest.date||latest.filingDate||null,
    gross_margin:pct(gross,revenue),operating_margin:pct(op,revenue),net_margin:pct(net,revenue),
    total_assets:assets,total_liabilities:liabilities,cash_and_equivalents:cashValue,total_debt:debt,
    shareholders_equity:equity,current_assets:num(b.totalCurrentAssets),current_liabilities:num(b.totalCurrentLiabilities),
    operating_cash_flow:num(c.operatingCashFlow),capital_expenditure:abs(num(c.capitalExpenditure)),
    fcf_margin:pct(fcf,revenue),shares_outstanding:shares,
    enterprise_value_to_revenue:num(latest.evToSales),enterprise_value_to_ebitda:num(latest.evToEbitda),
    earnings_yield:eps!=null&&price>0?(eps/price)*100:null,data_source:'FMP'
  };
}

const stocks=await db('stocks',{params:{select:'id,symbol,market_cap,asset_type',is_active:'eq.true',limit:5000}});
const quotes=await db('latest_quotes',{params:{select:'stock_id,price',limit:5000}});
const prices=new Map((quotes||[]).map(x=>[Number(x.stock_id),num(x.price)]));
const eligible=(stocks||[]).filter(s=>s.symbol&&String(s.asset_type||'stock')==='stock');

const existing=await db('fundamentals',{params:{select:'stock_id',limit:5000}});
const existingIds=new Set((existing||[]).map(x=>Number(x.stock_id)));
const candidates=eligible.filter(s=>!existingIds.has(Number(s.id)));
const batch=candidates.slice(0,70); // 3 statement calls/stock = 210 calls/day max; leaves quota headroom
const successfulSymbols=new Set();
const fundamentalRows=[],statementRows=[],ownershipRows=[],fallbackSymbols=[],failures=[];

for(const stock of batch){
  const symbol=String(stock.symbol).toUpperCase();
  try{
    const [inc,balance,cash]=await Promise.all([
      getJson(`income-statement?symbol=${encodeURIComponent(symbol)}&limit=5&period=annual`),
      getJson(`balance-sheet-statement?symbol=${encodeURIComponent(symbol)}&limit=5&period=annual`),
      getJson(`cash-flow-statement?symbol=${encodeURIComponent(symbol)}&limit=5&period=annual`)
    ]);
    const fundamental=buildFundamental(stock,prices.get(Number(stock.id)),inc,balance,cash);
    if(!fundamental){fallbackSymbols.push(symbol);continue;}
    successfulSymbols.add(symbol);
    fundamentalRows.push(fundamental);
    statementRows.push(...[
      ...inc.map(r=>normalizeIncome(r,stock.id)),
      ...balance.map(r=>normalizeBalance(r,stock.id)),
      ...cash.map(r=>normalizeCash(r,stock.id))
    ].filter(Boolean));
    if(fundamental.shares_outstanding!=null&&fundamental.report_date){
      ownershipRows.push({stock_id:Number(stock.id),period_end:fundamental.report_date,shares_outstanding:fundamental.shares_outstanding,data_source:'FMP'});
    }
  }catch(e){
    fallbackSymbols.push(symbol);
    failures.push({symbol,reason:e.message});
    if(/FMP HTTP 429/i.test(e.message) && /Limit Reach/i.test(e.message)){
      quotaExhausted=true;
      break;
    }
  }
  await sleep(150);
}

// Anything not attempted today remains in the fallback queue for SEC/Alpha.
for(const stock of eligible){
  const symbol=String(stock.symbol).toUpperCase();
  if(!successfulSymbols.has(symbol) && !fallbackSymbols.includes(symbol)) fallbackSymbols.push(symbol);
}
await import('node:fs/promises').then(fs=>fs.writeFile('.fmp_fallback_symbols.json',JSON.stringify(fallbackSymbols)));

for(const row of fundamentalRows){
  await db('fundamentals',{method:'POST',params:{on_conflict:'stock_id,fiscal_period'},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});
}
for(const row of statementRows){
  await db('financial_statements',{method:'POST',params:{on_conflict:'stock_id,statement_type,period_type,fiscal_period'},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});
}
for(const row of ownershipRows){
  await db('ownership_snapshots',{method:'POST',params:{on_conflict:'stock_id,period_end'},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});
}

await import('node:fs/promises').then(fs=>fs.writeFile('.fmp_fallback_symbols.json',JSON.stringify(fallbackSymbols)));

console.log(JSON.stringify({
  source:'FMP',eligible:eligible.length,candidates:candidates.length,batch_processed:batch.length,fundamentals_written:fundamentalRows.length,
  statement_rows_written:statementRows.length,ownership_rows_written:ownershipRows.length,
  quota_exhausted:quotaExhausted,
  fallback_to_sec:fallbackSymbols.length,fallback_symbols:fallbackSymbols.slice(0,100),
  failures:failures.slice(0,20)
},null,2));
