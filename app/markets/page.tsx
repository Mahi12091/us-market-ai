import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Market Overview',
  description: 'US market overview covering major indices, breadth, volatility, sectors and market momentum.',
};

const indices = [
  ['S&P 500', 'SPX'],
  ['Nasdaq 100', 'NDX'],
  ['Dow Jones', 'DJI'],
  ['Russell 2000', 'RUT'],
  ['VIX', 'VIX'],
];

const sectors = ['Technology', 'Financials', 'Healthcare', 'Consumer', 'Industrials', 'Energy', 'Communication', 'Real Estate'];

export default function MarketsPage() {
  return (
    <div className="container market-page">
      <div className="market-shell">
        <section className="page-hero">
          <div className="page-hero-content">
            <div className="eyebrow">US Markets · Live Intelligence</div>
            <h1>Market Overview</h1>
            <p>One research view for US indices, breadth, volatility, sectors and market momentum. Once the market feed is connected, every panel below will update from verified data.</p>
            <div className="hero-actions">
              <Link className="blue-btn" href="/stocks">Explore US Stocks</Link>
              <Link className="outline-btn" href="/predictions">View AI Predictions</Link>
            </div>
          </div>
        </section>

        <section>
          <div className="section-card-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div><h2>Major market gauges</h2><p>Key benchmarks and volatility indicators</p></div>
            <span className="muted" style={{ fontSize: 10 }}>Data feed pending</span>
          </div>
          <div className="market-index-grid">
            {indices.map(([name, symbol]) => (
              <div className="index-card" key={symbol}>
                <div className="index-top"><div><div className="index-name">{name}</div><div className="index-symbol">{symbol}</div></div><span className="index-status">PENDING</span></div>
                <div className="index-value">—</div>
                <div className="index-pending">Awaiting verified market data</div>
              </div>
            ))}
          </div>
        </section>

        <section className="market-layout">
          <div className="section-card chart-panel">
            <div className="section-card-head" style={{ padding: 0 }}>
              <div><h2>Market chart</h2><p>Benchmark performance will appear here when price history is available.</p></div>
              <div className="range-tabs"><span className="active">1D</span><span>1W</span><span>1M</span><span>1Y</span></div>
            </div>
            <div className="fake-chart"><div className="chart-empty"><strong>Market history is being connected</strong><span>No numerical data is shown until the feed is verified.</span></div></div>
          </div>
          <div className="section-card breadth-card">
            <div><h2 style={{ margin: 0, fontSize: 20 }}>Market breadth</h2><p className="muted" style={{ fontSize: 11, margin: '5px 0 0' }}>Breadth and participation signals</p></div>
            {['Advancers vs decliners', 'Volume participation', 'New highs vs lows'].map((label) => (
              <div className="breadth-item" key={label}><div className="breadth-row"><span>{label}</span><strong>—</strong></div><div className="breadth-track"><div className="breadth-fill" /></div><div className="breadth-note">Awaiting market data</div></div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <div className="section-card-head"><div><h2>US sector dashboard</h2><p>Sector-level momentum and relative strength</p></div><span className="muted" style={{ fontSize: 10 }}>8 sectors</span></div>
          <div className="sector-grid">
            {sectors.map((sector) => <div className="sector-card" key={sector}><strong>{sector}</strong><span>Performance data pending</span><div className="sector-bar"><i /></div></div>)}
          </div>
        </section>

        <section className="market-note">
          <div className="note-card"><small>MARKET REGIME</small><h3>Trend & momentum</h3><p>AI market-regime classification will combine index trend, breadth, volatility and momentum after verified data is available.</p></div>
          <div className="note-card"><small>VOLATILITY</small><h3>Risk conditions</h3><p>Volatility and VIX-based context will be shown here without inventing values before the live feed is connected.</p></div>
          <div className="note-card"><small>RESEARCH</small><h3>From data to insight</h3><p>Use this page as the top-level market context for individual stock and crypto research pages.</p></div>
        </section>
      </div>
    </div>
  );
}
