import type { Metadata } from 'next';
import { createDatabaseClient } from '@/lib/neon';
import { cleanNewsText, dedupeNewsItems, isMarketRelevantNews, newsSummary, safeNewsUrl } from '@/lib/news-content';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'US Stock Market News: Company, Earnings & Sector Updates',
  description: 'Follow the latest US stock market news, company announcements, earnings updates and sector developments. Explore ticker-linked headlines, publisher sources and market sentiment.',
  keywords: ['US stock market news', 'stock market news today', 'US stocks news', 'earnings news', 'technology stocks news', 'financial market updates', 'stock sentiment'],
  alternates: { canonical: 'https://usmarketai.com/news' },
  openGraph: { title: 'US Stock Market News', description: 'Latest US company news, earnings headlines and sector developments with source links and market sentiment.', url: 'https://usmarketai.com/news', siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'US Stock Market News | US Market AI', description: 'Latest US company news, earnings headlines and sector developments.' },
};

type NewsRow = { id: string; stock_id: string | null; title: string; summary: string | null; url: string | null; source: string | null; published_at: string | null; sentiment: string | null; sentiment_score: number | null };
type StockRow = { id: string; symbol: string; slug: string | null; company_name: string; sector?: string | null };

const tones = ['blue','purple','green','gold','blue','purple'];
const date = (v: string | null | undefined) => {
  if (!v) return 'Publication time unavailable';
  const parsed = new Date(v);
  if (!Number.isFinite(parsed.getTime())) return 'Publication time unavailable';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(parsed);
};

const sectorName = (value: string | null | undefined) => {
  const sector = cleanNewsText(value);
  return sector && !['n/a', 'na', 'unknown', 'null'].includes(sector.toLowerCase()) ? sector : 'Other Stocks';
};

export default async function News() {
  const supabase = createDatabaseClient();
  const { data: rawNews } = await supabase.from('news').select('id,stock_id,title,summary,url,source,published_at,sentiment,sentiment_score').order('published_at',{ascending:false,nullsFirst:false}).limit(200);
  const items = dedupeNewsItems(((rawNews ?? []) as NewsRow[]).filter(isMarketRelevantNews), 40);
  const ids = [...new Set(items.map(n=>n.stock_id).filter((id): id is string => Boolean(id)))];
  const { data: rawStocks } = ids.length ? await supabase.from('stocks').select('id,symbol,slug,company_name,sector').in('id',ids) : {data:[]};
  const stocks = (rawStocks ?? []) as StockRow[];
  const stockMap = new Map(stocks.map(s=>[s.id,s]));
  const latest = items;
  const featured = latest[0];
  const sectorGroups = new Map<string, NewsRow[]>();
  for (const item of latest) {
    const stock = item.stock_id ? stockMap.get(item.stock_id) : undefined;
    const sector = sectorName(stock?.sector);
    if (!sectorGroups.has(sector)) sectorGroups.set(sector, []);
    sectorGroups.get(sector)!.push(item);
  }
  const sectorNews = [...sectorGroups.entries()].filter(([sector]) => sector !== 'Other Stocks').sort((a, b) => b[1].length - a[1].length).slice(0, 8);

  return <div className="container news-page"><section className="news-hero"><div className="news-hero-copy"><div className="eyebrow">News intelligence</div><h1>Market News</h1><p>Explore the latest US stock market news, company announcements, earnings headlines and sector developments. Each story links back to its publisher, with ticker context and sentiment when available.</p><div className="news-actions"><a className="blue-btn" href="#latest">Latest Stories</a><a className="outline-btn" href="#sector-news">Sector Insights</a></div></div><div className="news-hero-art" aria-hidden="true"><div className="news-terminal"><span>US MARKET AI</span><b>NEWS</b><i>VERIFIED FEED</i></div><div className="news-line line-one"/><div className="news-line line-two"/><div className="news-line line-three"/></div></section>

    <section id="latest" className="news-feature-grid"><div className="news-feature-card"><div className="feature-visual"><span>{featured ? 'MARKET NEWS HIGHLIGHT' : 'LATEST MARKET UPDATE'}</span><div className="feature-bars"><i/><i/><i/><i/><i/></div></div><div className="feature-copy"><div className="eyebrow">Latest intelligence</div>{featured ? <><h2>{safeNewsUrl(featured.url) ? <a href={safeNewsUrl(featured.url)!} target="_blank" rel="noopener noreferrer">{cleanNewsText(featured.title) || 'Market story'}</a> : (cleanNewsText(featured.title) || 'Market story')}</h2><p>{newsSummary(featured.summary, featured.title) || 'Read the original publisher report for the full details. US Market AI links each headline to its source and adds ticker context where available.'}</p><div className="feature-meta"><span>{featured.stock_id ? stockMap.get(featured.stock_id)?.symbol ?? 'Market' : 'Market'}</span><span>{cleanNewsText(featured.sentiment) || 'neutral'}</span><span>{cleanNewsText(featured.source) || 'Market News'}</span></div></> : <><h2>No recent stories yet</h2><p>The next successful news sync will populate this page automatically. No placeholder headlines are presented as real news.</p></>}{safeNewsUrl(featured?.url) ? <a className="text-link" href={safeNewsUrl(featured?.url)!} target="_blank" rel="noopener noreferrer">Open source story →</a> : <span className="text-link text-link-disabled">Source link unavailable</span>}</div></div></section>

    <section className="section-card"><div className="section-card-head news-section-head"><div><h2>Latest US stock market news</h2><p>Company announcements, earnings coverage and market-moving developments from trusted publishers. Times are shown in US Eastern Time.</p></div></div><div className="news-feed-grid">{latest.length ? latest.map((n,i)=>{const s=n.stock_id ? stockMap.get(n.stock_id) : undefined;const sourceUrl = safeNewsUrl(n.url); const storyTitle = cleanNewsText(n.title) || 'Market story'; return <article className="news-feed-card news-story-card" key={n.id}><div className={`feed-icon ${tones[i % tones.length] ?? 'blue'}`}>↗</div><div><div className="feed-kicker">{s?.symbol ?? 'MARKET'} · {(cleanNewsText(n.sentiment) || 'neutral').toUpperCase()}</div><h3>{storyTitle}</h3><p>{newsSummary(n.summary, n.title) || 'Publisher summary unavailable. Open the original report for the full story, and use the ticker link to explore related company research.'}</p><div className="feed-footer"><span>{cleanNewsText(n.source) || 'Publisher'} · {date(n.published_at)}</span>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${storyTitle}`}>Read source ↗</a> : s?.slug ? <a href={`/stocks/${s.slug}#news`}>View stock ↗</a> : <span>Source unavailable</span>}</div></div></article>}) : <div className="empty-state">No verified news records are available yet.</div>}</div></section>

    {sectorNews.length > 0 && <section id="sector-news" className="news-topics news-sector-section"><div className="section-card-head news-section-head"><div><h2>Browse news by stock sector</h2><p>Sector groupings are based on the linked company records in the latest feed.</p></div><span className="news-count">{sectorNews.length} SECTORS</span></div><div className="news-feed-grid">{sectorNews.map(([sector, stories]) => { const latestStory = stories[0]; const latestUrl = safeNewsUrl(latestStory.url); return <article className="news-feed-card news-sector-card" key={sector}><div className="feed-icon">▦</div><div className="feed-kicker">SECTOR NEWS · {stories.length} {stories.length === 1 ? "STORY" : "STORIES"}</div><h3>{sector}</h3><p>{stories.slice(0, 2).map(story => cleanNewsText(story.title)).join(" · ")}</p><div className="feed-footer"><span>{stories.length} linked {stories.length === 1 ? "headline" : "headlines"}</span>{latestUrl ? <a href={latestUrl} target="_blank" rel="noopener noreferrer">Read latest ↗</a> : <a href="#latest">View stories ↓</a>}</div></article>; })}</div></section>}

    <section className="news-research-banner"><div className="research-symbol">◈</div><div><small>MARKET CONTEXT</small><h2>Understand the story behind the move</h2><p>Explore company headlines alongside ticker context and market sentiment to support more informed research.</p></div></section>
  </div>;
}
