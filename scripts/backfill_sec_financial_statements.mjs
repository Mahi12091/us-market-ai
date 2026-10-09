import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required');
const sql = neon(process.env.NEON_DATABASE_URL);
const UA = process.env.SEC_USER_AGENT || 'US Market AI research contact admin@example.com';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-financial-backfill-'));
const execFileAsync = promisify(execFile);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const cik = v => String(v ?? '').replace(/\D/g, '').padStart(10, '0');

async function download(url, file) {
  for (let attempt=1; attempt<=5; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
    if (r.ok) { await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(file)); return; }
    if (![429,500,502,503,504].includes(r.status) || attempt===5) throw new Error('SEC HTTP '+r.status+' downloading '+url);
    await sleep(2000*attempt);
  }
}
async function upsert(table, rows, conflict, chunkSize=100, doNothing=false) {
  const cols = conflict.split(',').map(x=>x.trim());
  for (let i=0;i<rows.length;i+=chunkSize) {
    const chunk=[...new Map(rows.slice(i,i+chunkSize).map(r=>[cols.map(k=>String(r[k]??'')).join('|'),r])).values()];
    if (!chunk.length) continue;
    const keys=[...new Set(chunk.flatMap(r=>Object.keys(r)))], values=[];
    const tuples=chunk.map(row=>'('+keys.map(k=>{const v=row[k]??null;values.push(v!==null&&typeof v==='object'?JSON.stringify(v):v);return '$'+values.length;}).join(',')+')').join(',');
    const q='INSERT INTO public.'+table+' ('+keys.map(k=>'"'+k+'"').join(',')+') VALUES '+tuples+
      ' ON CONFLICT ('+cols.map(k=>'"'+k+'"').join(',')+') DO '+(doNothing?'NOTHING':'UPDATE SET '+
      keys.filter(k=>!cols.includes(k)).map(k=>'"'+k+'"=EXCLUDED."'+k+'"').join(','));
    await sql.query(q,values);
  }
}
const TAGS = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet','SalesRevenueGoodsNet','RegulatedAndUnregulatedOperatingRevenue','Revenue','RevenueFromContractsWithCustomers','OperatingRevenue','InvestmentIncomeNet','InvestmentIncomeInterestAndDividend','InterestAndDividendIncomeOperating','InterestAndDividendIncome','InvestmentIncomeInterest','InvestmentIncomeDividend','TotalRevenuesAndOtherIncome'],
  cost_of_revenue: ['CostOfRevenue','CostOfGoodsAndServicesSold','CostOfGoodsSold','CostOfSales'],
  gross_profit: ['GrossProfit'],
  operating_income: ['OperatingIncomeLoss','OperatingProfitLoss'],
  pretax_income: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest','IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments','ProfitLossBeforeTax','ProfitLossBeforeTaxAndExtraordinaryItems'],
  net_income: ['NetIncomeLoss','ProfitLoss','NetIncomeLossAvailableToCommonStockholdersBasic','ProfitLossAttributableToOwnersOfParent','ProfitLossAttributableToEquityHoldersOfParent'],
  eps_basic: ['EarningsPerShareBasic','BasicEarningsLossPerShare'],
  eps_diluted: ['EarningsPerShareDiluted','DilutedEarningsLossPerShare'],
  shares_basic: ['WeightedAverageNumberOfSharesOutstandingBasic','WeightedAverageNumberOfOrdinarySharesOutstandingBasic'],
  shares_diluted: ['WeightedAverageNumberOfDilutedSharesOutstanding','WeightedAverageNumberOfOrdinarySharesOutstandingDiluted'],
  cash_and_equivalents: ['CashAndCashEquivalentsAtCarryingValue','CashAndCashEquivalents'],
  short_term_investments: ['ShortTermInvestments','AvailableForSaleSecuritiesCurrent'],
  total_assets: ['Assets'],
  current_assets: ['AssetsCurrent','CurrentAssets'],
  total_liabilities: ['Liabilities'],
  current_liabilities: ['LiabilitiesCurrent','CurrentLiabilities'],
  total_debt: ['LongTermDebtAndFinanceLeaseObligationsCurrent','LongTermDebtCurrent','LongTermDebtNoncurrent','LongTermDebtAndFinanceLeaseObligations'],
  shareholders_equity: ['StockholdersEquity','StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest','Equity','EquityAttributableToOwnersOfParent'],
  operating_cash_flow: ['NetCashProvidedByUsedInOperatingActivities','CashFlowsFromUsedInOperatingActivities'],
  capital_expenditure: ['PaymentsToAcquirePropertyPlantAndEquipment','PurchaseOfPropertyPlantAndEquipment'],
  depreciation_amortization: ['DepreciationDepletionAndAmortization','DepreciationDepletionAndAmortizationPropertyPlantAndEquipment'],
  rd_expense: ['ResearchAndDevelopmentExpense'],
  sga_expense: ['SellingGeneralAndAdministrativeExpense'],
  tax_expense: ['IncomeTaxExpenseBenefit'],
  stock_based_compensation: ['ShareBasedCompensation'],
  dividends_paid: ['PaymentsOfDividendsCommonStock','PaymentsOfDividends'],
  buybacks: ['PaymentsForRepurchaseOfCommonStock'],
};
const GROUP = {
  income: new Set(['revenue','cost_of_revenue','gross_profit','operating_income','pretax_income','net_income','eps_basic','eps_diluted','shares_basic','shares_diluted','rd_expense','sga_expense','tax_expense']),
  balance: new Set(['cash_and_equivalents','short_term_investments','total_assets','current_assets','total_liabilities','current_liabilities','total_debt','shareholders_equity']),
  cashflow: new Set(['operating_cash_flow','capital_expenditure','depreciation_amortization','stock_based_compensation','dividends_paid','buybacks'])
};
const durationTag = new Set([...GROUP.income,...GROUP.cashflow]);
const tagToField = new Map(Object.entries(TAGS).flatMap(([field,tags])=>tags.map(t=>[t,field])));
const sectionFor = field => GROUP.income.has(field) ? (['revenue'].includes(field)?'revenue':['gross_profit','cost_of_revenue','operating_income','rd_expense','sga_expense'].includes(field)?'cost_and_expenses':['pretax_income','tax_expense'].includes(field)?'non_operating':['net_income'].includes(field)?'net_income':['eps_basic','eps_diluted','shares_basic','shares_diluted'].includes(field)?'per_share':'cost_and_expenses') : GROUP.balance.has(field) ? (['cash_and_equivalents','short_term_investments'].includes(field)?'assets':['total_assets','current_assets'].includes(field)?'assets':['total_liabilities','current_liabilities','total_debt'].includes(field)?'liabilities':'equity') : 'operating';

function selectFacts(facts) {
  const result = new Map();
  for (const [field,tags] of Object.entries(TAGS)) {
    let chosen=null;
    for (const tag of tags) {
      const fact=facts?.['us-gaap']?.[tag] || facts?.['ifrs-full']?.[tag];
      if (!fact?.units) continue;
      const unitNames=Object.keys(fact.units);
      const preferred=field.startsWith('eps_')?unitNames.find(x=>x.includes('per')):field.startsWith('shares_')?unitNames.find(x=>x==='shares'):unitNames.find(x=>x==='USD')||unitNames[0];
      const values=(fact.units[preferred]||[]).filter(x=>/^(10-K|10-Q|20-F|40-F)$/.test(x.form||'')&&x.end&&num(x.val)!==null);
      if (values.length) { chosen={tag,unit:preferred,values}; break; }
    }
    if (chosen) result.set(field,chosen);
  }
  return result;
}
function periodFacts(selected, stock) {
  const groups = new Map();
  for (const [field, fact] of selected) {
    for (const x of fact.values) {
      const isDuration=Boolean(x.start);
      if (durationTag.has(field)!==isDuration) continue;
      const days=isDuration ? (Date.parse(x.end)-Date.parse(x.start))/86400000+1 : 0;
      if (isDuration && field!=='eps_basic' && field!=='eps_diluted' && field!=='shares_basic' && field!=='shares_diluted' && days>0 && days<45) continue;
      const q=String(x.fp||'').toUpperCase();
      const periodType=isDuration ? ((days>=300&&days<=400)||q==='FY'?'annual':'quarterly') : ((q==='FY'||!x.start)?'annual':'quarterly');
      const fy=num(x.fy)||Number(String(x.end).slice(0,4));
      const fiscalPeriod='FY-'+fy+(periodType==='quarterly'&&/^Q[1-4]$/.test(q)?'-'+q:'');
      const key=[field,periodType,fiscalPeriod,x.end].join('|');
      const old=groups.get(key);
      if (!old || String(x.filed||'')>String(old.filed||'')) groups.set(key,{field,periodType,fiscalPeriod,end:x.end,fy,fp:q,val:num(x.val),unit:fact.unit,tag:fact.tag,form:x.form,filed:x.filed,start:x.start});
    }
  }
  return [...groups.values()];
}
function buildRows(stock, items) {
  const byType={income:[],balance:[],cashflow:[]};
  for (const item of items) {
    const type=GROUP.income.has(item.field)?'income':GROUP.balance.has(item.field)?'balance':'cashflow';
    byType[type].push(item);
  }
  const latest = {};
  for (const type of Object.keys(byType)) {
    const rows=byType[type].sort((a,b)=>String(b.end).localeCompare(String(a.end))||String(b.filed||'').localeCompare(String(a.filed||'')));
    if (rows.length) {
      const end=rows[0].end, periodType=rows[0].periodType, fiscalPeriod=rows[0].fiscalPeriod;
      latest[type]=rows.filter(r=>r.end===end&&r.periodType===periodType&&r.fiscalPeriod===fiscalPeriod);
    }
  }
  const map = Object.assign({}, ...Object.values(latest).flat().map(x=>({[x.field]:x.val})));
  const now=new Date().toISOString();
  const raw=[], line=[], normalized=[];
  for (const [type, rows] of Object.entries(latest)) {
    if (!rows.length) continue;
    const first=rows[0], statementType=type==='income'?'income_statement':type==='balance'?'balance_sheet':'cash_flow';
    const blockId='SEC-'+cik(stock.cik)+'-'+first.end+'-'+type;
    const sections={};
    for (const x of rows) {
      const section=sectionFor(x.field);
      sections[section]??={};
      sections[section][x.field]={label:x.field,value:x.val,source:'SEC_XBRL',unit:x.unit,tag:x.tag};
      line.push({stock_id:stock.id,ticker:stock.symbol,block_id:blockId,filing_id:x.filed||null,statement_type:statementType,section,item_key:x.field,label:x.field,value:x.val,source:'SEC_XBRL',members:{tag:x.tag,form:x.form,filed:x.filed,start:x.start,unit:x.unit},currency:x.unit==='USD'?'USD':null,period_end:x.end,period_type:first.periodType,fiscal_year:first.fy,fiscal_quarter:/^Q[1-4]$/.test(first.fp)?Number(first.fp.slice(1)):null,raw_item:{tag:x.tag,form:x.form,filed:x.filed,fp:x.fp,start:x.start,end:x.end,val:x.val,unit:x.unit},created_at:now,updated_at:now});
    }
    raw.push({stock_id:stock.id,ticker:stock.symbol,block_id:blockId,filing_id:first.filed||null,cik:cik(stock.cik),form_type:first.form,source_url:'https://www.sec.gov/edgar/search/',statement_type:statementType,period_of_report:first.end,period_end:first.end,period_type:first.periodType,fiscal_year:first.fy,fiscal_quarter:/^Q[1-4]$/.test(first.fp)?Number(first.fp.slice(1)):null,currency:'USD',statement_json:{sections,source:'SEC_XBRL_BULK',fields:Object.fromEntries(rows.map(x=>[x.field,x.val]))},raw_json:{source:'SEC_XBRL_BULK',tags:rows.map(x=>x.tag)},created_at:now,updated_at:now});
    const normalizedRow={stock_id:stock.id,statement_type:statementType,period_type:first.periodType,fiscal_period:first.fiscalPeriod,period_end:first.end,data_source:'SEC_XBRL_BULK',created_at:now,updated_at:now};
    const normalizedAllowed = new Set(['revenue','cost_of_revenue','gross_profit','operating_income','pretax_income','net_income','eps_basic','eps_diluted','shares_basic','shares_diluted','cash_and_equivalents','short_term_investments','total_assets','current_assets','total_liabilities','current_liabilities','total_debt','shareholders_equity','operating_cash_flow','capital_expenditure','free_cash_flow','ebitda','ebit','rd_expense','sga_expense','tax_expense','stock_based_compensation','acquisitions','debt_issuance','debt_repayment','dividends_paid','buybacks']);
    for (const x of rows) if (normalizedAllowed.has(x.field)) normalizedRow[x.field]=x.val;
    if (type==='cashflow' && map.operating_cash_flow!=null && map.capital_expenditure!=null) normalizedRow.free_cash_flow=map.operating_cash_flow-map.capital_expenditure;
    normalized.push(normalizedRow);
  }
  const latestEnd=[...Object.values(latest).flat()].map(x=>x.end).sort().at(-1);
  let fundamental=null;
  if (latestEnd && Object.keys(map).length) {
    const price=num(stock.market_cap);
    const revenue=map.revenue, gross=map.gross_profit, op=map.operating_income, net=map.net_income, equity=map.shareholders_equity, assets=map.total_assets, debt=map.total_debt, cash=map.cash_and_equivalents, cfo=map.operating_cash_flow, capex=map.capital_expenditure;
    const fcf=cfo!=null&&capex!=null?cfo-capex:null;
    fundamental={stock_id:stock.id,fiscal_period:'FY-'+String(latestEnd).slice(0,4),fiscal_year:Number(String(latestEnd).slice(0,4)),period_type:'annual',report_date:latestEnd,data_source:'SEC_XBRL_BULK',updated_at:now,market_cap:price, revenue,gross_profit:gross,operating_income:op,net_income:net,eps:map.eps_diluted??map.eps_basic,cost_of_revenue:map.cost_of_revenue,pretax_income:map.pretax_income,total_assets:assets,total_liabilities:map.total_liabilities,cash_and_equivalents:cash,total_debt:debt,shareholders_equity:equity,current_assets:map.current_assets,current_liabilities:map.current_liabilities,operating_cash_flow:cfo,capital_expenditure:capex,free_cash_flow:fcf,rd_expense:map.rd_expense,sga_expense:map.sga_expense,tax_expense:map.tax_expense,ebit:op,ebitda:op!=null&&map.depreciation_amortization!=null?op+map.depreciation_amortization:null};
    if(revenue&&gross!=null)fundamental.gross_margin=gross/revenue*100;
    if(revenue&&op!=null)fundamental.operating_margin=op/revenue*100;
    if(revenue&&net!=null)fundamental.net_margin=net/revenue*100;
    if(revenue&&fcf!=null)fundamental.fcf_margin=fcf/revenue*100;
    if(equity&&net!=null)fundamental.roe=net/equity*100;
    if(assets&&net!=null)fundamental.roa=net/assets*100;
    if(equity&&debt!=null)fundamental.debt_equity=debt/equity;
  }
  return {raw,line,normalized,fundamental};
}

async function fmpJson(endpoint) {
  if (!process.env.FMP_API_KEY) return [];
  const u = new URL('https://financialmodelingprep.com/stable/' + endpoint);
  u.searchParams.set('apikey', process.env.FMP_API_KEY);
  for (let attempt=1; attempt<=3; attempt++) {
    const r = await fetch(u, {headers:{Accept:'application/json'}});
    const body = await r.text();
    if (r.ok) {
      let parsed=[]; try { parsed=body?JSON.parse(body):[]; } catch {}
      return Array.isArray(parsed)?parsed:(Array.isArray(parsed?.data)?parsed.data:[]);
    }
    if ([429,500,502,503,504].includes(r.status) && attempt<3) { await sleep(1000*attempt); continue; }
    throw new Error('FMP HTTP '+r.status+': '+body.slice(0,250));
  }
  return [];
}
function fmpPeriod(row) {
  const year=String(row.calendarYear||row.fiscalYear||row.date||'').slice(0,4);
  const p=String(row.period||'FY').toUpperCase();
  return year ? 'FY-'+year+( /^Q[1-4]$/.test(p)?'-'+p:'') : String(row.date||'latest');
}
function fmpType(row) { return /^Q[1-4]$/i.test(String(row.period||''))?'quarterly':'annual'; }
async function backfillFmp(stock) {
  if (!process.env.FMP_API_KEY) return false;
  const symbol=String(stock.symbol||'').trim().toUpperCase();
  if (!symbol) return false;
  const q='symbol='+encodeURIComponent(symbol)+'&limit=1&period=annual';
  const [income,balance,cash]=await Promise.all([
    fmpJson('income-statement?'+q), fmpJson('balance-sheet-statement?'+q), fmpJson('cash-flow-statement?'+q)
  ]);
  const inc=income[0]||{}, bal=balance[0]||{}, cf=cash[0]||{};
  const pick=(obj,...keys)=>{for(const k of keys){const n=num(obj?.[k]);if(n!=null)return n;}return null;};
  const now=new Date().toISOString();
  const statementDefs=[
    {type:'income_statement',data:inc,fields:[
      ['revenue','revenue'],['cost_of_revenue','costOfRevenue'],['gross_profit','grossProfit'],['operating_income','operatingIncome'],['pretax_income','incomeBeforeTax'],['net_income','netIncome'],['eps_basic','eps'],['eps_diluted','epsDiluted'],['shares_basic','weightedAverageShsOut'],['shares_diluted','weightedAverageShsOutDil'],['rd_expense','researchAndDevelopmentExpenses'],['sga_expense','sellingGeneralAndAdministrativeExpenses'],['tax_expense','incomeTaxExpense']
    ]},
    {type:'balance_sheet',data:bal,fields:[
      ['cash_and_equivalents','cashAndCashEquivalents'],['short_term_investments','shortTermInvestments'],['total_assets','totalAssets'],['current_assets','totalCurrentAssets'],['total_liabilities','totalLiabilities'],['current_liabilities','totalCurrentLiabilities'],['total_debt','totalDebt'],['long_term_debt','longTermDebt'],['shareholders_equity','totalStockholdersEquity']
    ]},
    {type:'cash_flow',data:cf,fields:[
      ['operating_cash_flow','operatingCashFlow'],['capital_expenditure','capitalExpenditure'],['free_cash_flow','freeCashFlow'],['stock_based_compensation','stockBasedCompensation'],['dividends_paid','commonDividendsPaid'],['buybacks','commonStockRepurchased']
    ]}
  ];
  const raw=[],line=[],normalized=[];
  for(const def of statementDefs){
    const row=def.data;
    const periodEnd=row.date||row.filingDate;
    if(!periodEnd) continue;
    const values={};
    for(const [field,key] of def.fields){const v=pick(row,key);if(v!=null)values[field]=v;}
    if(!Object.keys(values).length) continue;
    const periodType=fmpType(row), fiscalPeriod=fmpPeriod(row), fy=Number(String(periodEnd).slice(0,4));
    const blockId='FMP-'+symbol+'-'+periodEnd+'-'+def.type;
    const sections={};
    for(const [field,value] of Object.entries(values)){
      const sec=sectionFor(field);
      sections[sec]??={};
      sections[sec][field]={label:field,value,source:'FMP',tag:field};
      line.push({stock_id:stock.id,ticker:symbol,block_id:blockId,filing_id:row.fillingDate||row.filingDate||null,statement_type:def.type,section:sec,item_key:field,label:field,value,source:'FMP',members:{provider:'Financial Modeling Prep',period:row.period||'FY'},currency:'USD',period_end:periodEnd,period_type:periodType,fiscal_year:fy,fiscal_quarter:/^Q[1-4]$/i.test(String(row.period||''))?Number(String(row.period).slice(1)):null,raw_item:{field,value,source:'FMP'},created_at:now,updated_at:now});
    }
    raw.push({stock_id:stock.id,ticker:symbol,block_id:blockId,filing_id:row.filingDate||null,cik:stock.cik?cik(stock.cik):null,form_type:row.period||'FY',source_url:'https://financialmodelingprep.com/stable/'+def.type,statement_type:def.type,period_of_report:periodEnd,period_end:periodEnd,period_type:periodType,fiscal_year:fy,fiscal_quarter:/^Q[1-4]$/i.test(String(row.period||''))?Number(String(row.period).slice(1)):null,currency:'USD',statement_json:{sections,source:'FMP',fields:values},raw_json:{source:'FMP',symbol,period:row.period||'FY',date:periodEnd},created_at:now,updated_at:now});
    const norm={stock_id:stock.id,statement_type:def.type,period_type:periodType,fiscal_period:fiscalPeriod,period_end:periodEnd,data_source:'FMP',created_at:now,updated_at:now,...values};
    if(def.type==='cash_flow'&&values.operating_cash_flow!=null&&values.capital_expenditure!=null)norm.free_cash_flow=values.free_cash_flow??(values.operating_cash_flow-Math.abs(values.capital_expenditure));
    normalized.push(norm);
  }
  if(!raw.length&&!line.length&&!normalized.length) return false;
  await upsert('threespread_financial_statements',raw,'stock_id,block_id',50);
  await upsert('threespread_statement_line_items',line,'stock_id,block_id,item_key',200);
  await upsert('financial_statements',normalized,'stock_id,statement_type,period_type,fiscal_period',50,true);
  const revenue=pick(inc,'revenue'),gross=pick(inc,'grossProfit'),op=pick(inc,'operatingIncome'),net=pick(inc,'netIncome');
  const assets=pick(bal,'totalAssets'),liabilities=pick(bal,'totalLiabilities'),equity=pick(bal,'totalStockholdersEquity','totalEquity'),cashValue=pick(bal,'cashAndCashEquivalents','cashAndShortTermInvestments'),debt=pick(bal,'totalDebt','longTermDebt');
  const cfo=pick(cf,'operatingCashFlow'),capex=pick(cf,'capitalExpenditure'),fcf=pick(cf,'freeCashFlow')??(cfo!=null&&capex!=null?cfo-Math.abs(capex):null);
  const reportDate=inc.date||bal.date||cf.date||null;
  if(reportDate){
    const fp=fmpPeriod(inc.date?inc:bal.date?bal:cf);
    const fundamental={stock_id:stock.id,fiscal_period:fp,fiscal_year:Number(String(reportDate).slice(0,4)),period_type:fmpType(inc.date?inc:bal.date?bal:cf),report_date:reportDate,data_source:'FMP',updated_at:now,market_cap:num(stock.market_cap),revenue,gross_profit:gross,operating_income:op,net_income:net,eps:pick(inc,'epsDiluted','eps'),cost_of_revenue:pick(inc,'costOfRevenue'),pretax_income:pick(inc,'incomeBeforeTax'),total_assets:assets,total_liabilities:liabilities,cash_and_equivalents:cashValue,total_debt:debt,shareholders_equity:equity,current_assets:pick(bal,'totalCurrentAssets'),current_liabilities:pick(bal,'totalCurrentLiabilities'),operating_cash_flow:cfo,capital_expenditure:capex,free_cash_flow:fcf,rd_expense:pick(inc,'researchAndDevelopmentExpenses'),sga_expense:pick(inc,'sellingGeneralAndAdministrativeExpenses'),tax_expense:pick(inc,'incomeTaxExpense')};
    if(revenue&&gross!=null)fundamental.gross_margin=gross/revenue*100;
    if(revenue&&op!=null)fundamental.operating_margin=op/revenue*100;
    if(revenue&&net!=null)fundamental.net_margin=net/revenue*100;
    if(revenue&&fcf!=null)fundamental.fcf_margin=fcf/revenue*100;
    if(equity&&net!=null)fundamental.roe=net/equity*100;
    if(assets&&net!=null)fundamental.roa=net/assets*100;
    if(equity&&debt!=null)fundamental.debt_equity=debt/equity;
    await upsert('fundamentals',[fundamental],'stock_id,fiscal_period',1,true);
  }
  console.log('[FMP fallback] '+symbol+' inserted '+raw.length+' statement blocks and '+line.length+' line items');
  return true;
}

async function main() {
  const zip=path.join(TMP,'companyfacts.zip'), dir=path.join(TMP,'companyfacts');
  console.log('[SEC XBRL] Downloading SEC companyfacts bulk ZIP');
  await download('https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip',zip);
  await fs.promises.mkdir(dir,{recursive:true});
  await execFileAsync('unzip',['-q','-o',zip,'-d',dir]);
  const stocks=await sql`SELECT s.id,s.symbol,s.cik,s.market_cap FROM public.stocks s WHERE s.is_active=true AND s.asset_type='stock' AND (
    NOT EXISTS (SELECT 1 FROM public.fundamentals f WHERE f.stock_id=s.id) OR
    NOT EXISTS (SELECT 1 FROM public.financial_statements f WHERE f.stock_id=s.id) OR
    NOT EXISTS (SELECT 1 FROM public.threespread_statement_line_items f WHERE f.stock_id=s.id) OR
    NOT EXISTS (SELECT 1 FROM public.threespread_financial_statements f WHERE f.stock_id=s.id)
  ) ORDER BY s.id`;
  let processed=0, rawCount=0, lineCount=0, normalizedCount=0, fundamentalsCount=0, noFacts=0;
  for(let i=0;i<stocks.length;i++){
    const stock=stocks[i];
    try {
      let built={raw:[],line:[],normalized:[],fundamental:null};
      const file=stock.cik?path.join(dir,'CIK'+cik(stock.cik)+'.json'):null;
      if(file&&fs.existsSync(file)){
        const j=JSON.parse(await fs.promises.readFile(file,'utf8'));
        const selected=selectFacts(j.facts||{});
        built=buildRows(stock,periodFacts(selected,stock));
      }
      if(built.raw.length||built.line.length||built.normalized.length||built.fundamental){
        await upsert('threespread_financial_statements',built.raw,'stock_id,block_id',50);
        await upsert('threespread_statement_line_items',built.line,'stock_id,block_id,item_key',200);
        await upsert('financial_statements',built.normalized,'stock_id,statement_type,period_type,fiscal_period',50,true);
        if(built.fundamental) await upsert('fundamentals',[built.fundamental],'stock_id,fiscal_period',1,true);
        rawCount+=built.raw.length; lineCount+=built.line.length; normalizedCount+=built.normalized.length; fundamentalsCount+=built.fundamental?1:0; processed++;
      } else {
        const fmpOk=await backfillFmp(stock);
        if(fmpOk) { processed++; console.log('[SEC XBRL] SEC facts absent; FMP fallback covered '+stock.symbol); }
        else { noFacts++; console.log('[SEC XBRL] no usable SEC/FMP facts for '+stock.symbol); }
      }
    } catch(e) { console.error('[SEC/FMP] '+stock.symbol+' failed: '+e.message); }
    if((i+1)%100===0) console.log(JSON.stringify({progress:i+1,total:stocks.length,processed,rawCount,lineCount,normalizedCount,fundamentalsCount,noFacts}));
  }
  const report=await sql`SELECT COUNT(*) FILTER (WHERE s.is_active AND s.asset_type='stock')::int AS universe,
    (SELECT COUNT(DISTINCT f.stock_id)::int FROM public.fundamentals f JOIN public.stocks x ON x.id=f.stock_id WHERE x.is_active AND x.asset_type='stock') AS fundamentals,
    (SELECT COUNT(DISTINCT f.stock_id)::int FROM public.financial_statements f JOIN public.stocks x ON x.id=f.stock_id WHERE x.is_active AND x.asset_type='stock') AS financial_statements,
    (SELECT COUNT(DISTINCT f.stock_id)::int FROM public.threespread_statement_line_items f JOIN public.stocks x ON x.id=f.stock_id WHERE x.is_active AND x.asset_type='stock') AS line_items,
    (SELECT COUNT(DISTINCT f.stock_id)::int FROM public.threespread_financial_statements f JOIN public.stocks x ON x.id=f.stock_id WHERE x.is_active AND x.asset_type='stock') AS raw_statements
    FROM public.stocks s`;
  console.log('[SEC XBRL] COMPLETE',JSON.stringify({processed,rawCount,lineCount,normalizedCount,fundamentalsCount,noFacts,coverage:report[0]}));
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>{try{fs.rmSync(TMP,{recursive:true,force:true})}catch{}});
