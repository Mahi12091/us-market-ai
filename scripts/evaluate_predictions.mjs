import { neon } from '@neondatabase/serverless';

const required=['NEON_DATABASE_URL'];
for(const n of required) if(!process.env[n]) throw new Error(`${n} is not configured in GitHub Actions secrets.`);
const sql=neon(process.env.NEON_DATABASE_URL);

async function db(table,{method='GET',params={},body}={}){
  const ident=/^[A-Za-z_][A-Za-z0-9_]*$/;
  const qid=x=>{if(!ident.test(x))throw new Error('Unsafe identifier: '+x);return '"'+x+'"';};
  const values=[],filters=[];
  for(const [key,raw] of Object.entries(params)){
    if(['select','limit','offset','order','on_conflict'].includes(key))continue;
    const m=String(raw).match(/^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/); if(!m)continue;
    const [,op,val]=m; const col=qid(key);
    if(op==='is')filters.push(val==='null'?col+' IS NULL':val==='true'?col+' IS TRUE':val==='false'?col+' IS FALSE':'1=0');
    else if(op==='in'){const items=val.replace(/^\(|\)$/g,'').split(',').filter(Boolean);const ph=items.map(x=>{values.push(x.replace(/^["']|["']$/g,''));return '$'+values.length;}).join(',');filters.push(col+' IN ('+(ph||'NULL')+')');}
    else{values.push(val);filters.push(col+' '+({eq:'=',neq:'<>',gt:'>',gte:'>=',lt:'<',lte:'<='}[op])+' $'+values.length);}
  }
  const where=filters.length?' WHERE '+filters.join(' AND '):'';
  if((method||'GET')==='GET'){const cols=(params.select||'*')==='*'?'*':String(params.select).split(',').map(x=>qid(x.trim())).join(',');let q='SELECT '+cols+' FROM '+qid(table)+where;if(params.order)q+=' ORDER BY '+String(params.order).split(',').map(part=>{const [col,dir]=part.split('.');return qid(col)+' '+(dir==='desc'?'DESC':'ASC');}).join(', ');if(params.limit!=null)q+=' LIMIT '+Math.max(0,Number(params.limit));if(params.offset!=null)q+=' OFFSET '+Math.max(0,Number(params.offset));return await sql.query(q,values);}
  if((method||'GET')==='POST'){const rows=Array.isArray(body)?body:[body||{}];const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];const vals=[];const tuples=rows.map(row=>'('+keys.map(k=>{vals.push(row[k]??null);return '$'+vals.length;}).join(',')+')').join(',');let q='INSERT INTO '+qid(table)+' ('+keys.map(qid).join(',')+') VALUES '+tuples;const conflict=String(params.on_conflict||'').split(',').map(x=>x.trim()).filter(Boolean);if(conflict.length){const updates=keys.filter(k=>!conflict.includes(k)).map(k=>qid(k)+'=EXCLUDED.'+qid(k)).join(',');q+=' ON CONFLICT ('+conflict.map(qid).join(',')+') DO '+(updates?'UPDATE SET '+updates:'NOTHING');}return await sql.query(q+' RETURNING *',vals);}
  if((method||'GET')==='DELETE')return await sql.query('DELETE FROM '+qid(table)+where+' RETURNING *',values);
  throw new Error('Unsupported method '+method);
}


const days={24:1,7:7,30:30,90:90};
const predictions=await db('predictions',{params:{select:'id,stock_id,horizon,prediction_time,current_price,predicted_price,predicted_change_percent,direction,confidence',order:'prediction_time.asc',limit:50000}});
let evaluated=0,skipped=0;
for(const p of predictions??[]){const horizon=String(p.horizon).replace('h','').replace('d','');const targetMs=new Date(p.prediction_time).getTime()+days[horizon]*86400000;const rows=await db('price_history',{params:{select:'timestamp,close',stock_id:`eq.${p.stock_id}`,timeframe:'eq.1d',timestamp:`gte.${new Date(targetMs).toISOString()}`,order:'timestamp.asc',limit:1}});const actual=Number(rows?.[0]?.close);if(!Number.isFinite(actual)){skipped++;continue}const current=Number(p.current_price),predicted=Number(p.predicted_price);if(!current||!actual||!predicted){skipped++;continue}const actualChange=(actual/current)-1;const actualDirection=actualChange>0.012?'bullish':actualChange<-0.012?'bearish':'neutral';const predictedDirection=p.direction??(Number(p.predicted_change_percent)>1.2?'bullish':Number(p.predicted_change_percent)<-1.2?'bearish':'neutral');const hit=predictedDirection===actualDirection;const result={prediction_id:p.id,stock_id:p.stock_id,horizon:p.horizon,predicted_price:predicted,actual_price:actual,predicted_direction:predictedDirection,actual_direction:actualDirection,absolute_error:Math.abs(predicted-actual),percentage_error:Math.abs((predicted-actual)/actual)*100,hit,evaluated_at:new Date().toISOString()};await db('prediction_results',{method:'DELETE',params:{prediction_id:`eq.${p.id}`},prefer:'return=minimal'});await db('prediction_results',{method:'POST',body:[result],prefer:'return=minimal'});evaluated++}
console.log(JSON.stringify({mode:'prediction-evaluation',evaluated,skipped},null,2));