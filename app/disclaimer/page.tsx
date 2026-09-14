export const metadata = { title: 'Disclaimer', description: 'Important limitations and financial research disclaimer for US Market AI.' };

export default function Disclaimer() {
  return (
    <div className="info-page">
      <div className="info-shell legal-layout">
        <section className="info-hero">
          <div className="eyebrow-row"><span className="eyebrow-dot" /> Legal & risk</div>
          <h1>Disclaimer</h1>
          <p className="info-lead">Please understand the limits of market data, forecasts and AI-generated research before relying on anything published by US Market AI.</p>
        </section>
        <section className="info-section">
          <div className="legal-note">US Market AI provides research and educational information only. Nothing on this website should be treated as personalized investment, trading, tax or legal advice.</div>
          <h2>Predictions are estimates</h2>
          <p>Forecasts are generated from historical and market inputs and may be wrong. A confidence score is a model signal, not a probability of profit or a guarantee of an outcome.</p>
          <h2>Market data limitations</h2>
          <p>Market data may be delayed, incomplete, corrected after publication or unavailable for a period of time. Users should independently verify important information with reliable primary sources before making decisions.</p>
          <h2>AI-generated analysis</h2>
          <p>AI commentary is intended to explain supplied structured evidence. It can contain errors or omissions and should not be treated as a substitute for independent research or professional advice.</p>
          <h2>No guarantee of performance</h2>
          <p>Past performance and historical prediction accuracy do not guarantee future results. Financial markets are inherently uncertain and losses are possible.</p>
        </section>
      </div>
    </div>
  );
}
