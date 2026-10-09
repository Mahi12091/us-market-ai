import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is required');
const sql=neon(process.env.NEON_DATABASE_URL);
const UA=process.env.SEC_USER_AGENT || 'USMarketAI/1.0 contact: support@usmarketai.com';
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'usmai-13f-'));
const execFileAsync=promisify(execFile);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||'').toLowerCase().replace(/&/g,' and ').replace(/\b(the|incorporated|inc|corporation|corp|company|co|limited|ltd|plc|holdings|holding|class|ordinary|shares)\b/g,' ').replace(/[^a-z0-9]/g,'');
const date=s=>{if(!s)return null;const v=String(s).trim();let m=v.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);if(m){const d=new Date(m[2]+' '+m[1]+', '+m[3]+' UTC');return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null;}const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null;};
function parseTsvLine(line){const out=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(c==='\t'&&!quoted){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;}
async function* rows(file){const rl=createInterface({input:fs.createReadStream(file),crlfDelay:Infinity});let headers=null;for await(const line of rl){if(!headers){headers=parseTsvLine(line).map(x=>x.replace(/^\uFEFF/,''));continue;}const vals=parseTsvLine(line);const row={};headers.forEach((h,i)=>row[h]=vals[i]??'');yield row;}}
async function get(url){const r=await fetch(url,{headers:{'User-Agent':UA,'Accept-Encoding':'gzip, deflate'}});if(!r.ok)throw new Error('SEC '+r.status+' '+url);return r;}
async function main(){
  const page=await (await get('https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets')).text();
  const links=[...page.matchAll(/href=["']([^"']+\.zip)["']/gi)].map(m=>m[1]).filter(x=>/form13f\.zip/i.test(x));
  if(!links.length)throw new Error('Could not locate official SEC 13F quarterly ZIP link');
  const url=new URL(links[0], 'https://www.sec.gov').href;
  const zip=path.join(TMP,'13f.zip');
  const response=await get(url);await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(zip));
  await fs.promises.mkdir(path.join(TMP,'data'),{recursive:true});
  await execFileAsync('unzip',['-q','-o',zip,'-d',path.join(TMP,'data')]);
  const files=(await fs.promises.readdir(path.join(TMP,'data'),{recursive:true})).map(f=>path.join(TMP,'data',f)).filter(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
  const find=name=>files.find(f=>path.basename(f).toUpperCase()===name+'.TXT')||files.find(f=>path.basename(f).toUpperCase()===name+'.CSV')||files.find(f=>path.basename(f).toUpperCase()===name+'.TSV')||files.find(f=>path.basename(f).toUpperCase()===name);
  const coverFile=find('COVERPAGE'), infoFile=find('INFOTABLE'), submissionFile=find('SUBMISSION');
  if(!coverFile||!infoFile||!submissionFile)throw new Error('SEC 13F ZIP missing expected SUBMISSION/COVERPAGE/INFOTABLE files: '+files.map(f=>path.basename(f)).join(','));
  const [stocks,submissions,coverpages]=await Promise.all([
    sql`SELECT id,symbol,company_name FROM stocks WHERE is_active=true AND asset_type='stock'`,
    (async()=>{const m=new Map();for await(const r of rows(submissionFile)){if(r.ACCESSION_NUMBER)m.set(r.ACCESSION_NUMBER,r);}return m;})(),
    (async()=>{const m=new Map();for await(const r of rows(coverFile)){if(r.ACCESSION_NUMBER)m.set(r.ACCESSION_NUMBER,r);}return m;})()
  ]);
  const nameMap=new Map();for(const s of stocks){const k=norm(s.company_name);if(k){if(nameMap.has(k))nameMap.set(k,null);else nameMap.set(k,s);}}
  const stockForIssuer=issuer=>{const k=norm(issuer);if(!k)return null;const exact=nameMap.get(k);if(exact)return exact;let match=null;for(const [name,stock] of nameMap){if(!stock)continue;if(name.length>=9&&(name.includes(k)||k.includes(name))){if(match&&match.id!==stock.id)return null;match=stock;}}return match;};
  const batch=[];let scanned=0,matched=0,inserted=0,unmatched=0;
  const flush=async()=>{
    if(!batch.length)return;
    const chunk=batch.splice(0,batch.length);
    const payload=JSON.stringify(chunk);
    const q="INSERT INTO institutional_holders(stock_id,holder_name,cik,period_end,shares_held,market_value,filing_date,data_source,created_at) SELECT v.stock_id,v.holder_name,v.cik,v.period_end,v.shares_held,v.market_value,v.filing_date,'SEC_13F_DATASET',NOW() FROM jsonb_to_recordset($1::jsonb) AS v(stock_id bigint,holder_name text,cik text,period_end date,shares_held numeric,market_value numeric,filing_date date) WHERE NOT EXISTS (SELECT 1 FROM institutional_holders h WHERE h.stock_id=v.stock_id AND h.holder_name=v.holder_name AND h.cik=v.cik AND h.period_end=v.period_end) RETURNING stock_id";
    const result=await sql.query(q,[payload]);
    inserted+=result.length;
  };
  for await(const row of rows(infoFile)){
    scanned++;
    const accession=row.ACCESSION_NUMBER;const cover=coverpages.get(accession);const sub=submissions.get(accession);
    if(!cover||!sub)continue;
    const issuer=row.NAMEOFISSUER;const stock=stockForIssuer(issuer);const shares=Number(String(row.SSHPRNAMT||'').replace(/,/g,''));const val=Number(String(row.VALUE||'').replace(/,/g,''));
    if(!stock||!issuer||!Number.isFinite(shares)||shares<=0){unmatched++;continue;}
    const period=date(cover.REPORTCALENDARORQUARTER)||date(sub.PERIODOFREPORT);const filed=date(sub.FILING_DATE);
    if(!period)continue;
    const value=Number.isFinite(val)&&val>=0?val*1000:null;
    batch.push({stock_id:Number(stock.id),holder_name:cover.FILINGMANAGER_NAME||('13F filer '+sub.CIK),cik:String(sub.CIK||'').replace(/^0+/,'')||null,period_end:period,shares_held:shares,market_value:value,filing_date:filed});
    matched++;
    if(batch.length>=200)await flush();
    if(scanned%500000===0)console.log(JSON.stringify({scanned,matched,inserted,unmatched}));
  }
  await flush();
  const snapshots=await sql.query("INSERT INTO ownership_snapshots(stock_id,period_end,shares_outstanding,institutional_ownership_percent,insider_ownership_percent,float_shares,data_source,created_at,institutional_shares,insider_shares,top_holders) SELECT h.stock_id,h.period_end,f.shares_outstanding,CASE WHEN f.shares_outstanding>0 THEN SUM(h.shares_held)/f.shares_outstanding*100 ELSE NULL END,NULL,NULL,'SEC_13F_DATASET',NOW(),SUM(h.shares_held),NULL,jsonb_agg(jsonb_build_object('holder_name',h.holder_name,'cik',h.cik,'shares_held',h.shares_held,'market_value',h.market_value,'period_end',h.period_end) ORDER BY h.market_value DESC NULLS LAST) FROM institutional_holders h LEFT JOIN LATERAL(SELECT shares_outstanding FROM fundamentals f0 WHERE f0.stock_id=h.stock_id AND f0.shares_outstanding>0 ORDER BY f0.report_date DESC NULLS LAST LIMIT 1) f ON true WHERE h.period_end=(SELECT MAX(h2.period_end) FROM institutional_holders h2 WHERE h2.stock_id=h.stock_id) AND NOT EXISTS(SELECT 1 FROM ownership_snapshots o WHERE o.stock_id=h.stock_id AND o.period_end=h.period_end) GROUP BY h.stock_id,h.period_end,f.shares_outstanding RETURNING stock_id");
  console.log(JSON.stringify({source:'SEC Form 13F quarterly dataset',dataset_url:url,stocks_in_universe:stocks.length,infotable_rows_scanned:scanned,matched_issuer_rows:matched,inserted_holdings:inserted,unmatched_rows:unmatched,ownership_snapshots_added:snapshots.length},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});    const payload=JSON.stringify(chunk);
    const q="INSERT INTO institutional_holders(stock_id,holder_name,cik,period_end,shares_held,market_value,filing_date,data_source,created_at) SELECT v.stock_id,v.holder_name,v.cik,v.period_end,v.shares_held,v.market_value,v.filing_date,'SEC_13F_DATASET',NOW() FROM jsonb_to_recordset($1::jsonb) AS v(stock_id bigint,holder_name text,cik text,period_end date,shares_held numeric,market_value numeric,filing_date date) WHERE NOT EXISTS (SELECT 1 FROM institutional_holders h WHERE h.stock_id=v.stock_id AND h.holder_name=v.holder_name AND h.cik=v.cik AND h.period_end=v.period_end)";
    await sql.query(q,[payload]);inserted+=chunk.length;
  };
  for await(const row of rows(infoFile)){
    scanned++;
    const accession=row.ACCESSION_NUMBER;const cover=coverpages.get(accession);const sub=submissions.get(accession);
    if(!cover||!sub)continue;
    const issuer=row.NAMEOFISSUER;const stock=stockForIssuer(issuer);const shares=Number(String(row.SSHPRNAMT||'').replace(/,/g,''));const val=Number(String(row.VALUE||'').replace(/,/g,''));
    if(!stock||!issuer||!Number.isFinite(shares)||shares<=0){unmatched++;continue;}
    const period=date(cover.REPORTCALENDARORQUARTER)||date(sub.PERIODOFREPORT);const filed=date(sub.FILING_DATE);
    if(!period)continue;
    const value=Number.isFinite(val)&&val>=0?val*1000:null;
    batch.push({stock_id:Number(stock.id),holder_name:cover.FILINGMANAGER_NAME||('13F filer '+sub.CIK),cik:String(sub.CIK||'').replace(/^0+/,'')||null,period_end:period,shares_held:shares,market_value:value,filing_date:filed});
    matched++;
    if(batch.length>=200)await flush();
    if(scanned%500000===0)console.log(JSON.stringify({scanned,matched,inserted,unmatched}));
  }
  await flush();
  const snapshots=await sql.query("INSERT INTO ownership_snapshots(stock_id,period_end,shares_outstanding,institutional_ownership_percent,insider_ownership_percent,float_shares,data_source,created_at,institutional_shares,insider_shares,top_holders) SELECT h.stock_id,h.period_end,f.shares_outstanding,CASE WHEN f.shares_outstanding>0 THEN SUM(h.shares_held)/f.shares_outstanding*100 ELSE NULL END,NULL,NULL,'SEC_13F_DATASET',NOW(),SUM(h.shares_held),NULL,jsonb_agg(jsonb_build_object('holder_name',h.holder_name,'cik',h.cik,'shares_held',h.shares_held,'market_value',h.market_value,'period_end',h.period_end) ORDER BY h.market_value DESC NULLS LAST) FROM institutional_holders h LEFT JOIN LATERAL(SELECT shares_outstanding FROM fundamentals f0 WHERE f0.stock_id=h.stock_id AND f0.shares_outstanding>0 ORDER BY f0.report_date DESC NULLS LAST LIMIT 1) f ON true WHERE h.period_end=(SELECT MAX(h2.period_end) FROM institutional_holders h2 WHERE h2.stock_id=h.stock_id) AND NOT EXISTS(SELECT 1 FROM ownership_snapshots o WHERE o.stock_id=h.stock_id AND o.period_end=h.period_end) GROUP BY h.stock_id,h.period_end,f.shares_outstanding RETURNING stock_id");
  console.log(JSON.stringify({source:'SEC Form 13F quarterly dataset',dataset_url:url,stocks_in_universe:stocks.length,infotable_rows_scanned:scanned,matched_issuer_rows:matched,inserted_holdings:inserted,unmatched_rows:unmatched,ownership_snapshots_added:snapshots.length},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
