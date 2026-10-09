import { neon } from '@neondatabase/serverless';

for (const name of ['THREESPREAD_API_KEY2', 'NEON_DATABASE_URL']) {
  if (!process.env[name]) throw new Error(`${name} is not configured.`);
}

const sql = neon(process.env.NEON_DATABASE_URL);
const API = 'https://api.3spread.com';
const DEEP = process.env.SYNC_3SPREAD_METRICS_RATIOS === 'true';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

async function getJson(path) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const r = await fetch(API + path, { headers: { Accept: 'application/json', apikey: process.env.THREESPREAD_API_KEY2 } });
    const text = await r.text();
    let body = {}; try { body = text ? JSON.parse(text) : {}; } catch {}
    if (r.ok) return body;
    if (![408, 429, 500, 502, 503, 504].includes(r.status) || attempt === 5) {
      throw new Error(`3spread ${r.status}: ${text.slice(0, 500)}`);
    }
    await sleep(r.status === 429 ? 65000 : Math.min(30000, 3000 * 2 ** (attempt - 1)));
  }
  throw new Error('3spread request failed');
}

async function getAll(path) {
  const rows = []; let cursor = null; let guard = 0;
  do {
    const u = new URL(API + path);
    if (cursor) u.searchParams.set('cursor', cursor);
    const body = await getJson(u.pathname + u.search);
    rows.push(...(Array.isArray(body?.data) ? body.data : []));
    const next = body?.next_cursor ?? body?.pagination?.next_cursor ?? null;
    if (!next || next === cursor || ++guard > 100) break;
    cursor = next;
  } while (cursor);
  return rows;
}

async function db(table, { method = 'GET', params = {}, body } = {}) {
  const ident = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const qid = x => { if (!ident.test(x)) throw new Error(`Unsafe identifier: ${x}`); return `"${x}"`; };
  const values = []; const filters = [];
  for (const [key, value] of Object.entries(params)) {
    if (['select', 'limit', 'offset', 'order', 'on_conflict'].includes(key)) continue;
    const m = String(value).match(/^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/); if (!m) continue;
    const [, op, raw] = m; const col = qid(key);
    if (op === 'is') filters.push(raw === 'null' ? `${col} IS NULL` : raw === 'true' ? `${col} IS TRUE` : raw === 'false' ? `${col} IS FALSE` : '1=0');
    else if (op === 'in') {
      const items = raw.replace(/^\(|\)$/g, '').split(',').filter(Boolean);
      const ph = items.map(item => { values.push(item.replace(/["']/g, '')); return `$${values.length}`; }).join(',');
      filters.push(`${col} IN (${ph || 'NULL'})`);
    } else {
      values.push(raw); filters.push(`${col} ${({ eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' })[op]} $${values.length}`);
    }
  }
  if (method === 'GET') {
    const cols = (params.select || '*') === '*' ? '*' : String(params.select).split(',').map(x => qid(x.trim())).join(',');
    let q = `SELECT ${cols} FROM ${qid(table)}${filters.length ? ` WHERE ${filters.join(' AND ')}` : ''}`;
    if (params.order) q += ` ORDER BY ${String(params.order).split(',').map(part => { const [col, dir] = part.split('.'); return `${qid(col)} ${dir === 'desc' ? 'DESC' : 'ASC'}`; }).join(', ')}`;
    if (params.limit != null) q += ` LIMIT ${Math.max(0, Number(params.limit))}`;
    if (params.offset != null) q += ` OFFSET ${Math.max(0, Number(params.offset))}`;
    return sql.query(q, values);
  }
  if (method === 'POST') {
    const rows = Array.isArray(body) ? body : [body || {}]; if (!rows.length) return [];
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))]; const vals = [];
    const tuples = rows.map(row => `(${keys.map(k => { vals.push(row[k] ?? null); return `$${vals.length}`; }).join(',')})`).join(',');
    let q = `INSERT INTO ${qid(table)} (${keys.map(qid).join(',')}) VALUES ${tuples}`;
    const conflict = String(params.on_conflict || '').split(',').map(x => x.trim()).filter(Boolean);
    if (conflict.length) {
      const updates = keys.filter(k => !conflict.includes(k)).map(k => `${qid(k)}=EXCLUDED.${qid(k)}`).join(',');
      q += ` ON CONFLICT (${conflict.map(qid).join(',')}) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}`;
    }
    return sql.query(q + ' RETURNING *', vals);
  }
  throw new Error(`Unsupported db method: ${method}`);
}

async function dbAll(table, params = {}, pageSize = 500) {
  const rows = [];
  for (let offset = 0;; offset += pageSize) {
    const page = await db(table, { params: { ...params, limit: pageSize, offset } });
    if (!page?.length) break;
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function normalizedPeriodType(r) {
  const p = String(r.period_type ?? r.period ?? '').toLowerCase();
  if (p.includes('quarter') || p.includes('three_month') || p.includes('three month')) return 'quarterly';
  if (p.includes('annual') || p === 'fy') return 'annual';
  if (p.includes('ttm') || p.includes('trailing')) return 'ttm';
  // 3spread balance sheets are point-in-time statements. For the normalized
  // financial_statements table they are stored as the fiscal quarter/year.
  if (p.includes('point')) return num(r.fiscal_quarter) ? 'quarterly' : 'annual';
  if (p.includes('semi') || p.includes('six_month') || p.includes('six month') || p.includes('nine_month') || p.includes('nine month')) {
    return num(r.fiscal_quarter) ? 'quarterly' : 'annual';
  }
  return 'quarterly';
}

function normalizedStatementType(st) {
  const s = String(st || '').toLowerCase();
  if (s === 'inc' || s.includes('income')) return 'income_statement';
  if (s === 'bs' || s.includes('balance')) return 'balance_sheet';
  if (s === 'cf' || s.includes('cash')) return 'cash_flow';
  return null;
}

function fiscalPeriod(r) {
  const y = r.fiscal_year ?? String(r.period_end ?? '').slice(0, 4);
  const q = r.fiscal_quarter;
  return y ? `FY-${y}${q ? `-Q${q}` : ''}` : String(r.period_end ?? 'latest');
}

const aliases = {
  revenue: ['revenue','revenues','sales','sales_revenue','total_revenue'],
  cost_of_revenue: ['cost_of_revenue','cost_of_sales','cost_of_goods_sold'],
  gross_profit: ['gross_profit'], operating_income: ['operating_income','income_from_operations'],
  pretax_income: ['pretax_income','income_before_tax'], net_income: ['net_income','net_income_loss','net_income_attributable_to_parent'],
  eps_diluted: ['eps_diluted','diluted_eps','earnings_per_share_diluted'], eps_basic: ['eps_basic','basic_eps','earnings_per_share_basic'],
  shares_diluted: ['shares_diluted','diluted_shares','weighted_average_shares_diluted'], shares_basic: ['shares_basic','basic_shares','weighted_average_shares_basic'],
  cash_and_equivalents: ['cash_and_equivalents','cash_and_cash_equivalents','cash_and_short_term_investments','cash'],
  total_assets: ['total_assets','assets'], current_assets: ['current_assets','total_current_assets'],
  total_liabilities: ['total_liabilities','liabilities'], current_liabilities: ['current_liabilities','total_current_liabilities'],
  total_debt: ['total_debt','debt','debt_and_finance_leases'], shareholders_equity: ['shareholders_equity','stockholders_equity','total_equity','equity'],
  operating_cash_flow: ['operating_cash_flow','net_cash_operating','net_cash_provided_by_operating_activities','net_cash_provided_by_used_in_operating_activities','cash_from_operations'],
  capital_expenditure: ['capital_expenditure','capital_expenditures','purchases_of_property_plant_and_equipment'], free_cash_flow: ['free_cash_flow','fcf'],
  ebitda: ['ebitda'], depreciation_amortization: ['depreciation_amortization','depreciation_and_amortization','depreciation_depletion_and_amortization']
};
const reverse = new Map(Object.entries(aliases).flatMap(([dest, keys]) => keys.map(k => [norm(k), dest])));

function collectLeaves(obj, path = [], out = [], meta = {}) {
  if (obj == null) return out;
  if (Array.isArray(obj)) { for (const v of obj) collectLeaves(v, path, out, meta); return out; }
  if (typeof obj !== 'object') { const n = num(obj); if (n != null) out.push({ key: path.map(norm).join('_'), value: n, label: meta.label ?? null }); return out; }
  const local = { ...meta };
  for (const k of ['label','name','title','canonical_name','line_item','metric_name']) if (obj[k] != null) local.label = String(obj[k]);
  for (const [k, v] of Object.entries(obj)) if (!['label','name','title','canonical_name','line_item','metric_name','unit','currency'].includes(k)) collectLeaves(v, [...path, k], out, local);
  return out;
}

function extractFields(statementJson) {
  const sections = statementJson?.sections; const out = {};
  const pick = (section, keys) => { const obj = sections?.[section]; if (!obj) return null; for (const k of keys) { const n = num(obj?.[k]?.value); if (n != null) return n; } return null; };
  const direct = {
    revenue: pick('revenue', ['total_revenue','net_revenue']), gross_profit: pick('cost_and_expenses', ['gross_profit']),
    operating_income: pick('cost_and_expenses', ['operating_income']), pretax_income: pick('non_operating', ['income_before_taxes','pretax_income']),
    net_income: pick('net_income', ['net_income','net_income_to_common','net_income_to_parent']), eps_diluted: pick('per_share', ['eps_diluted']), eps_basic: pick('per_share', ['eps_basic']),
    shares_diluted: pick('per_share', ['shares_diluted']), shares_basic: pick('per_share', ['shares_basic']),
    cash_and_equivalents: pick('assets', ['cash_and_equivalents']), total_assets: pick('assets', ['total_assets']), current_assets: pick('assets', ['total_current_assets']),
    total_liabilities: pick('liabilities', ['total_liabilities']), current_liabilities: pick('liabilities', ['total_current_liabilities']),
    shareholders_equity: pick('equity', ['total_equity','total_common_equity']), total_debt: pick('liabilities', ['total_borrowings','long_term_debt','short_term_borrowings']),
    operating_cash_flow: pick('operating', ['net_cash_provided_by_used_in_operating_activities','net_cash_operating','cash_from_operations','operating_cash_flow']),
    capital_expenditure: pick('investing', ['capital_expenditures','capital_expenditure','payments_to_acquire_property_plant_and_equipment','purchases_of_property_plant_and_equipment']),
    free_cash_flow: pick('operating', ['free_cash_flow','fcf']), depreciation_amortization: pick('operating', ['depreciation_and_amortization']), ebitda: pick('operating', ['ebitda'])
  };
  for (const [k, v] of Object.entries(direct)) if (v != null) out[k] = v;
  if (Object.keys(out).length < 2) for (const x of collectLeaves(statementJson)) { const dest = reverse.get(norm(x.label || '')) || reverse.get(norm(x.key)); if (dest && out[dest] == null) out[dest] = x.value; }
  return out;
}

function lineItems(r) {
  const sections = r?.statement_json?.sections; if (!sections || typeof sections !== 'object') return [];
  const out = [];
  for (const [section, items] of Object.entries(sections)) for (const [item_key, item] of Object.entries(items || {})) {
    if (!item || typeof item !== 'object') continue;
    out.push({ section, item_key, label: item.label ?? item_key, value: num(item.value), source: item.source ?? null, members: item.members ?? null, raw_item: item });
  }
  return out;
}

function statementRow(stockId, r) {
  const fields = extractFields(r.statement_json); const statement_type = normalizedStatementType(r.statement_type);
  if (!statement_type || !Object.keys(fields).length) return null;
  const row = { stock_id: stockId, statement_type, period_type: normalizedPeriodType(r), fiscal_period: fiscalPeriod(r), period_end: r.period_end ?? null, data_source: '3spread' };
  const normalized = { ...fields }; delete normalized.ebitda; delete normalized.depreciation_amortization; Object.assign(row, normalized);
  if (row.capital_expenditure != null) row.capital_expenditure = Math.abs(row.capital_expenditure);
  if (row.operating_cash_flow != null && row.capital_expenditure != null && row.free_cash_flow == null) row.free_cash_flow = row.operating_cash_flow - row.capital_expenditure;
  return row;
}

function dedupeRows(rows, conflict) {
  const keys = conflict.split(',').map(s => s.trim()).filter(Boolean);
  const map = new Map();
  for (const row of rows) {
    const key = keys.map(k => {
      const v = row[k];
      return v == null ? '__NULL__' : String(v);
    }).join('|');
    // Keep the most complete/latest row for a conflict key.
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    const score = x => Object.values(x).reduce((n, v) => n + (v == null ? 0 : (typeof v === 'object' && Object.keys(v).length === 0 ? 0 : 1)), 0);
    const prevScore = score(prev);
    const nextScore = score(row);
    if (nextScore >= prevScore) map.set(key, row);
  }
  return [...map.values()];
}

async function upsertBatch(table, rows, conflict, chunk = 100) {
  const uniqueRows = dedupeRows(rows, conflict);
  for (let i = 0; i < uniqueRows.length; i += chunk) {
    const batch = uniqueRows.slice(i, i + chunk);
    if (batch.length) await db(table, { method: 'POST', params: { on_conflict: conflict }, body: batch });
  }
}

function buildFundamental(stock, statements, quote) {
  const sorted = statements.slice().sort((a,b) => String(b.period_end).localeCompare(String(a.period_end)));
  const inc = sorted.filter(r => normalizedStatementType(r.statement_type) === 'income_statement' && normalizedPeriodType(r) === 'quarterly');
  const bs = sorted.filter(r => normalizedStatementType(r.statement_type) === 'balance_sheet');
  const cf = sorted.filter(r => normalizedStatementType(r.statement_type) === 'cash_flow' && normalizedPeriodType(r) === 'quarterly');
  const latestIncome = inc[0], latestBalance = bs[0], latestCf = cf[0];
  if (!latestIncome && !latestBalance && !latestCf) return null;
  const f = r => r ? extractFields(r.statement_json) : {};
  const inf=f(latestIncome), bsf=f(latestBalance), cff=f(latestCf);
  const v=(x,names)=>{for(const n of names) if(x[n]!=null) return num(x[n]); return null;};
  const revenue=v(inf,['revenue']), gross=v(inf,['gross_profit']), op=v(inf,['operating_income']), net=v(inf,['net_income']), eps=v(inf,['eps_diluted','eps_basic']);
  const assets=v(bsf,['total_assets']), liabilities=v(bsf,['total_liabilities']), cash=v(bsf,['cash_and_equivalents']), debt=v(bsf,['total_debt']), equity=v(bsf,['shareholders_equity']);
  const cfo=v(cff,['operating_cash_flow']), capex0=v(cff,['capital_expenditure']), capex=capex0==null?null:Math.abs(capex0), fcf0=v(cff,['free_cash_flow']), fcf=fcf0!=null?fcf0:(cfo!=null&&capex!=null?cfo-capex:null);
  const fy=num(latestIncome?.fiscal_year), fq=num(latestIncome?.fiscal_quarter), latestDate=latestIncome?.period_end??latestBalance?.period_end??latestCf?.period_end;
  const prev=inc.find(r=>num(r.fiscal_year)===fy-1&&num(r.fiscal_quarter)===fq), pf=prev?f(prev):{};
  const prevRevenue=v(pf,['revenue']), prevEps=v(pf,['eps_diluted','eps_basic']);
  const revenueGrowth=revenue!=null&&prevRevenue?((revenue/prevRevenue)-1)*100:null, epsGrowth=eps!=null&&prevEps?((eps/prevEps)-1)*100:null;
  const q4=inc.filter(r=>String(r.period_end)<=String(latestDate)).slice(0,4).map(f);
  const ttmRevenue=q4.length===4&&q4.every(x=>v(x,['revenue'])!=null)?q4.reduce((s,x)=>s+v(x,['revenue']),0):null;
  const ttmEps=q4.length===4&&q4.every(x=>v(x,['eps_diluted','eps_basic'])!=null)?q4.reduce((s,x)=>s+v(x,['eps_diluted','eps_basic']),0):null;
  const price=num(quote?.price), marketCap=num(stock.market_cap)>0?num(stock.market_cap):null;
  const enterpriseValue=marketCap!=null&&debt!=null&&cash!=null?marketCap+debt-cash:null;
  const pe=price>0&&ttmEps>0?price/ttmEps:null, ps=marketCap!=null&&ttmRevenue>0?marketCap/ttmRevenue:null, pb=marketCap!=null&&equity>0?marketCap/equity:null;
  const out={stock_id:Number(stock.id),fiscal_period:fiscalPeriod(latestIncome||latestBalance||latestCf),fiscal_year:fy,period_type:'quarterly',report_date:latestDate,data_source:'3spread',market_cap:marketCap,enterprise_value:enterpriseValue,revenue,revenue_growth:revenueGrowth,gross_profit:gross,operating_income:op,net_income:net,eps,eps_growth:epsGrowth,total_assets:assets,total_liabilities:liabilities,cash_and_equivalents:cash,total_debt:debt,shareholders_equity:equity,operating_cash_flow:cfo,capital_expenditure:capex,free_cash_flow:fcf,shares_outstanding:null,pe_ratio:pe,peg_ratio:pe!=null&&epsGrowth>0?pe/epsGrowth:null,price_sales:ps,price_book:pb,enterprise_value_to_revenue:enterpriseValue!=null&&ttmRevenue>0?enterpriseValue/ttmRevenue:null,earnings_yield:price>0&&ttmEps>0?ttmEps/price*100:null};
  if(revenue!=null&&gross!=null) out.gross_margin=gross/revenue*100; if(revenue!=null&&op!=null) out.operating_margin=op/revenue*100; if(revenue!=null&&net!=null) out.net_margin=net/revenue*100; if(revenue!=null&&fcf!=null) out.fcf_margin=fcf/revenue*100; if(equity&&net) out.roe=net/equity*100; if(assets&&net) out.roa=net/assets*100; if(equity&&debt) out.debt_equity=debt/equity;
  return out;
}

const stockLimit = Math.max(1, Number(process.env.SYNC_STOCK_LIMIT || 250));
const startOffset = Math.max(0, Number(process.env.SYNC_START_OFFSET || 0));
const stockPage = await dbAll('stocks', { select: 'id,symbol,market_cap', is_active: 'eq.true', order: 'id.asc' }, 5000);
const stocks = stockPage.slice(startOffset, startOffset + stockLimit);
if (!stocks.length) throw new Error('No active stocks found for this batch.');
const summary=[];

for (const [index, stock] of stocks.entries()) {
  const symbol=String(stock.symbol).toUpperCase(), stockId=Number(stock.id);
  console.log(`[3spread-v2] ${index+1}/${stocks.length} ${symbol} start`);
  try {
    let statements = await dbAll('threespread_financial_statements', { select: 'stock_id,ticker,block_id,filing_id,statement_type,period_end,period_type,fiscal_year,fiscal_quarter,statement_json', stock_id: `eq.${stockId}`, order: 'period_end.desc' }, 500);
    let fetched=false;
    if (!statements.length) {
      const apiSymbol=symbol.replace(/\./g,'-');
      statements=await getAll(`/v1/financials/statements?ticker=${encodeURIComponent(apiSymbol)}&version=latest&limit=10`);
      fetched=true;
      if (!statements.length && apiSymbol!==symbol) statements=await getAll(`/v1/financials/statements?ticker=${encodeURIComponent(symbol)}&version=latest&limit=10`);
    }
    if (fetched && statements.length) {
      // Keep canonical statement snapshots, but do not persist the full raw payload twice.
      const rawRows=dedupeRows(statements.filter(r=>r?.block_id).map(r=>({
        stock_id:stockId,ticker:symbol,block_id:r.block_id,filing_id:r.filing_id??null,cik:r.cik??null,
        form_type:r.form_type??null,accession_num:r.accession_num??null,source_url:r.source_url??null,
        accepted_time:r.accepted_time??null,statement_type:r.statement_type??null,spine:r.spine??null,
        spine_confidence:num(r.spine_confidence),spine_low_conf:num(r.spine_low_conf),
        period_of_report:r.period_of_report??null,period_end:r.period_end??null,period_length:num(r.period_length),
        period_type:normalizedPeriodType(r),fiscal_year:num(r.fiscal_year),fiscal_quarter:num(r.fiscal_quarter),
        filing_fiscal_year:num(r.filing_fiscal_year),is_comparative:r.is_comparative??null,derived:r.derived??null,
        is_valid:r.is_valid??null,score_composite:num(r.score_composite),scores:r.scores??null,currency:r.currency??null,
        statement_json:r.statement_json??null,raw_json:null
      })), 'stock_id,block_id');
      await upsertBatch('threespread_financial_statements',rawRows,'stock_id,block_id');

      // Persist line items only for the most recent 4 statement blocks per stock.
      const recentBlocks = new Set(statements.filter(r=>r?.block_id).slice(0,4).map(r=>r.block_id));
      const li=[];
      for(const r of statements) {
        if(!recentBlocks.has(r?.block_id)) continue;
        for(const x of lineItems(r)) li.push({
          stock_id:stockId,ticker:symbol,block_id:r.block_id,filing_id:r.filing_id??null,
          statement_type:r.statement_type??null,section:x.section,item_key:x.item_key,label:x.label,value:x.value,
          source:x.source,members:x.members,currency:r.currency??null,period_end:r.period_end??null,
          period_type:normalizedPeriodType(r),fiscal_year:num(r.fiscal_year),fiscal_quarter:num(r.fiscal_quarter),raw_item:null
        });
      }
      await upsertBatch('threespread_statement_line_items',li,'stock_id,block_id,item_key');
    }

    const normalized=statements.map(r=>statementRow(stockId,r)).filter(Boolean);
    await upsertBatch('financial_statements',normalized,'stock_id,statement_type,period_type,fiscal_period');

    let metrics=[], ratios=[];
    if (DEEP) {
      const apiSymbol=symbol.replace(/\./g,'-');
      [metrics,ratios]=await Promise.all([
        getAll(`/v1/financials/metrics?ticker=${encodeURIComponent(apiSymbol)}&version=latest&limit=1000`),
        getAll(`/v1/financials/ratios?ticker=${encodeURIComponent(apiSymbol)}&version=latest&limit=1000`)
      ]);
      await upsertBatch('threespread_metrics',metrics.filter(r=>r?.category&&r?.period_end).map(r=>({stock_id:stockId,ticker:symbol,period_end:r.period_end,period_of_report:r.period_of_report??null,period_length:num(r.period_length),period_type:r.period_type??null,fiscal_year:num(r.fiscal_year),fiscal_quarter:num(r.fiscal_quarter),category:r.category,value:num(r.value),currency:r.currency??null,unit:r.unit??null,spine:r.spine??null,derived:r.derived??null,is_valid:r.is_valid??null,raw_json:r})),'stock_id,category,period_end,period_type');
      await upsertBatch('threespread_ratios',ratios.filter(r=>r?.ratio_name&&r?.period_end).map(r=>({stock_id:stockId,ticker:symbol,ratio_category:r.ratio_category??null,ratio_name:r.ratio_name,value:num(r.value),value_pctile:num(r.value_pctile),missing_inputs:r.missing_inputs??null,period_end:r.period_end,period_of_report:r.period_of_report??null,period_length:num(r.period_length),period_type:r.period_type??null,fiscal_year:num(r.fiscal_year),fiscal_quarter:num(r.fiscal_quarter),spine:r.spine??null,derived:r.derived??null,is_valid:r.is_valid??null,raw_json:r})),'stock_id,ratio_name,period_end,period_type');
    }

    const quote=(await db('latest_quotes',{params:{select:'price',stock_id:`eq.${stockId}`,limit:1}}))?.[0]??null;
    const fundamental=buildFundamental(stock,statements,quote);
    if (fundamental) await upsertBatch('fundamentals',[fundamental],'stock_id,fiscal_period');
    summary.push({symbol,ok:true,fetched,statement_rows:statements.length,normalized_rows:normalized.length,metrics:metrics.length,ratios:ratios.length,fundamental:!!fundamental});
  } catch (e) {
    console.error(`[3spread-v2] ${symbol} failed: ${e.message}`); summary.push({symbol,ok:false,error:e.message});
    if (String(e.message).includes('3spread 429')) break;
  }
  console.log(`[3spread-v2] ${symbol} done`);
  await sleep(Number(process.env.SYNC_DELAY_MS || 75));
}

const failed=summary.filter(x=>!x.ok).length;
console.log(JSON.stringify({source:'3spread',version:2,total_stocks:stocks.length,completed:summary.filter(x=>x.ok).length,failed,summary},null,2));
if (failed) process.exitCode=1;
