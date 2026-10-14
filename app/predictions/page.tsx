import type { Metadata } from 'next';
import { createDatabaseClient } from '@/lib/neon';

export const metadata: Metadata = { title: 'AI Predictions', description: 'Explore experimental quantitative forecasts for US stocks across 24-hour to 90-day horizons, with transparent data coverage and outcome-based validation.' };
const horizons=['24h','7d','30d','90d'];
const MIN_OVERALL_RESULTS = 30;
const MIN_HORIZON_RESULTS = 20;
const pct=(v:number|null|undefined)=>v==null?'—':`${v.toFixed(1)}%`;

type PredictionStock = { id: string; symbol: string };
type PredictionRow = { id: string; stock_id: string; horizon: string; current_price: number|null; predicted_price: number|null; predicted_change_percent: number|null; direction: string|null; confidence: number|null; prediction_time: string|null };
type PredictionResult = { prediction_id: string; stock_id: string; horizon: string; predicted_price: number|null; actual_price: number|null; predicted_direction: string|null; actual_direction: string|null; percentage_error: number|null; hit: boolean|null; evaluated_at: string|null };

export default async function Predictions(){
  const db= createDatabaseClient();
  const [{data:rawStocks},{data:rawPredictions},{data:rawResults}]=await Promise.all([
    db.from<PredictionStock>('stocks').select('id,symbol').eq('is_active',true).limit(10000),
    db.from<PredictionRow>('predictions').select('id,stock_id,horizon,current_price,predicted_price,predicted_change_percent,direction,confidence,prediction_time').eq('model_version','quant-v3.0').order('prediction_time',{ascending:false}).limit(30000),
    db.from<PredictionResult>('prediction_results').select('prediction_id,stock_id,horizon,predicted_price,actual_price,predicted_direction,actual_direction,percentage_error,hit,evaluated_at').order('evaluated_at',{ascending:false}).limit(5000)
  ]);
  const stocks: PredictionStock[]=Array.isArray(rawStocks)?rawStocks:rawStocks?[rawStocks]:[];
  const predictions: PredictionRow[]=Array.isArray(rawPredictions)?rawPredictions:rawPredictions?[rawPredictions]:[];
  const results: PredictionResult[]=Array.isArray(rawResults)?rawResults:rawResults?[rawResults]:[];
  const names=new Map<string,string>(stocks.map((s)=>[s.id,s.symbol]));
  const currentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const currentByStockHorizon = new Map<string, PredictionRow>();
  for (const p of predictions) {
    const timestamp = p.prediction_time ? new Date(p.prediction_time).getTime() : NaN;
    if (!Number.isFinite(timestamp) || timestamp < currentCutoff || p.predicted_price == null || !Number.isFinite(Number(p.predicted_price))) continue;
    const key = `${p.stock_id}:${p.horizon}`;
    if (!currentByStockHorizon.has(key)) currentByStockHorizon.set(key, p);
  }
  const currentPredictions = [...currentByStockHorizon.values()];
  const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const horizonSummaries = horizons.map(h => {
    const rows = currentPredictions.filter(p => p.horizon === h);
    const changes = rows.map(p => p.predicted_change_percent).filter((v): v is number => v !== null && Number.isFinite(Number(v))).map(Number);
    const scores = rows.map(p => p.confidence).filter((v): v is number => v !== null && Number.isFinite(Number(v))).map(Number);
    const bullish = rows.filter(p => p.direction === 'bullish').length;
    const bearish = rows.filter(p => p.direction === 'bearish').length;
    return { h, count: rows.length, bullish, bearish, signal: bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral', avgChange: mean(changes), avgConfidence: mean(scores) };
  });
  const stats=horizons.map(h=>{const rs=results.filter((r)=>r.horizon===h);const hits=rs.filter((r)=>r.hit).length;return {h,count:rs.length,accuracy:rs.length>=MIN_HORIZON_RESULTS?hits/rs.length*100:null}});
  const evaluated=results.length;
  const overall=evaluated>=MIN_OVERALL_RESULTS?results.filter((r)=>r.hit).length/evaluated*100:null;
  const recent=predictions.slice(0,20);
  const leaderBull=[...currentPredictions].filter((p)=>p.direction==='bullish').sort((a,b)=>Number(b.confidence)-Number(a.confidence))[0];
  const leaderBear=[...currentPredictions].filter((p)=>p.direction==='bearish').sort((a,b)=>Number(b.confidence)-Number(a.confidence))[0];
  return <div className="container predictions-page"><div className="predictions-shell"><section className="prediction-hero"><div className="prediction-hero-copy"><div className="eyebrow">Quantitative intelligence</div><h1>AI Predictions</h1><p>Model forecasts across 24 hours, 7 days, 30 days and 90 days, with model scores and outcome-based validation. Scores are not probabilities of being correct.</p><div className="prediction-actions"><a className="blue-btn" href="#forecasts">Explore Forecasts</a><a className="outline-btn" href="#history">Prediction History</a></div></div></section><section className="prediction-overview"><div className="prediction-stat"><small>MODEL COVERAGE</small><strong>{stocks.length}</strong><span>Active US assets</span></div><div className="prediction-stat"><small>HORIZONS</small><strong>4</strong><span>24H · 7D · 30D · 90D</span></div><div className="prediction-stat"><small>LIVE STATUS</small><strong>{currentPredictions.length?'Active':'Preparing'}</strong><span>{currentPredictions.length.toLocaleString('en-US')} recent stock/horizon forecasts · Quant-v3.0</span></div><div className="prediction-stat"><small>VALIDATION</small><strong>{evaluated?pct(overall):'Pending'}</strong><span>{evaluated} / {MIN_OVERALL_RESULTS} outcomes to validate</span></div></section><section id="forecasts" className="prediction-layout"><div className="prediction-panel"><div className="prediction-panel-head"><div><h2>Forecast dashboard</h2><p>Aggregated latest forecasts from each stock’s most recent model output, limited to the last seven days.</p></div></div><div className="prediction-table"><div className="prediction-row head"><span>Horizon</span><span>Signal mix</span><span>Average score</span><span>Average forecast move</span></div>{horizonSummaries.map(s=><div className="prediction-row" key={s.h}><b>{s.h.toUpperCase()}<small className="prediction-count">{s.count.toLocaleString('en-US')} stocks</small></b><span className={`signal-pill ${s.signal}`}>{s.bullish.toLocaleString('en-US')} bullish · {s.bearish.toLocaleString('en-US')} bearish</span><div><span>{s.avgConfidence!=null?`${s.avgConfidence.toFixed(0)}/100`:'—'}</span><div className="confidence-track"><div className="confidence-fill" style={{width:`${Math.min(100,Math.max(0,s.avgConfidence??0))}%`}}/></div></div><span>{s.avgChange!=null?`${s.avgChange>=0?'+':''}${s.avgChange.toFixed(2)}%`:'—'}</span></div>)}</div></div><aside className="prediction-panel"><div className="prediction-panel-head"><div><h2>Signal leaders</h2><p>Highest-scored latest signals. The score is not a probability of success.</p></div></div><div className="leaderboard">{[['BULL','Top bullish signal',leaderBull],['BEAR','Top bearish signal',leaderBear]].map(([icon,title,p])=>{const row=p as PredictionRow|undefined;return <div className="leader-row" key={String(title)}><div className="leader-icon">{String(icon)}</div><div><b>{String(title)}</b><small>{row?names.get(row.stock_id):'Awaiting model'}</small></div><div className="leader-value">{row?pct(Number(row.confidence)):'—'}</div></div>})}</div></aside></section><section id="history" className="prediction-history"><div className="prediction-panel history-card"><div className="prediction-panel-head"><div><h2>Prediction history</h2><p>Actual outcomes are shown only after the target horizon has completed. Historical rows are not treated as current signals.</p></div></div><div className="history-list"><div className="history-row"><b>Asset</b><span>Horizon</span><span>Predicted</span><span>Actual / Result</span></div>{recent.length?recent.map((p)=>{const r=results.find((x)=>x.prediction_id===p.id);return <div className="history-row" key={p.id}><b>{names.get(p.stock_id)??'—'}</b><span>{String(p.horizon).toUpperCase()}</span><span>{p.predicted_price!=null?Number(p.predicted_price).toFixed(2):'—'}</span><span>{r?`${Number(r.actual_price).toFixed(2)} · ${r.hit?'HIT':'MISS'}`:'Pending'}</span></div>}):<div className="history-row"><span>No predictions yet</span></div>}</div></div><aside className="prediction-panel accuracy-card"><div className="eyebrow">Model validation</div><div className="accuracy-big">{evaluated?pct(overall):'—'}</div><div className="accuracy-note">Verified directional hit rate appears only after at least {MIN_OVERALL_RESULTS} completed outcomes. Current sample: {evaluated} / {MIN_OVERALL_RESULTS}.</div><div className="accuracy-bars">{stats.map(s=><div className="accuracy-line" key={s.h}><div><b>{s.h.toUpperCase()} accuracy</b><span>{s.accuracy==null?`Pending (${results.filter((r)=>r.horizon===s.h).length}/${MIN_HORIZON_RESULTS})`:pct(s.accuracy)}</span></div><div className="accuracy-track"><i style={{width:`${Math.min(100,s.accuracy??0)}%`}} /></div></div>)}</div></aside></section><section className="prediction-disclaimer"><small>RESEARCH DISCLAIMER</small><h3>Predictions are estimates, not financial advice.</h3><p>Historical accuracy is calculated from completed outcomes stored by the evaluation engine. The database currently has only a small evaluation sample, so accuracy stays pending until the minimum sample size is reached. Model confidence is a relative score—not a calibrated probability—and should not be used as one.</p></section></div></div>}
