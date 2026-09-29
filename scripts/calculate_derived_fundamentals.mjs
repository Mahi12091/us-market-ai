import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.NEON_DATABASE_URL;
if (!databaseUrl) throw new Error('NEON_DATABASE_URL is not configured.');
const sql = neon(databaseUrl);

console.log('[derived] syncing statement fields into fundamentals...');
await sql`
WITH s AS (
  SELECT stock_id, fiscal_period,
    MAX(revenue) FILTER (WHERE statement_type='income_statement') revenue,
    MAX(cost_of_revenue) FILTER (WHERE statement_type='income_statement') cost_of_revenue,
    MAX(gross_profit) FILTER (WHERE statement_type='income_statement') gross_profit,
    MAX(operating_income) FILTER (WHERE statement_type='income_statement') operating_income,
    MAX(pretax_income) FILTER (WHERE statement_type='income_statement') pretax_income,
    MAX(net_income) FILTER (WHERE statement_type='income_statement') net_income,
    MAX(eps_diluted) FILTER (WHERE statement_type='income_statement') eps,
    MAX(shares_diluted) FILTER (WHERE statement_type='income_statement') shares_outstanding,
    MAX(ebitda) FILTER (WHERE statement_type='income_statement') ebitda,
    MAX(ebit) FILTER (WHERE statement_type='income_statement') ebit,
    MAX(rd_expense) FILTER (WHERE statement_type='income_statement') rd_expense,
    MAX(sga_expense) FILTER (WHERE statement_type='income_statement') sga_expense,
    MAX(tax_expense) FILTER (WHERE statement_type='income_statement') tax_expense,
    MAX(cash_and_equivalents) FILTER (WHERE statement_type='balance_sheet') cash,
    MAX(total_assets) FILTER (WHERE statement_type='balance_sheet') assets,
    MAX(current_assets) FILTER (WHERE statement_type='balance_sheet') current_assets,
    MAX(total_liabilities) FILTER (WHERE statement_type='balance_sheet') liabilities,
    MAX(current_liabilities) FILTER (WHERE statement_type='balance_sheet') current_liabilities,
    MAX(total_debt) FILTER (WHERE statement_type='balance_sheet') debt,
    MAX(shareholders_equity) FILTER (WHERE statement_type='balance_sheet') equity,
    MAX(short_term_investments) FILTER (WHERE statement_type='balance_sheet') sti,
    MAX(long_term_debt) FILTER (WHERE statement_type='balance_sheet') ltd,
    MAX(tangible_book_value) FILTER (WHERE statement_type='balance_sheet') tbv,
    MAX(working_capital) FILTER (WHERE statement_type='balance_sheet') wc,
    MAX(operating_cash_flow) FILTER (WHERE statement_type='cash_flow') ocf,
    MAX(capital_expenditure) FILTER (WHERE statement_type='cash_flow') capex,
    MAX(free_cash_flow) FILTER (WHERE statement_type='cash_flow') fcf
  FROM public.financial_statements GROUP BY stock_id, fiscal_period
), x AS (
  SELECT s.*, q.price, q.market_cap q_market_cap, q.shares_outstanding q_shares
  FROM s LEFT JOIN public.latest_quotes q ON q.stock_id=s.stock_id
)
UPDATE public.fundamentals f SET
  revenue=CASE WHEN COALESCE(f.revenue,0)=0 THEN x.revenue ELSE f.revenue END,
  cost_of_revenue=CASE WHEN COALESCE(f.cost_of_revenue,0)=0 THEN x.cost_of_revenue ELSE f.cost_of_revenue END,
  gross_profit=CASE WHEN COALESCE(f.gross_profit,0)=0 THEN x.gross_profit ELSE f.gross_profit END,
  operating_income=CASE WHEN COALESCE(f.operating_income,0)=0 THEN x.operating_income ELSE f.operating_income END,
  pretax_income=CASE WHEN COALESCE(f.pretax_income,0)=0 THEN x.pretax_income ELSE f.pretax_income END,
  net_income=CASE WHEN COALESCE(f.net_income,0)=0 THEN x.net_income ELSE f.net_income END,
  eps=CASE WHEN COALESCE(f.eps,0)=0 THEN x.eps ELSE f.eps END,
  shares_outstanding=CASE WHEN COALESCE(f.shares_outstanding,0)=0 THEN COALESCE(x.shares_outstanding,x.q_shares) ELSE f.shares_outstanding END,
  ebitda=CASE WHEN COALESCE(f.ebitda,0)=0 THEN x.ebitda ELSE f.ebitda END,
  ebit=CASE WHEN COALESCE(f.ebit,0)=0 THEN COALESCE(x.ebit,x.operating_income) ELSE f.ebit END,
  rd_expense=CASE WHEN COALESCE(f.rd_expense,0)=0 THEN x.rd_expense ELSE f.rd_expense END,
  sga_expense=CASE WHEN COALESCE(f.sga_expense,0)=0 THEN x.sga_expense ELSE f.sga_expense END,
  tax_expense=CASE WHEN COALESCE(f.tax_expense,0)=0 THEN x.tax_expense ELSE f.tax_expense END,
  cash_and_equivalents=CASE WHEN COALESCE(f.cash_and_equivalents,0)=0 THEN x.cash ELSE f.cash_and_equivalents END,
  total_assets=CASE WHEN COALESCE(f.total_assets,0)=0 THEN x.assets ELSE f.total_assets END,
  current_assets=CASE WHEN COALESCE(f.current_assets,0)=0 THEN x.current_assets ELSE f.current_assets END,
  total_liabilities=CASE WHEN COALESCE(f.total_liabilities,0)=0 THEN x.liabilities ELSE f.total_liabilities END,
  current_liabilities=CASE WHEN COALESCE(f.current_liabilities,0)=0 THEN x.current_liabilities ELSE f.current_liabilities END,
  total_debt=CASE WHEN COALESCE(f.total_debt,0)=0 THEN x.debt ELSE f.total_debt END,
  shareholders_equity=CASE WHEN COALESCE(f.shareholders_equity,0)=0 THEN x.equity ELSE f.shareholders_equity END,
  short_term_investments=CASE WHEN COALESCE(f.short_term_investments,0)=0 THEN x.sti ELSE f.short_term_investments END,
  long_term_debt=CASE WHEN COALESCE(f.long_term_debt,0)=0 THEN x.ltd ELSE f.long_term_debt END,
  tangible_book_value=CASE WHEN COALESCE(f.tangible_book_value,0)=0 THEN x.tbv ELSE f.tangible_book_value END,
  working_capital=CASE WHEN COALESCE(f.working_capital,0)=0 THEN x.wc ELSE f.working_capital END,
  operating_cash_flow=CASE WHEN COALESCE(f.operating_cash_flow,0)=0 THEN x.ocf ELSE f.operating_cash_flow END,
  capital_expenditure=CASE WHEN COALESCE(f.capital_expenditure,0)=0 THEN x.capex ELSE f.capital_expenditure END,
  free_cash_flow=CASE WHEN COALESCE(f.free_cash_flow,0)=0 THEN x.fcf ELSE f.free_cash_flow END,
  market_cap=CASE WHEN COALESCE(f.market_cap,0)=0 THEN COALESCE(x.q_market_cap,CASE WHEN x.price>0 AND COALESCE(f.shares_outstanding,x.q_shares)>0 THEN x.price*COALESCE(f.shares_outstanding,x.q_shares) END) ELSE f.market_cap END,
  updated_at=now()
FROM x WHERE f.stock_id=x.stock_id AND f.fiscal_period=x.fiscal_period;
`;

console.log('[derived] calculating valuation, profitability, cash-flow and leverage ratios...');
await sql`
UPDATE public.fundamentals f
SET
  enterprise_value=CASE WHEN COALESCE(f.enterprise_value,0)=0 AND f.market_cap>0 THEN f.market_cap+COALESCE(f.total_debt,0)-COALESCE(f.cash_and_equivalents,0)-COALESCE(f.short_term_investments,0) ELSE f.enterprise_value END,
  gross_margin=CASE WHEN COALESCE(f.gross_margin,0)=0 AND f.revenue>0 THEN f.gross_profit/f.revenue*100 ELSE f.gross_margin END,
  operating_margin=CASE WHEN COALESCE(f.operating_margin,0)=0 AND f.revenue>0 THEN f.operating_income/f.revenue*100 ELSE f.operating_margin END,
  net_margin=CASE WHEN COALESCE(f.net_margin,0)=0 AND f.revenue>0 THEN f.net_income/f.revenue*100 ELSE f.net_margin END,
  free_cash_flow=CASE WHEN COALESCE(f.free_cash_flow,0)=0 AND f.operating_cash_flow IS NOT NULL THEN f.operating_cash_flow-COALESCE(f.capital_expenditure,0) ELSE f.free_cash_flow END,
  fcf_margin=CASE WHEN COALESCE(f.fcf_margin,0)=0 AND f.revenue>0 AND COALESCE(f.free_cash_flow,0)<>0 THEN f.free_cash_flow/f.revenue*100 ELSE f.fcf_margin END,
  working_capital=CASE WHEN COALESCE(f.working_capital,0)=0 AND f.current_assets IS NOT NULL AND f.current_liabilities IS NOT NULL THEN f.current_assets-f.current_liabilities ELSE f.working_capital END,
  debt_equity=CASE WHEN COALESCE(f.debt_equity,0)=0 AND f.shareholders_equity>0 AND f.total_debt IS NOT NULL THEN f.total_debt/f.shareholders_equity ELSE f.debt_equity END,
  roe=CASE WHEN COALESCE(f.roe,0)=0 AND f.shareholders_equity>0 THEN f.net_income/f.shareholders_equity*100 ELSE f.roe END,
  roa=CASE WHEN COALESCE(f.roa,0)=0 AND f.total_assets>0 THEN f.net_income/f.total_assets*100 ELSE f.roa END,
  pe_ratio=CASE WHEN COALESCE(f.pe_ratio,0)=0 AND q.price>0 AND f.eps>0 THEN q.price/f.eps ELSE f.pe_ratio END,
  price_sales=CASE WHEN COALESCE(f.price_sales,0)=0 AND q.price>0 AND f.revenue>0 AND f.shares_outstanding>0 THEN q.price*f.shares_outstanding/f.revenue ELSE f.price_sales END,
  price_book=CASE WHEN COALESCE(f.price_book,0)=0 AND q.price>0 AND f.shareholders_equity>0 AND f.shares_outstanding>0 THEN q.price*f.shares_outstanding/f.shareholders_equity ELSE f.price_book END,
  earnings_yield=CASE WHEN COALESCE(f.earnings_yield,0)=0 AND q.price>0 AND f.eps IS NOT NULL THEN f.eps/q.price*100 ELSE f.earnings_yield END,
  book_value_per_share=CASE WHEN COALESCE(f.book_value_per_share,0)=0 AND f.shareholders_equity IS NOT NULL AND f.shares_outstanding>0 THEN f.shareholders_equity/f.shares_outstanding ELSE f.book_value_per_share END,
  fcf_per_share=CASE WHEN COALESCE(f.fcf_per_share,0)=0 AND f.free_cash_flow IS NOT NULL AND f.shares_outstanding>0 THEN f.free_cash_flow/f.shares_outstanding ELSE f.fcf_per_share END,
  price_to_fcf=CASE WHEN COALESCE(f.price_to_fcf,0)=0 AND q.price>0 AND f.free_cash_flow>0 AND f.shares_outstanding>0 THEN q.price/(f.free_cash_flow/f.shares_outstanding) ELSE f.price_to_fcf END,
  enterprise_value_to_revenue=CASE WHEN COALESCE(f.enterprise_value_to_revenue,0)=0 AND f.enterprise_value>0 AND f.revenue>0 THEN f.enterprise_value/f.revenue ELSE f.enterprise_value_to_revenue END,
  enterprise_value_to_ebitda=CASE WHEN COALESCE(f.enterprise_value_to_ebitda,0)=0 AND f.enterprise_value>0 AND f.ebitda>0 THEN f.enterprise_value/f.ebitda ELSE f.enterprise_value_to_ebitda END,
  ev_to_ebit=CASE WHEN COALESCE(f.ev_to_ebit,0)=0 AND f.enterprise_value>0 AND f.ebit>0 THEN f.enterprise_value/f.ebit ELSE f.ev_to_ebit END,
  peg_ratio=CASE WHEN COALESCE(f.peg_ratio,0)=0 AND f.pe_ratio>0 AND f.eps_growth>0 THEN f.pe_ratio/f.eps_growth ELSE f.peg_ratio END,
  roic=CASE WHEN COALESCE(f.roic,0)=0 AND f.ebit>0 AND f.shareholders_equity+COALESCE(f.total_debt,0)-COALESCE(f.cash_and_equivalents,0)>0 THEN f.ebit*(1-CASE WHEN f.pretax_income>0 AND f.tax_expense IS NOT NULL THEN LEAST(GREATEST(f.tax_expense/f.pretax_income,0),1) ELSE 0 END)/(f.shareholders_equity+COALESCE(f.total_debt,0)-COALESCE(f.cash_and_equivalents,0))*100 ELSE f.roic END,
  roce=CASE WHEN COALESCE(f.roce,0)=0 AND f.ebit>0 AND f.total_assets-COALESCE(f.current_liabilities,0)>0 THEN f.ebit/(f.total_assets-f.current_liabilities)*100 ELSE f.roce END,
  updated_at=now()
FROM public.latest_quotes q
WHERE f.stock_id=q.stock_id;
`;

console.log('[derived] done');
