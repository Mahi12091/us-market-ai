import React from 'react';

type Props = {
  financialStatements: any[];
  dividends: any[];
  ownership: any[];
  monthlyResearch: any[];
  quarterlyResearch: any[];
};

const money = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`;
const num = (v: any) => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 });
const pct = (v: any) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

function Card({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="seo-card" id={id}><div className="seo-card-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div></div>{children}</section>;
}

function Empty({ children }: { children: string }) {
  return <div className="seo-empty">{children}</div>;
}

function statementRows(rows: any[], type: string) {
  const filtered = rows.filter(r => r.statement_type === type);
  const byKey = new Map<string, any>();
  for (const r of filtered) {
    const key = `${r.period_end ?? r.fiscal_period ?? ''}|${r.period_type ?? ''}`;
    const old = byKey.get(key);
    if (!old || (r.data_source === '3spread' && old.data_source !== '3spread')) byKey.set(key, r);
  }
  return [...byKey.values()].sort((a, b) => String(b.period_end ?? b.fiscal_period ?? '').localeCompare(String(a.period_end ?? a.fiscal_period ?? '')));
}

function periodLabel(r: any) {
  const period = r.period_end ?? r.fiscal_period ?? '—';
  const type = r.period_type ? String(r.period_type).replaceAll('_', ' ') : '';
  return type ? `${period} · ${type}` : period;
}

export default function StockDataExpansion({ financialStatements, dividends, ownership, monthlyResearch, quarterlyResearch }: Props) {
  const income = statementRows(financialStatements, 'income_statement');
  const balance = statementRows(financialStatements, 'balance_sheet');
  const cashflow = statementRows(financialStatements, 'cash_flow');

  return <div className="seo-research-stack">
    <Card id="financial-statements" eyebrow="FINANCIAL STATEMENTS" title="Income Statement, Balance Sheet & Cash Flow">
      {financialStatements.length ? <>
        <h3>Income Statement</h3>
        {income.length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Revenue</th><th>Cost of Revenue</th><th>Gross Profit</th><th>Operating Income</th><th>Pretax Income</th><th>Net Income</th><th>Basic EPS</th><th>Diluted EPS</th><th>Basic Shares</th><th>Diluted Shares</th></tr></thead><tbody>
          {income.slice(0, 12).map(r => <tr key={r.id}><td>{periodLabel(r)}</td><td>{money(r.revenue)}</td><td>{money(r.cost_of_revenue)}</td><td>{money(r.gross_profit)}</td><td>{money(r.operating_income)}</td><td>{money(r.pretax_income)}</td><td>{money(r.net_income)}</td><td>{num(r.eps_basic)}</td><td>{num(r.eps_diluted)}</td><td>{num(r.shares_basic)}</td><td>{num(r.shares_diluted)}</td></tr>)}
        </tbody></table></div> : <Empty>Income-statement data is unavailable.</Empty>}

        <h3>Balance Sheet</h3>
        {balance.length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Cash & Equivalents</th><th>Current Assets</th><th>Total Assets</th><th>Current Liabilities</th><th>Total Liabilities</th><th>Total Debt</th><th>Shareholders' Equity</th></tr></thead><tbody>
          {balance.slice(0, 12).map(r => <tr key={`bs-${r.id}`}><td>{periodLabel(r)}</td><td>{money(r.cash_and_equivalents)}</td><td>{money(r.current_assets)}</td><td>{money(r.total_assets)}</td><td>{money(r.current_liabilities)}</td><td>{money(r.total_liabilities)}</td><td>{money(r.total_debt)}</td><td>{money(r.shareholders_equity)}</td></tr>)}
        </tbody></table></div> : <Empty>Balance-sheet data is unavailable.</Empty>}

        <h3>Cash Flow Statement</h3>
        {cashflow.length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Operating Cash Flow</th><th>Capital Expenditure</th><th>Free Cash Flow</th><th>Cash & Equivalents</th><th>Total Debt</th></tr></thead><tbody>
          {cashflow.slice(0, 12).map(r => <tr key={`cf-${r.id}`}><td>{periodLabel(r)}</td><td>{money(r.operating_cash_flow)}</td><td>{money(r.capital_expenditure)}</td><td>{money(r.free_cash_flow)}</td><td>{money(r.cash_and_equivalents)}</td><td>{money(r.total_debt)}</td></tr>)}
        </tbody></table></div> : <Empty>Cash-flow statement data is unavailable.</Empty>}
      </> : <Empty>Detailed financial statements will appear after a verified financial-statement sync runs.</Empty>}
    </Card>

    <Card id="cash-flow" eyebrow="CASH FLOW" title="Cash Flow Summary">
      {cashflow.length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Operating Cash Flow</th><th>CapEx</th><th>Free Cash Flow</th></tr></thead><tbody>
        {cashflow.slice(0, 12).map(r => <tr key={`summary-cf-${r.id}`}><td>{periodLabel(r)}</td><td>{money(r.operating_cash_flow)}</td><td>{money(r.capital_expenditure)}</td><td>{money(r.free_cash_flow)}</td></tr>)}
      </tbody></table></div> : <Empty>Cash-flow summary is unavailable.</Empty>}
    </Card>

    <Card id="dividend" eyebrow="DIVIDEND" title="Dividend History, Yield & Payment Dates">
      {dividends.length ? <div className="seo-data-table"><table><thead><tr><th>Ex-Date</th><th>Record Date</th><th>Payment Date</th><th>Declaration Date</th><th>Amount</th><th>Frequency</th><th>Currency</th><th>Source</th></tr></thead><tbody>
        {dividends.map(d => <tr key={d.id}><td>{d.ex_date ?? '—'}</td><td>{d.record_date ?? '—'}</td><td>{d.payment_date ?? '—'}</td><td>{d.declaration_date ?? '—'}</td><td>{d.amount == null ? '—' : `$${Number(d.amount).toFixed(4)}`}</td><td>{d.frequency ?? '—'}</td><td>{d.currency ?? 'USD'}</td><td>{d.data_source ?? '—'}</td></tr>)}
      </tbody></table></div> : <Empty>Dividend history will appear when a verified dividend feed is connected.</Empty>}
    </Card>

    <Card id="ownership" eyebrow="OWNERSHIP" title="Institutional, Insider & Share Ownership">
      {ownership.length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Shares Outstanding</th><th>Institutional %</th><th>Insider %</th><th>Float Shares</th><th>Source</th></tr></thead><tbody>
        {ownership.map(o => <tr key={o.id}><td>{o.period_end ?? '—'}</td><td>{num(o.shares_outstanding)}</td><td>{pct(o.institutional_ownership_percent)}</td><td>{pct(o.insider_ownership_percent)}</td><td>{num(o.float_shares)}</td><td>{o.data_source ?? '—'}</td></tr>)}
      </tbody></table></div> : <Empty>Ownership data will appear after a verified ownership feed is connected.</Empty>}
    </Card>

    <Card id="monthly-research" eyebrow="AI MONTHLY RESEARCH" title="Monthly Stock Research & What Changed">
      {monthlyResearch.length ? monthlyResearch.map(r => <div className="faq-template-row" key={r.id}><h3>{r.research_month}</h3><div className="seo-data-table"><table><tbody>
        <tr><th>Price Change</th><td>{pct(r.price_change_percent)}</td></tr><tr><th>Revenue Change</th><td>{pct(r.revenue_change_percent)}</td></tr><tr><th>EPS Change</th><td>{pct(r.eps_change_percent)}</td></tr><tr><th>Technical Summary</th><td>{r.technical_summary ?? '—'}</td></tr><tr><th>Fundamental Summary</th><td>{r.fundamental_summary ?? '—'}</td></tr><tr><th>News Summary</th><td>{r.news_summary ?? '—'}</td></tr><tr><th>Risk Summary</th><td>{r.risk_summary ?? '—'}</td></tr><tr><th>Catalyst Summary</th><td>{r.catalyst_summary ?? '—'}</td></tr><tr><th>AI Summary</th><td>{r.ai_summary ?? '—'}</td></tr><tr><th>Model</th><td>{r.model ?? '—'}</td></tr>
      </tbody></table></div></div>) : <Empty>Monthly AI research will appear after the scheduled research job runs.</Empty>}
    </Card>

    <Card id="quarterly-research" eyebrow="AI QUARTERLY RESEARCH" title="Quarterly Earnings & Financial Research">
      {quarterlyResearch.length ? quarterlyResearch.map(r => <div className="faq-template-row" key={r.id}><h3>{r.fiscal_period}</h3><div className="seo-data-table"><table><tbody>
        <tr><th>Period End</th><td>{r.period_end ?? '—'}</td></tr><tr><th>Earnings Summary</th><td>{r.earnings_summary ?? '—'}</td></tr><tr><th>Financial Summary</th><td>{r.financial_summary ?? '—'}</td></tr><tr><th>Guidance</th><td>{r.guidance_summary ?? '—'}</td></tr><tr><th>Management Commentary</th><td>{r.management_commentary ?? '—'}</td></tr><tr><th>Risks</th><td>{r.risks_summary ?? '—'}</td></tr><tr><th>Catalysts</th><td>{r.catalysts_summary ?? '—'}</td></tr><tr><th>YoY</th><td>{r.yoy_summary ?? '—'}</td></tr><tr><th>QoQ</th><td>{r.qoq_summary ?? '—'}</td></tr><tr><th>AI Summary</th><td>{r.ai_summary ?? '—'}</td></tr><tr><th>Model</th><td>{r.model ?? '—'}</td></tr>
      </tbody></table></div></div>) : <Empty>Quarterly research will appear after the earnings/filing research job runs.</Empty>}
    </Card>
  </div>;
}
