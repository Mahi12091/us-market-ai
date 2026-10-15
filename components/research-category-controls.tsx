'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Row = Record<string, unknown>;
type Mode = 'screener' | 'compare';

const label = (key: string) => ({
  symbol: 'Ticker', company_name: 'Company', sector: 'Sector', industry: 'Industry',
  exchange: 'Exchange', market_cap: 'Market cap (USD)', asset_type: 'Asset type',
}[key] ?? key.replaceAll('_', ' '));

function display(key: string, value: unknown) {
  if (value == null || value === '') return '—';
  if (key === 'market_cap') {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: number >= 1_000_000_000 ? 'compact' : 'standard' }) : '—';
  }
  return String(value);
}

export default function ResearchCategoryControls({ rows, headers, mode }: { rows: Row[]; headers: string[]; mode: Mode }) {
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('all');
  const [minCap, setMinCap] = useState('');
  const [maxCap, setMaxCap] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const pageSize = 50;
  const sectors = useMemo(() => [...new Set(rows.map(row => String(row.sector ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(row => {
      const text = [row.symbol, row.company_name, row.sector, row.industry, row.exchange].map(v => String(v ?? '')).join(' ').toLowerCase();
      const hasCap = row.market_cap != null && row.market_cap !== '' && Number.isFinite(Number(row.market_cap));
      const cap = hasCap ? Number(row.market_cap) : null;
      return (!term || text.includes(term))
        && (sector === 'all' || row.sector === sector)
        && (minCap === '' || (cap !== null && cap >= Number(minCap)))
        && (maxCap === '' || (cap !== null && cap <= Number(maxCap)));
    });
  }, [rows, search, sector, minCap, maxCap]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedRows = selected.map(symbol => rows.find(row => String(row.symbol) === symbol)).filter((row): row is Row => Boolean(row));
  const toggle = (symbol: string) => setSelected(current => current.includes(symbol) ? current.filter(item => item !== symbol) : current.length < 4 ? [...current, symbol] : current);
  const reset = () => { setSearch(''); setSector('all'); setMinCap(''); setMaxCap(''); setPage(1); };

  return <div className="research-controls">
    <div className="research-filter-toolbar">
      <label className="research-filter-field research-filter-search">
        <span>Search companies</span>
        <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Ticker, company, sector…" autoComplete="off" />
      </label>
      <label className="research-filter-field">
        <span>Sector</span>
        <select value={sector} onChange={event => { setSector(event.target.value); setPage(1); }}>
          <option value="all">All sectors</option>
          {sectors.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      {mode === 'screener' && <>
        <label className="research-filter-field research-filter-number">
          <span>Min market cap (USD)</span>
          <input inputMode="numeric" type="number" min="0" value={minCap} onChange={event => { setMinCap(event.target.value); setPage(1); }} placeholder="No minimum" />
        </label>
        <label className="research-filter-field research-filter-number">
          <span>Max market cap (USD)</span>
          <input inputMode="numeric" type="number" min="0" value={maxCap} onChange={event => { setMaxCap(event.target.value); setPage(1); }} placeholder="No maximum" />
        </label>
      </>}
      <button className="research-filter-reset" type="button" onClick={reset}>Reset filters</button>
    </div>
    <div className="research-filter-status" aria-live="polite">
      <span><strong>{filtered.length.toLocaleString('en-US')}</strong> matching companies</span>
      {mode === 'compare' && <span><strong>{selected.length}/4</strong> selected to compare</span>}
    </div>
    {mode === 'compare' && <section className="research-compare-panel" aria-labelledby="research-compare-title">
      <div className="research-table-heading"><div><h2 id="research-compare-title">Side-by-side company comparison</h2><p>Select up to four companies below. Only stored company facts are compared; missing values remain unavailable.</p></div><button type="button" className="research-filter-reset" onClick={() => setSelected([])} disabled={!selected.length}>Clear selection</button></div>
      {selectedRows.length ? <div className="research-table-scroll"><table><caption className="sr-only">Selected company comparison</caption><thead><tr><th>Metric</th>{selectedRows.map(row => <th key={String(row.symbol)}>{String(row.symbol)}</th>)}</tr></thead><tbody>{(['company_name','sector','industry','exchange','market_cap'] as const).map(key => <tr key={key}><th scope="row">{label(key)}</th>{selectedRows.map(row => <td key={String(row.symbol)}>{key === 'company_name' && row.slug ? <Link href={'/stocks/' + String(row.slug)}>{display(key, row[key])}</Link> : display(key, row[key])}</td>)}</tr>)}</tbody></table></div> : <p className="research-compare-empty">Choose two to four tickers from the results to compare company facts.</p>}
    </section>}
    <section className="research-table-card"><div className="research-table-heading"><div><h2>{mode === 'screener' ? 'Filterable US stock universe' : 'Choose companies to compare'}</h2><p>{mode === 'screener' ? 'Use search, sector and market-cap filters to narrow the currently indexed universe.' : 'Select up to four companies. Open a company page for deeper fundamentals and risk context.'}</p></div><span>{{currentPage} / {pageCount}</span></div>
      <div className="research-table-scroll"><table><caption className="sr-only">{mode === 'screener' ? 'US stock screener results' : 'Companies available for comparison'}</caption><thead><tr>{mode === 'compare' && <th scope="col">Select</th>}{headers.map(key => <th scope="col" key={key}>{label(key)}</th>)}<th scope="col">Research</th></tr></thead><tbody>{visible.map((row, index) => {
        const symbol = String(row.symbol ?? '');
        const isSelected = selected.includes(symbol);
        return <tr key={String(row.id ?? symbol ?? index)}>
          {mode === 'compare' && <td><input type="checkbox" aria-label={'Select ' + symbol + ' for comparison'} checked={isSelected} disabled={!isSelected && selected.length >= 4} onChange={() => toggle(symbol)} /></td>}
          {headers.map(key => <td key={key}>{key === 'symbol' && row.slug ? <Link className="research-symbol" href={'/stocks/' + String(row.slug)}>{display(key, row[key])}</Link> : display(key, row[key])}</td>)}
          <td>{row.slug ? <Link className="research-open" href={'/stocks/' + String(row.slug)}>Open research →</Link> : '—'}</td>
        </tr>;
      })}</tbody></table></div>
      <div className="research-pagination"><span>Showing {filtered.length ? ((currentPage - 1) * pageSize + 1).toLocaleString('en-US') : 0}–{currentPage * pageSize < filtered.length ? (currentPage * pageSize).toLocaleString('en-US') : filtered.length.toLocaleString('en-US')} of {filtered.length.toLocaleString('en-US')}</span><div><button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>Previous</button><button type="button" onClick={() => setPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage >= pageCount}>Next</button></div></div>
    </section>
  </div>;
}
