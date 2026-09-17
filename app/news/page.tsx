import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Market News', description: 'Latest US company and market news with ticker-linked sentiment intelligence.' };

const tones = ['blue','purple','green','gold','blue','purple'];
const feeds = [
  ['Market Movers','MARKETS','Recent stories associated with tracked US stocks.'],
  ['Company News','EQUITIES','Ticker-linked company developments and announcements.'],
  ['Earnings News','EARNINGS','Earnings-related stories when supplied by the news feed.'],
  ['Macro & Fed','MACRO','Macro stories when a tracked ticker association is available.'],
  ['Technology','SECTOR','Technology-company news from the tracked universe.'],
  ['Crypto','DIGITAL ASSETS','Crypto coverage remains a separate data pipeline.'],
];

export default async function News() {
  const supabase = await createClient();
  const { data: news } = await supabase.from('news').select('id,stock_id,title,summary,url,source,published_at,sentiment,sentiment_score').order('published_at',{ascending:false,nullsFirst:false}).limit(40);
  const items = news ?? [];
  const ids = [...new Set(items.map(n=>n.stock_id).filter(Boolean))];
  const { data: stocks } = ids.length ? await supabase.from('stocks').select('id,symbol,slug,company_name').in('id',ids) : {data:[]};
  const stockMap = new Map((stocks ?? []).map(s=>[s.id,s]));
  const latest = items.slice(0,8);
  const featured = latest[0];
  const date = (v:string|null|undefined) => v ? new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Latest';

  return <div className="container news-page"><section className="news-hero"><div className="news-hero-copy"><div className="eyebrow">News intelligence</div><h1>Market News</h1><p>Verified stories linked to tracked US stocks, with source, publication time and sentiment stored by the market-data workflow.</p><div className="news-actions"><a className="blue-btn" href="#latest">Latest Stories</a><a className="outline-btn" href="#topics">Browse Topics</a></div></div><div className="news-hero-art" aria-hidden="true"><div className="news-terminal"><span>US MARKET AI</span><b>NEWS</b><i>VERIFIED FEED</i></div><div className="news-line line-one"/><div className="news-line line-two"/><div className="news-line line-three"/></div></section>

    <section id="latest" className="news-feature-grid"><div className="news-feature-card"><div className="feature-visual"><span>{featured ? 'VERIFIED MARKET FEED' : 'FEED READY'}</span><div className="feature-bars"><i/><i/><i/><i/><i/></div></div><div className="feature-copy"><div className="eyebrow">Latest intelligence</div>{featured ? <><h2>{featured.title}</h2><p>{featured.summary ?? 'Ticker-linked market development from the verified news feed.'}</p><div className="feature-meta"><span>{stockMap.get(featured.stock_id)?.symbol ?? 'Market'}</span><span>{featured.sentiment ?? 'neutral'}</span><span>{featured.source ?? 'Market News'}</span></div></> : <><h2>No recent stories yet</h2><p>The next successful news sync will populate this page automatically. No placeholder headlines are presented as real news.</p></>}<a className="text-link" href={featured?.url ?? '#'} target={featured?.url ? '_blank' : undefined} rel={featured?.url ? 'noreferrer' : undefined}>Open source story →</a></div></div><aside className="news-side-card"><div className="section-card-head"><div><h2>Feed status</h2><p>Backend-linked news signals</p></div></div><div className="signal-row"><span>Stored stories</span><b>{items.length || '—'}</b></div><div className="signal-row"><span>Ticker associations</span><b>{new Set(items.map(n=>n.stock_id).filter(Boolean)).size || '—'}</b></div><div className="signal-row"><span>Sentiment</span><b>Ready</b></div><div className="signal-row"><span>Source links</span><b>Stored</b></div></aside></section>

    <section className="section-card"><div className="section-card-head news-section-head"><div><h2>Latest stories</h2><p>Newest ticker-linked articles stored by the news pipeline.</p></div><span className="news-count">{items.length} STORED</span></div><div className="news-feed-grid">{latest.length ? latest.map((n,i)=>{const s=stockMap.get(n.stock_id);return <a className="news-feed-card" href={n.url ?? (s ? `/stocks/${s.slug}#news` : '#')} target={n.url ? '_blank' : undefined} rel={n.url ? 'noreferrer' : undefined} key={n.id}><div className={`feed-icon ${tones[i] ?? 'blue'}`}>↗</div><div><div className="feed-kicker">{s?.symbol ?? 'MARKET'} · {n.sentiment ?? 'neutral'}</div><h3>{n.title}</h3><p>{n.summary ?? 'Read the source story for full details.'}</p><div className="feed-footer"><span>{n.source ?? 'Market News'} · {date(n.published_at)}</span><b>→</b></div></div></a>}) : <div className="empty-state">No verified news records are available yet.</div>}</div></section>

    <section id="topics" className="news-topics"><div className="section-card-head news-section-head"><div><h2>Explore news feeds</h2><p>Coverage categories supported by the research workflow.</p></div><span className="news-count">6 FEEDS</span></div><div className="news-feed-grid">{feeds.map(([title,kicker,text],i)=><article className={`news-feed-card ${tones[i]}`} key={title}><div className="feed-icon">↗</div><div className="feed-kicker">{kicker}</div><h3>{title}</h3><p>{text}</p><div className="feed-footer"><span>{title==='Crypto'?'Separate pipeline':'Verified ticker-linked stories'}</span><b>→</b></div></article>)}</div></section>

    <section className="news-research-banner"><div className="research-symbol">◈</div><div><small>RESEARCH WORKFLOW</small><h2>News → sentiment → prediction</h2><p>Relevant stories can feed the sentiment layer used by the quantitative prediction engine.</p></div><a className="outline-btn" href="/predictions">View Predictions</a></section>
  </div>;
}
