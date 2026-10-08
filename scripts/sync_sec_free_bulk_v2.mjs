import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';

const execFileAsync=promisify(execFile);
const sql=neon(process.env.NEON_DATABASE_URL);
const UA=process.env.SEC_USER_AGENT||'US Market AI research admin@example.com';
const MAX=Number(process.env.SEC_MAX_STOCKS||0);
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'usmarketai-sec-v2-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const date=v=>v?String(v).slice(0,10):null;
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const cik=v=>String(v||'').replace(/\D/g,'').padStart(10,'0');
const filingUrl=(c,a,d)=>'https://www.sec.gov/Archives/edgar/data/'+Number(c)+'/'+String(a).replace(/-/g,'')+'/'+(d||'');

async function download(u,f){
  const r=await fetch(u,{headers:{'User-Agent':UA,'Accept-Encoding':'gzip, deflate'}});
  if(!r.ok) throw new Error('SEC '+r.status+' '+u);
  await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(f));
}
async function unzip(f,d){
  await fs.promises.mkdir(d,{recursive:true});
  await execFileAsync('unzip',['-q','-o',f,'-d',d]);
}

async function mapCiks(){
  const f=path.join(TMP,'company_tickers.json');
  await download('https://www.sec.gov/files/company_tickers.json',f);
  const j=JSON.parse(await fs.promises.readFile(f,'utf8'));
  const map=new Map(Object.values(j).map(x=>[String(x.ticker||'').toUpperCase(),cik(x.cik_str)]));
  const rows=await sql`SELECT id,symbol,cik FROM stocks WHERE is_active=true ORDER BY id`;
  let updated=0;
  for(const s of rows){
    const c=map.get(String(s.symbol||'').toUpperCase());
    if(c && c!=='0000000000'){
      await sql`UPDATE stocks SET cik=${c},data_last_verified_at=NOW() WHERE id=${s.id}`;
      updated++;
    }
  }
  console.log('CIK mapped',updated);
}
async function universe(){
  const rows=await sql`SELECT id,symbol,cik FROM stocks WHERE is_active=true AND cik IS NOT NULL ORDER BY id`;
  return (MAX?rows.slice(0,MAX):rows).map(x=>({...x,cik:cik(x.cik)})).filter(x=>x.cik!=='0000000000');
}
async function syncFilings(stocks){
  const z=path.join(TMP,'submissions.zip'),o=path.join(TMP,'submissions');
  await download('https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip',z);
  await unzip(z,o);
  let count=0;
  for(const s of stocks){
    const f=path.join(o,'CIK'+s.cik+'.json'); if(!fs.existsSync(f)) continue;
    const j=JSON.parse(await fs.promises.readFile(f,'utf8')),r=j.filings?.recent; if(!r) continue;
    for(let i=0;i<r.form.length;i++){
      const form=r.form[i],a=r.accessionNumber?.[i];
      if(!a || !/^(10-K|10-Q|8-K|20-F|40-F|6-K|DEF 14A|DEFA14A|DEF 14C|SC 13D|SC 13G|13F-HR|13F-HR\/A|3|4|5|144|S-1|S-3|S-4|424B|11-K)$/i.test(form)) continue;
      const doc=r.primaryDocument?.[i]||null;
      await sql`INSERT INTO sec_filings(stock_id,cik,accession_number,form_type,filing_date,filing_period,accepted_at,primary_document,filing_url,filing_description,data_source,created_at)
      VALUES(${s.id},${s.cik},${a},${form},${date(r.filingDate?.[i])},${date(r.reportDate?.[i])},${r.accepted?.[i]?new Date(r.accepted[i]):null},${doc},${filingUrl(s.cik,a,doc)},${r.primaryDocDescription?.[i]||null},'SEC_EDGAR_BULK',NOW())
      ON CONFLICT(accession_number) DO UPDATE SET form_type=EXCLUDED.form_type,filing_date=EXCLUDED.filing_date,filing_period=EXCLUDED.filing_period,accepted_at=EXCLUDED.accepted_at,primary_document=EXCLUDED.primary_document,filing_url=EXCLUDED.filing_url,filing_description=EXCLUDED.filing_description`;
      count++;
    }
  }
  console.log('SEC filings',count);
}
function fact(f,names){for(const n of names)for(const t of ['us-gaap','ifrs-full']){const x=f?.[t]?.[n];if(x)return x}return null}
function factRows(x){if(!x?.units)return[];const k=Object.keys(x.units)[0];return(x.units[k]||[]).filter(v=>/^(10-Q|10-K|20-F|40-F)$/.test(v.form))}
async function syncXbrl(stocks){
  const z=path.join(TMP,'companyfacts.zip'),o=path.join(TMP,'companyfacts');
  await download('https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip',z); await unzip(z,o);
  let earnings=0,divs=0;
  for(const s of stocks){
    const f=path.join(o,'CIK'+s.cik+'.json'); if(!fs.existsSync(f))continue;
    const facts=JSON.parse(await fs.promises.readFile(f,'utf8')).facts||{};
    const eps=factRows(fact(facts,['EarningsPerShareDiluted','EarningsPerShareBasic']));
    const rev=factRows(fact(facts,['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues']));
    const div=factRows(fact(facts,['CommonStockDividendsPerShareDeclared','PaymentsOfDividendsCommonStock','PaymentsOfDividends']));
    const periods=new Map();
    for(const x of [...eps,...rev]){const k=(x.fy||'')+'|'+(x.fp||'')+'|'+(x.end||'');if(!periods.has(k))periods.set(k,{end:x.end,filed:x.filed,fp:x.fp,eps:null,rev:null})}
    for(const x of eps){const k=(x.fy||'')+'|'+(x.fp||'')+'|'+(x.end||'');if(periods.has(k))periods.get(k).eps=num(x.val)}
    for(const x of rev){const k=(x.fy||'')+'|'+(x.fp||'')+'|'+(x.end||'');if(periods.has(k))periods.get(k).rev=num(x.val)}
    for(const p of periods.values()){if(p.eps==null&&p.rev==null)continue;await sql`INSERT INTO earnings(stock_id,earnings_date,fiscal_period,eps_actual,revenue_actual,data_source,created_at) VALUES(${s.id},${date(p.filed||p.end)},${p.fp||'reported'},${p.eps},${p.rev},'SEC_XBRL_BULK',NOW()) ON CONFLICT DO NOTHING`;earnings++}
    for(const x of div){if(x.val==null||!x.end)continue;await sql`INSERT INTO dividends(stock_id,ex_date,declaration_date,amount,currency,data_source,created_at) VALUES(${s.id},NULL,${date(x.filed||x.end)},${num(x.val)},'USD','SEC_XBRL_BULK',NOW()) ON CONFLICT DO NOTHING`;divs++}
  }
  console.log('XBRL earnings',earnings,'dividend facts',divs);
}
try{await mapCiks();const stocks=await universe();console.log('SEC universe',stocks.length);await syncFilings(stocks);await syncXbrl(stocks);console.log('SEC v2 complete')}finally{await sleep(100);process.exit(0)}