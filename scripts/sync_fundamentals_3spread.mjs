const REQUIRED=['THREESPREAD_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const n of REQUIRED) if(!process.env[n]) throw new Error(n+' is not configured.');

const THREE='https://api.3spread.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');

async function getJson(path){
  const r=await fetch(THREE+path,{headers:{Accept:'application/json',apikey:process.env.THREESPREAD_API_KEY}});
  const text=await r.text();
  let body={}; try{body=text?JSON.parse(text):{};}catch{}
  if(!r.ok) throw new Error('3spread '+r.status+': '+text.slice(0,500));
  return body;
}
async function db(table,{method='GET',params={},body,prefer='return=representation'}={}){
  const u=new URL(process.env.SUPABASE_URL+'/rest/v1/'+table);
  for(const [k,v] of Object.entries(params)) u.searchParams.set(k,v);
  const r=await fetch(u,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});
  const text=await r.text(); if(!r.ok) throw new Error('Supabase '+r.status+': '+text);
  return text?JSON.parse(text):null;
}
function periodType(r){
  const p=String(r.period_type??r.period??'').toLowerCase();
  if(p.includes('quarter')) return 'quarterly';
  if(p.includes('semi')) return 'semi_annual';
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
 operating_cash_flow:['operating_cash_flow','net_cash_provided_by_operating_activities','cash_from_operations'],
 capital_expenditure:['capital_expenditure','capital_expenditures','purchases_of_property_plant_and_equipment'],
 free_cash_flow:['free_cash_flow','fcf']
};
const reverse=new Map(Object.entries(aliases).flatMap(([dest,keys])=>keys.map(k=>[norm(k),dest])));

function extractFields(statementJson){
  const leaves=collectLeaves(statementJson);
  const out={};
  for(const x of leaves){
    const candidates=[x.key,x.label||''].flatMap(v=>String(v).split(/[.\s/:-]+/).map(norm));
    const joined=candidates.filter(Boolean).join('_');
    const direct=reverse.get(norm(x.key))||reverse.get(norm(x.label||''))||reverse.get(joined);
    if(direct && out[direct]==null) out[direct]=x.value;
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
function buildFundamental(stock, metrics){
  const map=latestByCategory(metrics);
  const revenue=metricValue(map,['revenue','revenues','sales']);
  const gross=metricValue(map,['gross_profit']);
  const op=metricValue(map,['operating_income']);
  const net=metricValue(map,['net_income']);
  const eps=metricValue(map,['eps_diluted','diluted_eps','earnings_per_share_diluted']);
  const assets=metricValue(map,['total_assets','assets']);
  const liabilities=metricValue(map,['total_liabilities','liabilities']);
  const cash=metricValue(map,['cash_and_equivalents','cash_and_cash_equivalents','cash']);
  const debt=metricValue(map,['total_debt','debt']);
  const equity=metricValue(map,['shareholders_equity','stockholders_equity','total_equity','equity']);
  const cfo=metricValue(map,['operating_cash_flow']);
  const capex=metricValue(map,['capital_expenditure','capital_expenditures']);
  const fcf=metricValue(map,['free_cash_flow']);
  if([revenue,gross,op,net,eps,assets,liabilities,cash,debt,equity,cfo,capex,fcf].every(v=>v==null)) return null;
  const latest=metrics.slice().sort((a,b)=>String(b.period_end).localeCompare(String(a.period_end)))[0]||{};
  const out={stock_id:Number(stock.id),fiscal_period:fiscalPeriod(latest),fiscal_year:num(latest.fiscal_year),period_type:periodType(latest),report_date:latest.period_end,data_source:'3spread'};
  Object.assign(out,{revenue,gross_profit:gross,operating_income:op,net_income:net,eps,total_assets:assets,total_liabilities:liabilities,cash_and_equivalents:cash,total_debt:debt,shareholders_equity:equity,operating_cash_flow:cfo,capital_expenditure:capex,free_cash_flow:fcf});
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
    Object.assign(row,fields);
    if(row.capital_expenditure!=null) row.capital_expenditure=Math.abs(row.capital_expenditure);
    if(row.operating_cash_flow!=null&&row.capital_expenditure!=null&&row.free_cash_flow==null) row.free_cash_flow=row.operating_cash_flow-row.capital_expenditure;
    if(row.revenue!=null||row.net_income!=null||row.total_assets!=null||row.operating_cash_flow!=null) result.push(row);
  }
  return result;
}
async function mergeInsert(table,keys,row){
  const params={}; for(const [k,v] of Object.entries(keys)) params[k]='eq.'+v;
  const existing=await db(table,{params:{...params,select:'*',limit:1}});
  if(existing?.[0]){
    const merged={...existing[0]};
    for(const [k,v] of Object.entries(row)) if(v!=null && (merged[k]==null||merged[k]==='')) merged[k]=v;
    delete merged.id; delete merged.created_at;
    const patchParams={}; for(const [k,v] of Object.entries(keys)) patchParams[k]='eq.'+v;
    await db(table,{method:'PATCH',params:patchParams,prefer:'return=minimal',body:merged});
    return {action:'merged',fields:Object.keys(row).filter(k=>row[k]!=null)};
  }
  await db(table,{method:'POST',params:{on_conflict:Object.keys(keys).join(',')},prefer:'resolution=merge-duplicates,return=minimal',body:[row]});
  return {action:'inserted',fields:Object.keys(row).filter(k=>row[k]!=null)};
}

const stocks=await db('stocks',{params:{select:'id,symbol',symbol:'in.(AAPL,MSFT,NVDA,AMZN,GOOGL)',is_active:'eq.true',limit:10}});
if(!stocks?.length) throw new Error('Controlled stock set not found.');
const summary=[];
for(const stock of stocks){
  const stockId=Number(stock.id);
  await db('financial_statements',{method:'DELETE',params:{stock_id:'eq.'+stockId,data_source:'eq.3spread'},prefer:'return=minimal'});
  await db('fundamentals',{method:'DELETE',params:{stock_id:'eq.'+stockId,data_source:'eq.3spread'},prefer:'return=minimal'});
  await db('threespread_statement_line_items',{method:'DELETE',params:{stock_id:'eq.'+stockId},prefer:'return=minimal'});
  const symbol=String(stock.symbol).toUpperCase();
  try{
    const [sBody,mBody,rBody]=await Promise.all([
      getJson('/v1/financials/statements?ticker='+encodeURIComponent(symbol)+'&version=latest&limit=10'),
      getJson('/v1/financials/metrics?ticker='+encodeURIComponent(symbol)+'&version=latest&limit=100'),
      getJson('/v1/financials/ratios?ticker='+encodeURIComponent(symbol)+'&version=latest&limit=100')
    ]);
    const statements=Array.isArray(sBody?.data)?sBody.data:[];
    const metrics=metricRows(mBody);
    const ratios=ratioRows(rBody);

    let rawStatements=0, rawMetrics=0, rawRatios=0, normalizedStatements=0, normalizedFundamentals=0;
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
      if(raw.block_id) { await upsertRaw('threespread_financial_statements',raw,'stock_id,block_id'); rawStatements++; }
      const lineItems=statementLineItems(r);
      for(const li of lineItems){
        await upsertRaw('threespread_statement_line_items',{
          stock_id:stockId,ticker:symbol,block_id:r.block_id,filing_id:r.filing_id??null,
          statement_type:r.statement_type,section:li.section,item_key:li.item_key,label:li.label,
          value:li.value,source:li.source,members:li.members,currency:r.currency??null,
          period_end:r.period_end??null,period_type:r.period_type??null,fiscal_year:num(r.fiscal_year),
          fiscal_quarter:num(r.fiscal_quarter),raw_item:li.raw_item
        },'stock_id,block_id,item_key');
      }
      const fields=extractFields(r.statement_json);
      const statement_type=normalizedStatementType(r.statement_type);
      if(statement_type && Object.keys(fields).length){
        const row={stock_id:Number(stock.id),statement_type,period_type:periodType(r),fiscal_period:fiscalPeriod(r),period_end:r.period_end??null,data_source:'3spread'};
        Object.assign(row,fields);
        if(row.capital_expenditure!=null) row.capital_expenditure=Math.abs(row.capital_expenditure);
        if(row.operating_cash_flow!=null&&row.capital_expenditure!=null&&row.free_cash_flow==null) row.free_cash_flow=row.operating_cash_flow-row.capital_expenditure;
        if(row.revenue!=null||row.net_income!=null||row.total_assets!=null||row.operating_cash_flow!=null){
          await mergeInsert('financial_statements',{stock_id:stockId,statement_type,period_type:row.period_type,fiscal_period:row.fiscal_period},row);
          normalizedStatements++;
        }
      }
    }

    for(const r of metrics){
      const raw={stock_id:stockId,ticker:symbol,period_end:r.period_end??null,period_of_report:r.period_of_report??null,
        period_length:num(r.period_length),period_type:r.period_type??null,fiscal_year:num(r.fiscal_year),fiscal_quarter:num(r.fiscal_quarter),
        category:r.category??null,value:num(r.value),currency:r.currency??null,unit:r.unit??null,spine:r.spine??null,
        derived:r.derived??null,is_valid:r.is_valid??null,raw_json:r};
      if(raw.category && raw.period_end) { await upsertRaw('threespread_metrics',raw,'stock_id,category,period_end,period_type'); rawMetrics++; }
    }

    for(const r of ratios){
      const raw={stock_id:stockId,ticker:symbol,ratio_category:r.ratio_category??null,ratio_name:r.ratio_name??null,
        value:num(r.value),value_pctile:num(r.value_pctile),missing_inputs:r.missing_inputs??null,period_end:r.period_end??null,
        period_of_report:r.period_of_report??null,period_length:num(r.period_length),period_type:r.period_type??null,
        fiscal_year:num(r.fiscal_year),fiscal_quarter:num(r.fiscal_quarter),spine:r.spine??null,derived:r.derived??null,
        is_valid:r.is_valid??null,raw_json:r};
      if(raw.ratio_name && raw.period_end) { await upsertRaw('threespread_ratios',raw,'stock_id,ratio_name,period_end,period_type'); rawRatios++; }
    }

    const fundamental=buildFundamental(stock,metrics);
    if(fundamental){
      await mergeInsert('fundamentals',{stock_id:stockId,fiscal_period:fundamental.fiscal_period},fundamental);
      normalizedFundamentals++;
    }
    summary.push({symbol,ok:true,statement_api_rows:statements.length,metric_rows:metrics.length,ratio_rows:ratios.length,
      raw_statements:rawStatements,raw_metrics:rawMetrics,raw_ratios:rawRatios,
      normalized_statements:normalizedStatements,fundamental:!!fundamental,normalized_fundamentals:normalizedFundamentals});
  }catch(e){summary.push({symbol,ok:false,error:e.message});}
  await sleep(150);
}
console.log(JSON.stringify({source:'3spread',mode:'controlled-5-stock-raw-plus-normalized',summary},null,2));
if(summary.some(x=>!x.ok)) process.exitCode=1;
