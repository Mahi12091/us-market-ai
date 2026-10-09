import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required');
const sql = neon(process.env.NEON_DATABASE_URL);
const UA = process.env.NEWS_USER_AGENT || 'USMarketAI/1.0 contact: support@usmarketai.com';
const BATCH = Math.max(10, Math.min(250, Number(process.env.FREE_NEWS_STOCKS_PER_RUN || 100)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const tag = (xml, name) => { const m = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i')); return m ? decode(m[1].replace(/<[^>]+>/g, '')) : null; };
function parseItems(xml) {
  return [...xml.matchAll(/<item(?:\\s[^>]*)?>([\\s\\S]*?)<\\/item>/gi)].map(m => {
    const x=m[1]; const title=tag(x,'title'); const link=tag(x,'link') || tag(x,'guid'); const pub=tag(x,'pubDate');
    const source=tag(x,'source');
    const desc=tag(x,'description');
    const parsed=pub ? new Date(pub) : null;
    return {title, url:link, published_at:parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null, source, summary:desc};
  }).filter(x => x.title && x.url && /^https?:\\/\\//i.test(x.url));
}
async function fetchRss(stock) {
  const q = '"' + String(stock.symbol).replace(/[^A-Za-z0-9.-]/g,'') + '" stock';
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
  for (let attempt=1; attempt<=4; attempt++) {
    try {
      const r=await fetch(url,{headers:{'User-Agent':UA,'Accept':'application/rss+xml, application/xml, text/xml'}});
      if (r.status===429 || r.status>=500) { if(attempt===4) return []; await sleep(1500*attempt); continue; }
      if(!r.ok) return [];
      return parseItems(await r.text()).slice(0,12);
    } catch { if(attempt===4) return []; await sleep(1000*attempt); }
  }
  return [];
}
const stocks = await sql`
  SELECT s.id,s.symbol,s.company_name
  FROM stocks s
  WHERE s.is_active=true AND s.asset_type='stock'
  ORDER BY (
    SELECT MAX(n.published_at) FROM news n WHERE n.stock_id=s.id
  ) ASC NULLS FIRST, s.id
  LIMIT ${BATCH}
`;
if (!stocks.length) { console.log('No active stocks found'); process.exit(0); }
let seen=0, written=0, failed=0;
for (const stock of stocks) {
  try {
    const items=await fetchRss(stock); seen+=items.length;
    for (const item of items) {
      // Keep association explicit to the ticker query, dedupe by URL per stock.
      const exists=await sql`SELECT 1 FROM news WHERE stock_id=${stock.id} AND url=${item.url} LIMIT 1`;
      if(exists.length) continue;
      await sql`INSERT INTO news(stock_id,title,summary,url,source,published_at,sentiment,sentiment_score,relevance_score,created_at)
        VALUES(${stock.id},${item.title},${item.summary},${item.url},${item.source || 'Google News RSS'},${item.published_at},'neutral',0,0.6,NOW())`;
      written++;
    }
  } catch(e) { failed++; console.error('[news]',stock.symbol,String(e?.message||e).slice(0,180)); }
  await sleep(350);
}
await sql`UPDATE free_news_sync_state SET last_stock_id=${Number(stocks[stocks.length-1].id)},updated_at=NOW() WHERE id=1`;
console.log(JSON.stringify({source:'Google News RSS (free)',stocks_processed:stocks.length,articles_seen:seen,rows_written:written,failed_stocks:failed,next_cursor:Number(stocks[stocks.length-1].id),sentiment:'neutral unless independently computed'},null,2));
