import React from 'react';

type Props = {
  financialStatements: any[];
  dividends: any[];
  ownership: any[];
  monthlyResearch: any[];
  quarterlyResearch: any[];
};

const money = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`;
const num = (v: any) => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
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
  return [...byKey.values()].sort((a, b) =>
    String(b.period_end ?? b.fiscal_period ?? '').localeCompare(String(a.period_end ?? a.fiscal_period ?? ''))
  );
}

function periodLabel(r: any) {
  const period = r.period_end ?? r.fiscal_period ?? '—';
  const type = r.period_type ? String(r.period_type).replaceAll('_', ' ') : '';
  return type ? `${period} · ${type}` : period;
}

export default function StockDataExpansion({ financialStatements, dividends, ownership, monthlyResearch, quarterlyResearch }: Props) {
  return <div className="seo-research-stack">
    <Card id="financial-statements" eyebrow="FINANCIAL STATEMENTS" title="Income Statement, Balance Sheet & Cash Flow">
      {financialStatements.length ? <>
        <h3>Income Statement</h3>
        {statementRows(financialStatements, 'income_statement').length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Revenue</th><th>Gross Profit</th><th>Operating Income</th><th>Net Income</th><th>EPS</th></tr></thead><tbody>
          {statementRows(financialStatements, 'income_statement').slice(0, 8).map((r) => <tr key={r.id}><td>{periodLabel(r)}</td><td>{money(r.revenue)}</td><td>{money(r.gross_profit)}</td><td>{money(r.operating_income)}</td><td>{money(r.net_income)}</td><td>{num(r.eps_diluted ?? r.eps_basic)}</td></tr>)}
        </tbody></table></div> : <Empty>Income-statement data is unavailable.</Empty>}

        <h3>Balance Sheet</h3>
        {statementRows(financialStatements, 'balance_sheet').length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Cash</th><th>Total Assets</th><th>Total Liabilities</th><th>Total Debt</th><th>Equity</th></tr></thead><tbody>
          {statementRows(financialStatements, 'balance_sheet').slice(0, 8).map((r) => <tr key={`bs-${r.id}`}><td>{periodLabel(r)}</td><td>{money(r.cash_and_equivalents)}</td><td>{money(r.total_assets)}</td><td>{money(r.total_liabilities)}</td><td>{money(r.total_debt)}</td><td>{money(r.shareholders_equity)}</td></tr>)}
        </tbody></table></div> : <Empty>Balance-sheet data is unavailable.</Empty>}

        <h3>Cash Flow Statement</h3>
        {statementRows(financialStatements, 'cash_flow').length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Operating Cash Flow</th><th>CapEx</th><th>Free Cash Flow</th><th>Cash</th><th>Total Debt</th></tr></thead><tbody>
          {statementRows(financialStatements, 'cash_flow').slice(0, 8).map((r) => <tr key={`cf-${r.id}`}><td>{periodLabel(r)}</td><td>{money(r.operating_cash_flow)}</td><td>{money(r.capital_expenditure)}</td><td>{money(r.free_cash_flow)}</td><td>{money(r.cash_and_equivalents)}</td><td>{money(r.total_debt)}</td></tr>)}
        </tbody></table></div> : <Empty>Cash-flow statement data is unavailable.</Empty>}
      </> : <Empty>Detailed financial statements will appear after a verified financial-statement sync runs.</Empty>}
    </Card>

    <Card id="cash-flow" eyebrow="CASH FLOW" title="Cash Flow Summary">
      {statementRows(financialStatements, 'cash_flow').length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Operating Cash Flow</th><th>CapEx</th><th>Free Cash Flow</th></tr></thead><tbody>
        {statementRows(financialStatements, 'cash_flow').slice(0, 8).map((r) => <tr key={`summary-cf-${r.id}`}><td>{periodLabel(r)}</td><td>{money(r.operating_cash_flow)}</td><td>{money(r.capital_expenditure)}</td><td>{money(r.free_cash_flow)}</td></tr>)}
      </tbody></table></div> : <Empty>Cash-flow summary is unavailable.</Empty>}
    </Card>

    <Card id="dividend" eyebrow="DIVIDEND" title="Dividend History, Yield & Payment Dates">
      {dividends.length ? <div className="seo-data-table"><table><thead><tr><th>Ex-Date</th><th>Record Date</th><th>Payment Date</th><th>Amount</th><th>Frequency</th></tr></thead><tbody>
        {dividends.map((d) => <tr key={d.id}><td>{d.ex_date ?? '—'}</td><td>{d.record_date ?? '—'}</td><td>{d.payment_date ?? '—'}</td><td>{d.amount == null ? '—' : `$${Number(d.amount).toFixed(4)}`}</td><td>{d.frequency ?? '—'}</td></tr>)}
      </tbody></table></div> : <Empty>Dividend history will appear when a verified dividend feed is connected.</Empty>}
    </Card>

    <Card id="ownership" eyebrow="OWNERSHIP" title="Institutional, Insider & Share Ownership">
      {ownership.length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Shares Outstanding</th><th>Institutional</th><th>Insider</th><th>Float</th></tr></thead><tbody>
        {ownership.map((o) => <tr key={o.id}><td>{o.period_end ?? '—'}</td><td>{num(o.shares_outstanding)}</td><td>{pct(o.institutional_ownership_percent)}</td><td>{pct(o.insider_ownership_percent)}</td><td>{num(o.float_shares)}</td></tr>)}
      </tbody></table></div> : <Empty>Ownership data will appear after a verified ownership feed is connected.</Empty>}
    </Card>

    <Card id="monthly-research" eyebrow="AI MONTHLY RESEARCH" title="Monthly Stock Research & What Changed">
      {monthlyResearch.length ? monthlyResearch.map((r) => <div className="faq-template-row" key={r.id}><h3>{r.research_month}</h3><p className="seo-prose">{r.ai_summary ?? r.fundamental_summary ?? r.technical_summary ?? 'Monthly research generated from verified data.'}</p></div>) : <Empty>Monthly AI research will appear after the scheduled research job runs.</Empty>}
    </Card>

    <Card id="quarterly-research" eyebrow="AI QUARTERLY RESEARCH" title="Quarterly Earnings & Financial Research">
      {quarterlyResearch.length ? quarterlyResearch.map((r) => <div className="faq-template-row" key={r.id}><h3>{r.fiscal_period}</h3><p className="seo-prose">{r.ai_summary ?? r.financial_summary ?? r.earnings_summary ?? 'Quarterly research generated from verified filing and earnings data.'}</p></div>) : <Empty>Quarterly AI research will appear after the earnings/filing research job runs.</Empty>}
    </Card>
  </div>;
}
