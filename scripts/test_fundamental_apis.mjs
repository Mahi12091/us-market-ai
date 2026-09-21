const required=['THREESPREAD_API_KEY','TICKERLAYER_API_KEY'];
for(const n of required) if(!process.env[n]) throw new Error(`${n} is not configured.`);

const three='https://api.3spread.com';
const ticker='https://api.tickerlayer.com';
async function getJson(url,headers){
  const r=await fetch(url,{headers:{Accept:'application/json',...headers}});
  const text=await r.text(); let body={};
  try{body=text?JSON.parse(text):{};}catch{body={raw:text.slice(0,500)};}
  if(!r.ok) throw new Error(`${r.status} ${url}: ${JSON.stringify(body).slice(0,700)}`);
  return body;
}
const result={symbol:'AAPL',three_spread:{},ticker_layer:{}};
for(const [name,path] of [['statements','/v1/financials/statements?ticker=AAPL&version=latest&limit=20'],['metrics','/v1/financials/metrics?ticker=AAPL&version=latest&limit=100']]){
  try{const body=await getJson(three+path,{apikey:process.env.THREESPREAD_API_KEY}); const data=Array.isArray(body?.data)?body.data:[];
    result.three_spread[name]={ok:true,count:data.length,keys:data[0]?Object.keys(data[0]).slice(0,40):[],sample:data[0]||null};
  }catch(e){result.three_spread[name]={ok:false,error:e.message};}
}
for(const [name,path] of [['fundamentals','/fundamentals/stocks/US:AAPL'],['snapshot','/stocks/snapshot/US:AAPL']]){
  try{const body=await getJson(ticker+path,{'x-api-key':process.env.TICKERLAYER_API_KEY}); result.ticker_layer[name]={ok:true,keys:Object.keys(body),sample:body};}
  catch(e){result.ticker_layer[name]={ok:false,error:e.message};}
}
console.log(JSON.stringify(result,null,2));
if(!result.three_spread.statements.ok || !result.three_spread.metrics.ok || !result.ticker_layer.snapshot.ok) process.exitCode=1;