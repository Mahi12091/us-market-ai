import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market News',
  description: 'Latest US market and company news with sentiment intelligence.',
};

const feeds = [
  { title: 'Market Movers', kicker: 'MARKETS', text: 'Price-moving stories, catalysts and verified market events in one fast research feed.', tone: 'blue' },
  { title: 'Company News', kicker: 'EQUITIES', text: 'Company-specific developments, filings, product updates and material announcements.', tone: 'purple' },
  { title: 'Earnings News', kicker: 'EARNINGS', text: 'Earnings releases, guidance changes, estimates and post-report market reactions.', tone: 'green' },
  { title: 'Macro & Fed', kicker: 'MACRO', text: 'Federal Reserve decisions, inflation, jobs, rates and other major macro catalysts.', tone: 'gold' },
  { title: 'Technology', kicker: 'SECTOR', text: 'AI, semiconductors, cloud, software and other technology-sector developments.', tone: 'blue' },
  { title: 'Crypto', kicker: 'DIGITAL ASSETS', text: 'Crypto market developments, regulation, institutional activity and major catalysts.', tone: 'purple' },
];

export default function News() {
  return (
    <div className="container news-page">
      <section className="news-hero">
        <div className="news-hero-copy">
          <div className="eyebrow">News intelligence</div>
          <h1>Market News</h1>
          <p>Company news, market events and sentiment signals organized into a clean research feed for US markets.</p>
          <div className="news-actions">
            <a className="blue-btn" href="#latest">Latest Stories</a>
            <a className="outline-btn" href="#topics">Browse Topics</a>
          </div>
        </div>
        <div className="news-hero-art" aria-hidden="true">
          <div className="news-terminal"><span>US MARKET AI</span><b>NEWS</b><i>LIVE FEED</i></div>
          <div className="news-line line-one" /><div className="news-line line-two" /><div className="news-line line-three" />
        </div>
      </section>

      <section id="latest" className="news-feature-grid">
        <div className="news-feature-card">
          <div className="feature-visual"><span>VERIFIED MARKET FEED</span><div className="feature-bars"><i /><i /><i /><i /><i /></div></div>
          <div className="feature-copy">
            <div className="eyebrow">Latest intelligence</div>
            <h2>Verified stories will appear here</h2>
            <p>The news pipeline will populate this area automatically with source, publication time, related tickers and sentiment once the market-data and news feed is connected.</p>
            <div className="feature-meta"><span>Source verified</span><span>Sentiment ready</span><span>Ticker linked</span></div>
          </div>
        </div>
        <aside className="news-side-card">
          <div className="section-card-head"><div><h2>News signals</h2><p>Built for fast scanning</p></div></div>
          <div className="signal-row"><span>Market impact</span><b>Ready</b></div><div className="signal-row"><span>Sentiment</span><b>Ready</b></div><div className="signal-row"><span>Company links</span><b>Ready</b></div><div className="signal-row"><span>AI summaries</span><b>Ready</b></div>
        </aside>
      </section>

      <section id="topics" className="news-topics">
        <div className="section-card-head news-section-head"><div><h2>Explore news feeds</h2><p>Separate streams for the stories that matter most.</p></div><span className="news-count">6 FEEDS</span></div>
        <div className="news-feed-grid">
          {feeds.map((feed) => <article className={`news-feed-card ${feed.tone}`} key={feed.title}><div className="feed-icon">↗</div><div className="feed-kicker">{feed.kicker}</div><h3>{feed.title}</h3><p>{feed.text}</p><div className="feed-footer"><span>Verified stories</span><b>→</b></div></article>)}
        </div>
      </section>

      <section className="news-research-banner"><div className="research-symbol">◈</div><div><small>RESEARCH WORKFLOW</small><h2>News → sentiment → prediction</h2><p>Relevant stories can feed the sentiment layer and become one of the inputs used by the quantitative prediction engine.</p></div><a className="outline-btn" href="/predictions">View Predictions</a></section>
    </div>
  );
}
