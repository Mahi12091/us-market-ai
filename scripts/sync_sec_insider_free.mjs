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
const text=async url=>{const r=await fetch(url,{headers:{'User-Agent':UA,'Accept-Encoding':'gzip, deflate'}});if(!r.ok)throw new Error('SEC '+r.status+' '+url);return r.text()};
const xmlUrl=(filingUrl)=>filingUrl.replace(/\/[^/]+$/,'')+'/';

async function getOwnershipXml(filingUrl){
  const idx=filingUrl.match(/^(https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/[^/]+\/[^/]+)\/[^/]+$/i)?.[1];
  if(!idx)return null;
  const index=await text(idx+'/index.json');
  const files=JSON.parse(index).directory?.item||[];
  const xml=files.map(x=>x.name).find(n=>/\.xml$/i.test(n));
  if(!xml)return null;
  return text(idx+'/'+xml);
}
async function main(){
  const rows=await sql`SELECT sf.stock_id,sf.cik,sf.accession_number,sf.filing_date,sf.filing_url,s.form_type FROM sec_filings sf JOIN stocks s ON s.id=sf.stock_id WHERE sf.form_type IN ('3','3/A','4','4/A','5','5/A') AND sf.filing_date >= current_date-${DAYS} ORDER BY sf.filing_date DESC LIMIT ${MAX}`;
  let inserted=0,failed=0;
  for(const f of rows){
    try{
      const xml=await getOwnershipXml(f.filing_url); if(!xml)continue;
      const owner=tag(xml,'rptOwnerName'), title=tag(xml,'officerTitle')||tag(xml,'otherText');
      const txDate=date(tag(xml,'transactionDate'));
      const code=tag(xml,'transactionCode');
      const shares=num(tag(xml,'transactionShares'));
      const price=num(tag(xml,'transactionPricePerShare'));
      const after=num(tag(xml,'sharesOwnedFollowingTransaction'));
      const value=shares!=null&&price!=null?shares*price:null;
      if(!owner || !txDate || shares==null)continue;
      const type={P:'Purchase',S:'Sale',A:'Award/Grant',D:'Disposition',F:'Tax Withholding',M:'Option Exercise',G:'Gift',J:'Other' }[code]||code||'Other';
      await sql`INSERT INTO insider_transactions(stock_id,insider_name,insider_title,transaction_date,filing_date,transaction_type,shares,price,value,shares_owned_after,transaction_code,filing_url,data_source,created_at)
      VALUES(${f.stock_id},${owner},${title},${txDate},${date(f.filing_date)},${type},${shares},${price},${value},${after},${code},${f.filing_url},'SEC_FORM_3_4_5',NOW())`;
      inserted++;
    }catch(e){failed++}
    await sleep(180);
  }
  console.log('Insider parsed',inserted,'failed',failed);
}
main().catch(e=>{console.error(e);process.exit(1)})