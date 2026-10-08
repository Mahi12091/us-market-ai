import { neon } from '@neondatabase/serverless';

const key=process.env.FMP_API_KEY;
const db=process.env.NEON_DATABASE_URL;
if(!key||!db) throw new Error('FMP_API_KEY and NEON_DATABASE_URL are required.');
const sql=neon(db);
const BASE='https://financialmodelingprep.com/stable';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const api=async(path)=>{
  for(let a=1;a<=5;a++){
    const u=new URL(BASE+path); u.searchParams.set('apikey',key);
    const r=await fetch(u); const t=await r.text();
    if(r.ok){try{return JSON.parse(t)}catch{return []}}
    if(![408,429,500,502,503,504].includes(r.status)||a===5) throw new Error(`FMP ${r.status}: ${t.slice(0,300)}`);
    await sleep(r.status===429?60000:3000*a);
  }
};
const stocks=await sql`SELECT id,symbol,cik FROM stocks WHERE is_active=true AND asset_type='stock' ORDER BY id`;
let ok=0,failed=0;
for(const s of stocks){
  try{
    const sym=encodeURIComponent(String(s.symbol).toUpperCase());
    const [earn,divs,sec,ins] = await Promise.all([
      api(`/earnings?symbol=${sym}`),
      api(`/dividends?symbol=${sym}`),
      api(`/sec-filings-search/symbol?symbol=${sym}&from=2020-01-01&to=2099-12-31&page=0&limit=100`),
      api(`/insider-trading/search?symbol=${sym}&page=0&limit=100`)
    ]);
    for(const x of Array.isArray(earn)?earn:[]){
      await sql`INSERT INTO earnings(stock_id,earnings_date,fiscal_period,eps_estimate,eps_actual,eps_surprise,revenue_estimate,revenue_actual,revenue_surprise,data_source,created_at) VALUES(${s.id},${x.date??x.earningsDate??null},${x.fiscalDateEnding??x.fiscalPeriod??null},${x.epsEstimated??x.epsEstimate??null},${x.eps??x.epsActual??null},${x.epsSurprise??null},${x.revenueEstimated??x.revenueEstimate??null},${x.revenue??x.revenueActual??null},${x.revenueSurprise??null},'fmp',NOW()) ON CONFLICT DO NOTHING`;
    }
    for(const x of Array.isArray(divs)?divs:[]){
      await sql`INSERT INTO dividends(stock_id,ex_date,record_date,payment_date,declaration_date,amount,frequency,currency,data_source,created_at) VALUES(${s.id},${x.date??x.exDate??null},${x.recordDate??null},${x.paymentDate??null},${x.declarationDate??null},${x.dividend??x.amount??null},${x.frequency??null},${x.currency??'USD'},'fmp',NOW()) ON CONFLICT DO NOTHING`;
    }
    for(const x of Array.isArray(sec)?sec:[]){
      await sql`INSERT INTO sec_filings(stock_id,cik,accession_number,form_type,filing_date,filing_period,accepted_at,primary_document,filing_url,filing_description,data_source,created_at) VALUES(${s.id},${x.cik??s.cik??null},${x.accessionNumber??null},${x.formType??null},${x.filingDate??null},${x.filingPeriod??null},${x.acceptedDate??null},${x.finalLink?String(x.finalLink).split('/').pop():null},${x.finalLink??x.link??null},${x.formType??null},'fmp',NOW()) ON CONFLICT DO NOTHING`;
    }
    for(const x of Array.isArray(ins)?ins:[]){
      const shares=Number(x.securitiesTransacted??x.shares??0)||null;
      const price=Number(x.price??0)||null;
      await sql`INSERT INTO insider_transactions(stock_id,insider_name,insider_title,transaction_date,filing_date,transaction_type,shares,price,value,shares_owned_after,transaction_code,filing_url,data_source,created_at) VALUES(${s.id},${x.reportingName??null},${x.typeOfOwner??null},${x.transactionDate??null},${x.filingDate??null},${x.transactionType??null},${shares},${price},${shares&&price?shares*price:null},${x.securitiesOwned??null},${x.transactionType??null},${x.url??null},'fmp',NOW()) ON CONFLICT DO NOTHING`;
    }
    ok++;
  }catch(e){failed++;console.error(`[repair] ${s.symbol}: ${e.message}`)}
  if((ok+failed)%10===0) console.log(JSON.stringify({processed:ok+failed,total:stocks.length,ok,failed}));
  await sleep(100);
}
console.log(JSON.stringify({total:stocks.length,ok,failed}));
