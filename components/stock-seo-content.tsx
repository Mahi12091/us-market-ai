import { isValidElement } from 'react';

type Props = {
  stock:any; quote:any; tech:any; predictions:any[]|null; fundamentals:any; financialMetrics:any[]; threeSpreadMetrics?:any[]; threeSpreadRatios?:any[];
  earnings:any[]|null; earningsRevisions:any[]; news:any[]|null; results:any[]|null; article?:any;
  aiResearch:any[]; performance:any; risks:any; valuations:any; longTerm:any[]; peerMetrics:any[];
};

const money=(v:any)=>v==null?'—':`$${Number(v).toLocaleString('en-US',{maximumFractionDigits:2})}`;
const compactMoney=(v:any)=>v==null?'—':`$${Number(v).toLocaleString('en-US',{notation:'compact',maximumFractionDigits:2})}`;
const num=(v:any)=>v==null?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
const pct=(v:any)=>v==null?'—':`${Number(v)>=0?'+':''}${Number(v).toFixed(2)}%`;
const date=(v:any)=>v==null?'—':new Date(v).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
const renderValue=(v:any):React.ReactNode=>{
  if(v==null)return '—'; if(isValidElement(v))return v;
  if(v instanceof Date)return Number.isNaN(v.getTime())?'—':date(v);
  if(typeof v==='object'){try{return JSON.stringify(v)}catch{return String(v)}} return v;
};

function Section({id,eyebrow,title,children}:{id:string;eyebrow:string;title:string;children:React.ReactNode}){
  return <section className="research-section" id={id}>
    <div className="research-section-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div></div>{children}
  </section>;
}
function Grid({items}:{items:[string,React.ReactNode][]}){
  return <div className="research-metric-grid">{items.map(([k,v])=><div className="research-metric" key={k}><span>{k}</span><strong>{renderValue(v)}</strong></div>)}</div>;
}
function Table({headers,rows}:{headers:string[];rows:any[][]}){
  return <div className="research-table-wrap"><table className="research-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{renderValue(v)}</td>)}</tr>)}</tbody></table></div>;
}
function Empty({children}:{children:string}){return <div className="research-empty">{children}</div>;}
function Explain({title,children}:{title:string;children:React.ReactNode}){return <div className="research-explain"><b>{title}</b><span>{children}</span></div>;}

export default function StockSeoContent({stock,quote,tech,predictions,fundamentals,financialMetrics,earnings,earningsRevisions,news,results,article,aiResearch,performance,risks,valuations,longTerm,peerMetrics}:Props){
  const symbol=stock.symbol, company=stock.company_name;
  const revenueGrowth=fundamentals?.revenue_growth ?? financialMetrics?.[0]?.revenue_growth;
  const netMargin=fundamentals?.net_margin ?? financialMetrics?.[0]?.net_margin;
  const roe=fundamentals?.roe ?? financialMetrics?.[0]?.roe;
  const roic=fundamentals?.roic ?? financialMetrics?.[0]?.roic;
  const pe=fundamentals?.pe_ratio ?? valuations?.pe;
  const businessSummary=stock.description || `${company} is a publicly listed company in the ${stock.industry || stock.sector || 'US equity'} space. Review the evidence below for its business, financial performance, valuation, market behaviour and risks.`;
  const longMap=new Map((longTerm??[]).map(r=>[Number(r.target_year),r]));
  const technical=[
    ['RSI',num(tech?.rsi)],['MACD',num(tech?.macd)],['MACD Signal',num(tech?.macd_signal)],['MACD Histogram',num(tech?.macd_histogram)],
    ['SMA 20',money(tech?.sma_20)],['SMA 50',money(tech?.sma_50)],['SMA 100',money(tech?.sma_100)],['SMA 200',money(tech?.sma_200)],
    ['EMA 20',money(tech?.ema_20)],['EMA 200',money(tech?.ema_200)],['ATR',num(tech?.atr)],['ADX',num(tech?.adx)],
    ['Stochastic',num(tech?.stochastic)],['Stochastic Signal',num(tech?.stochastic_signal)],['OBV',num(tech?.obv)],
    ['ROC',pct(tech?.roc)],['Momentum',pct(tech?.momentum)],['Volatility',pct(tech?.volatility)],
    ['Bollinger Upper',money(tech?.bollinger_upper)],['Bollinger Middle',money(tech?.bollinger_middle)],['Bollinger Lower',money(tech?.bollinger_lower)],
    ['Support',money(tech?.support_level ?? tech?.support)],['Resistance',money(tech?.resistance_level ?? tech?.resistance)],['Trend',tech?.trend??'—']
  ];
  const financial=[
    ['Revenue',compactMoney(fundamentals?.revenue)],['Revenue Growth',pct(revenueGrowth)],['Gross Profit',compactMoney(fundamentals?.gross_profit)],
    ['Operating Income',compactMoney(fundamentals?.operating_income)],['Net Income',compactMoney(fundamentals?.net_income)],['Net Margin',pct(netMargin)],
    ['EPS',num(fundamentals?.eps)],['EPS Growth',pct(fundamentals?.eps_growth)],['Free Cash Flow',compactMoney(fundamentals?.free_cash_flow)],
    ['FCF Growth',pct(fundamentals?.fcf_growth)],['ROE',pct(roe)],['ROIC',pct(roic)],['ROA',pct(fundamentals?.roa)],
    ['Debt / Equity',num(fundamentals?.debt_equity)],['Total Debt',compactMoney(fundamentals?.total_debt)],['Cash',compactMoney(fundamentals?.cash_and_equivalents)],
    ['Working Capital',compactMoney(fundamentals?.working_capital)],['Book Value / Share',num(fundamentals?.book_value_per_share)]
  ];
  const valuation=[
    ['P/E',num(pe)],['Forward P/E',num(fundamentals?.forward_pe ?? valuations?.forward_pe)],['PEG',num(fundamentals?.peg_ratio ?? valuations?.peg)],
    ['Price / Sales',num(fundamentals?.price_sales ?? valuations?.price_sales)],['Price / Book',num(fundamentals?.price_book ?? valuations?.price_book)],
    ['Price / FCF',num(fundamentals?.price_to_fcf ?? valuations?.price_fcf)],['EV / Revenue',num(fundamentals?.enterprise_value_to_revenue ?? valuations?.ev_revenue)],
    ['EV / EBITDA',num(fundamentals?.enterprise_value_to_ebitda ?? valuations?.ev_ebitda)],['EV / EBIT',num(fundamentals?.ev_to_ebit ?? valuations?.ev_to_ebit)],
    ['Earnings Yield',pct(fundamentals?.earnings_yield ?? valuations?.earnings_yield)],['FCF Yield',pct(fundamentals?.fcf_yield ?? valuations?.fcf_yield)],
    ['Dividend Yield',pct(fundamentals?.dividend_yield ?? valuations?.dividend_yield)],['Payout Ratio',pct(fundamentals?.payout_ratio ?? valuations?.payout_ratio)]
  ];
  const risksRows=risks?[['Beta',num(risks.beta)],['Volatility',pct(risks.volatility)],['ATR',num(risks.atr)],['Maximum Drawdown',pct(risks.maximum_drawdown)],['Sharpe Ratio',num(risks.sharpe_ratio)],['Sortino Ratio',num(risks.sortino_ratio)],['Current Ratio',num(risks.current_ratio)],['Quick Ratio',num(risks.quick_ratio)],['Interest Coverage',num(risks.interest_coverage)],['Altman Z-Score',num(risks.altman_z_score)],['Short Interest',num(risks.short_interest)],['Short % Float',pct(risks.short_percent_float)],['Liquidity Risk',risks.liquidity_risk??'—']]:[];
  const perfRows=performance?[['1D',pct(performance.period_1d)],['5D',pct(performance.period_5d)],['1M',pct(performance.period_1m)],['3M',pct(performance.period_3m)],['6M',pct(performance.period_6m)],['YTD',pct(performance.period_ytd)],['1Y',pct(performance.period_1y)],['3Y',pct(performance.period_3y)],['5Y',pct(performance.period_5y)]]:[];

  return <div className="research-flow">
    <Section id="price" eyebrow="01 · PRICE & PERFORMANCE" title={`${symbol} Stock Price Today, Chart & Historical Performance`}>
      <div className="research-intro-grid">
        <div>
          <Grid items={[[`Current ${symbol} Price`,money(quote?.price)],[`Daily Change`,pct(quote?.change_percent)],['Open',money(quote?.open)],['Day High',money(quote?.high)],['Day Low',money(quote?.low)],['Previous Close',money(quote?.previous_close)],['Volume',quote?.volume!=null?Number(quote.volume).toLocaleString('en-US'):'—'],['Market Cap',compactMoney(quote?.market_cap??stock.market_cap)]]}/>
          <div className="research-reading-strip"><b>Historical performance:</b> {perfRows.length?'Returns below describe what has already happened; they are not forecasts.':'Historical return data is not available yet.'}</div>
          {perfRows.length?<Grid items={perfRows}/>:null}
        </div>
        <div className="research-learn"><h3>How to read the price</h3><p>Use the current quote for the latest market snapshot, the chart for historical behaviour, and the performance cards for different holding periods. Keep price movement separate from business fundamentals.</p><div className="research-profile"><span><b>Exchange</b>{stock.exchange??'—'}</span><span><b>Asset Type</b>{stock.asset_type??'Equity'}</span><span><b>52W High</b>{money(quote?.fifty_two_week_high ?? stock.fifty_two_week_high)}</span><span><b>52W Low</b>{money(quote?.fifty_two_week_low ?? stock.fifty_two_week_low)}</span></div></div>
      </div>
    </Section>

    <Section id="analysis" eyebrow="02 · AI RESEARCH + QUANT" title={`${symbol} Stock Analysis: AI Research & Quantitative Outlook`}>
      <div className="research-two-col">
        <div><Grid items={[[`Market Direction`,predictions?.[0]?.direction??'Neutral'],['24H Estimate',money(predictions?.find(p=>String(p.horizon)==='24h')?.predicted_price)],['7D Estimate',money(predictions?.find(p=>String(p.horizon)==='7d')?.predicted_price)],['30D Estimate',money(predictions?.find(p=>String(p.horizon)==='30d')?.predicted_price)],['90D Estimate',money(predictions?.find(p=>String(p.horizon)==='90d')?.predicted_price)],['Model Confidence',predictions?.[0]?.confidence!=null?num(predictions[0].confidence):'—']]}/></div>
        <div className="research-explainer-stack"><Explain title="What is driving the stock?">The model combines market/price features, technical indicators and available fundamental inputs. New evidence can change the estimate.</Explain><Explain title="Bullish and bearish signals">Show the underlying technical, fundamental and event evidence rather than treating the model direction as a guarantee.</Explain><Explain title="What investors should watch">Earnings, guidance, material filings, major news, valuation changes and meaningful shifts in price/volume.</Explain></div>
      </div>
      {aiResearch?.length?<div className="research-ai-block"><h3>Latest AI research notes</h3>{aiResearch.slice(0,3).map((r:any)=><div key={r.id}><b>{r.research_period??r.research_type??'Research update'}</b><p>{r.what_changed_recently??r.fundamental_analysis??r.company_overview??'Research note available.'}</p></div>)}</div>:null}
      <div className="research-reading-strip"><b>Method:</b> quantitative models handle the numbers; AI is used to explain evidence and context. Confidence is a model-quality score, not a probability of being correct.</div>
    </Section>

    <Section id="technical-analysis" eyebrow="03 · TECHNICAL ANALYSIS" title={`${symbol} Technical Analysis: RSI, MACD, Moving Averages & Support`}>
      <Grid items={technical.slice(0,12) as [string,React.ReactNode][]}/>
      <details className="research-details"><summary>Show all technical indicators</summary><Table headers={['Indicator','Value']} rows={technical}/></details>
      <div className="research-two-col"><Explain title="RSI, MACD & momentum">RSI measures recent momentum; MACD compares moving averages; stochastic and momentum indicators help describe price behaviour.</Explain><Explain title="Moving averages & trend">SMA/EMA levels help show trend structure. Support, resistance, Bollinger Bands, ATR and ADX add context around volatility and trend strength.</Explain></div>
    </Section>

    <Section id="financials" eyebrow="04 · FINANCIALS" title={`${symbol} Financials, Fundamentals & Valuation`}>
      <h3>Financial health</h3><Grid items={financial as [string,React.ReactNode][]}/>
      <div className="research-two-col"><Explain title="Revenue & earnings">Revenue growth, net income, margins and EPS help describe the company's operating trajectory.</Explain><Explain title="Cash flow & balance sheet">Free cash flow, cash, debt and leverage help assess financial capacity and balance-sheet risk.</Explain></div>
      <details className="research-details"><summary>Show historical financial metrics</summary>{financialMetrics?.length?<Table headers={['Period','FY','Q','Revenue Growth','Net Margin','ROE','ROIC','FCF Growth','3Y CAGR','5Y CAGR','10Y CAGR']} rows={financialMetrics.map(m=>[date(m.period_end),m.fiscal_year??'—',m.fiscal_quarter??'—',pct(m.revenue_growth),pct(m.net_margin),pct(m.roe),pct(m.roic),pct(m.fcf_growth),pct(m.three_year_cagr),pct(m.five_year_cagr),pct(m.ten_year_cagr)])}/>:<Empty>No period-based financial metrics are stored.</Empty>}</details>
      <h3 id="valuation">Valuation analysis</h3><Grid items={valuation as [string,React.ReactNode][]}/><div className="research-reading-strip">A valuation multiple must be read with growth, margins, cash generation, balance-sheet quality and industry economics. A single multiple is not a complete valuation conclusion.</div>
    </Section>

    <Section id="earnings" eyebrow="05 · EARNINGS + DIVIDEND" title={`${symbol} Earnings, EPS Estimates, Revisions & Dividend`}>
      {(earnings??[]).length?<Table headers={['Date','Period','EPS Est.','EPS Actual','EPS Surprise','Revenue Est.','Revenue Actual','Revenue Surprise']} rows={(earnings??[]).map(e=>[date(e.earnings_date),e.fiscal_period??'—',num(e.eps_estimate),num(e.eps_actual),pct(e.eps_surprise),compactMoney(e.revenue_estimate),compactMoney(e.revenue_actual),pct(e.revenue_surprise)])}/>:<Empty>Earnings data is not populated yet.</Empty>}
      {earningsRevisions?.length?<details className="research-details"><summary>Show EPS and revenue estimate revisions</summary><Table headers={['Date','Period','EPS Estimate','Previous EPS','Revenue Estimate','Previous Revenue','Analysts','Direction']} rows={earningsRevisions.map(r=>[date(r.revision_date),r.fiscal_period??'—',num(r.eps_estimate),num(r.previous_eps_estimate),compactMoney(r.revenue_estimate),compactMoney(r.previous_revenue_estimate),num(r.analyst_count),r.direction??'—'])}/></details>:null}
      <div className="research-two-col"><Explain title="Next earnings date">{earnings?.[0]?.earnings_date?date(earnings[0].earnings_date):'Not available yet.'}</Explain><Explain title="Dividend status">{fundamentals?.dividend_yield!=null? `Dividend yield ${pct(fundamentals.dividend_yield)}. See the Data Room for payment and ex-date history.`:'Dividend information is not available yet.'}</Explain></div>
    </Section>

    <Section id="company" eyebrow="06 · COMPANY + BUSINESS" title={`About ${company}: Business, Sector, Industry & Business Model`}>
      <div className="research-two-col"><div><h3>What does {company} do?</h3><p>{businessSummary}</p></div><div><Grid items={[[`Ticker`,symbol],['Exchange',stock.exchange_full_name??stock.exchange??'—'],['Sector',stock.sector??'—'],['Industry',stock.industry??'—'],['Country',stock.country??'—'],['Founded',renderValue(stock.founded_year)],['Employees',stock.employees!=null?num(stock.employees):'—'],['Headquarters',stock.headquarters??'—']]}/></div></div>
      <h3>Business model & revenue sources</h3><p>{stock.products_services??stock.business_segments??'Detailed product, service and segment data is not available yet.'}</p>
      {peerMetrics?.length?<><h3>Competitive & peer context</h3><Table headers={['Date','Metric','Company','Peer Median','Peer Average','Min','Max','Percentile']} rows={peerMetrics.map(p=>[date(p.metric_date),p.metric_name??'—',num(p.company_value),num(p.peer_median),num(p.peer_average),num(p.peer_min),num(p.peer_max),num(p.percentile)])}/></>:null}
    </Section>

    <Section id="forecast" eyebrow="07 · LONG-TERM SCENARIOS" title={`${symbol} Stock Forecast 2026–2050`}>
      {longTerm?.length?<Table headers={['Year','Bear','Base','Bull','CAGR','Confidence']} rows={[2026,2027,2030,2035,2040,2050].map(y=>{const r=longMap.get(y);return[y,money(r?.bear_price),money(r?.base_price),money(r?.bull_price),pct(r?.expected_cagr),num(r?.confidence)]})}/>:<Empty>Long-term scenario data is not populated yet.</Empty>}
      <div className="research-reading-strip"><b>Scenario model:</b> Bear/Base/Bull outputs are model estimates. Uncertainty increases with the forecast horizon; they are not guaranteed future prices.</div>
    </Section>

    <Section id="news-risks" eyebrow="08 · NEWS, CATALYSTS + RISKS" title={`${symbol} Stock News, Catalysts & Risk Analysis`}>
      <div className="research-two-col"><div><h3>Latest {symbol} stock news</h3>{(news??[]).length?<div className="research-news">{(news??[]).map(n=><a href={n.url??'#'} target="_blank" rel="noreferrer" key={n.id}><div><b>{n.title}</b><span>{n.source??'Market News'} · {n.published_at?date(n.published_at):'Latest'}</span></div><em>{n.sentiment??'neutral'}</em></a>)}</div>:<Empty>No recent ticker-linked news is available.</Empty>}</div><div><h3>Risk metrics</h3>{risksRows.length?<Grid items={risksRows.slice(0,8) as [string,React.ReactNode][]}/>:<Empty>Risk metrics are not populated yet.</Empty>}</div></div>
      <div className="research-risk-list"><h3>Key risk categories</h3><div>Business risk — demand, competition, customers, products and industry structure.</div><div>Financial risk — debt, liquidity, cash flow and interest burden.</div><div>Valuation risk — expectations may already be reflected in the market price.</div><div>Market and volatility risk — broad market conditions can move the stock.</div><div>Event risk — earnings, regulation, litigation and major corporate actions.</div></div>
    </Section>

    <Section id="accuracy" eyebrow="09 · MODEL TRACK RECORD" title={`${symbol} Prediction History, Accuracy & Model Performance`}>
      {results?.length?<Table headers={['Evaluated','Horizon','Predicted','Actual','Error','Result']} rows={results.map(r=>[date(r.evaluated_at),String(r.horizon).toUpperCase(),money(r.predicted_price),money(r.actual_price),pct(r.percentage_error),r.hit?'Hit':'Miss'])}/>:<Empty>Prediction accuracy will appear after forecasts mature and are evaluated against later actual prices.</Empty>}
      <div className="research-reading-strip">Accuracy is calculated only from evaluated predictions. Do not treat an unevaluated forecast or a confidence score as proof of future accuracy.</div>
    </Section>

    <Section id="evidence" eyebrow="10 · EVIDENCE + METHODOLOGY" title={`${symbol} Financial Statements, SEC Filings & Research Evidence`}>
      <div className="research-two-col"><Explain title="Source of truth">Observed market data, reported financial information, filings and other verified inputs are kept separate from model outputs. Missing values remain unavailable rather than being invented.</Explain><Explain title="Research workflow">Market context → technical structure → company evidence → earnings/news → quantitative model → explanation and scenario analysis.</Explain></div>
      <div className="research-reading-strip">The expandable Advanced Data Room below contains raw statements, ownership, SEC filings, monthly/quarterly research, identifiers, provenance and data-quality records.</div>
      {article?.content?<div className="research-ai-block"><h3>Latest AI research</h3><b>{article.title??`${company} research update`}</b><p>{article.summary??article.content}</p></div>:null}
    </Section>

    <Section id="faqs" eyebrow="11 · LONG-TAIL FAQ" title={`${company} (${symbol}) Stock FAQs`}>
      {[
        [`What Is the Current ${company} (${symbol}) Stock Price?`,money(quote?.price)],
        [`What Is the ${company} (${symbol}) Stock Forecast for 2026?`,longMap.get(2026)?`Bear ${money(longMap.get(2026)?.bear_price)} · Base ${money(longMap.get(2026)?.base_price)} · Bull ${money(longMap.get(2026)?.bull_price)}`:'Not available yet.'],
        [`What Is the ${company} (${symbol}) Stock Forecast for 2027?`,longMap.get(2027)?`Bear ${money(longMap.get(2027)?.bear_price)} · Base ${money(longMap.get(2027)?.base_price)} · Bull ${money(longMap.get(2027)?.bull_price)}`:'Not available yet.'],
        [`What Is the ${company} (${symbol}) Stock Price Prediction for 2030?`,longMap.get(2030)?`Bear ${money(longMap.get(2030)?.bear_price)} · Base ${money(longMap.get(2030)?.base_price)} · Bull ${money(longMap.get(2030)?.bull_price)}`:'Not available yet.'],
        [`What Is the Long-Term ${company} (${symbol}) Stock Forecast Through 2050?`,longTerm?.length?'See the 2026–2050 scenario table above.':'Not available yet.'],
        [`What Is the ${symbol} Stock Prediction for the Next 7 Days?`,money(predictions?.find(p=>String(p.horizon)==='7d')?.predicted_price)],
        [`What Is the ${symbol} Stock Prediction for the Next 30 Days?`,money(predictions?.find(p=>String(p.horizon)==='30d')?.predicted_price)],
        [`Is ${symbol} Stock Overvalued or Undervalued?`,pe!=null?`Current P/E is ${num(pe)}; valuation should be interpreted with growth, profitability and peers.`:'Valuation data is not available yet.'],
        [`What Is the ${symbol} P/E Ratio and Valuation?`,pe!=null?num(pe):'Not available yet.'],
        [`What Are the ${company} (${symbol}) Stock Financials?`,fundamentals?'Financial metrics are summarized in the Financials section above.':'Financial data is not available yet.'],
        [`What Does the ${symbol} Technical Analysis Show?`,tech?.trend??'Technical trend data is not available yet.'],
        [`When Is the Next ${symbol} Earnings Date?`,earnings?.[0]?.earnings_date?date(earnings[0].earnings_date):'Not available yet.'],
        [`Does ${company} (${symbol}) Pay a Dividend?`,fundamentals?.dividend_yield!=null?`Dividend yield: ${pct(fundamentals.dividend_yield)}.`:'Dividend data is not available yet.'],
        [`What Are the Key Risks of ${symbol} Stock?`,'Review business, financial, valuation, market and event risks above.'],
        [`What Does ${company} Do and How Does It Make Money?`,businessSummary],
        [`How Accurate Have Previous ${symbol} Stock Predictions Been?`,results?.length?'See evaluated prediction history above.':'No mature prediction history is available yet.'],
        [`What Has Changed Recently in ${symbol} Stock?`,aiResearch?.[0]?.what_changed_recently??'Recent change analysis is not available yet.']
      ].map(([q,a])=><div className="faq-template-row" key={String(q)}><h3>{q}</h3><p>{a}</p></div>)}
    </Section>
  </div>;
}
