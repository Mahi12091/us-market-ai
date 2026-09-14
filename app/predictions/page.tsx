import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Predictions',
  description: 'Quantitative market predictions for US stocks and crypto across multiple time horizons.',
};

const horizons = ['24H', '7D', '30D', '90D'];
const leaders = [
  ['BULL', 'Top bullish signals', 'Awaiting model'],
  ['BEAR', 'Top bearish signals', 'Awaiting model'],
  ['CONF', 'Highest confidence', 'Awaiting model'],
  ['7D', 'Best 7D accuracy', 'Awaiting evaluation'],
];

export default function Predictions() {
  return (
    <div className="container predictions-page">
      <div className="predictions-shell">
        <section className="prediction-hero">
          <div className="prediction-hero-copy">
            <div className="eyebrow">Quantitative intelligence</div>
            <h1>AI Predictions</h1>
            <p>Forecasts across 24 hours, 7 days, 30 days and 90 days, with confidence, signals and verified prediction history.</p>
            <div className="prediction-actions">
              <a className="blue-btn" href="#forecasts">Explore Forecasts</a>
              <a className="outline-btn" href="#history">Prediction History</a>
            </div>
          </div>
        </section>

        <section className="prediction-overview">
          <div className="prediction-stat"><small>MODEL COVERAGE</small><strong>US Markets</strong><span>Stocks + crypto</span></div>
          <div className="prediction-stat"><small>HORIZONS</small><strong>4</strong><span>24H · 7D · 30D · 90D</span></div>
          <div className="prediction-stat"><small>LIVE STATUS</small><strong>Preparing</strong><span>Prediction engine pending</span></div>
          <div className="prediction-stat"><small>VALIDATION</small><strong>Tracked</strong><span>Hit rate + error history</span></div>
        </section>

        <section id="forecasts" className="prediction-layout">
          <div className="prediction-panel">
            <div className="prediction-panel-head"><div><h2>Forecast dashboard</h2><p>Model outputs will populate automatically from verified market features.</p></div></div>
            <div className="prediction-table">
              <div className="prediction-row head"><span>Horizon</span><span>Direction</span><span>Confidence</span><span>Status</span></div>
              {horizons.map((h) => (
                <div className="prediction-row" key={h}>
                  <b>{h}</b>
                  <span className="signal-pill">Awaiting model</span>
                  <div><span>—</span><div className="confidence-track"><div className="confidence-fill" /></div></div>
                  <span>Pending</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="prediction-panel">
            <div className="prediction-panel-head"><div><h2>Signal leaders</h2><p>Highest-priority model modules</p></div></div>
            <div className="leaderboard">
              {leaders.map(([icon, title, value]) => (
                <div className="leader-row" key={title}>
                  <div className="leader-icon">{icon}</div>
                  <div><b>{title}</b><small>{value}</small></div>
                  <div className="leader-value">—</div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section id="history" className="prediction-history">
          <div className="prediction-panel history-card">
            <div className="prediction-panel-head"><div><h2>Prediction history</h2><p>Past forecasts will be compared with actual market outcomes.</p></div></div>
            <div className="history-list">
              <div className="history-row"><b>Asset</b><span>Horizon</span><span>Result</span><span>Accuracy</span></div>
              {['AAPL', 'NVDA', 'MSFT', 'BTC'].map((x) => <div className="history-row" key={x}><b>{x}</b><span>—</span><span>Not evaluated</span><span>—</span></div>)}
            </div>
          </div>

          <aside className="prediction-panel accuracy-card">
            <div className="eyebrow">Model validation</div>
            <div className="accuracy-big">—</div>
            <div className="accuracy-note">Verified accuracy will be calculated only after predictions have enough completed outcomes.</div>
            <div className="accuracy-bars">
              {['24H accuracy', '7D accuracy', '30D accuracy', '90D accuracy'].map((x) => <div className="accuracy-line" key={x}><div><b>{x}</b><span>—</span></div><div className="accuracy-track"><i /></div></div>)}
            </div>
          </aside>
        </section>

        <section className="prediction-disclaimer">
          <small>RESEARCH DISCLAIMER</small>
          <h3>Predictions are estimates, not financial advice.</h3>
          <p>The quantitative engine will use market and other verified structured inputs to produce model estimates. Historical accuracy will be shown from evaluated predictions rather than assumed performance.</p>
        </section>
      </div>
    </div>
  );
}
