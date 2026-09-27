import { neon } from '@neondatabase/serverless';

const REQUIRED = ['THREESPREAD_API_KEY2', 'NEON_DATABASE_URL'];
for (const name of REQUIRED) {
  if (!process.env[name]) throw new Error(`${name} is not configured.`);
}

const API = 'https://api.3spread.com';
const sql = neon(process.env.NEON_DATABASE_URL);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const norm = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

async function getJson(path) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(API + path, {
      headers: { Accept: 'application/json', apikey: process.env.THREESPREAD_API_KEY2 }
    });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch {}
    if (response.ok) return body;
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 5) {
      throw new Error(`3spread ${response.status}: ${text.slice(0, 500)}`);
    }
    await sleep(response.status === 429 ? 65000 : Math.min(30000, 3000 * 2 ** (attempt - 1)));
  }
  throw new Error('3spread request failed');
}

async function getAll(path) {
  const rows = [];
  let cursor = null;
  let guard = 0;
  do {
    const url = new URL(API + path);
    if (cursor) url.searchParams.set('cursor', cursor);
    const body = await getJson(url.pathname + url.search);
    rows.push(...(Array.isArray(body?.data) ? body.data : []));
    const next = body?.next_cursor ?? body?.pagination?.next_cursor ?? null;
    if (!next || next === cursor || ++guard > 100) break;
    cursor = next;
  } while (cursor);
  return rows;
}

async function query(sqlText, values = []) {
  return sql.query(sqlText, values);
}

async function upsert(table, rows, conflict, chunkSize = 250) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const keys = [...new Set(chunk.flatMap(row => Object.keys(row)))];
    const values = [];
    const tuples = chunk.map(row => `(${keys.map(key => {
      values.push(row[key] ?? null);
      return `$${values.length}`;
    }).join(',')})`).join(',');
    const conflictCols = conflict.split(',').map(x => x.trim()).filter(Boolean);
    const updates = keys.filter(key => !conflictCols.includes(key))
      .map(key => `"${key}"=EXCLUDED."${key}"`).join(',');
    const sqlText = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(',')}) VALUES ${tuples} ON CONFLICT (${conflictCols.map(k => `"${k}"`).join(',')}) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}`;
    await query(sqlText, values);
  }
}

function normalizedPeriodType(row) {
  const p = String(row.period_type ?? row.period ?? '').toLowerCase();
  if (p.includes('ttm') || p.includes('trailing')) return 'ttm';
  if (p.includes('annual') || p === 'fy') return 'annual';
  if (p.includes('quarter') || p.includes('three') || p.includes('six') || p.includes('nine')) return 'quarterly';
  if (p.includes('point')) return row.fiscal_quarter ? 'quarterly' : 'annual';
  return null;
}

function normalizedStatementType(value) {
  const s = String(value ?? '').toLowerCase();
  if (s === 'inc' || s.includes('income')) return 'income_statement';
  if (s === 'bs' || s.includes('balance')) return 'balance_sheet';
  if (s === 'cf' || s.includes('cash')) return 'cash_flow';
  return null;
}

function fiscalPeriodFn(row) {
  const year = row?.fiscal_year ?? String(row?.period_end ?? '').slice(0, 4);
  const quarter = row?.fiscal_quarter;
  return year ? `FY-${year}${quarter ? `-Q${quarter}` : ''}` : String(row?.period_end ?? 'latest');
}

const aliases = {
  revenue: ['revenue', 'revenues', 'sales', 'sales_revenue', 'total_revenue'],
  cost_of_revenue: ['cost_of_revenue', 'cost_of_sales', 'cost_of_goods_sold'],
  gross_profit: ['gross_profit'], operating_income: ['operating_income', 'income_from_operations'],
  pretax_income: ['pretax_income', 'income_before_tax'], net_income: ['net_income', 'net_income_loss', 'net_income_attributable_to_parent'],
  eps_diluted: ['eps_diluted', 'diluted_eps', 'earnings_per_share_diluted'], eps_basic: ['eps_basic', 'basic_eps', 'earnings_per_share_basic'],
  shares_diluted: ['shares_diluted', 'diluted_shares', 'weighted_average_shares_diluted'], shares_basic: ['shares_basic', 'basic_shares', 'weighted_average_shares_basic'],
  cash_and_equivalents: ['cash_and_equivalents', 'cash_and_cash_equivalents', 'cash_and_short_term_investments', 'cash'],
  short_term_investments: ['short_term_investments', 'marketable_securities', 'short_term_investments_and_cash'],
  total_assets: ['total_assets', 'assets'], current_assets: ['current_assets', 'total_current_assets'],
  total_liabilities: ['total_liabilities', 'liabilities'], current_liabilities: ['current_liabilities', 'total_current_liabilities'],
  total_debt: ['total_debt', 'debt', 'debt_and_finance_leases'], long_term_debt: ['long_term_debt', 'long_term_debt_noncurrent'],
  shareholders_equity: ['shareholders_equity', 'stockholders_equity', 'total_equity', 'equity'],
  operating_cash_flow: ['operating_cash_flow', 'net_cash_operating', 'net_cash_provided_by_operating_activities', 'net_cash_provided_by_used_in_operating_activities', 'cash_from_operations'],
  capital_expenditure: ['capital_expenditure', 'capital_expenditures', 'purchases_of_property_plant_and_equipment'],
  free_cash_flow: ['free_cash_flow', 'fcf'], ebitda: ['ebitda'], ebit: ['ebit', 'operating_income'],
  rd_expense: ['rd_expense', 'research_and_development'], sga_expense: ['sga_expense', 'selling_general_and_administrative'],
  tax_expense: ['tax_expense', 'income_tax_expense']
};
const reverse = new Map(Object.entries(aliases).flatMap(([dest, keys]) => keys.map(key => [norm(key), dest])));

function collectLeaves(obj, path = [], out = [], meta = {}) {
  if (obj == null) return out;
  if (Array.isArray(obj)) { for (const value of obj) collectLeaves(value, path, out, meta); return out; }
  if (typeof obj !== 'object') {
    const value = num(obj);
    if (value != null) out.push({ key: path.map(norm).join('_'), value, label: meta.label ?? null });
    return out;
  }
  const local = { ...meta };
  for (const key of ['label', 'name', 'title', 'canonical_name', 'line_item', 'metric_name']) if (obj[key] != null) local.label = String(obj[key]);
  for (const [key, value] of Object.entries(obj)) {
    if (['label', 'name', 'title', 'canonical_name', 'line_item', 'metric_name', 'unit', 'currency'].includes(key)) continue;
    collectLeaves(value, [...path, key], out, local);
  }
  return out;
}

function extractFields(statementJson) {
  const sections = statementJson?.sections;
  const out = {};
  const pick = (section, keys) => {
    const obj = sections?.[section];
    if (!obj) return null;
    for (const key of keys) { const value = num(obj?.[key]?.value); if (value != null) return value; }
    return null;
  };
  const direct = {
    revenue: pick('revenue', ['total_revenue', 'net_revenue']),
    cost_of_revenue: pick('cost_and_expenses', ['cost_of_revenue', 'cost_of_sales', 'cost_of_goods_sold']),
    gross_profit: pick('cost_and_expenses', ['gross_profit']), operating_income: pick('cost_and_expenses', ['operating_income']),
    pretax_income: pick('non_operating', ['income_before_taxes', 'pretax_income']),
    net_income: pick('net_income', ['net_income', 'net_income_to_common', 'net_income_to_parent']),
    eps_diluted: pick('per_share', ['eps_diluted']), eps_basic: pick('per_share', ['eps_basic']),
    shares_diluted: pick('per_share', ['shares_diluted']), shares_basic: pick('per_share', ['shares_basic']),
    cash_and_equivalents: pick('assets', ['cash_and_equivalents']), total_assets: pick('assets', ['total_assets']), current_assets: pick('assets', ['total_current_assets']),
    total_liabilities: pick('liabilities', ['total_liabilities']), current_liabilities: pick('liabilities', ['total_current_liabilities']),
    total_debt: pick('liabilities', ['total_borrowings', 'long_term_debt', 'short_term_borrowings']),
    shareholders_equity: pick('equity', ['total_equity', 'total_common_equity']),
    operating_cash_flow: pick('operating', ['net_cash_provided_by_used_in_operating_activities', 'net_cash_operating', 'cash_from_operations', 'operating_cash_flow']),
    capital_expenditure: pick('investing', ['capital_expenditures', 'capital_expenditure', 'payments_to_acquire_property_plant_and_equipment', 'purchases_of_property_plant_and_equipment']),
    free_cash_flow: pick('operating', ['free_cash_flow', 'fcf']), depreciation_amortization: pick('operating', ['depreciation_and_amortization']),
    ebitda: pick('operating', ['ebitda']), ebit: pick('operating', ['ebit']),
    rd_expense: pick('operating', ['research_and_development', 'rd_expense']), sga_expense: pick('operating', ['selling_general_and_administrative', 'sga_expense']),
    tax_expense: pick('non_operating', ['income_tax_expense', 'tax_expense'])
  };
  for (const [key, value] of Object.entries(direct)) if (value != null) out[key] = value;
  if (Object.keys(out).length < 3) {
    for (const leaf of collectLeaves(statementJson)) {
      const destination = reverse.get(norm(leaf.label ?? '')) || reverse.get(norm(leaf.key));
      if (destination && out[destination] == null) out[destination] = leaf.value;
    }
  }
  return out;
}

function latestByType(rows, type) {
  return rows.filter(row => normalizedStatementType(row.statement_type) === type)
    .sort((a, b) => String(b.period_end ?? '').localeCompare(String(a.period_end ?? '')))[0] ?? null;
}

function buildFundamental(stock, statements, quote) {
  const income = latestByType(statements, 'income_statement');
  const balance = latestByType(statements, 'balance_sheet');
  const cashflow = latestByType(statements, 'cash_flow');
  const inf = income ? extractFields(income.statement_json) : {};
  const bsf = balance ? extractFields(balance.statement_json) : {};
  const cff = cashflow ? extractFields(cashflow.statement_json) : {};
  if (!income && !balance && !cashflow) return null;
  const revenue = inf.revenue ?? null, gross = inf.gross_profit ?? null, op = inf.operating_income ?? null, net = inf.net_income ?? null;
  const eps = inf.eps_diluted ?? inf.eps_basic ?? null, assets = bsf.total_assets ?? null, liabilities = bsf.total_liabilities ?? null;
  const cash = bsf.cash_and_equivalents ?? null, debt = bsf.total_debt ?? null, equity = bsf.shareholders_equity ?? null;
  const cfo = cff.operating_cash_flow ?? null, capex = cff.capital_expenditure != null ? Math.abs(cff.capital_expenditure) : null;
  const fcf = cff.free_cash_flow ?? (cfo != null && capex != null ? cfo - capex : null);
  const price = num(quote?.price), marketCap = num(stock.market_cap);
  const enterpriseValue = marketCap != null && cash != null && debt != null ? marketCap + debt - cash : null;
  const pe = price != null && eps != null && eps > 0 ? price / eps : null;
  const ps = price != null && revenue != null && revenue > 0 && marketCap != null ? marketCap / revenue : null;
  const pb = price != null && equity != null && equity > 0 && marketCap != null ? marketCap / equity : null;
  const evRevenue = enterpriseValue != null && revenue != null && revenue > 0 ? enterpriseValue / revenue : null;
  const ebitda = inf.ebitda ?? null;
  const evEbitda = enterpriseValue != null && ebitda != null && ebitda > 0 ? enterpriseValue / ebitda : null;
  const latest = income ?? balance ?? cashflow;
  const out = {
    stock_id: Number(stock.id), fiscal_period: fiscalPeriodFn(latest), fiscal_year: num(latest?.fiscal_year),
    period_type: normalizedPeriodType(latest) ?? 'quarterly', report_date: latest?.period_end ?? null, data_source: '3spread',
    market_cap: marketCap, enterprise_value: enterpriseValue, revenue, gross_profit: gross, operating_income: op, net_income: net,
    eps, pe_ratio: pe, price_sales: ps, price_book: pb,
    debt_equity: equity != null && debt != null && equity !== 0 ? debt / equity : null,
    roe: equity != null && net != null && equity !== 0 ? net / equity * 100 : null,
    roa: assets != null && net != null && assets !== 0 ? net / assets * 100 : null,
    free_cash_flow: fcf, total_assets: assets, total_liabilities: liabilities, cash_and_equivalents: cash, total_debt: debt,
    shareholders_equity: equity, current_assets: bsf.current_assets ?? null, current_liabilities: bsf.current_liabilities ?? null,
    operating_cash_flow: cfo, capital_expenditure: capex, cost_of_revenue: inf.cost_of_revenue ?? null,
    pretax_income: inf.pretax_income ?? null, tax_expense: inf.tax_expense ?? null, ebitda, ebit: inf.ebit ?? null,
    rd_expense: inf.rd_expense ?? null, sga_expense: inf.sga_expense ?? null, short_term_investments: bsf.short_term_investments ?? null,
    long_term_debt: bsf.long_term_debt ?? null
  };
  if (revenue != null && gross != null) out.gross_margin = gross / revenue * 100;
  if (revenue != null && op != null) out.operating_margin = op / revenue * 100;
  if (revenue != null && net != null) out.net_margin = net / revenue * 100;
  if (revenue != null && fcf != null) out.fcf_margin = fcf / revenue * 100;
  if (pe != null && pe > 0) out.earnings_yield = 100 / pe;
  if (evRevenue != null) out.enterprise_value_to_revenue = evRevenue;
  if (evEbitda != null) out.enterprise_value_to_ebitda = evEbitda;
  return out;
}

const stockRows = await query(`SELECT id, symbol, market_cap FROM public.stocks WHERE is_active=true AND asset_type='stock' ORDER BY id ASC`);
if (!stockRows.length) throw new Error('No active stocks found.');

console.log(`[3spread-compact] active stocks: ${stockRows.length}`);
console.log('[3spread-compact] normalized financial statements + fundamentals only; raw 3spread JSON/line-items are intentionally not stored.');

let completed = 0, failed = 0, normalizedRows = 0, fundamentalRows = 0, quotaHit = false;
const failures = [];

for (let index = 0; index < stockRows.length; index++) {
  const stock = stockRows[index];
  const symbol = String(stock.symbol ?? '').toUpperCase();
  const apiSymbol = symbol.replace(/\./g, '-');
  console.log(`[3spread-compact] ${index + 1}/${stockRows.length} ${symbol}`);
  try {
    const statements = await getAll(`/v1/financials/statements?ticker=${encodeURIComponent(apiSymbol)}&version=latest&limit=10`);
    const rows = [];
    for (const statement of statements) {
      const statementType = normalizedStatementType(statement.statement_type);
      const periodType = normalizedPeriodType(statement);
      const fields = extractFields(statement.statement_json);
      if (!statementType || !periodType || !Object.keys(fields).length) continue;
      const row = {
        stock_id: Number(stock.id), statement_type: statementType, period_type: periodType,
        fiscal_period: fiscalPeriodFn(statement), period_end: statement.period_end ?? null, data_source: '3spread'
      };
      Object.assign(row, fields);
      delete row.ebitda; delete row.depreciation_amortization;
      if (row.capital_expenditure != null) row.capital_expenditure = Math.abs(row.capital_expenditure);
      if (row.operating_cash_flow != null && row.capital_expenditure != null && row.free_cash_flow == null) row.free_cash_flow = row.operating_cash_flow - row.capital_expenditure;
      if (row.revenue != null || row.net_income != null || row.total_assets != null || row.operating_cash_flow != null) rows.push(row);
    }
    if (rows.length) {
      await upsert('financial_statements', rows, 'stock_id,statement_type,period_type,fiscal_period');
      normalizedRows += rows.length;
    }
    const quoteRows = await query(`SELECT price FROM public.latest_quotes WHERE stock_id=$1 LIMIT 1`, [Number(stock.id)]);
    const fundamental = buildFundamental(stock, statements, quoteRows[0] ?? null);
    if (fundamental) {
      await upsert('fundamentals', [fundamental], 'stock_id,fiscal_period');
      fundamentalRows++;
    }
    completed++;
  } catch (error) {
    const message = String(error?.message ?? error);
    failed++; failures.push({ symbol, error: message });
    console.error(`[3spread-compact] ${symbol} failed: ${message}`);
    if (message.includes('3spread 429')) {
      quotaHit = true;
      console.error('[3spread-compact] 3spread rate/quota limit reached; stopping so completed stocks remain intact.');
      break;
    }
  }
  await sleep(150);
}

console.log(JSON.stringify({
  source: '3spread', mode: 'compact-normalized', total_stocks: stockRows.length,
  completed, failed, normalized_statement_rows: normalizedRows, fundamental_rows: fundamentalRows,
  quota_hit: quotaHit, failures: failures.slice(0, 100)
}, null, 2));
if (quotaHit) process.exitCode = 2;
