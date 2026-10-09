import { neon } from '@neondatabase/serverless';
const sql=neon(process.env.NEON_DATABASE_URL);
const UA=process.env.SEC_USER_AGENT||'US Market AI research admin@example.com';
const MAX=Number(process.env.SEC_INSIDER_MAX||5000);
const DAYS=Number(process.env.SEC_INSIDER_DAYS||180);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim();
const tag=(xml,name)=>{const m=xml.match(new RegExp('<(?:[A-Za-z0-9_.-]+:)?'+name+'[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?'+name+'>','i'));return m?clean(m[1]):null};
const date=s=>s?String(s).slice(0,10):null;
const num=s=>{const n=Number(String(s||'').replace(/,/g,''));return Number.isFinite(n)?n:null};
async function get(url){const r=await fetch(url,{headers:{'User-Agent':UA,'Accept-Encoding':'gzip, deflate'}});if(!r.ok)throw new Error('SEC '+r.status);return r.text()}
async function ownershipXml(url){return get(url)}
async function main(){
 const rows=await sql`SELECT sf.stock_id,sf.cik,sf.accession_number,sf.filing_date,sf.filing_url,sf.form_type FROM sec_filings sf WHERE sf.form_type IN ('3','3/A','4','4/A','5','5/A') AND sf.filing_date >= CURRENT_DATE - (${DAYS} * INTERVAL '1 day') ORDER BY sf.filing_date DESC LIMIT ${MAX}`;
 let inserted=0,skipped=0,failed=0;
 for(const f of rows)try{
  const xml=await ownershipXml(f.filing_url);if(!xml){skipped++;continue}
  const owner=tag(xml,'rptOwnerName'),title=tag(xml,'officerTitle')||tag(xml,'otherText'),txDate=date(tag(xml,'transactionDate')),code=tag(xml,'transactionCode'),shares=num(tag(xml,'transactionShares')),price=num(tag(xml,'transactionPricePerShare')),after=num(tag(xml,'sharesOwnedFollowingTransaction'));
  if(!owner||!txDate||shares==null){skipped++;continue}
  const type={P:'Purchase',S:'Sale',A:'Award/Grant',D:'Disposition',F:'Tax Withholding',M:'Option Exercise',G:'Gift',J:'Other'}[code]||code||'Other';
  const exists=await sql`SELECT 1 FROM insider_transactions WHERE stock_id=${f.stock_id} AND insider_name=${owner} AND transaction_date=${txDate} AND transaction_code=${code||null} AND shares=${shares} AND filing_url=${f.filing_url} LIMIT 1`;
  if(exists.length){skipped++;continue}
  await sql`INSERT INTO insider_transactions(stock_id,insider_name,insider_title,transaction_date,filing_date,transaction_type,shares,price,value,shares_owned_after,transaction_code,filing_url,data_source,created_at) VALUES(${f.stock_id},${owner},${title},${txDate},${date(f.filing_date)},${type},${shares},${price},${price!=null?shares*price:null},${after},${code},${f.filing_url},'SEC_FORM_3_4_5',NOW())`;inserted++;
 }catch(e){failed++}
 await sleep(180);
 console.log('Insider parsed',inserted,'skipped',skipped,'failed',failed);
}
main().catch(e=>{console.error(e);process.exit(1)})