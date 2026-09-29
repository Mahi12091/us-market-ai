import { neon } from '@neondatabase/serverless';
const url = process.env.NEON_DATABASE_URL;
if (!url) throw new Error('NEON_DATABASE_URL is not configured.');
const sql = neon(url);

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const score = (v, scale) => { const x=n(v); return x==null||scale<=0?null:clamp(x/scale,-1,1); };
const weightedMean = (items) => { if(!items.length) return null; const w=items.reduce((s,x)=>s+x.weight,0); return w?items.reduce((s,x)=>s+x.score*x.weight,0)/w:null; };
const add=(a,name,s,w,value=null)=>{ if(s==null||!Number.isFinite(s)) return; a.push({name,score:clamp(s,-1,1),weight:w,value}); };
const direction=(r)=>r>0.015?'bullish':r<-0.015?'bearish':'neutral';

function build(row,horizon){
  const current=n(row.price); if(!(current>0)) return null;
  const t=[]; const f=[];
  const ema20=n(row.ema_20), ema50=n(row.ema_50), sma50=n(row.sma_50), sma200=n(row.sma_200);
  const rsi=n(row.rsi), macd=n(row.macd_histogram), momentum=n(row.momentum), vol=n(row.volatility);
  const support=n(row.support_level), resistance=n(row.resistance_level);
  if(ema20) add(t,'price-vs-ema20',score((current/ema20-1)*100,6),1.2,current/ema20-1);
  if(ema50) add(t,'price-vs-ema50',score((current/ema50-1)*100,10),1.0,current/ema50-1);
  if(sma50) add(t,'price-vs-sma50',score((current/sma50-1)*100,10),0.85,current/sma50-1);
  if(sma200) add(t,'price-vs-sma200',score((current/sma200-1)*100,15),0.7,current/sma200-1);
  if(ema20&&ema50) add(t,'ema-alignment',ema20>ema50?0.55:-0.55,0.85,ema20-ema50);
  if(rsi!=null&&rsi>=0&&rsi<=100) add(t,'rsi-regime',rsi<30?0.55:rsi>70?-0.55:(rsi-50)/25,0.9,rsi);
  if(macd!=null) add(t,'macd-histogram',score((macd/current)*100,0.45),1.0,macd);
  if(momentum!=null) add(t,'momentum-10d',score(momentum,12),1.1,momentum);
  if(support&&resistance&&resistance>support){ const pos=clamp((current-support)/(resistance-support),0,1); add(t,'support-resistance-position',(pos-0.5)*2,0.55,pos); }
  const rg=n(row.revenue_growth), eg=n(row.eps_growth), roe=n(row.roe), roa=n(row.roa), de=n(row.debt_equity);
  const fcfm=n(row.fcf_margin), pe=n(row.pe_ratio), peg=n(row.peg_ratio);
  if(rg!=null&&Math.abs(rg)<=150) add(f,'revenue-growth',score(rg,30),1,rg);
  if(eg!=null&&Math.abs(eg)<=200) add(f,'eps-growth',score(eg,40),1,eg);
  if(roe!=null&&roe>=-100&&roe<=150) add(f,'roe',score(roe,30),0.8,roe);
  if(roa!=null&&roa>=-50&&roa<=60) add(f,'roa',score(roa,15),0.55,roa);
  if(fcfm!=null&&fcfm>=-100&&fcfm<=100) add(f,'fcf-margin',score(fcfm,25),0.8,fcfm);
  if(de!=null&&de>0&&de<5) add(f,'leverage',score(1-de,1.5),0.65,de);
  if(pe!=null&&pe>0&&pe<150) add(f,'pe-context',clamp((30-pe)/30,-1,1),0.3,pe);
  if(peg!=null&&peg>0&&peg<8) add(f,'peg-context',clamp((2-peg)/2,-1,1),0.25,peg);
  const ts=weightedMean(t), fs=weightedMean(f); if(ts==null&&fs==null) return null;
  const tw=ts==null?0:0.65, fw=fs==null?0:0.35, total=tw+fw, combined=((ts??0)*tw+(fs??0)*fw)/total;
  const all=[...t,...f];
  const dispersion=all.length?all.reduce((s,x)=>s+Math.abs(x.score-combined),0)/all.length:1;
  const agreement=clamp(1-dispersion/1.5,0,1);
  const hcount=n(row.history_count)||0;
  const dq=clamp((Math.min(hcount,252)/252)*0.60+(t.length/9)*0.22+(f.length/8)*0.18,0,1);
  const annualVol=vol!=null&&vol>0&&vol<200?vol/100:0.30;
  const cfg={ '24h':{days:1,m:0.60,cap:0.040}, '7d':{days:7,m:0.85,cap:0.085}, '30d':{days:30,m:1.10,cap:0.16}, '90d':{days:90,m:1.25,cap:0.25} }[horizon];
  const damped=combined*(0.70+0.30*agreement);
  const ret=clamp(damped*annualVol*Math.sqrt(cfg.days/252)*cfg.m,-cfg.cap,cfg.cap);
  const pred=current*(1+ret);
  const dir=direction(ret);
  const conf=clamp(40+agreement*25+dq*20+Math.min(1,Math.abs(damped))*10,40,82);
  return {current_price:Number(current.toFixed(4)),predicted_price:Number(pred.toFixed(4)),predicted_change_percent:Number((ret*100).toFixed(3)),direction:dir,confidence:Number(conf.toFixed(1)),signal:dir==='bullish'?'positive-quant-score':dir==='bearish'?'negative-quant-score':'mixed-quant-score',feature_summary:{model:'quant-v3.0',technical_weight:0.65,fundamental_weight:0.35,technical_score:ts,fundamental_score:fs,combined_score:Number(combined.toFixed(4)),damped_score:Number(damped.toFixed(4)),agreement:Number(agreement.toFixed(4)),data_quality:Number(dq.toFixed(4)),annualized_volatility:annualVol,horizon_days:cfg.days,factors:all,note:'Quantitative estimate. Confidence is not a probability of correctness.'}};
}

const batchSize=Math.max(1,Number(process.env.STOCK_BATCH_SIZE??500));
const batchIndex=Math.max(0,Number(process.env.STOCK_BATCH_INDEX??0));
const offset=batchIndex*batchSize;
const rows=await sql.query(`WITH lf AS (SELECT DISTINCT ON (stock_id) stock_id,revenue,revenue_growth,eps_growth,roe,roa,debt_equity,free_cash_flow,fcf_margin,pe_ratio,peg_ratio,report_date FROM fundamentals ORDER BY stock_id,report_date DESC NULLS LAST,updated_at DESC), hc AS (SELECT stock_id,COUNT(*)::int history_count FROM price_history WHERE timeframe='1d' GROUP BY stock_id) SELECT s.id,s.symbol,q.price,t.ema_20,t.ema_50,t.sma_50,t.sma_200,t.rsi,t.macd_histogram,t.momentum,t.volatility,t.support_level,t.resistance_level,lf.revenue,lf.revenue_growth,lf.eps_growth,lf.roe,lf.roa,lf.debt_equity,lf.free_cash_flow,lf.fcf_margin,lf.pe_ratio,lf.peg_ratio,COALESCE(hc.history_count,0) history_count FROM stocks s JOIN latest_quotes q ON q.stock_id=s.id AND q.price>0 JOIN technical_indicators t ON t.stock_id=s.id AND t.timeframe='daily' LEFT JOIN lf ON lf.stock_id=s.id LEFT JOIN hc ON hc.stock_id=s.id WHERE s.is_active=true AND s.asset_type='stock' ORDER BY s.id OFFSET $1 LIMIT $2`,[offset,batchSize]);
let generated=0,skipped=0;
for(const row of rows.rows){
  for(const horizon of ['24h','7d','30d','90d']){
    const p=build(row,horizon); if(!p) continue;
    await sql.query(`DELETE FROM predictions WHERE stock_id=$1 AND horizon=$2 AND model_version='quant-v3.0'`,[Number(row.id),horizon]);
    await sql.query(`INSERT INTO predictions (stock_id,model_version,prediction_time,horizon,current_price,predicted_price,predicted_change_percent,direction,confidence,signal,feature_summary,model_name,generated_date,feature_version) VALUES ($1,'quant-v3.0',now(),$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'Quantitative Ensemble',current_date,'v3')`,[Number(row.id),horizon,p.current_price,p.predicted_price,p.predicted_change_percent,p.direction,p.confidence,p.signal,JSON.stringify(p.feature_summary)]);
    generated++;
  }
  if(!rows.rows.length) skipped++;
}
console.log(JSON.stringify({model_version:'quant-v3.0',batch_index:batchIndex,batch_size:batchSize,stocks_processed:rows.rows.length,predictions_generated:generated,stocks_skipped:skipped,horizons:['24h','7d','30d','90d']},null,2));