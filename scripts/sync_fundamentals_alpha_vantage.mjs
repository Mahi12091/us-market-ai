const required=['ALPHA_VANTAGE_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const n of required) if(!process.env[n]) throw new Error(`${n} is not configured.`);

const BASE='https://www.alphavantage.co/query';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const abs=v=>v==null?null:Math.abs(v);
const pct=(a,b)=>a!=null&&b!=null&&b!==0?(a/b)*100:null;
const growth=(a,b)=>a!=null&&b!=null&&b!==0?(a/b-1)*100:null;

async function getJson(fn,symbol){
  const u=new URL(BASE);
  u.searchParams.set('function',fn);
  u.searchParams.set('symbol',symbol);
  u.searchParams.set('apikey',process.env.ALPHA_VANTAGE_API_KEY);
  const r=await fetch(u,{headers:{Accept:'application/json'}});
  const text=await r.text();
  if(!r.ok) throw new Error(`Alpha Vantage HTTP ${r.status}: ${text.slice(0,400)}`);
  const data=text?JSON.parse(text):{};
  if(data['Error Message']) throw new Error(data['Error Message']);
  if(data['Note']) throw new Error(data['Note']);
  if(data['Information']) throw new Error(data['Information']);
  return data;
}

async function db(table,{method='GET',params={},body,prefer='return=representation'}={}){
  const u=new URL(`${process.env.SUPABASE_URL}/rest/v1/${table}`);
  for(const [k,v] of Object.entries(params)) u.searchParams.set(k,v);
  const r=await fetch(u,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});
  const text=await r.text();
  if(!r.ok) throw new Error(`Supabase ${r.status}: ${text}`);
  return text?JSON.parse(text):null;
}

function periodType(row){return String(row.fiscalDateEnding||'').length? 'annual':'annual';}
function fiscalLabel(row,period){return `${period||'FY'}-${String(row.fiscalDateEnding||'').slice(0,4)}`;}

function incomeRows(data,stockId){
  return [...(data.annualReports||[]),...(data.quarterlyReports||[])].map(r=>{
    const q=(data.quarterlyReports||[]).includes(r);
    return {
      stock_id:Number(stockId),statement_type:'income_statement',period_type:q?'quarterly':'annual',
      fiscal_period:fiscalLabel(r,q?'Q':'FY'),period_end:r.fiscalDateEnding||null,
      revenue:num(r.totalRevenue),cost_of_revenue:abs(num(r.costOfRevenue)),gross_profit:num(r.grossProfit),
      operating_income:num(r.operatingIncome),pretax_income:num(r.incomeBeforeTax),net_income:num(r.netIncome),
      eps_basic:num(r.reportedEPS),eps_diluted:num(r.reportedEPS),shares_basic:num(r.weightedAverageShsOut),
      shares_diluted:num(r.weightedAverageShsOutDil),data_source:'Alpha Vantage'
    };
  }).filter(r=>r.period_end&&(r.revenue!=null||r.net_income!=null||r.eps_diluted!=null));
}

function balanceRows(data,stockId){
  return [...(data.annualReports||[]),...(data.quarterlyReports||[])].map(r=>{
    const q=(data.quarterlyReports||[]).includes(r);
    const equity=num(r.totalShareholderEquity);
    return {
      stock_id:Number(stockId),statement_type:'balance_sheet',period_type:q?'quarterly':'annual',
      fiscal_period:fiscalLabel(r,q?'Q':'FY'),period_end:r.fiscalDateEnding||null,
      cash_and_equivalents:num(r.cashAndCashEquivalentsAtCarryingValue),
      total_assets:num(r.totalAssets),current_assets:num(r.totalCurrentAssets),
      total_liabilities:num(r.totalLiabilities),current_liabilities:num(r.totalCurrentLiabilities),
      total_debt:num(r.longTermDebtNoncurrent),shareholders_equity:equity,data_source:'Alpha Vantage'
    };
  }).filter(r=>r.period_end&&(r.total_assets!=null||r.total_liabilities!=null||r.shareholders_equity!=null));
}

function cashRows(data,stockId){
  return [...(data.annualReports||[]),...(data.quarterlyReports||[])].map(r=>{
    const q=(data.quarterlyReports||[]).includes(r);
    const cfo=num(r.operatingCashflow), capex=abs(num(r.capitalExpenditures));
    return {
      stock_id:Number(stockId),statement_type:'cash_flow',period_type:q?'quarterly':'annual',
      fiscal_period:fiscalLabel(r,q?'Q':'FY'),period_end:r.fiscalDateEnding||null,
      operating_cash_flow:cfo,capital_expenditure:capex,
      free_cash_flow:cfo!=null&&capex!=null?cfo-capex:null,data_source:'Alpha Vantage'
    };
  }).filter(r=>r.period_end&&(r.operating_cash_flow!=null||r.capital_expenditure!=null));
}

function fundamental(stock,price,inc,balance,cash){
  const annual=inc.filter(x=>x.period_type==='annual').sort((a,b)=>String(b.period_end).localeCompare(String(a.period_end)));
  const latest=annual[0],prev=annual[1];
  const b=balance.filter(x=>x.period_type==='annual').sort((a,b)=>String(b.period_end).localeCompare(String(a.period_end)))[0]||{};
  const cf=cash.filter(x=>x.period_type==='annual').sort((a,b)=>String(b.period_end).localeCompare(String(a.period_end)))[0]||{};
  if(!latest) return null;
  const revenue=latest.revenue, net=latest.net_income, gross=latest.gross_profit, op=latest.operating_income;
  const eps=latest.eps_diluted, shares=latest.shares_diluted;
  const marketCap=price!=null&&shares!=null?price*shares:null;
  const equity=b.shareholders_equity, assets=b.total_assets;
  const debt=b.total_debt;
  const fcf=cf.free_cash_flow;
  return {
    stock_id:Number(stock.id),fiscal_period:latest.fiscal_period,fiscal_year:Number(String(latest.period_end).slice(0,4))||null,
    period_type:'annual',market_cap:marketCap,revenue,revenue_growth:growth(revenue,prev?.revenue),
    gross_profit:gross,operating_income:op,net_income:net,eps,eps_growth:growth(eps,prev?.eps_diluted),
    pe_ratio:price!=null&&eps>0?price/eps:null,price_sales:marketCap!=null&&revenue>0?marketCap/revenue:null,
    price_book:marketCap!=null&&equity>0?marketCap/equity:null,debt_equity:equity!=null&&equity!==0?debt/equity:null,
    roe:pct(net,equity),roa:pct(net,assets),free_cash_flow:fcf,report_date:latest.period_end,
    gross_margin:pct(gross,revenue),operating_margin:pct(op,revenue),net_margin:pct(net,revenue),
    total_assets:assets,total_liabilities:b.total_liabilities,cash_and_equivalents:b.cash_and_equivalents,
    total_debt:debt,shareholders_equity:equity,current_assets:b.current_assets,current_liabilities:b.current_liabilities,
    operating_cash_flow:cf.operating_cash_flow,capital_expenditure:cf.capital_expenditure,fcf_margin:pct(fcf,revenue),
    shares_outstanding:shares,earnings_yield:eps!=null&&price>0?(eps/price)*100:null,data_source:'Alpha Vantage'
  };
}

const stocks=await db('stocks',{params:{select:'id,symbol,market_cap,asset_type',is_active:'eq.true',limit:5000}});
const quotes=await db('latest_quotes',{params:{select:'stock_id,price',limit:5000}});
const prices=new Map((quotes||[]).map(x=>[Number(x.stock_id),num(x.price)]));
const fallbackFile=process.env.FUNDAMENTALS_SYMBOLS_FILE||'.fmp_fallback_symbols.json';
let fallbackSymbols=[];
try{const fs=await import('node:fs/promises');fallbackSymbols=JSON.parse(await fs.readFile(fallbackFile,'utf8')).map(x=>String(x).toUpperCase());}catch(e){console.warn('No fallback list:',e.message);}
const bySymbol=new Map((stocks||[]).map(s=>[String(s.symbol).toUpperCase(),s]));
const existing=await db('fundamentals',{params:{select:'stock_id',limit:5000}});
const existingIds=new Set((existing||[]).map(x=>Number(x.stock_id)));
const candidates=fallbackSymbols.map(s=>bySymbol.get(s)).filter(Boolean).filter(s=>!existingIds.has(Number(s.id))).slice(0,7); // 7 stocks x 3 calls = 21/day; leaves quota headroom

const fundamentalRows=[],statementRows=[],ownershipRows=[],failures=[];
for(const stock of candidates){
  const symbol=String(stock.symbol).toUpperCase();
  try{
    // Alpha Vantage free keys enforce roughly 1 request/second.
    // Keep every request serialized with a safety gap; Promise.all would trigger burst throttling.
    await sleep(1200);
    const inc=await getJson('INCOME_STATEMENT',symbol);
    await sleep(1200);
    const balance=await getJson('BALANCE_SHEET',symbol);
    await sleep(1200);
    const cash=await getJson('CASH_FLOW',symbol);
    const rows=[
      ...incomeRows(inc,stock.id),...balanceRows(balance,stock.id),...cashRows(cash,stock.id)
    ];
    const f=fundamental(stock,prices.get(Number(stock.id)),rows.filter(x=>x.statement_type==='income_statement'),rows.filter(x=>x.statement_type==='balance_sheet'),rows.filter(x=>x.statement_type==='cash_flow'));
    if(f) fundamentalRows.push(f);
    statementRows.push(...rows);
    if(f?.shares_outstanding!=null&&f.report_date) ownershipRows.push({stock_id:Number(stock.id),period_end:f.report_date,shares_outstanding:f.shares_outstanding,data_source:'Alpha Vantage'});
  }catch(e){failures.push({symbol,reason:e.message});}
  await sleep(1200);
}

for(const row of fundamentalRows) await db('fundamentals',{method:'POST',params:{on_conflict:'stock_id,fiscal_period'},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});
for(const row of statementRows) await db('financial_statements',{method:'POST',params:{on_conflict:'stock_id,statement_type,period_type,fiscal_period'},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});
for(const row of ownershipRows) await db('ownership_snapshots',{method:'POST',params:{on_conflict:'stock_id,period_end'},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});

console.log(JSON.stringify({source:'Alpha Vantage',candidates:candidates.length,fundamentals_written:fundamentalRows.length,statement_rows_written:statementRows.length,ownership_rows_written:ownershipRows.length,failures},null,2));
