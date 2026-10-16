import Link from 'next/link';

export const metadata = {
  title: "Crypto Market Intelligence & Research",
  description: "Explore cryptocurrency market context and quantitative research. Coverage and forecast availability depend on the latest validated source data.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/crypto" },
  openGraph: {
    title: "Crypto Market Intelligence & Research",
    description: "Explore cryptocurrency market context and quantitative research. Coverage and forecast availability depend on the latest validated source data.",
    url: "https://usmarketai.com/crypto",
    siteName: 'US Market AI',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: "Crypto Market Intelligence & Research",
    description: "Explore cryptocurrency market context and quantitative research. Coverage and forecast availability depend on the latest validated source data.",
  },
};

const assets = [
  ['BTC', 'Bitcoin', 'Primary crypto benchmark', 'Pending'],
  ['ETH', 'Ethereum', 'Smart-contract ecosystem', 'Pending'],
  ['SOL', 'Solana', 'High-throughput network', 'Pending'],
  ['XRP', 'XRP', 'Payments-focused asset', 'Pending'],
];

export default function CryptoPage() {
  return (
    <div className="info-page">
      <div className="info-shell">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> Digital assets</div>
          <h1>Crypto Intelligence</h1>
          <p className="info-lead">Crypto research is in preview while validated market data is being connected. Live prices, charts and forecasts are intentionally withheld until source coverage is verified.</p>
          <div className="info-actions"><Link className="info-btn primary" href="/predictions">View Predictions →</Link><Link className="info-btn" href="/news">Crypto News</Link></div>
        </section>

        <div className="info-grid">
          <article className="info-card"><div className="info-kicker">Market</div><h2>Live data pipeline</h2><p>Not connected yet. No live price, volume or volatility figures are presented until validated source records are available.</p></article>
          <article className="info-card"><div className="info-kicker">Signals</div><h2>Crypto Factors</h2><p>Momentum, volatility, BTC relationship, sentiment and other crypto-native factors feed the quantitative layer.</p></article>
          <article className="info-card"><div className="info-kicker">Forecasts</div><h2>Forecasts not available</h2><p>Forecast horizons are planned, but no crypto forecasts are published until the dedicated data and evaluation pipeline is active.</p></article>
        </div>

        <section className="info-section">
          <div className="info-kicker">Asset coverage</div>
          <h2>Crypto research directory</h2>
          <div className="crypto-table">
            <div>Asset</div><div>Role</div><div>Status</div><div>Research</div>
            {assets.map(([symbol, name, role, status]) => (
              <div key={`${symbol}-row`} style={{display:'contents'}}>
                <div><strong>{symbol} · {name}</strong></div>
                <div>{role}</div>
                <div>{status}</div>
                <div><Link href="/predictions">Coming soon</Link></div>
              </div>
            ))}
          </div>
        </section>

        <section className="info-section">
          <div className="info-kicker">Model note</div>
          <h2>Separate crypto pipeline</h2>
          <p>Crypto is treated separately from equities because its market structure, volatility and drivers differ. The eventual model can incorporate BTC correlation or dominance, momentum, volume, volatility and sentiment without pretending that stock-market factors behave identically in crypto.</p>
          <div className="legal-note">No live prices or prediction figures are shown here until verified data is available. This avoids publishing fabricated market information.</div>
        </section>
      </div>
    </div>
  );
}
