import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL);
if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is not configured.');

const YEARS = [2026, 2027, 2030, 2035, 2040, 2050];
const MODEL = 'long-term-v1.0';
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const median = (xs) => { const a=xs.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
const cagr = (start,end,years) => start>0&&end>0&&years>0 ? Math.pow(end/start,1/years)-1 : null;

function quality(f) {
  const parts=[];
  if(n(f.roe)!=null) parts.push(clamp(n(f.roe)/25,0,1));
  if(n(f.roic)!=null) parts.push(clamp(n(f.roic)/20,0,1));
  if(n(f.fcf_margin)!=null) parts.push(clamp(n(f.fcf_margin)/25,0,1));
  if(n(f.debt_equity)!=null&&n(f.debt_equity)>0) parts.push(clamp(1-n(f.debt_equity)/2,0,1));
  return parts.length?parts.reduce((a,b)=>a+b,0)/parts.length:0.5;
}

function growthAnchor(f) {
  const vals=[];
  for(const k of ['three_year_cagr','five_year_cagr','ten_year_cagr','revenue_growth','eps_growth','fcf_growth']) {
    const x=n(f[k]); if(x!=null&&x>-50&&x<100) vals.push(x/100);
  }
  return median(vals);
}

function scenarioGrowth(anchor,q,scenario) {
  const terminal = scenario==='bear'?0.025:scenario==='base'?0.040:0.055;
  const earlyCap = scenario==='bear'?0.14:scenario==='base'?0.20:0.28;
  const earlyFloor = scenario==='bear'?-0.08:scenario==='base'?-0.03:0.00;
  const raw = anchor==null?terminal:anchor;
  const qualityLift=(q-0.5)*0.06;
  return clamp(raw+qualityLift,earlyFloor,earlyCap);
}

function targetMultiple(f,scenario) {
  const pe=n(f.pe_ratio);
  const qualityScore=quality(f);
  const qualityMult=12+qualityScore*18;
  const marketAnchor=scenario==='bear'?14:scenario==='base'?19:24;
  const current=pe&&pe>0&&pe<120?pe:marketAnchor;
  const weight=scenario==='bear'?0.75:scenario==='base'?0.55:0.40;
  return clamp(current*weight+marketAnchor*(1-weight)+qualityMult*0.20,8,42);
}

function build(row) {
  const price=n(row.price); if(!(price>0)) return null;
  const anchor=growthAnchor(row);
  const q=quality(row);
  const currentPE=n(row.pe_ratio);
  const yearsNow=2026-new Date().getUTCFullYear();
  const scenarios={};
  for(const scenario of ['bear','base','bull']) {
    const terminal=scenario==='bear'?0.025:scenario==='base'?0.040:0.055;
    const g0=scenarioGrowth(anchor,q,scenario);
    const multiple=targetMultiple(row,scenario);
    const prices={2026:price};
    let p=price;
    for(const year of YEARS.slice(1)) {
      const years=year-2026;
      // Growth decays toward a durable terminal rate; long horizons are not linear extrapolations.
      const annualG=terminal+(g0-terminal)*Math.exp(-years/8);
      p*=1+annualG;
      prices[year]=p;
    }
    const valuationYears={2027:1,2030:4,2035:9,2040:14,2050:24};
    for(const [year,yrs] of Object.entries(valuationYears)) {
      const valuationBlend=Math.min(1,yrs/10);
      const targetPE=currentPE&&currentPE>0?clamp(currentPE*(1-valuationBlend)+multiple*valuationBlend,8,42):multiple;
      const baseGrowth=p=>p;
      prices[year]=prices[year]*(targetPE/(currentPE&&currentPE>0?currentPE:multiple));
    }
    scenarios[scenario]={prices,growth_start:g0,terminal_growth:terminal,target_multiple:multiple};
  }
  const dataQuality=clamp((row.history_years/10)*0.25+(row.fundamental_count>0?0.45:0)+(row.statement_count>=3?0.30:0),0,1);
  const agreement=1-Math.min(1,Math.abs(scenarios.bull.prices[2050]-scenarios.bear.prices[2050])/Math.max(scenarios.base.prices[2050],1));
  const confidence=clamp(45+dataQuality*25+quality(row)*15+agreement*10,40,82);
  return {q,dataQuality,confidence,scenarios};
}

const rows=(await sql`WITH lf AS (
  SELECT DISTINCT ON (stock_id) * FROM fundamentals ORDER BY stock_id,report_date DESC NULLS LAST,updated_at DESC
), hc AS (
  SELECT stock_id,COUNT(*)::int history_count,COUNT(DISTINCT EXTRACT(YEAR FROM price_date))::int history_years FROM price_history WHERE timeframe='1d' GROUP BY stock_id
), sc AS (
  SELECT stock_id,COUNT(*)::int statement_count FROM financial_statements GROUP BY stock_id
)
SELECT s.id,s.symbol,q.price,lf.*,COALESCE(hc.history_count,0) history_count,COALESCE(hc.history_years,0) history_years,COALESCE(sc.statement_count,0) statement_count,
(SELECT COUNT(*) FROM fundamentals f2 WHERE f2.stock_id=s.id) fundamental_count
FROM stocks s JOIN latest_quotes q ON q.stock_id=s.id AND q.price>0
LEFT JOIN lf ON lf.stock_id=s.id LEFT JOIN hc ON hc.stock_id=s.id LEFT JOIN sc ON sc.stock_id=s.id
WHERE s.is_active=true AND s.asset_type='stock' ORDER BY s.id`);

let inserted=0, skipped=0;
for(const row of rows){
  const built=build(row); if(!built){skipped++;continue;}
  for(const year of YEARS){
    const bear=built.scenarios.bear.prices[year];
    const base=built.scenarios.base.prices[year];
    const bull=built.scenarios.bull.prices[year];
    const years=Math.max(0,year-2026);
    const c=years>0?Math.pow(base/row.price,1/years)-1:0;
    const uncertainty=base>0?(bull-bear)/(2*base):null;
    const direction=base>row.price*1.03?'bullish':base<row.price*0.97?'bearish':'neutral';
    const signal=direction==='bullish'?'long-term-positive':direction==='bearish'?'long-term-negative':'long-term-neutral';
    const feature={model:MODEL,anchor_growth:built.scenarios.base.growth_start,terminal_growth:built.scenarios.base.terminal_growth,target_multiple:built.scenarios.base.target_multiple,quality_score:built.q,data_quality:built.dataQuality,scenario_method:'growth decay toward terminal rate plus valuation mean reversion',note:'Scenario estimate, not a guaranteed future price. 2035-2050 uncertainty is materially higher.'};
    const assumptions={bear:{price:bear},base:{price:base},bull:{price:bull},years,source:'internal fundamentals + financial history'};
    await sql`DELETE FROM long_term_predictions WHERE stock_id=${row.id} AND model_version=${MODEL} AND target_year=${year} AND prediction_date=current_date`;
    await sql`INSERT INTO long_term_predictions(stock_id,model_version,target_year,prediction_date,current_price,bear_price,base_price,bull_price,expected_cagr,confidence,uncertainty,direction,signal,feature_summary,assumptions) VALUES(${row.id},${MODEL},${year},current_date,${row.price},${bear},${base},${bull},${c*100},${built.confidence},${uncertainty},${direction},${signal},${JSON.stringify(feature)}::jsonb,${JSON.stringify(assumptions)}::jsonb)`;
    inserted++;
  }
}
console.log(JSON.stringify({model:MODEL,stocks:rows.length,inserted,skipped,years:YEARS},null,2));