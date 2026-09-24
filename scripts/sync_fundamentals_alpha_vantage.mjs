import { neon } from '@neondatabase/serverless';

const required=['ALPHA_VANTAGE_API_KEY','NEON_DATABASE_URL'];
for(const n of required) if(!process.env[n]) throw new Error(`${n} is not configured.`);

const sql=neon(process.env.NEON_DATABASE_URL);
const db=async(table,{method='GET',params={},body}={})=>{
  const ident=/^[A-Za-z_][A-Za-z0-9_]*$/; const qid=x=>{if(!ident.test(x))throw new Error('Unsafe identifier: '+x);return '"'+x+'"';};
  const filters=[],values=[];
  for(const [k,v] of Object.entries(params)){
    if(['select','limit','offset','order','on_conflict'].includes(k))continue;
    const m=String(v).match(/^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/);if(!m)continue;
    const [,op,raw]=m, col=qid(k);
    if(op==='is')filters.push(raw==='null'?col+' IS NULL':raw==='true'?col+' IS TRUE':raw==='false'?col+' IS FALSE':'1=0');
    else if(op==='in'){const items=raw.replace(/^\(|\)$/g,'').split(',').filter(Boolean);const ph=items.map(x=>{values.push(x.replace(/^["']|["']$/g,''));return '$'+values.length;}).join(',');filters.push(col+' IN ('+(ph||'NULL')+')');}
    else{values.push(raw);filters.push(col+' '+({eq:'=',neq:'<>',gt:'>',gte:'>=',lt:'<',lte:'<='}[op])+' $'+values.length);}
  }
  const where=filters.length?' WHERE '+filters.join(' AND '):'';
  if((method||'GET')==='GET'){const cols=(params.select||'*')==='*'?'*':String(params.select).split(',').map(x=>qid(x.trim())).join(',');let q='SELECT '+cols+' FROM '+qid(table)+where;if(params.order)q+=' ORDER BY '+String(params.order).split(',').map(part=>{const [col,dir]=part.split('.');return qid(col)+' '+(dir==='desc'?'DESC':'ASC');}).join(', ');if(params.limit!=null)q+=' LIMIT '+Math.max(0,Number(params.limit));if(params.offset!=null)q+=' OFFSET '+Math.max(0,Number(params.offset));return await sql.query(q,values);}
  if((method||'GET')==='POST'){const rows=Array.isArray(body)?body:[body||{}];if(!rows.length)return[];const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];const vals=[];const tuples=rows.map(row=>'('+keys.map(k=>{vals.push(row[k]??null);return '$'+vals.length;}).join(',')+')').join(',');let q='INSERT INTO '+qid(table)+' ('+keys.map(qid).join(',')+') VALUES '+tuples;const conflict=String(params.on_conflict||'').split(',').map(x=>x.trim()).filter(Boolean);if(conflict.length){const updates=keys.filter(k=>!conflict.includes(k)).map(k=>qid(k)+'=EXCLUDED.'+qid(k)).join(',');q+=' ON CONFLICT ('+conflict.map(qid).join(',')+') DO '+(updates?'UPDATE SET '+updates:'NOTHING');}return await sql.query(q+' RETURNING *',vals);}
  throw new Error('Unsupported method '+method);
};


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
