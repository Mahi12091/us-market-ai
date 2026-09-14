import Link from 'next/link';

export const metadata = { title: 'About', description: 'Learn about US Market AI and its market intelligence approach.' };

export default function About() {
  return (
    <div className="info-page">
      <div className="info-shell">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> About the platform</div>
          <h1>Research built around evidence.</h1>
          <p className="info-lead">US Market AI is a market intelligence platform for US equities and crypto, combining verified data, technical analysis, fundamentals, sentiment and quantitative models into one research experience.</p>
          <div className="info-actions"><Link className="info-btn primary" href="/stocks">Explore US Stocks →</Link><Link className="info-btn" href="/analysis">Read AI Analysis</Link></div>
        </section>

        <div className="info-grid">
          <article className="info-card"><div className="info-kicker">01 · Data</div><h2>Structured inputs</h2><p>Market data is normalized into a common architecture so pages can be generated consistently at scale.</p></article>
          <article className="info-card"><div className="info-kicker">02 · Quant</div><h2>Models do the math</h2><p>Numerical forecasts are intended to come from quantitative features and ensembles rather than language-model guesses.</p></article>
          <article className="info-card"><div className="info-kicker">03 · AI</div><h2>Explain the evidence</h2><p>AI is used to turn verified structured signals into readable market commentary and research context.</p></article>
        </div>

        <section className="info-section">
          <div className="info-kicker">Our approach</div>
          <h2>From raw signals to useful research</h2>
          <ul>
            <li>Collect and validate market, fundamental, earnings and news inputs.</li>
            <li>Calculate technical indicators and quantitative prediction features.</li>
            <li>Generate forecasts across multiple horizons and track them against later outcomes.</li>
            <li>Use AI to explain the evidence, risks and scenarios without inventing missing data.</li>
          </ul>
        </section>

        <section className="info-section">
          <div className="info-kicker">Important</div>
          <h2>Estimates, not guarantees</h2>
          <p>US Market AI is intended for research and educational purposes. Predictions can be wrong, market data can be delayed or incomplete, and nothing on the platform is personalized financial advice.</p>
          <div className="info-actions"><Link className="info-btn" href="/disclaimer">Read Disclaimer</Link><Link className="info-btn" href="/contact">Contact the team</Link></div>
        </section>
      </div>
    </div>
  );
}
