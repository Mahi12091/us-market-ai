import Link from 'next/link';

export const metadata = {
  title: 'AI Market Analysis',
  description: 'AI-assisted market analysis based on verified structured market data.',
};

export default function Analysis() {
  return (
    <div className="info-page">
      <div className="info-shell">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> Research desk</div>
          <h1>AI Market Analysis</h1>
          <p className="info-lead">Turn verified market data into clear, explainable research. Quantitative models handle the numbers; AI explains the evidence, context and scenarios.</p>
          <div className="info-actions">
            <Link className="info-btn primary" href="/predictions">Explore Predictions →</Link>
            <Link className="info-btn" href="/markets">View Market Overview</Link>
          </div>
        </section>

        <div className="info-grid">
          <article className="info-card"><div className="info-kicker">Daily Brief</div><h2>Market Pulse</h2><p>Indices, breadth, sectors, volatility and major market drivers in one concise research view.</p></article>
          <article className="info-card"><div className="info-kicker">Company Research</div><h2>Stock Deep Dives</h2><p>Technical structure, fundamentals, earnings and news combined around individual US stocks.</p></article>
          <article className="info-card"><div className="info-kicker">Explainable AI</div><h2>Evidence First</h2><p>Generated commentary is grounded in supplied structured inputs instead of invented market numbers.</p></article>
        </div>

        <div className="analysis-grid">
          <section className="info-section brief-card">
            <div className="info-kicker">Research workflow</div>
            <h2>How the analysis engine works</h2>
            <div className="signal-list">
              <div className="signal-item"><span>01 · Market context</span><span>Indices + volatility</span></div>
              <div className="signal-item"><span>02 · Technical structure</span><span>Momentum + trend</span></div>
              <div className="signal-item"><span>03 · Company evidence</span><span>Fundamentals + earnings</span></div>
              <div className="signal-item"><span>04 · News & sentiment</span><span>Relevant signals</span></div>
              <div className="signal-item"><span>05 · AI explanation</span><span>Scenario + risks</span></div>
            </div>
          </section>
          <section className="info-section">
            <div className="info-kicker">Coverage</div>
            <h2>Built for US markets</h2>
            <p>Research is designed around US equities and crypto, with a scalable architecture for thousands of automatically generated asset pages.</p>
            <div className="info-actions"><Link className="info-btn" href="/stocks">Browse Stocks</Link><Link className="info-btn" href="/crypto">Explore Crypto</Link></div>
          </section>
        </div>

        <section className="info-section">
          <div className="info-kicker">Important</div>
          <h2>Research, not financial advice</h2>
          <p>Analysis and forecasts are estimates based on available data and model outputs. They are not guarantees, recommendations or personalized financial advice. Historical accuracy will be shown only after predictions are actually evaluated against later market outcomes.</p>
        </section>
      </div>
    </div>
  );
}
