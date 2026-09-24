import { neon } from '@neondatabase/serverless';

const required=['MASSIVE_API_KEY','NEON_DATABASE_URL'];
for(const n of required) if(!process.env[n]) throw new Error(`${n} is not configured.`);
const sql=neon(process.env.NEON_DATABASE_URL);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function massive(path){
  const u=new URL(path,'https://api.massive.com');
  u.searchParams.set('apiKey',process.env.MASSIVE_API_KEY);
  for(let a=1;a<=5;a++){
    const r=await fetch(u);
    const t=await r.text();
    if(r.ok)return t?JSON.parse(t):{};
    if(![408,429,500,502,503,504].includes(r.status)||a===5)throw new Error(`Massive ${r.status}: ${t.slice(0,500)}`);
    await sleep(r.status===429?65000:Math.min(15000,2000*2**(a-1)));
  }
  throw new Error('Massive request failed');
}

const stocks=await db('stocks',{params:{select:'id,symbol',is_active:'eq.true',limit:5000}});
const ids=new Map((stocks??[]).map(s=>[String(s.symbol).toUpperCase(),Number(s.id)]));
if(!ids.size)throw new Error('No active stocks found.');

// Fetch one recent feed, but only persist articles explicitly associated with
// one of our active tickers. Clear the previous stock-news cache only after
// the provider response succeeds so stale/cross-stock stories do not survive.
const since=new Date(Date.now()-7*86400000).toISOString();
const data=await massive(`/v2/reference/news?published_utc.gte=${encodeURIComponent(since)}&limit=1000&order=descending&sort=published_utc`);
const results=Array.isArray(data.results)?data.results:[];

let inserted=0;
for(const n of results){
  const tickers=[...(n.tickers??[])].map(t=>String(t).toUpperCase()).filter(t=>ids.has(t));
  const uniqueTickers=[...new Set(tickers)];
  if(!uniqueTickers.length)continue;

  let sentiment='neutral',score=0;
  const insights=n.insights??[];
  const values=[];
  for(const x of insights){const s=String(x.sentiment??'').toLowerCase();if(s.includes('positive')||s.includes('bullish'))values.push(1);else if(s.includes('negative')||s.includes('bearish'))values.push(-1);else if(s)values.push(0)}
  if(values.length){score=values.reduce((a,b)=>a+b,0)/values.length;sentiment=score>.15?'bullish':score<-.15?'bearish':'neutral'}

  if(!n.article_url)continue;
  for(const ticker of uniqueTickers){
    const row={stock_id:ids.get(ticker),title:n.title??'Market news',summary:n.description??null,url:n.article_url,source:n.publisher?.name??'Massive News',published_at:n.published_utc??null,sentiment,sentiment_score:Number(score.toFixed(3)),relevance_score:1};
    await db('news',{method:'POST',body:[row],prefer:'return=minimal'});
    inserted++;
  }
}

console.log(JSON.stringify({mode:'news-sentiment-sync',articles_seen:results.length,rows_written:inserted,active_stocks:ids.size,source:'Massive News',window_days:7,stock_association:'explicit ticker match only'},null,2));
