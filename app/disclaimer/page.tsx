import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Financial Research Disclaimer',
  description: 'Understand the investment, data quality, forecast, and AI limitations of US Market AI research.',
  alternates: { canonical: '/disclaimer' },
  openGraph: { title: 'Financial Research Disclaimer | US Market AI', description: 'Understand the investment, data quality, forecast, and AI limitations of US Market AI research.', url: 'https://usmarketai.com/disclaimer', siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: 'Financial Research Disclaimer | US Market AI', description: 'Understand the investment, data quality, forecast, and AI limitations of US Market AI research.' },
};

export default function Disclaimer() {
  return (
    <div className="info-page">
      <div className="info-shell legal-layout">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> Legal & risk</div>
          <h1>Financial Research Disclaimer</h1>
          <p className="info-lead">Understand the limits of market data, quantitative estimates, rankings, and AI-generated research before using them in a decision.</p>
        </section>
        <section className="info-section">
          <div className="legal-note">US Market AI is an informational and educational research platform. Its content is not individualized investment, trading, tax, accounting, or legal advice, and it is not an offer, solicitation, or recommendation to buy or sell a security or digital asset.</div>
          <h2>Investment risk</h2>
          <p>Investing and trading involve risk, including loss of some or all invested capital. Prices can move sharply, liquidity can disappear, and instruments may be affected by company events, market conditions, interest rates, regulation, currency movements, and other factors. Consider your circumstances and consult a qualified professional where appropriate.</p>
          <h2>Forecasts and confidence scores</h2>
          <p>Predictions are estimates based on available inputs and model assumptions, not facts about the future. A score or confidence label is not a guaranteed probability of profit, a measure of suitability, or a promise of accuracy. Forecasts can be wrong, stale, unstable, or unavailable for particular securities and time horizons.</p>
          <h2>Historical performance</h2>
          <p>Historical prices, backtests, and prior prediction outcomes do not guarantee future results. Backtests may be affected by data gaps, survivorship, selection bias, transaction costs, liquidity assumptions, and methodology changes. Do not interpret historical performance as a promise of future returns.</p>
          <h2>Data freshness and source limitations</h2>
          <p>Quotes, financial statements, ratios, corporate actions, news, and event dates may be delayed, incomplete, corrected, or unavailable. Missing data must not be interpreted as zero or as evidence that an event did not occur. Verify material information with official filings, issuer disclosures, exchanges, or other reliable primary sources.</p>
          <h2>AI-generated material</h2>
          <p>AI-assisted summaries and explanations can omit context, misread source material, or produce inaccurate statements. Treat them as aids to research, check the underlying evidence, and do not rely on generated text alone for a financial decision.</p>
          <h2>Third-party information</h2>
          <p>Third-party links, news, data, and provider labels are supplied for context. US Market AI does not guarantee the accuracy or availability of external content and is not responsible for changes made by external providers.</p>
          <h2>Independent decision-making</h2>
          <p>You are responsible for evaluating the risks and verifying information before acting. US Market AI does not know your investment objectives, financial position, experience, tax status, or risk tolerance. Nothing on this site creates an advisory, fiduciary, brokerage, or client relationship.</p>
        </section>
      </div>
    </div>
  );
}
