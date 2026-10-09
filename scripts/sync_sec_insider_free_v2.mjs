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
  const owner=tag(xml,'rptOwnerName'),title=tag(xml,'officerTitle')||tag(xml,'otherText');
  const transactions=xml.match(/<(?:[A-Za-z0-9_.-]+:)?(?:nonDerivativeTransaction|derivativeTransaction)\\b[^>]*>[\\s\\S]*?<\\/(?:[A-Za-z0-9_.-]+:)?(?:nonDerivativeTransaction|derivativeTransaction)\\s*>/gi)||[];
  if(!owner||!transactions.length){skipped++;continue}
  let insertedForFiling=0;
  for(const tx of transactions){
   const txDate=date(tag(tx,'transactionDate')),code=tag(tx,'transactionCode'),shares=num(tag(tx,'transactionShares')),price=num(tag(tx,'transactionPricePerShare')),after=num(tag(tx,'sharesOwnedFollowingTransaction'));
   if(!txDate||shares==null){skipped++;continue}
   const type={P:'Purchase',S:'Sale',A:'Award/Grant',D:'Disposition',F:'Tax Withholding',M:'Option Exercise',G:'Gift',J:'Other'}[code]||code||'Other';
   const exists=await sql`SELECT 1 FROM insider_transactions WHERE stock_id=${f.stock_id} AND insider_name=${owner} AND transaction_date=${txDate} AND transaction_code IS NOT DISTINCT FROM ${code||null} AND shares=${shares} AND filing_url=${f.filing_url} LIMIT 1`;
   if(exists.length){skipped++;continue}
   await sql`INSERT INTO insider_transactions(stock_id,insider_name,insider_title,transaction_date,filing_date,transaction_type,shares,price,value,shares_owned_after,transaction_code,filing_url,data_source,created_at) VALUES(${f.stock_id},${owner},${title},${txDate},${date(f.filing_date)},${type},${shares},${price},${price!=null?shares*price:null},${after},${code},${f.filing_url},'SEC_FORM_3_4_5',NOW())`;inserted++;insertedForFiling++;
  }
  if(!insertedForFiling) skipped++;
 }catch(e){failed++}
 await sleep(180);
 console.log('Insider parsed',inserted,'skipped',skipped,'failed',failed);
}


async function syncInstitutionalHoldings() {
  const filings = await sql.query(
    "SELECT sf.stock_id,sf.cik,sf.accession_number,sf.filing_date,sf.filing_url,s.company_name AS filer_name,s.symbol AS filer_symbol " +
    "FROM public.sec_filings sf JOIN public.stocks s ON s.id=sf.stock_id " +
    "WHERE sf.form_type IN ('13F-HR','13F-HR/A') AND sf.filing_date >= CURRENT_DATE - ($1::int * INTERVAL '1 day') " +
    "ORDER BY sf.filing_date DESC LIMIT $2",
    [Math.max(DAYS, 190), Math.max(400, Math.min(1500, MAX))]
  );
  const stocks = await sql.query("SELECT id,symbol,company_name FROM public.stocks WHERE is_active=true AND asset_type='stock'");
  const nameMap = new Map();
  const normalize = value => clean(value).toLowerCase().replace(/&/g, ' and ').replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc)\b/g, ' ').replace(/[^a-z0-9]/g, '');
  for (const stock of stocks) {
    const key = normalize(stock.company_name || '');
    if (key && !nameMap.has(key)) nameMap.set(key, stock);
    else if (key) nameMap.set(key, null);
  }
  let parsed = 0, inserted = 0, unmatched = 0, failed = 0;
  for (const filing of filings) {
    try {
      const parsedUrl = new URL(filing.filing_url);
      const parts = parsedUrl.pathname.split('/').filter(Boolean);
      const edgar = parts.indexOf('edgar');
      if (edgar < 0 || !parts[edgar + 3] || !parts[edgar + 4]) { unmatched++; continue; }
      const base = parsedUrl.origin + '/' + parts.slice(0, edgar + 5).join('/');
      const listing = JSON.parse(await get(base + '/index.json'));
      const files = (listing.directory && listing.directory.item ? listing.directory.item : []).map(x => x.name);
      const infoName = files.find(name => /infotable.*\.xml$/i.test(name)) || files.find(name => /infotable/i.test(name) && /\.xml$/i.test(name));
      if (!infoName) { unmatched++; continue; }
      const xml = await get(base + '/' + infoName);
      const periodEnd = date(tag(xml, 'periodOfReport')) || date(filing.filing_date);
      const blocks = xml.match(/<(?:[A-Za-z0-9_.-]+:)?infoTable\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_.-]+:)?infoTable\s*>/gi) || [];
      if (!blocks.length) { unmatched++; continue; }
      parsed++;
      for (const block of blocks) {
        const issuer = tag(block, 'nameOfIssuer');
        const stock = nameMap.get(normalize(issuer || ''));
        const shares = num(tag(block, 'sshPrnamt'));
        const valueThousands = num(tag(block, 'value'));
        if (!stock || shares == null || !issuer) { unmatched++; continue; }
        const marketValue = valueThousands == null ? null : valueThousands * 1000;
        const query =
          "INSERT INTO public.institutional_holders (stock_id,holder_name,cik,period_end,shares_held,market_value,ownership_percent,shares_change,shares_change_percent,filing_date,data_source,created_at) " +
          "SELECT $1,$2,$3,$4,$5,$6,NULL,NULL,NULL,$7,$8,NOW() WHERE NOT EXISTS (" +
          "SELECT 1 FROM public.institutional_holders WHERE stock_id=$1 AND holder_name=$2 AND cik=$3 AND period_end=$4)";
        await sql.query(query, [Number(stock.id), filing.filer_name || filing.filer_symbol || 'SEC 13F filer', String(filing.cik || '').replace(/^0+/, ''), periodEnd, shares, marketValue, date(filing.filing_date), 'SEC_13F_HR']);
        inserted++;
      }
    } catch (error) {
      failed++;
      if (failed <= 10) console.error('[13F] ' + filing.filing_url + ': ' + error.message);
    }
    await sleep(180);
  }
  const snapshotResult = await sql.query(
    "INSERT INTO public.ownership_snapshots (stock_id,period_end,shares_outstanding,institutional_ownership_percent,insider_ownership_percent,float_shares,data_source,created_at,institutional_shares,insider_shares,top_holders) " +
    "SELECT h.stock_id,MAX(h.period_end),f.shares_outstanding,CASE WHEN f.shares_outstanding > 0 THEN SUM(h.shares_held)/f.shares_outstanding*100 ELSE NULL END,NULL,NULL,'SEC_13F_HR',NOW(),SUM(h.shares_held),NULL, " +
    "jsonb_agg(jsonb_build_object('holder_name',h.holder_name,'cik',h.cik,'shares_held',h.shares_held,'market_value',h.market_value,'period_end',h.period_end) ORDER BY h.market_value DESC NULLS LAST) " +
    "FROM public.institutional_holders h LEFT JOIN LATERAL (SELECT shares_outstanding FROM public.fundamentals f0 WHERE f0.stock_id=h.stock_id AND f0.shares_outstanding > 0 ORDER BY f0.report_date DESC NULLS LAST LIMIT 1) f ON true " +
    "WHERE h.period_end=(SELECT MAX(h2.period_end) FROM public.institutional_holders h2 WHERE h2.stock_id=h.stock_id) AND NOT EXISTS (SELECT 1 FROM public.ownership_snapshots o WHERE o.stock_id=h.stock_id AND o.period_end=h.period_end) " +
    "GROUP BY h.stock_id,f.shares_outstanding RETURNING stock_id"
  );
  console.log('[13F] ' + JSON.stringify({ filings: filings.length, parsed_filings: parsed, inserted_holdings: inserted, ownership_snapshots_added: snapshotResult.length, unmatched_issuer_rows: unmatched, failed }));
}

main().then(syncInstitutionalHoldings).catch(e=>{console.error(e);process.exit(1)})