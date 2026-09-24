import { neon } from '@neondatabase/serverless';

const required=['MASSIVE_API_KEY','NEON_DATABASE_URL'];
for(const n of required)if(!process.env[n])throw new Error(`${n} is not configured.`);

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

const stocks=await sql.query(`SELECT id,symbol FROM public.stocks WHERE is_active=true ORDER BY id LIMIT 5000`);
const ids=new Map(stocks.map(s=>[String(s.symbol).toUpperCase(),Number(s.id)]));
let data;
try{
  data=await massive('/benzinga/v1/earnings?limit=50000&sort=date.desc');
}catch(error){
  if(String(error.message).includes('not entitled')){
    console.warn('Benzinga earnings dataset is not enabled for this Massive plan; skipping earnings sync.');
    process.exit(0);
  }
  throw error;
}
const rows=[];
for(const e of data.results??[]){
  const symbol=String(e.ticker??'').toUpperCase();
  const id=ids.get(symbol);
  if(!id||!e.date)continue;
  rows.push({
    stock_id:id,
    earnings_date:e.date,
    fiscal_period:e.fiscal_period??null,
    eps_estimate:e.estimated_eps??e.eps_estimate??null,
    eps_actual:e.actual_eps??null,
    eps_surprise:e.eps_surprise_percent??e.eps_surprise??null,
    revenue_estimate:e.estimated_revenue??e.revenue_estimate??null,
    revenue_actual:e.actual_revenue??null,
    revenue_surprise:e.revenue_surprise_percent??e.revenue_surprise??null,
    data_source:'Massive/Benzinga'
  });
}
let written=0;
for(const r of rows){
  try{
    await sql.query(
      `INSERT INTO public.earnings
       (stock_id,earnings_date,fiscal_period,eps_estimate,eps_actual,eps_surprise,revenue_estimate,revenue_actual,revenue_surprise,data_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [r.stock_id,r.earnings_date,r.fiscal_period,r.eps_estimate,r.eps_actual,r.eps_surprise,r.revenue_estimate,r.revenue_actual,r.revenue_surprise,r.data_source]
    );
    written++;
  }catch(e){console.error(`Earnings insert failed for stock_id ${r.stock_id}: ${e.message}`);}
}
console.log(JSON.stringify({mode:'earnings-sync-neon',stocks:ids.size,rows_seen:rows.length,written,source:'Massive/Benzinga'},null,2));
