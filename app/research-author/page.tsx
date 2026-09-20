import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'US Market AI Research Desk',
  description: 'Meet the US Market AI Research Desk and learn how market data, quantitative models and AI-assisted research are presented.',
};

export default function ResearchAuthorPage() {
  return (
    <div className="info-page">
      <div className="info-shell">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> Research author</div>
          <h1>US Market AI Research Desk</h1>
          <p className="info-lead">The Research Desk presents market data, technical indicators, fundamentals, quantitative model outputs, news context and AI-assisted explanations across US Market AI.</p>
          <div className="info-actions"><Link className="info-btn primary" href="/stocks">Explore US Stocks →</Link><Link className="info-btn" href="/about">About the platform</Link></div>
        </section>
        <div className="info-grid">
          <article className="info-card"><div className="info-kicker">01 · Data</div><h2>Verified inputs</h2><p>Stock pages are built from structured market, fundamental, earnings, news and historical-price datasets available to the platform.</p></article>
          <article className="info-card"><div className="info-kicker">02 · Quant</div><h2>Model outputs</h2><p>Quantitative predictions are displayed as estimates and can be evaluated against later outcomes.</p></article>
          <article className="info-card"><div className="info-kicker">03 · AI</div><h2>Research explanations</h2><p>AI-assisted writing is used to explain structured evidence while missing data is kept clearly marked as unavailable.</p></article>
        </div>
        <section className="info-section">
          <div className="info-kicker">Editorial approach</div>
          <h2>Separate facts, models and commentary</h2>
          <ul>
            <li>Market and company facts are presented separately from model estimates.</li>
            <li>Short-horizon predictions are not presented as distant-year targets.</li>
            <li>Prediction history is retained so matured forecasts can be compared with actual outcomes.</li>
            <li>Unavailable data is not replaced with invented values.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
