const required=['MASSIVE_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const n of required) if(!process.env[n]) throw new Error(n+' is not configured.');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function massive(path){const u=new URL(path,'https://api.massive.com');u.searchParams.set('apiKey',process.env.MASSIVE_API_KEY);for(let attempt=1;attempt<=5;attempt++){const r=await fetch(u);const t=await r.text();if(r.ok)return t?JSON.parse(t):{};if(![408,429,500,502,503,504].includes(r.status)||attempt===5)throw new Error('Massive '+r.status+': '+t.slice(0,500));await sleep(r.status===429?65000:Math.min(2000*2**(attempt-1),15000));}}
async function db(table,{method='GET',params={},body,prefer='return=minimal'}={}){const u=new URL(process.env.SUPABASE_URL+'/rest/v1/'+table);for(const[k,v]of Object.entries(params))u.searchParams.set(k,v);const r=await fetch(u,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});const t=await r.text();if(!r.ok)throw new Error('Supabase '+r.status+': '+t);return t?JSON.parse(t):null;}
const stocks=await db('stocks',{params:{select:'id,symbol',is_active:'eq.true',asset_type:'eq.stock',limit:5000}});
const ids=new Map((stocks||[]).map(s=>[String(s.symbol).toUpperCase(),Number(s.id)]));
const data=await massive('/stocks/v1/dividends?ticker=*&limit=5000&sort=ex_dividend_date.desc');
const results=data.results||[];
await db('dividends',{method:'DELETE',params:{id:'not.is.null'},prefer:'return=minimal'});
const rows=results.filter(d=>ids.has(String(d.ticker||'').toUpperCase())&&d.ex_dividend_date).map(d=>({stock_id:ids.get(String(d.ticker).toUpperCase()),ex_date:d.ex_dividend_date||null,record_date:d.record_date||null,payment_date:d.pay_date||null,declaration_date:d.declaration_date||null,amount:d.cash_amount??null,frequency:d.frequency!=null?String(d.frequency):null,currency:d.currency||'USD',data_source:'Massive /stocks/v1/dividends'}));
for(let i=0;i<rows.length;i+=500) await db('dividends',{method:'POST',body:rows.slice(i,i+500)});
console.log(JSON.stringify({mode:'dividend-sync',stocks:ids.size,api_rows:results.length,written:rows.length,source:'Massive /stocks/v1/dividends'},null,2));