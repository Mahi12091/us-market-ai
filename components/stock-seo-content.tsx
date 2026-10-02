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
  const perfRows: [string, React.ReactNode][]=performance?[['1D',pct(performance.period_1d)],['5D',pct(performance.period_5d)],['1M',pct(performance.period_1m)],['3M',pct(performance.period_3m)],['6M',pct(performance.period_6m)],['YTD',pct(performance.period_ytd)],['1Y',pct(performance.period_1y)],['3Y',pct(performance.period_3y)],['5Y',pct(performance.period_5y)]]:[];

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
    <h3>{symbol} Stock Price Today</h3><p className="seo-prose">Current verified quote and daily movement are shown above.</p><h3>{symbol} Share Price, Open, High, Low &amp; Volume</h3><p className="seo-prose">Open, high, low, previous close and volume come from the latest quote.</p><h3>{symbol} Stock Chart &amp; Historical Price Performance</h3><p className="seo-prose">The historical chart uses stored daily price history.</p><h3>{symbol} 52-Week High, Low &amp; Market Data</h3><p className="seo-prose">52-week range and market data are shown from available backend fields.</p><h3>{symbol} Historical Returns &amp; Price Performance</h3><p className="seo-prose">Returns are displayed for 1D, 5D, 1M, 3M, 6M, YTD, 1Y, 3Y and 5Y where available.</p></Section>

    <Section id="analysis" eyebrow="02 · AI RESEARCH + QUANT" title={`${symbol} Stock Analysis: AI Research & Quantitative Outlook`}>
      <div className="research-two-col">
        <div><Grid items={[[`Market Direction`,predictions?.[0]?.direction??'Neutral'],['24H Estimate',money(predictions?.find(p=>String(p.horizon)==='24h')?.predicted_price)],['7D Estimate',money(predictions?.find(p=>String(p.horizon)==='7d')?.predicted_price)],['30D Estimate',money(predictions?.find(p=>String(p.horizon)==='30d')?.predicted_price)],['90D Estimate',money(predictions?.find(p=>String(p.horizon)==='90d')?.predicted_price)],['Model Confidence',predictions?.[0]?.confidence!=null?num(predictions[0].confidence):'—']]}/></div>
        <div className="research-explainer-stack"><Explain title="What is driving the stock?">AI text pending</Explain><Explain title="Bullish and bearish signals">AI text pending</Explain><Explain title="What investors should watch">AI text pending</Explain></div>
      </div>
      {aiResearch?.length?<div className="research-ai-block"><h3>Latest AI research notes</h3>{aiResearch.slice(0,3).map((r:any)=><div key={r.id}><b>{r.research_period??r.research_type??'Research update'}</b><p>{r.what_changed_recently??r.fundamental_analysis??r.company_overview??'Research note available.'}</p></div>)}</div>:null}
      <div className="research-reading-strip"><b>AI Research:</b> AI text pending</div>
    <h3>{symbol} Stock Analysis Today: What Is Changing?</h3><p className="seo-prose">Current research notes and available evidence describe what has changed.</p><h3>Is {symbol} Stock Going Up or Down? Current Market Outlook</h3><p className="seo-prose">The current quantitative direction is displayed from the model output.</p><h3>What Is Driving {symbol} Stock Price?</h3><p className="seo-prose">Available market, technical, fundamental and event evidence is used as model context.</p><h3>{symbol} Quantitative Forecast: 24H, 7D, 30D &amp; 90D</h3><p className="seo-prose">Forecast rows are populated only when the corresponding prediction exists.</p><h3>Key Bullish and Bearish Signals for {symbol}</h3><p className="seo-prose">Signals are derived from observed model inputs, not arbitrary labels.</p><h3>What Investors Should Watch for {symbol}</h3><p className="seo-prose">Earnings, filings, news, valuation and material technical changes are the principal watch items.</p><h3>How the US Market AI Quantitative Model Works</h3><p className="seo-prose">Market data → technical features → fundamentals → model → prediction → evaluation.</p></Section>

    <Section id="technical-analysis" eyebrow="03 · TECHNICAL ANALYSIS" title={`${symbol} Technical Analysis: RSI, MACD, Moving Averages & Support`}>
      <Grid items={technical.slice(0,12) as [string,React.ReactNode][]}/>
      <details className="research-details"><summary>Show all technical indicators</summary><Table headers={['Indicator','Value']} rows={technical}/></details>
      <div className="research-two-col"><Explain title="RSI, MACD & momentum">AI text pending</Explain><Explain title="Moving averages & trend">AI text pending</Explain></div>
    </Section>

    <Section id="financials" eyebrow="04 · FINANCIALS" title={`${symbol} Financials, Fundamentals & Valuation`}>
      <h3>Financial health</h3><Grid items={financial as [string,React.ReactNode][]}/>
      <div className="research-two-col"><Explain title="Revenue & earnings">AI text pending</Explain><Explain title="Cash flow & balance sheet">AI text pending</Explain></div>
      <details className="research-details"><summary>Show historical financial metrics</summary>{financialMetrics?.length?<Table headers={['Period','FY','Q','Revenue Growth','Net Margin','ROE','ROIC','FCF Growth','3Y CAGR','5Y CAGR','10Y CAGR']} rows={financialMetrics.map(m=>[date(m.period_end),m.fiscal_year??'—',m.fiscal_quarter??'—',pct(m.revenue_growth),pct(m.net_margin),pct(m.roe),pct(m.roic),pct(m.fcf_growth),pct(m.three_year_cagr),pct(m.five_year_cagr),pct(m.ten_year_cagr)])}/>:<Empty>No period-based financial metrics are stored.</Empty>}</details>
      <h3 id="valuation">Valuation analysis</h3><Grid items={valuation as [string,React.ReactNode][]}/><div className="research-reading-strip"><b>AI Valuation Interpretation:</b> AI text pending</div>
    <h3>{symbol} Revenue &amp; Revenue Growth</h3><p className="seo-prose">Revenue and growth are sourced from fundamentals and financial metrics.</p><h3>{symbol} Earnings, Net Income &amp; Profit Margin</h3><p className="seo-prose">Net income and margin are shown from available reported metrics.</p><h3>{symbol} EPS &amp; EPS Growth</h3><p className="seo-prose">EPS and EPS growth are shown where available.</p><h3>{symbol} Free Cash Flow &amp; Cash Flow Analysis</h3><p className="seo-prose">Free cash flow and related cash-flow metrics are surfaced from backend data.</p><h3>{symbol} ROE, ROIC &amp; Profitability</h3><p className="seo-prose">ROE, ROIC and profitability metrics provide return context.</p><h3>{symbol} Debt, Cash &amp; Debt-to-Equity Ratio</h3><p className="seo-prose">Debt, cash and leverage are shown from financial data.</p><h3>{symbol} Balance Sheet &amp; Financial Health</h3><p className="seo-prose">This is the interpreted financial-health view; the raw balance sheet remains in Evidence.</p><h3>{symbol} P/E Ratio, Forward P/E &amp; PEG Ratio</h3><p className="seo-prose">Valuation multiples are shown when available.</p><h3>{symbol} Price-to-Sales &amp; Price-to-Book Ratio</h3><p className="seo-prose">Sales and book-value multiples are shown from valuation data.</p><h3>{symbol} Enterprise Value, EV/Revenue &amp; EV/EBITDA</h3><p className="seo-prose">Enterprise-value multiples are shown where populated.</p><h3>{symbol} Market Cap &amp; Enterprise Value</h3><p className="seo-prose">Market capitalization and enterprise value are kept distinct.</p><h3>{symbol} Valuation Analysis</h3><p className="seo-prose">Valuation interpretation combines multiples with growth, profitability and cash generation.</p><h3>{symbol} Financial Metrics &amp; Historical Trends</h3><p className="seo-prose">Historical financial metrics are shown by period where available.</p></Section>

    <Section id="earnings" eyebrow="05 · EARNINGS + DIVIDEND" title={`${symbol} Earnings, EPS Estimates, Revisions & Dividend`}>
      {(earnings??[]).length?<Table headers={['Date','Period','EPS Est.','EPS Actual','EPS Surprise','Revenue Est.','Revenue Actual','Revenue Surprise']} rows={(earnings??[]).map(e=>[date(e.earnings_date),e.fiscal_period??'—',num(e.eps_estimate),num(e.eps_actual),pct(e.eps_surprise),compactMoney(e.revenue_estimate),compactMoney(e.revenue_actual),pct(e.revenue_surprise)])}/>:<Empty>Earnings data is not populated yet.</Empty>}
      {earningsRevisions?.length?<details className="research-details"><summary>Show EPS and revenue estimate revisions</summary><Table headers={['Date','Period','EPS Estimate','Previous EPS','Revenue Estimate','Previous Revenue','Analysts','Direction']} rows={earningsRevisions.map(r=>[date(r.revision_date),r.fiscal_period??'—',num(r.eps_estimate),num(r.previous_eps_estimate),compactMoney(r.revenue_estimate),compactMoney(r.previous_revenue_estimate),num(r.analyst_count),r.direction??'—'])}/></details>:null}
      <div className="research-two-col"><Explain title="Next earnings date">{earnings?.[0]?.earnings_date?date(earnings[0].earnings_date):'Not available yet.'}</Explain><Explain title="Dividend status">{fundamentals?.dividend_yield!=null? `Dividend yield ${pct(fundamentals.dividend_yield)}. See the Data Room for payment and ex-date history.`:'Dividend information is not available yet.'}</Explain></div>
    <h3>{symbol} Earnings Date &amp; Latest Results</h3><p className="seo-prose">Latest earnings records and dates are shown from the earnings dataset.</p><h3>{symbol} EPS Actual vs Estimate</h3><p className="seo-prose">Actual-versus-estimate EPS is shown when both fields exist.</p><h3>{symbol} Revenue Actual vs Estimate</h3><p className="seo-prose">Actual-versus-estimate revenue is shown when both fields exist.</p><h3>{symbol} Earnings Surprise &amp; Revisions</h3><p className="seo-prose">Surprises and analyst revisions are sourced from earnings and revisions data.</p><h3>{symbol} Earnings Growth &amp; Historical Results</h3><p className="seo-prose">Stored historical earnings records provide the evidence layer for earnings trends.</p><h3>When Is {symbol}'s Next Earnings Date?</h3><p className="seo-prose">The next stored earnings date is shown when available.</p><h3>Does {symbol} Pay a Dividend?</h3><p className="seo-prose">Dividend status is based on dividend records rather than assumptions.</p><h3>{symbol} Dividend Yield, Ex-Dividend Date &amp; Payment Date</h3><p className="seo-prose">Yield and dividend dates are shown from dividend records.</p><h3>{symbol} Dividend History</h3><p className="seo-prose">Historical dividend rows are available when populated.</p></Section>

    <Section id="company" eyebrow="06 · COMPANY + BUSINESS" title={`About ${company}: Business, Sector, Industry & Business Model`}>
      <div className="research-two-col"><div><h3>What does {company} do?</h3><p>{stock.description ? stock.description : 'AI text pending'}</p></div><div><Grid items={[[`Ticker`,symbol],['Exchange',stock.exchange_full_name??stock.exchange??'—'],['Sector',stock.sector??'—'],['Industry',stock.industry??'—'],['Country',stock.country??'—'],['Founded',renderValue(stock.founded_year)],['Employees',stock.employees!=null?num(stock.employees):'—'],['Headquarters',stock.headquarters??'—']]}/></div></div>
      <h3>Business model & revenue sources</h3><p>{stock.products_services??stock.business_segments??'AI text pending'}</p>
      {peerMetrics?.length?<><h3>Competitive & peer context</h3><Table headers={['Date','Metric','Company','Peer Median','Peer Average','Min','Max','Percentile']} rows={peerMetrics.map(p=>[date(p.metric_date),p.metric_name??'—',num(p.company_value),num(p.peer_median),num(p.peer_average),num(p.peer_min),num(p.peer_max),num(p.percentile)])}/></>:null}
    <h3>What Does {company} Do?</h3><p className="seo-prose">The company description is used as the primary business-profile source.</p><h3>{symbol} Business Model &amp; Revenue Sources</h3><p className="seo-prose">Business model and segment fields are shown when populated.</p><h3>{symbol} Products, Services &amp; Markets</h3><p className="seo-prose">Products and services are shown from the company profile when available.</p><h3>{symbol} Sector and Industry</h3><p className="seo-prose">Sector and industry come from the stock master data.</p><h3>{symbol} Market Cap, Employees &amp; Headquarters</h3><p className="seo-prose">Company profile metadata is shown where stored.</p><h3>{symbol} Company Overview</h3><p className="seo-prose">The overview consolidates the available company profile information.</p><h3>{symbol} Competitive &amp; Peer Context</h3><p className="seo-prose">Peer metrics are shown when the peer dataset is populated.</p></Section>

    <Section id="forecast" eyebrow="07 · LONG-TERM SCENARIOS" title={`${symbol} Stock Forecast 2026–2050`}>
      {longTerm?.length?<Table headers={['Year','Bear','Base','Bull','CAGR','Confidence']} rows={[2026,2027,2030,2035,2040,2050].map(y=>{const r=longMap.get(y);return[y,money(r?.bear_price),money(r?.base_price),money(r?.bull_price),pct(r?.expected_cagr),num(r?.confidence)]})}/>:<Empty>Long-term scenario data is not populated yet.</Empty>}
      <div className="research-reading-strip"><b>Scenario model:</b> Bear/Base/Bull outputs are model estimates. <b>AI scenario interpretation:</b> AI text pending.</div>
    <h3>{symbol} Stock Price Prediction 2026</h3><p className="seo-prose">Bear/Base/Bull values come from long-term-v1.0 when available.</p><h3>{symbol} Stock Price Prediction 2027</h3><p className="seo-prose">Bear/Base/Bull values come from long-term-v1.0 when available.</p><h3>{symbol} Stock Price Prediction 2030</h3><p className="seo-prose">Bear/Base/Bull values come from long-term-v1.0 when available.</p><h3>{symbol} Stock Price Prediction 2035</h3><p className="seo-prose">Bear/Base/Bull values come from long-term-v1.0 when available.</p><h3>{symbol} Stock Price Prediction 2040</h3><p className="seo-prose">Bear/Base/Bull values come from long-term-v1.0 when available.</p><h3>{symbol} Stock Price Prediction 2050</h3><p className="seo-prose">Bear/Base/Bull values come from long-term-v1.0 when available.</p><h3>How the {symbol} Long-Term Forecast Is Calculated</h3><p className="seo-prose">One long-term-v1.0 architecture is used across the target years.</p><h3>{symbol} Bull, Base &amp; Bear Scenario Assumptions</h3><p className="seo-prose">Scenario assumptions are displayed from stored model metadata when available.</p></Section>

    <Section id="news-risks" eyebrow="08 · NEWS, CATALYSTS + RISKS" title={`${symbol} Stock News, Catalysts & Risk Analysis`}>
      <div className="research-two-col"><div><h3>Latest {symbol} stock news</h3>{(news??[]).length?<div className="research-news">{(news??[]).map(n=><a href={n.url??'#'} target="_blank" rel="noreferrer" key={n.id}><div><b>{n.title}</b><span>{n.source??'Market News'} · {n.published_at?date(n.published_at):'Latest'}</span></div><em>{n.sentiment??'neutral'}</em></a>)}</div>:<Empty>No recent ticker-linked news is available.</Empty>}</div><div><h3>Risk metrics</h3>{risksRows.length?<Grid items={risksRows.slice(0,8) as [string,React.ReactNode][]}/>:<Empty>Risk metrics are not populated yet.</Empty>}</div></div>
      <div className="research-risk-list"><h3>Key risk categories</h3><div>Business risk — AI text pending</div><div>Financial risk — AI text pending</div><div>Valuation risk — AI text pending</div><div>Market and volatility risk — AI text pending</div><div>Event risk — AI text pending</div></div>
    </Section>

    <Section id="accuracy" eyebrow="09 · MODEL TRACK RECORD" title={`${symbol} Prediction History, Accuracy & Model Performance`}>
      {results?.length?<Table headers={['Evaluated','Horizon','Predicted','Actual','Error','Result']} rows={results.map(r=>[date(r.evaluated_at),String(r.horizon).toUpperCase(),money(r.predicted_price),money(r.actual_price),pct(r.percentage_error),r.hit?'Hit':'Miss'])}/>:<Empty>Prediction accuracy will appear after forecasts mature and are evaluated against later actual prices.</Empty>}
      <div className="research-reading-strip"><b>AI Performance Interpretation:</b> AI text pending. Accuracy calculations themselves remain backend-derived.</div>
    <h3>{symbol} 24-Hour Prediction Accuracy</h3><p className="seo-prose">Only matured 24-hour forecasts are included.</p><h3>{symbol} 7-Day Prediction Accuracy</h3><p className="seo-prose">Only matured 7-day forecasts are included.</p><h3>{symbol} 30-Day Prediction Accuracy</h3><p className="seo-prose">Only matured 30-day forecasts are included.</p><h3>{symbol} 90-Day Prediction Accuracy</h3><p className="seo-prose">Only matured 90-day forecasts are included.</p><h3>Actual Price vs Predicted Price for {symbol}</h3><p className="seo-prose">Prediction results compare the stored forecast with later actual price.</p><h3>{symbol} Historical Forecast Performance</h3><p className="seo-prose">Historical performance uses evaluated prediction results only.</p><h3>How US Market AI Measures Prediction Accuracy</h3><p className="seo-prose">Predictions are evaluated only after their target horizon has matured.</p></Section>

    <Section id="evidence" eyebrow="10 · EVIDENCE + METHODOLOGY" title={`${symbol} Financial Statements, SEC Filings & Research Evidence`}>
      <div className="research-two-col"><Explain title="Source of truth">Observed market data, reported financial information, filings and other verified inputs are kept separate from model outputs. Missing values remain unavailable rather than being invented.</Explain><Explain title="Research workflow">AI text pending</Explain></div>
      <div className="research-reading-strip">The expandable Advanced Data Room below contains raw source-level data. <b>AI research interpretation:</b> AI text pending.</div>
      {article?.content?<div className="research-ai-block"><h3>Latest AI research</h3><b>{article.title??`${company} research update`}</b><p>{article.summary??article.content}</p></div>:null}
    <h3>{symbol} Income Statement</h3><p className="seo-prose">Raw historical income-statement records are shown here.</p><h3>{symbol} Balance Sheet</h3><p className="seo-prose">Raw historical balance-sheet records are shown here; interpretation remains in Financials.</p><h3>{symbol} Cash Flow Statement</h3><p className="seo-prose">Raw cash-flow records are shown here.</p><h3>{symbol} SEC Filings &amp; Regulatory Reports</h3><p className="seo-prose">SEC filing records and source links are shown when available.</p><h3>{symbol} Institutional Ownership</h3><p className="seo-prose">Institutional holder records are shown from the ownership datasets.</p><h3>{symbol} Insider Transactions</h3><p className="seo-prose">Insider transaction records are shown from the backend.</p><h3>{symbol} Historical Financial Data</h3><p className="seo-prose">Historical metrics provide the period-level evidence behind summaries.</p><h3>{symbol} Source Data &amp; Financial Ratios</h3><p className="seo-prose">3Spread and other source-level ratios are kept in the evidence layer.</p><h3>{symbol} Data Sources &amp; Research Methodology</h3><p className="seo-prose">Source, provenance and methodology information explain where research inputs originate.</p><h3>AI Monthly Stock Research</h3><p className="seo-prose">Monthly research archives are shown when populated.</p><h3>AI Quarterly Earnings &amp; Financial Research</h3><p className="seo-prose">Quarterly research archives are shown when populated.</p><h3>Data Quality &amp; Provenance</h3><p className="seo-prose">Quality checks and provenance records are shown when available.</p><h3>Advanced Data Room</h3><p className="seo-prose">Raw source-level datasets remain expandable so the page stays readable.</p></Section>

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
