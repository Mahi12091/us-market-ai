import { neon } from '@neondatabase/serverless';

const REQUIRED=['THREESPREAD_API_KEY2','NEON_DATABASE_URL'];
for(const n of REQUIRED) if(!process.env[n]) throw new Error(n+' is not configured.');

const THREE='https://api.3spread.com';
const sql=neon(process.env.NEON_DATABASE_URL);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DEEP_SYNC=process.env.SYNC_3SPREAD_METRICS_RATIOS==='true';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');

async function getJson(path){
  for(let attempt=1;attempt<=5;attempt++){
    const r=await fetch(THREE+path,{headers:{Accept:'application/json',apikey:process.env.THREESPREAD_API_KEY2}});
    const text=await r.text();
    let body={}; try{body=text?JSON.parse(text):{};}catch{}
    if(r.ok) return body;
    if(![408,429,500,502,503,504].includes(r.status)||attempt===5) throw new Error('3spread '+r.status+': '+text.slice(0,500));
    await sleep(r.status===429?65000:Math.min(30000,3000*2**(attempt-1)));
  }
  throw new Error('3spread request failed');
}

async function getAll(path){
  const rows=[]; let cursor=null; let guard=0;
  do{
    const u=new URL(THREE+path);
    if(cursor)u.searchParams.set('cursor',cursor);
    const body=await getJson(u.pathname+u.search);
    rows.push(...(Array.isArray(body?.data)?body.data:[]));
    const next=body?.next_cursor??body?.pagination?.next_cursor??null;
    if(!next||next===cursor||++guard>100)break;
    cursor=next;
  }while(cursor);
  return rows;
}

async function db(table,{method='GET',params={},body}={}){
  const ident=/^[A-Za-z_][A-Za-z0-9_]*$/;
  const qid=x=>{if(!ident.test(x))throw new Error('Unsafe identifier: '+x);return '"' + x + '"';};
  const values=[]; const filters=[];
  for(const [key,value] of Object.entries(params)){
    if(['select','limit','offset','order','on_conflict'].includes(key))continue;
    const m=String(value).match(/^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/); if(!m)continue;
    const [,op,raw]=m; const col=qid(key);
    if(op==='is') filters.push(raw==='null'?col+' IS NULL':raw==='true'?col+' IS TRUE':raw==='false'?col+' IS FALSE':'1=0');
    else if(op==='in'){
      const items=raw.replace(/^\(|\)$/g,'').split(',').filter(Boolean);
      const ph=items.map(item=>{values.push(item.replace(/^["']|["']$/g,''));return '$'+values.length;}).join(',');
      filters.push(col+' IN ('+(ph||'NULL')+')');
    }else{
      values.push(raw);
      filters.push(col+' '+({eq:'=',neq:'<>',gt:'>',gte:'>=',lt:'<',lte:'<='}[op])+' $'+values.length);
    }
  }
  if(method==='GET'){
    const cols=(params.select||'*')==='*'?'*':String(params.select).split(',').map(x=>qid(x.trim())).join(',');
    let q='SELECT '+cols+' FROM '+qid(table)+(filters.length?' WHERE '+filters.join(' AND '):'');
    if(params.order){
      q+=' ORDER BY '+String(params.order).split(',').map(part=>{const [col,dir]=part.split('.');return qid(col)+' '+(dir==='desc'?'DESC':'ASC');}).join(', ');
    }
    if(params.limit!=null)q+=' LIMIT '+Math.max(0,Number(params.limit));
    if(params.offset!=null)q+=' OFFSET '+Math.max(0,Number(params.offset));
    return await sql.query(q,values);
  }
  if(method==='POST'){
    const rows=Array.isArray(body)?body:[body||{}]; if(!rows.length)return [];
    const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))]; const vals=[];
    const tuples=rows.map(row=>'('+keys.map(k=>{vals.push(row[k]??null);return '$'+vals.length;}).join(',')+')').join(',');
    let q='INSERT INTO '+qid(table)+' ('+keys.map(qid).join(',')+') VALUES '+tuples;
    const conflict=String(params.on_conflict||'').split(',').map(x=>x.trim()).filter(Boolean);
    if(conflict.length){
      const updates=keys.filter(k=>!conflict.includes(k)).map(k=>qid(k)+'=EXCLUDED.'+qid(k)).join(',');
      q+=' ON CONFLICT ('+conflict.map(qid).join(',')+') DO '+(updates?'UPDATE SET '+updates:'NOTHING');
    }
    return await sql.query(q+' RETURNING *',vals);
  }
  if(method==='DELETE'){
    return await sql.query('DELETE FROM '+qid(table)+(filters.length?' WHERE '+filters.join(' AND '):'')+' RETURNING *',values);
  }
  throw new Error('Unsupported db method: '+method);
}

async function dbAll(table,params={},pageSize=500){
  const rows=[];
  for(let offset=0;;offset+=pageSize){
    const page=await db(table,{params:{...params,limit:pageSize,offset}});
    if(!Array.isArray(page)||!page.length) break;
    rows.push(...page);
    if(page.length<pageSize) break;
  }
  return rows;
}
function periodType(r){
  const p=String(r.period_type??r.period??'').toLowerCase();
  if(p.includes('quarter')) return 'quarterly';
  if(p.includes('semi')) return 'semi_annual';
  if(p.includes('nine') && p.includes('month')) return 'nine_month';
  if(p.includes('six') && p.includes('month')) return 'six_month';
  if(p.includes('three') && p.includes('month')) return 'three_month';
  if(p.includes('annual')||p==='fy') return 'annual';
  if(p.includes('ttm')||p.includes('trailing')) return 'ttm';
  if(p.includes('point')) return 'point_in_time';
  return p||'unknown';
}
function normalizedStatementType(st){
  const s=String(st||'').toLowerCase();
  if(s==='inc'||s.includes('income')) return 'income_statement';
  if(s==='bs'||s.includes('balance')) return 'balance_sheet';
  if(s==='cf'||s.includes('cash')) return 'cash_flow';
  return null;
}
function fiscalPeriod(r){
  const y=r.fiscal_year??String(r.period_end??'').slice(0,4);
  const q=r.fiscal_quarter;
  return y?('FY-'+y+(q?'-Q'+q:'')):String(r.period_end??'latest');
}
function collectLeaves(obj,path=[],out=[],meta={}) {
  if(obj==null) return out;
  if(Array.isArray(obj)){ for(const v of obj) collectLeaves(v,path,out,meta); return out; }
  if(typeof obj!=='object') {
    const n=num(obj);
    if(n!=null) out.push({key:path.map(norm).join('_'),value:n,label:meta.label??meta.name??meta.title??null,unit:meta.unit??null,currency:meta.currency??null});
    return out;
  }
  const local={...meta};
  for(const k of ['label','name','title','canonical_name','line_item','metric_name']) if(obj[k]!=null) local.label=String(obj[k]);
  if(obj.unit!=null) local.unit=String(obj.unit);
  if(obj.currency!=null) local.currency=String(obj.currency);
  for(const [k,v] of Object.entries(obj)) {
    if(['label','name','title','canonical_name','line_item','metric_name','unit','currency'].includes(k)) continue;
    collectLeaves(v,[...path,k],out,local);
  }
  return out;
}
const aliases={
 revenue:['revenue','revenues','sales','sales_revenue','total_revenue'],
 cost_of_revenue:['cost_of_revenue','cost_of_sales','cost_of_goods_sold'],
 gross_profit:['gross_profit'],
 operating_income:['operating_income','income_from_operations'],
 pretax_income:['pretax_income','income_before_tax'],
 net_income:['net_income','net_income_loss','net_income_attributable_to_parent'],
 eps_diluted:['eps_diluted','diluted_eps','earnings_per_share_diluted'],
 eps_basic:['eps_basic','basic_eps','earnings_per_share_basic'],
 shares_diluted:['shares_diluted','diluted_shares','weighted_average_shares_diluted'],
 shares_basic:['shares_basic','basic_shares','weighted_average_shares_basic'],
 cash_and_equivalents:['cash_and_equivalents','cash_and_cash_equivalents','cash_and_short_term_investments','cash'],
 total_assets:['total_assets','assets'],
 current_assets:['current_assets','total_current_assets'],
 total_liabilities:['total_liabilities','liabilities'],
 current_liabilities:['current_liabilities','total_current_liabilities'],
 total_debt:['total_debt','debt','debt_and_finance_leases'],
 shareholders_equity:['shareholders_equity','stockholders_equity','total_equity','equity'],
 operating_cash_flow:['operating_cash_flow','net_cash_operating','net_cash_provided_by_operating_activities','net_cash_provided_by_used_in_operating_activities','cash_from_operations'],
 capital_expenditure:['capital_expenditure','capital_expenditures','purchases_of_property_plant_and_equipment'],
 free_cash_flow:['free_cash_flow','fcf'],
 ebitda:['ebitda'],
 depreciation_amortization:['depreciation_amortization','depreciation_and_amortization','depreciation_depletion_and_amortization']
};
const reverse=new Map(Object.entries(aliases).flatMap(([dest,keys])=>keys.map(k=>[norm(k),dest])));

function extractFields(statementJson){
  const sections=statementJson?.sections;
  const out={};
  const pick=(section,keys)=>{
    const obj=sections?.[section];
    if(!obj) return null;
    for(const k of keys){ const v=obj?.[k]?.value; const n=num(v); if(n!=null) return n; }
    return null;
  };
  const direct={
    revenue:pick('revenue',['total_revenue','net_revenue']),
    gross_profit:pick('cost_and_expenses',['gross_profit']),
    operating_income:pick('cost_and_expenses',['operating_income']),
    pretax_income:pick('non_operating',['income_before_taxes','pretax_income']),
    net_income:pick('net_income',['net_income','net_income_to_common','net_income_to_parent']),
    eps_diluted:pick('per_share',['eps_diluted']), eps_basic:pick('per_share',['eps_basic']),
    shares_diluted:pick('per_share',['shares_diluted']), shares_basic:pick('per_share',['shares_basic']),
    cash_and_equivalents:pick('assets',['cash_and_equivalents']), total_assets:pick('assets',['total_assets']), current_assets:pick('assets',['total_current_assets']),
    total_liabilities:pick('liabilities',['total_liabilities']), current_liabilities:pick('liabilities',['total_current_liabilities']),
    shareholders_equity:pick('equity',['total_equity','total_common_equity']),
    total_debt:pick('liabilities',['total_borrowings','long_term_debt','short_term_borrowings']),
    operating_cash_flow:pick('operating',['net_cash_provided_by_used_in_operating_activities','net_cash_operating','cash_from_operations','operating_cash_flow']),
    capital_expenditure:pick('investing',['capital_expenditures','capital_expenditure','payments_to_acquire_property_plant_and_equipment','purchases_of_property_plant_and_equipment']),
    free_cash_flow:pick('operating',['free_cash_flow','fcf']), depreciation_amortization:pick('operating',['depreciation_and_amortization']),
    ebitda:pick('operating',['ebitda'])
  };
  for(const [k,v] of Object.entries(direct)) if(v!=null) out[k]=v;
  // Fallback for future/alternate statement shapes.
  if(Object.keys(out).length<2){
    const leaves=collectLeaves(statementJson); for(const x of leaves){
      const dest=reverse.get(norm(x.label||''))||reverse.get(norm(x.key));
      if(dest && out[dest]==null) out[dest]=x.value;
    }
  }
  return out;
}
function metricRows(data){
  return (Array.isArray(data?.data)?data.data:[]).filter(r=>r && r.period_end);
}
function ratioRows(data){
  return (Array.isArray(data?.data)?data.data:[]).filter(r=>r);
}
function latestByCategory(rows){
  const m=new Map();
  for(const r of rows){
    const k=norm(r.category);
    const old=m.get(k);
    if(!old || String(r.period_end)>String(old.period_end)) m.set(k,r);
  }
  return m;
}
function metricValue(map,names){
  for(const n of names){const r=map.get(norm(n));if(r)return num(r.value);}
  return null;
}
function statementLineItems(r){
  const sections=r?.statement_json?.sections;
  if(!sections || typeof sections!=='object') return [];
  const out=[];
  for(const [section,items] of Object.entries(sections)){
    if(!items || typeof items!=='object') continue;
    for(const [item_key,item] of Object.entries(items)){
      if(!item || typeof item!=='object') continue;
      out.push({section,item_key,label:item.label??item_key,value:num(item.value),source:item.source??null,members:item.members??null,raw_item:item});
    }
  }
  return out;
}
async function upsertRaw(table,row,conflict){
  await db(table,{method:'POST',params:{on_conflict:conflict},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});
}
async function upsertRawBatch(table,rows,conflict,chunkSize=500){
  for(let i=0;i<rows.length;i+=chunkSize){
    const chunk=rows.slice(i,i+chunkSize);
    if(!chunk.length) continue;
    await db(table,{method:'POST',params:{on_conflict:conflict},prefer:'resolution=merge-duplicates,return=minimal',body:chunk});
  }
}
function buildFundamental(stock, metrics, statements, quote, tl){
  const sorted=statements.slice().sort((a,b)=>String(b.period_end).localeCompare(String(a.period_end)));
  const inc=sorted.filter(r=>normalizedStatementType(r.statement_type)==='income_statement' && periodType(r)==='quarterly');
  const bs=sorted.filter(r=>normalizedStatementType(r.statement_type)==='balance_sheet' && periodType(r)==='point_in_time');
  const cf=sorted.filter(r=>normalizedStatementType(r.statement_type)==='cash_flow' && periodType(r)==='quarterly');
  const latestIncome=inc[0]||null, latestBalance=bs[0]||null, latestCf=cf[0]||null;
  if(!latestIncome && !latestBalance && !latestCf) return null;
  const fields=(r)=>r?extractFields(r.statement_json):{};
  const value=(f,names)=>{for(const n of names){if(f[n]!=null)return num(f[n]);}return null;};
  const inf=fields(latestIncome), bsf=fields(latestBalance), cff=fields(latestCf);
  const revenue=value(inf,['revenue']), gross=value(inf,['gross_profit']), op=value(inf,['operating_income']), net=value(inf,['net_income']);
  const ebitdaDirect=value(inf,['ebitda']);
  const da=value(cff,['depreciation_amortization']);
  const eps=value(inf,['eps_diluted','eps_basic']);
  const assets=value(bsf,['total_assets']), liabilities=value(bsf,['total_liabilities']), cash=value(bsf,['cash_and_equivalents']), debt=value(bsf,['total_debt']), equity=value(bsf,['shareholders_equity']);
  const cfo=value(cff,['operating_cash_flow']), capex0=value(cff,['capital_expenditure']);
  const capex=capex0==null?null:Math.abs(capex0);
  const fcf0=value(cff,['free_cash_flow']);
  const fcf=fcf0!=null?fcf0:(cfo!=null&&capex!=null?cfo-capex:null);
  const fy=num(latestIncome?.fiscal_year), fq=num(latestIncome?.fiscal_quarter);
  const latestDate=latestIncome?.period_end??latestBalance?.period_end??latestCf?.period_end;
  const fp=fiscalPeriod(latestIncome||latestBalance||latestCf);

  // Use 3spread statement rows for period alignment. Metrics are intentionally NOT
  // used for growth/TTM because the metrics endpoint can contain duplicate and
  // cumulative/YTD observations without a reliable period_type.
  const qIncome=inc.map(r=>({r,f:fields(r)}));
  const samePrev=qIncome.find(x=>num(x.r.fiscal_year)===fy-1 && num(x.r.fiscal_quarter)===fq);
  const prevRevenue=samePrev?value(samePrev.f,['revenue']):null;
  const prevEps=samePrev?value(samePrev.f,['eps_diluted','eps_basic']):null;
  const revenueGrowth=revenue!=null&&prevRevenue!=null&&prevRevenue!==0?(revenue/prevRevenue-1)*100:null;
  const epsGrowth=eps!=null&&prevEps!=null&&prevEps!==0?(eps/prevEps-1)*100:null;

  const latestFour=qIncome.filter(x=>String(x.r.period_end)<=String(latestDate)).slice(0,4);
  const ttmRevenue=latestFour.length===4 && latestFour.every(x=>value(x.f,['revenue'])!=null)
    ?latestFour.reduce((s,x)=>s+value(x.f,['revenue']),0):null;
  const ttmEps=latestFour.length===4 && latestFour.every(x=>value(x.f,['eps_diluted','eps_basic'])!=null)
    ?latestFour.reduce((s,x)=>s+value(x.f,['eps_diluted','eps_basic']),0):null;
  let ttmEbitda=null;
  if(latestFour.length===4){
    const ebitdaValues=latestFour.map(x=>{
      const direct=value(x.f,['ebitda']);
      if(direct!=null) return direct;
      const oi=value(x.f,['operating_income']);
      const cfRow=cf.find(r=>String(r.period_end)===String(x.r.period_end));
      const d=cfRow?value(fields(cfRow),['depreciation_amortization']):null;
      return oi!=null&&d!=null?oi+d:null;
    });
    if(ebitdaValues.every(v=>v!=null)) ttmEbitda=ebitdaValues.reduce((s,v)=>s+v,0);
  }

  const price=num(quote?.price);
  const marketCap=num(stock.market_cap)>0?num(stock.market_cap):null;
  const enterpriseValue=marketCap!=null&&debt!=null&&cash!=null?marketCap+debt-cash:null;
  const pe=price!=null&&ttmEps!=null&&ttmEps>0?price/ttmEps:null;
  const priceSales=marketCap!=null&&ttmRevenue!=null&&ttmRevenue>0?marketCap/ttmRevenue:null;
  const priceBook=marketCap!=null&&equity!=null&&equity>0?marketCap/equity:null;
  const earningsYield=price!=null&&ttmEps!=null&&price>0?ttmEps/price*100:null;
  const peg=pe!=null&&epsGrowth!=null&&epsGrowth>0?pe/epsGrowth:null;
  const evRevenue=enterpriseValue!=null&&ttmRevenue!=null&&ttmRevenue>0?enterpriseValue/ttmRevenue:null;
  const evEbitda=enterpriseValue!=null&&ttmEbitda!=null&&ttmEbitda>0?enterpriseValue/ttmEbitda:null;

  const out={stock_id:Number(stock.id),fiscal_period:fp,fiscal_year:fy,period_type:'quarterly',report_date:latestDate,data_source:'3spread',
    market_cap:marketCap,enterprise_value:enterpriseValue,revenue,revenue_growth:revenueGrowth,gross_profit:gross,operating_income:op,net_income:net,eps,eps_growth:epsGrowth,
    total_assets:assets,total_liabilities:liabilities,cash_and_equivalents:cash,total_debt:debt,shareholders_equity:equity,operating_cash_flow:cfo,capital_expenditure:capex,free_cash_flow:fcf,
    shares_outstanding:null,pe_ratio:pe,peg_ratio:peg,price_sales:priceSales,price_book:priceBook,enterprise_value_to_revenue:evRevenue,enterprise_value_to_ebitda:evEbitda,earnings_yield:earningsYield};
  if(revenue!=null&&gross!=null) out.gross_margin=gross/revenue*100;
  if(revenue!=null&&op!=null) out.operating_margin=op/revenue*100;
  if(revenue!=null&&net!=null) out.net_margin=net/revenue*100;
  if(revenue!=null&&fcf!=null) out.fcf_margin=fcf/revenue*100;
  if(equity!=null&&net!=null&&equity!==0) out.roe=net/equity*100;
  if(assets!=null&&net!=null&&assets!==0) out.roa=net/assets*100;
  if(equity!=null&&debt!=null&&equity!==0) out.debt_equity=debt/equity;
  return out;
}
function buildStatements(stock,rows){
  const result=[];
  for(const r of rows){
    const fields=extractFields(r.statement_json);
    if(Object.keys(fields).length===0) continue;
    const st=String(r.statement_type||'').toLowerCase();
    const statement_type=st.includes('bs')||st.includes('balance')?'balance_sheet':st.includes('cf')||st.includes('cash')?'cash_flow':'income_statement';
    const row={stock_id:stockId,statement_type,period_type:periodType(r),fiscal_period:fiscalPeriod(r),period_end:r.period_end??null,data_source:'3spread'};
    const normalizedFields={...fields}; delete normalizedFields.ebitda; delete normalizedFields.depreciation_amortization;
    Object.assign(row,normalizedFields);
    if(row.capital_expenditure!=null) row.capital_expenditure=Math.abs(row.capital_expenditure);
    if(row.operating_cash_flow!=null&&row.capital_expenditure!=null&&row.free_cash_flow==null) row.free_cash_flow=row.operating_cash_flow-row.capital_expenditure;
    if(row.revenue!=null||row.net_income!=null||row.total_assets!=null||row.operating_cash_flow!=null) result.push(row);
  }
  return result;
}
async function upsertNormalizedBatch(table,rows,conflict,chunkSize=500){
  for(let i=0;i<rows.length;i+=chunkSize){
    const chunk=rows.slice(i,i+chunkSize);
    if(!chunk.length) continue;
    await db(table,{
      method:'POST',
      params:{on_conflict:conflict},
      prefer:'resolution=merge-duplicates,return=minimal',
      body:chunk
    });
  }
}

const stocks=await dbAll('stocks',{select:'id,symbol,market_cap',is_active:'eq.true',order:'id.asc'},500);
if(!stocks?.length) throw new Error('No active stocks found.');

// Read existing 3spread fundamentals once instead of making one Supabase request per stock.
// This avoids hundreds of REST round-trips and greatly reduces the chance of Supabase 504s.
const existingFundamentals=await dbAll('fundamentals',{select:'stock_id',data_source:'eq.3spread',order:'stock_id.asc'},500);
const existing3spreadStocks=new Set((existingFundamentals||[]).map(r=>Number(r.stock_id)));

const summary=[];
for(const [index,stock] of stocks.entries()){
  console.log('[3spread] '+(index+1)+'/'+stocks.length+' '+String(stock.symbol).toUpperCase()+' start');
  const stockId=Number(stock.id);

  const symbol=String(stock.symbol).toUpperCase();

  // Skip stocks that already have 3spread normalized fundamental data.
  // This makes reruns/resumes fetch only missing stocks and avoids wasting API quota.
  if(existing3spreadStocks.has(stockId)){
    summary.push({symbol,ok:true,skipped:true,reason:'already has 3spread fundamental data'});
    continue;
  }
  try{
    // Statements are sufficient for normalized fundamentals and use far fewer API requests.
    // Metrics/ratios remain supported as an optional deep pass for later enrichment.
    const statements=await getAll('/v1/financials/statements?ticker='+encodeURIComponent(symbol)+'&version=latest&limit=10');
    const [metrics,ratios]=DEEP_SYNC?await Promise.all([
      getAll('/v1/financials/metrics?ticker='+encodeURIComponent(symbol)+'&version=latest&limit=10'),
      getAll('/v1/financials/ratios?ticker='+encodeURIComponent(symbol)+'&version=latest&limit=10')
    ]):[[],[]];

    // Source fetch succeeded. Upsert in bulk; never do one GET+PATCH per statement row.
    // Existing 3spread rows are preserved/updated by their unique keys.
    let rawStatements=0, rawMetrics=0, rawRatios=0, normalizedStatements=0, normalizedFundamentals=0;
    const rawStatementRows=[];
    const lineItemRows=[];
    const normalizedStatementRows=[];
    for(const r of statements){
      const raw={
        stock_id:Number(stock.id),ticker:symbol,block_id:r.block_id??null,filing_id:r.filing_id??null,cik:r.cik??null,
        form_type:r.form_type??null,accession_num:r.accession_num??null,source_url:r.source_url??null,
        accepted_time:r.accepted_time??null,statement_type:r.statement_type??null,spine:r.spine??null,
        spine_confidence:num(r.spine_confidence),spine_low_conf:num(r.spine_low_conf),period_of_report:r.period_of_report??null,
        period_end:r.period_end??null,period_length:num(r.period_length),period_type:r.period_type??null,
        fiscal_year:num(r.fiscal_year),fiscal_quarter:num(r.fiscal_quarter),filing_fiscal_year:num(r.filing_fiscal_year),
        is_comparative:r.is_comparative??null,derived:r.derived??null,is_valid:r.is_valid??null,
        score_composite:num(r.score_composite),scores:r.scores??null,currency:r.currency??null,
        statement_json:r.statement_json??null,raw_json:r
      };
      if(raw.block_id) rawStatementRows.push(raw);
      const lineItems=statementLineItems(r);
      for(const li of lineItems){
        lineItemRows.push({
          stock_id:stockId,ticker:symbol,block_id:r.block_id,filing_id:r.filing_id??null,
          statement_type:r.statement_type,section:li.section,item_key:li.item_key,label:li.label,
          value:li.value,source:li.source,members:li.members,currency:r.currency??null,
          period_end:r.period_end??null,period_type:r.period_type??null,fiscal_year:num(r.fiscal_year),
          fiscal_quarter:num(r.fiscal_quarter),raw_item:li.raw_item
        });
      }
      const fields=extractFields(r.statement_json);
      const statement_type=normalizedStatementType(r.statement_type);
      if(statement_type && Object.keys(fields).length){
        const row={stock_id:Number(stock.id),statement_type,period_type:periodType(r),fiscal_period:fiscalPeriod(r),period_end:r.period_end??null,data_source:'3spread'};
        const normalizedFields={...fields}; delete normalizedFields.ebitda; delete normalizedFields.depreciation_amortization;
        Object.assign(row,normalizedFields);
        if(row.capital_expenditure!=null) row.capital_expenditure=Math.abs(row.capital_expenditure);
        if(row.operating_cash_flow!=null&&row.capital_expenditure!=null&&row.free_cash_flow==null) row.free_cash_flow=row.operating_cash_flow-row.capital_expenditure;
        if(row.revenue!=null||row.net_income!=null||row.total_assets!=null||row.operating_cash_flow!=null) normalizedStatementRows.push(row);
      }
    }
    await upsertRawBatch('threespread_financial_statements',rawStatementRows,'stock_id,block_id');
    await upsertRawBatch('threespread_statement_line_items',lineItemRows,'stock_id,block_id,item_key');
    rawStatements=rawStatementRows.length;

    await upsertNormalizedBatch(
      'financial_statements',
      normalizedStatementRows,
      'stock_id,statement_type,period_type,fiscal_period'
    );
    normalizedStatements=normalizedStatementRows.length;

    const rawMetricRows=metrics.filter(r=>r?.category&&r?.period_end).map(r=>({
      stock_id:stockId,ticker:symbol,period_end:r.period_end??null,period_of_report:r.period_of_report??null,
      period_length:num(r.period_length),period_type:r.period_type??null,fiscal_year:num(r.fiscal_year),fiscal_quarter:num(r.fiscal_quarter),
      category:r.category??null,value:num(r.value),currency:r.currency??null,unit:r.unit??null,spine:r.spine??null,
      derived:r.derived??null,is_valid:r.is_valid??null,raw_json:r
    }));
    await upsertRawBatch('threespread_metrics',rawMetricRows,'stock_id,category,period_end,period_type');
    rawMetrics=rawMetricRows.length;

    const rawRatioRows=ratios.filter(r=>r?.ratio_name&&r?.period_end).map(r=>({
      stock_id:stockId,ticker:symbol,ratio_category:r.ratio_category??null,ratio_name:r.ratio_name??null,
      value:num(r.value),value_pctile:num(r.value_pctile),missing_inputs:r.missing_inputs??null,period_end:r.period_end??null,
      period_of_report:r.period_of_report??null,period_length:num(r.period_length),period_type:r.period_type??null,
      fiscal_year:num(r.fiscal_year),fiscal_quarter:num(r.fiscal_quarter),spine:r.spine??null,derived:r.derived??null,
      is_valid:r.is_valid??null,raw_json:r
    }));
    await upsertRawBatch('threespread_ratios',rawRatioRows,'stock_id,ratio_name,period_end,period_type');
    rawRatios=rawRatioRows.length;

    const quoteRows=await db('latest_quotes',{params:{select:'price',stock_id:'eq.'+stockId,limit:1}});
    const quote=quoteRows?.[0]??null;
      const fundamental=buildFundamental(stock,metrics,statements,quote,null);
    if(fundamental){
      await upsertNormalizedBatch('fundamentals',[fundamental],'stock_id,fiscal_period');
      normalizedFundamentals=1;
    }
    summary.push({symbol,ok:true,statement_api_rows:statements.length,metric_rows:metrics.length,ratio_rows:ratios.length,
      raw_statements:rawStatements,raw_metrics:rawMetrics,raw_ratios:rawRatios,
      normalized_statements:normalizedStatements,fundamental:!!fundamental,normalized_fundamentals:normalizedFundamentals});
  }catch(e){
    console.error('[3spread] '+symbol+' failed: '+e.message);
    summary.push({symbol,ok:false,error:e.message});
    if(String(e.message).includes('3spread 429')) {
      console.error('[3spread] Daily API quota reached; stopping cleanly so completed stocks remain intact.');
      break;
    }
  }
  console.log('[3spread] '+symbol+' done');
  await sleep(75);
}
const failed=summary.filter(x=>!x.ok).length;
const skipped=summary.filter(x=>x.skipped).length;
const completed=summary.filter(x=>x.ok&&!x.skipped).length;
console.log(JSON.stringify({
  source:'3spread',
  mode:DEEP_SYNC?'full-active-universe-deep':'full-active-universe-statements',
  total_stocks:stocks.length,
  completed,
  skipped,
  failed,
  summary
},null,2));
if(failed>0) process.exitCode=1;
