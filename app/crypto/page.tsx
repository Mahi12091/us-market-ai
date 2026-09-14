import Link from 'next/link';

export const metadata = { title: 'Crypto', description: 'Cryptocurrency market intelligence and quantitative forecasts.' };

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
          <p className="info-lead">A dedicated research layer for digital assets, designed around price momentum, volatility, market context, sentiment and crypto-specific signals.</p>
          <div className="info-actions"><Link className="info-btn primary" href="/predictions">View Predictions →</Link><Link className="info-btn" href="/news">Crypto News</Link></div>
        </section>

        <div className="info-grid">
          <article className="info-card"><div className="info-kicker">Market</div><h2>Live Crypto Data</h2><p>Price, volume, volatility and market status will populate automatically once the data pipeline is connected.</p></article>
          <article className="info-card"><div className="info-kicker">Signals</div><h2>Crypto Factors</h2><p>Momentum, volatility, BTC relationship, sentiment and other crypto-native factors feed the quantitative layer.</p></article>
          <article className="info-card"><div className="info-kicker">Forecasts</div><h2>Multiple Horizons</h2><p>Forecast architecture supports 24H, 7D, 30D and 90D scenarios with confidence and later evaluation.</p></article>
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
