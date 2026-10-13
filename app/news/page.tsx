import type { Metadata } from 'next';
import { createDatabaseClient } from '@/lib/neon';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Market News', description: 'Latest US company and market news with ticker-linked sentiment intelligence.' };

type NewsRow = { id: string; stock_id: string | null; title: string; summary: string | null; url: string | null; source: string | null; published_at: string | null; sentiment: string | null; sentiment_score: number | null };
type StockRow = { id: string; symbol: string; slug: string | null; company_name: string };

const tones = ['blue','purple','green','gold','blue','purple'];
const feeds = [
  ['Market Movers','MARKETS','Recent stories associated with tracked US stocks.'],
  ['Company News','EQUITIES','Ticker-linked company developments and announcements.'],
  ['Earnings News','EARNINGS','Earnings-related stories when supplied by the news feed.'],
  ['Macro & Fed','MACRO','Macro stories when a tracked ticker association is available.'],
  ['Technology','SECTOR','Technology-company news from the tracked universe.'],
  ['Crypto','DIGITAL ASSETS','Crypto coverage remains a separate data pipeline.'],
];

const date = (v: string | null | undefined) => {
  if (!v) return 'Publication time unavailable';
  const parsed = new Date(v);
  if (!Number.isFinite(parsed.getTime())) return 'Publication time unavailable';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(parsed);
};

const cleanText = (value: string | null | undefined) => (value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim();

const safeExternalUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export default async function News() {
  const supabase = createDatabaseClient();
  const { data: rawNews } = await supabase.from('news').select('id,stock_id,title,summary,url,source,published_at,sentiment,sentiment_score').order('published_at',{ascending:false,nullsFirst:false}).limit(40);
  const items = (rawNews ?? []) as NewsRow[];
  const ids = [...new Set(items.map(n=>n.stock_id).filter((id): id is string => Boolean(id)))];
  const { data: rawStocks } = ids.length ? await supabase.from('stocks').select('id,symbol,slug,company_name').in('id',ids) : {data:[]};
  const stocks = (rawStocks ?? []) as StockRow[];
  const stockMap = new Map(stocks.map(s=>[s.id,s]));
  const latest = items;
  const featured = latest[0];

  return <div className="container news-page"><section className="news-hero"><div className="news-hero-copy"><div className="eyebrow">News intelligence</div><h1>Market News</h1><p>Verified stories linked to tracked US stocks, with source, publication time and sentiment stored by the market-data workflow.</p><div className="news-actions"><a className="blue-btn" href="#latest">Latest Stories</a><a className="outline-btn" href="#topics">Browse Topics</a></div></div><div className="news-hero-art" aria-hidden="true"><div className="news-terminal"><span>US MARKET AI</span><b>NEWS</b><i>VERIFIED FEED</i></div><div className="news-line line-one"/><div className="news-line line-two"/><div className="news-line line-three"/></div></section>

    <section id="latest" className="news-feature-grid"><div className="news-feature-card"><div className="feature-visual"><span>{featured ? 'VERIFIED MARKET FEED' : 'FEED READY'}</span><div className="feature-bars"><i/><i/><i/><i/><i/></div></div><div className="feature-copy"><div className="eyebrow">Latest intelligence</div>{featured ? <><h2>{cleanText(featured.title) || 'Market story'}</h2><p>{cleanText(featured.summary) || 'Open the publisher source for the full report.'}</p><div className="feature-meta"><span>{featured.stock_id ? stockMap.get(featured.stock_id)?.symbol ?? 'Market' : 'Market'}</span><span>{cleanText(featured.sentiment) || 'neutral'}</span><span>{cleanText(featured.source) || 'Market News'}</span></div></> : <><h2>No recent stories yet</h2><p>The next successful news sync will populate this page automatically. No placeholder headlines are presented as real news.</p></>}{safeExternalUrl(featured?.url) ? <a className="text-link" href={safeExternalUrl(featured?.url)!} target="_blank" rel="noopener noreferrer">Open source story →</a> : <span className="text-link text-link-disabled">Source link unavailable</span>}</div></div><aside className="news-side-card"><div className="section-card-head"><div><h2>Feed status</h2><p>Backend-linked news signals</p></div></div><div className="signal-row"><span>Latest stories loaded</span><b>{items.length}</b></div><div className="signal-row"><span>Ticker associations</span><b>{new Set(items.map(n=>n.stock_id).filter(Boolean)).size || '—'}</b></div><div className="signal-row"><span>With sentiment</span><b>{items.filter(n => ['bullish','neutral','bearish'].includes((n.sentiment ?? '').toLowerCase())).length}</b></div><div className="signal-row"><span>Valid source links</span><b>{items.filter(n => Boolean(safeExternalUrl(n.url))).length}</b></div></aside></section>

    <section className="section-card"><div className="section-card-head news-section-head"><div><h2>Latest stories</h2><p>The 40 most recently published records available from the news database. Times are shown in US Eastern Time.</p></div><span className="news-count">{items.length} LOADED</span></div><div className="news-feed-grid">{latest.length ? latest.map((n,i)=>{const s=n.stock_id ? stockMap.get(n.stock_id) : undefined;const sourceUrl = safeExternalUrl(n.url); const storyTitle = cleanText(n.title) || 'Market story'; return <article className="news-feed-card news-story-card" key={n.id}><div className={`feed-icon ${tones[i % tones.length] ?? 'blue'}`}>↗</div><div><div className="feed-kicker">{s?.symbol ?? 'MARKET'} · {(cleanText(n.sentiment) || 'neutral').toUpperCase()}</div><h3>{storyTitle}</h3><p>{cleanText(n.summary) || 'Summary not supplied. Open the publisher source to read the full story.'}</p><div className="feed-footer"><span>{cleanText(n.source) || 'Publisher'} · {date(n.published_at)}</span>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${storyTitle}`}>Read source ↗</a> : s?.slug ? <a href={`/stocks/${s.slug}#news`}>View stock ↗</a> : <span>Source unavailable</span>}</div></div></article>}) : <div className="empty-state">No verified news records are available yet.</div>}</div></section>

    <section id="topics" className="news-topics"><div className="section-card-head news-section-head"><div><h2>Explore news feeds</h2><p>Coverage categories supported by the research workflow.</p></div><span className="news-count">6 FEEDS</span></div><div className="news-feed-grid">{feeds.map(([title,kicker,text],i)=><article className={`news-feed-card ${tones[i]}`} key={title}><div className="feed-icon">↗</div><div className="feed-kicker">{kicker}</div><h3>{title}</h3><p>{text}</p><div className="feed-footer"><span>{title==='Crypto'?'Separate pipeline':'Verified ticker-linked stories'}</span><b>→</b></div></article>)}</div></section>

    <section className="news-research-banner"><div className="research-symbol">◈</div><div><small>RESEARCH WORKFLOW</small><h2>News → sentiment → prediction</h2><p>Relevant stories can feed the sentiment layer used by the quantitative prediction engine.</p></div><a className="outline-btn" href="/predictions">View Predictions</a></section>
  </div>;
}
