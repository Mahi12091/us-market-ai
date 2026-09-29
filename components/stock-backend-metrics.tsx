import React from 'react';

type Props = {
  fundamentals: any;
  metrics: any[];
  ratios: any[];
};

const num = (v: any) => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 });
const money = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`;
const pct = (v: any) => v == null ? '—' : `${Number(v).toFixed(2)}%`;

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function valueFor(key: string, value: any) {
  const lower = key.toLowerCase();
  if (value == null) return '—';
  if (lower.includes('margin') || lower.includes('yield') || lower.includes('growth') || lower.includes('return') || lower.includes('ownership')) return pct(value);
  if (lower.includes('revenue') || lower.includes('income') || lower.includes('cash') || lower.includes('debt') || lower.includes('assets') || lower.includes('equity') || lower.includes('capital') || lower.includes('value') || lower.includes('profit')) return money(value);
  return num(value);
}

export default function StockBackendMetrics({ fundamentals, metrics, ratios }: Props) {
  const fundamentalEntries = fundamentals ? Object.entries(fundamentals).filter(([key, value]) => !['id', 'stock_id', 'updated_at', 'created_at'].includes(key) && value != null) : [];
  const metricEntries = metrics.filter(x => x?.value != null);
  const ratioEntries = ratios.filter(x => x?.value != null);

  return <div className="seo-research-stack">
    <section className="seo-card" id="backend-fundamentals">
      <div className="seo-card-head"><div><div className="eyebrow">BACKEND DATA</div><h2>Complete Fundamental Metrics</h2></div></div>
      {fundamentalEntries.length ? <div className="seo-data-table"><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
        {fundamentalEntries.map(([key, value]) => <tr key={key}><th>{label(key)}</th><td>{valueFor(key, value)}</td></tr>)}
      </tbody></table></div> : <div className="seo-empty">No fundamental snapshot is available for this stock.</div>}
    </section>

    <section className="seo-card" id="backend-metrics">
      <div className="seo-card-head"><div><div className="eyebrow">3SPREAD METRICS</div><h2>Source Metrics & Derived Metrics</h2></div></div>
      {metricEntries.length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Category</th><th>Value</th><th>Unit</th><th>Derived</th></tr></thead><tbody>
        {metricEntries.slice(0, 100).map((m, i) => <tr key={`${m.category}-${m.period_end}-${i}`}><td>{m.period_end ?? '—'}</td><td>{label(String(m.category ?? 'metric'))}</td><td>{valueFor(String(m.category ?? ''), m.value)}</td><td>{m.unit ?? m.currency ?? '—'}</td><td>{m.derived ? 'Yes' : 'No'}</td></tr>)}
      </tbody></table></div> : <div className="seo-empty">No source metrics are available yet.</div>}
    </section>

    <section className="seo-card" id="backend-ratios">
      <div className="seo-card-head"><div><div className="eyebrow">3SPREAD RATIOS</div><h2>Financial Ratios & Percentiles</h2></div></div>
      {ratioEntries.length ? <div className="seo-data-table"><table><thead><tr><th>Period</th><th>Ratio</th><th>Value</th><th>Percentile</th><th>Derived</th></tr></thead><tbody>
        {ratioEntries.slice(0, 100).map((r, i) => <tr key={`${r.ratio_name}-${r.period_end}-${i}`}><td>{r.period_end ?? '—'}</td><td>{label(String(r.ratio_name ?? 'ratio'))}</td><td>{valueFor(String(r.ratio_name ?? ''), r.value)}</td><td>{r.value_pctile == null ? '—' : num(r.value_pctile)}</td><td>{r.derived ? 'Yes' : 'No'}</td></tr>)}
      </tbody></table></div> : <div className="seo-empty">No ratio data is available yet.</div>}
    </section>
  </div>;
}
