import { isValidElement } from 'react';

type Props = {
  stock:any; quote:any; tech:any; predictions:any[]|null; fundamentals:any; financialMetrics:any[]; threeSpreadMetrics?:any[]; threeSpreadRatios?:any[];
  earnings:any[]|null; earningsRevisions:any[]; news:any[]|null; results:any[]|null; article?:any; aiResearch:any[]; performance:any; risks:any; valuations:any; longTerm:any[]; peerMetrics:any[];
};

const money=(v:any)=>v==null?'—':`$${Number(v).toLocaleString('en-US',{maximumFractionDigits:2})}`;
const compactMoney=(v:any)=>v==null?'—':`$${Number(v).toLocaleString('en-US',{notation:'compact',maximumFractionDigits:2})}`;
const num=(v:any)=>v==null?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
const pct=(v:any)=>v==null?'—':`${Number(v)>=0?'+':''}${Number(v).toFixed(2)}%`;
const date=(v:any)=>v==null?'—':new Date(v).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
const textValue=(v:any):string=>{
  if(v==null)return '—';
  if(typeof v==='string')return v;
  if(typeof v==='number'||typeof v==='boolean')return String(v);
  try{return JSON.stringify(v)}catch{return String(v)}
};
const renderValue=(v:any):React.ReactNode=>{
  if(v==null)return '—';
  if(isValidElement(v))return v;
  if(v instanceof Date)return Number.isNaN(v.getTime())?'—':date(v);
  if(typeof v==='object'){try{return JSON.stringify(v)}catch{return String(v)}}
  return v;
};
function Section({id,eyebrow,title,children}:{id:string;eyebrow:string;title:string;children:React.ReactNode}){
  return <section className="research-section" id={id}><div className="research-section-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div></div>{children}</section>;
}
function Grid({items}:{items:[string,React.ReactNode][]}){return <div className="research-metric-grid">{items.filter(([,v])=>v!==null&&v!==undefined&&v!=='—').map(([k,v])=><div className="research-metric" key={k}><span>{k}</span><strong>{renderValue(v)}</strong></div>)}</div>}
function Table({headers,rows}:{headers:string[];rows:any[][]}){return <div className="research-table-wrap"><table className="research-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{renderValue(v)}</td>)}</tr>)}</tbody></table></div>}
function Empty({children}:{children:string}){return <div className="research-empty">{children}</div>}
function AIBlock({title,children='AI text pending'}:{title:string;children?:React.ReactNode}){return <div className="research-explain"><b>{title}</b><span>{children}</span></div>}
function JsonText({value}:{value:any}){return <span>{typeof value==='string'?value:textValue(value)}</span>}

export default function StockSeoContent({stock,quote,tech,predictions,fundamentals,financialMetrics,earnings,earningsRevisions,news,results,article,aiResearch,performance,risks,valuations,longTerm,peerMetrics}:Props){
  const symbol=stock.symbol, company=stock.company_name;
  const research=aiResearch?.[0]??{};
  const revenueGrowth=fundamentals?.revenue_growth;
  const pe=fundamentals?.pe_ratio??valuations?.pe;
  const longMap=new Map((longTerm??[]).map(r=>[Number(r.target_year),r]));
  const prediction=(h:string)=>predictions?.find(p=>String(p.horizon).toLowerCase()===h.toLowerCase());
  const latestEarnings=earnings?.[0];
  const hasDividend=Boolean(fundamentals?.dividend_yield!=null || (earnings??[]).length && false);
  const businessSegments=stock.business_segments;
  const products=stock.products_services;
  const management=stock.management;
  const hasHistoricalValuation=Boolean(valuations?.valuation_date || valuations?.price || valuations?.pe);
  const technicalRows:[string,React.ReactNode][]=[
    ['RSI',num(tech?.rsi)],['MACD',num(tech?.macd)],['MACD Signal',num(tech?.macd_signal)],['MACD Histogram',num(tech?.macd_histogram)],
    ['SMA 20',money(tech?.sma_20)],['SMA 50',money(tech?.sma_50)],['SMA 100',money(tech?.sma_100)],['SMA 200',money(tech?.sma_200)],
    ['EMA 20',money(tech?.ema_20)],['EMA 50',money(tech?.ema_50)],['EMA 200',money(tech?.ema_200)],['ATR',num(tech?.atr)],['ADX',num(tech?.adx)],
    ['Bollinger Upper',money(tech?.bollinger_upper)],['Bollinger Middle',money(tech?.bollinger_middle)],['Bollinger Lower',money(tech?.bollinger_lower)],
    ['Stochastic',num(tech?.stochastic)],['Stochastic Signal',num(tech?.stochastic_signal)],['OBV',num(tech?.obv)],['Volatility',pct(tech?.volatility)],
    ['Momentum',num(tech?.momentum)],['ROC',pct(tech?.roc)],['Williams %R',num(tech?.williams_r)],['CCI',num(tech?.cci)],['MFI',num(tech?.mfi)],
    ['Support',money(tech?.support_level)],['Resistance',money(tech?.resistance_level)],['Trend',tech?.trend]
  ];
  const financialRows:[string,React.ReactNode][]=[
    ['Revenue',compactMoney(fundamentals?.revenue)],['Revenue Growth',pct(revenueGrowth)],['Gross Profit',compactMoney(fundamentals?.gross_profit)],
    ['Operating Income',compactMoney(fundamentals?.operating_income)],['Net Income',compactMoney(fundamentals?.net_income)],['Net Margin',pct(fundamentals?.net_margin)],
    ['EPS',num(fundamentals?.eps)],['EPS Growth',pct(fundamentals?.eps_growth)],['Free Cash Flow',compactMoney(fundamentals?.free_cash_flow)],
    ['FCF Growth',pct(fundamentals?.fcf_growth)],['ROE',pct(fundamentals?.roe)],['ROA',pct(fundamentals?.roa)],['ROIC',pct(fundamentals?.roic)],['ROCE',pct(fundamentals?.roce)],
    ['Debt / Equity',num(fundamentals?.debt_equity)],['Total Debt',compactMoney(fundamentals?.total_debt)],['Cash',compactMoney(fundamentals?.cash_and_equivalents)],
    ['Total Assets',compactMoney(fundamentals?.total_assets)],['Total Liabilities',compactMoney(fundamentals?.total_liabilities)],['Shareholders Equity',compactMoney(fundamentals?.shareholders_equity)],
    ['Working Capital',compactMoney(fundamentals?.working_capital)],['Operating Cash Flow',compactMoney(fundamentals?.operating_cash_flow)],['Capital Expenditure',compactMoney(fundamentals?.capital_expenditure)],
    ['FCF Margin',pct(fundamentals?.fcf_margin)],['FCF / Share',num(fundamentals?.fcf_per_share)],['Book Value / Share',num(fundamentals?.book_value_per_share)]
  ];
  const valuationRows:[string,React.ReactNode][]=[
    ['P/E',num(pe)],['Forward P/E',num(fundamentals?.forward_pe??valuations?.forward_pe)],['PEG',num(fundamentals?.peg_ratio??valuations?.peg)],
    ['Price / Sales',num(fundamentals?.price_sales??valuations?.price_sales)],['Price / Book',num(fundamentals?.price_book??valuations?.price_book)],
    ['Price / FCF',num(fundamentals?.price_to_fcf??valuations?.price_fcf)],['EV / Revenue',num(fundamentals?.enterprise_value_to_revenue??valuations?.ev_revenue)],
    ['EV / EBITDA',num(fundamentals?.enterprise_value_to_ebitda??valuations?.ev_ebitda)],['EV / EBIT',num(fundamentals?.ev_to_ebit??valuations?.ev_ebit)],
    ['Earnings Yield',pct(fundamentals?.earnings_yield??valuations?.earnings_yield)],['FCF Yield',pct(fundamentals?.fcf_yield??valuations?.fcf_yield)]
  ];
  const risksRows:[string,React.ReactNode][]=[
    ['Beta',num(risks?.beta)],['Volatility',pct(risks?.volatility)],['ATR',num(risks?.atr)],['Maximum Drawdown',pct(risks?.maximum_drawdown)],
    ['Sharpe Ratio',num(risks?.sharpe_ratio)],['Sortino Ratio',num(risks?.sortino_ratio)],['Debt / Equity',num(risks?.debt_equity)],
    ['Current Ratio',num(risks?.current_ratio)],['Quick Ratio',num(risks?.quick_ratio)],['Interest Coverage',num(risks?.interest_coverage)],
    ['Altman Z-Score',num(risks?.altman_z_score)],['Short Interest',num(risks?.short_interest)],['Short % Float',pct(risks?.short_percent_float)],['Liquidity Risk',risks?.liquidity_risk]
  ];
  const perfRows:[string,React.ReactNode][]=performance?[['1D',pct(performance.period_1d)],['5D',pct(performance.period_5d)],['1M',pct(performance.period_1m)],['3M',pct(performance.period_3m)],['6M',pct(performance.period_6m)],['YTD',pct(performance.period_ytd)],['1Y',pct(performance.period_1y)],['3Y',pct(performance.period_3y)],['5Y',pct(performance.period_5y)],['10Y',pct(performance.period_10y)],['Max',pct(performance.period_max)]]:[];
  const longYears=[2026,2027,2030,2035,2040,2050];
  const forecastRows=longYears.map(y=>{const r=longMap.get(y);return [y,money(r?.bear_price),money(r?.base_price),money(r?.bull_price),pct(r?.expected_cagr),num(r?.confidence),num(r?.uncertainty)]});
  const faqRows=[
    [`What Is the Current ${company} (${symbol}) Stock Price?`,money(quote?.price)],
    [`What Is the ${company} (${symbol}) Stock Forecast for 2026?`,longMap.get(2026)?`Bear ${money(longMap.get(2026)?.bear_price)} · Base ${money(longMap.get(2026)?.base_price)} · Bull ${money(longMap.get(2026)?.bull_price)}`:'Not available yet.'],
    [`What Is the ${company} (${symbol}) Stock Forecast for 2027?`,longMap.get(2027)?`Bear ${money(longMap.get(2027)?.bear_price)} · Base ${money(longMap.get(2027)?.base_price)} · Bull ${money(longMap.get(2027)?.bull_price)}`:'Not available yet.'],
    [`What Is the ${company} (${symbol}) Stock Price Prediction for 2030?`,longMap.get(2030)?`Bear ${money(longMap.get(2030)?.bear_price)} · Base ${money(longMap.get(2030)?.base_price)} · Bull ${money(longMap.get(2030)?.bull_price)}`:'Not available yet.'],
    [`What Is the Long-Term ${company} (${symbol}) Stock Forecast Through 2050?`,longTerm?.length?'See the 2026–2050 scenario table above.':'Not available yet.'],
    [`What Is the ${symbol} Stock Prediction for the Next 7 Days?`,money(prediction('7d')?.predicted_price)],
    [`What Is the ${symbol} Stock Prediction for the Next 30 Days?`,money(prediction('30d')?.predicted_price)],
    [`Is ${symbol} Stock Overvalued or Undervalued?`,pe!=null?`Current P/E is ${num(pe)}; interpretation should also consider growth, profitability, cash generation and peer context.`:'Valuation data is not available yet.'],
    [`What Is the ${symbol} P/E Ratio and Valuation?`,pe!=null?num(pe):'Not available yet.'],
    [`What Are the ${company} (${symbol}) Stock Financials?`,fundamentals?'Financial metrics are summarized above.':'Financial data is not available yet.'],
    [`What Does the ${symbol} Technical Analysis Show?`,tech?.trend??'Technical trend data is not available yet.'],
    [`When Is the Next ${symbol} Earnings Date?`,latestEarnings?.earnings_date?date(latestEarnings.earnings_date):'Not available yet.'],
    [`Does ${company} (${symbol}) Pay a Dividend?`,hasDividend?`Dividend yield: ${pct(fundamentals.dividend_yield)}.`:'Dividend data is not available yet.'],
    [`What Are the Key Risks of ${symbol} Stock?`,research.risk_analysis??research.risks??'AI text pending'],
    [`What Does ${company} Do and How Does It Make Money?`,stock.description??'AI text pending'],
    [`How Accurate Have Previous ${symbol} Stock Predictions Been?`,results?.length?'See evaluated prediction history above.':'No mature prediction history is available yet.'],
    [`What Has Changed Recently in ${symbol} Stock?`,research.what_changed_recently??'AI text pending']
  ];
  return <div className="research-flow">
    <Section id="overview" eyebrow="01 · QUICK OVERVIEW" title={`${company} Stock Price Forecast: Quick Overview`}>
      <AIBlock title="AI-generated stock overview">{research.company_overview??research.fundamental_analysis??'AI text pending'}</AIBlock>
      <Grid items={[[`Stock Price`,money(quote?.price)],[`Market Cap`,compactMoney(quote?.market_cap??stock.market_cap)],[`P/E`,num(pe)],[`Forward P/E`,num(fundamentals?.forward_pe)],[`EPS`,num(fundamentals?.eps)],[`Revenue Growth`,pct(revenueGrowth)],[`EPS Growth`,pct(fundamentals?.eps_growth)],[`ROE`,pct(fundamentals?.roe)],[`ROIC`,pct(fundamentals?.roic)],[`Dividend Yield`,pct(fundamentals?.dividend_yield)],[`52-Week High`,money(quote?.week_52_high)],[`52-Week Low`,money(quote?.week_52_low)]]}/>
    </Section>

    <Section id="company-overview" eyebrow="02 · COMPANY" title={`${company} Company Overview`}>
      <h3>What Does {company} Do?</h3><AIBlock title="Company explanation">{research.company_overview??stock.description??'AI text pending'}</AIBlock>
      {(stock.founded_year||stock.ipo_listing_date||stock.company_status||stock.ceo||stock.management)?<><h3>{company} History</h3><Grid items={[[`Founded`,stock.founded_year],[`IPO Listing Date`,stock.ipo_listing_date?date(stock.ipo_listing_date):null],[`Company Status`,stock.company_status],[`CEO`,stock.ceo]]}/>{management?<AIBlock title="Management">{textValue(management)}</AIBlock>:null}</>:null}
      {management?<><h3>Management</h3><AIBlock title="Management information">{textValue(management)}</AIBlock></>:null}
      {(stock.employees||stock.headquarters||stock.city||stock.state||stock.country)?<><h3>Employees &amp; Headquarters</h3><Grid items={[[`Employees`,stock.employees!=null?num(stock.employees):null],[`Headquarters`,stock.headquarters],[`City`,stock.city],[`State`,stock.state],[`Country`,stock.country]]}/></>:null}
    </Section>

    <Section id="business-model" eyebrow="03 · BUSINESS MODEL" title={`${company} Business Model & Competitive Position`}>
      <h3>How Does {company} Make Money?</h3><AIBlock title="Revenue model">{research.fundamental_analysis??research.company_overview??'AI text pending'}</AIBlock>
      {products?<><h3>Products &amp; Services</h3><AIBlock title="Products and services"><JsonText value={products}/></AIBlock></>:null}
      {businessSegments?<><h3>Business Segment Analysis</h3><Table headers={['Segment','Available Data']} rows={Object.entries(businessSegments as any).map(([k,v])=>[k,textValue(v)])}/></>:null}
      {research.market_position_analysis||peerMetrics?.length?<><h3>Competitive Position</h3><AIBlock title="Competitive position">{research.market_position_analysis??'AI text pending'}</AIBlock></>:null}
    </Section>

    <Section id="industry" eyebrow="04 · INDUSTRY" title={`${company} Industry Analysis`}>
      <h3>Sector &amp; Industry</h3><Grid items={[[`Sector`,stock.sector],[`Industry`,stock.industry],[`Sub-Industry`,stock.sub_industry]]}/>
      <h3>Industry Trends</h3><AIBlock title="Industry-specific trends">{research.market_position_analysis??'AI text pending'}</AIBlock>
      <h3>Industry Tailwinds</h3><AIBlock title="Relevant tailwinds">{research.catalysts??'AI text pending'}</AIBlock>
      <h3>Industry Headwinds</h3><AIBlock title="Relevant headwinds">{research.risk_analysis??research.risks??'AI text pending'}</AIBlock>
    </Section>

    <Section id="financial-analysis" eyebrow="05 · FINANCIAL ANALYSIS" title={`${company} Financial Analysis`}>
      <h3>Revenue &amp; Earnings History</h3>
      <Grid items={financialRows}/>
      {financialMetrics?.length?<Table headers={['Period','Revenue Growth','Gross Margin','Operating Margin','Net Margin','EPS Growth','FCF Growth','ROE','ROIC']} rows={financialMetrics.map(m=>[date(m.period_end),pct(m.revenue_growth),pct(m.gross_margin),pct(m.operating_margin),pct(m.net_margin),pct(m.eps_growth),pct(m.fcf_growth),pct(m.roe),pct(m.roic)])}/>:null}
      <AIBlock title="What the financial trend shows">{research.fundamental_analysis??'AI text pending'}</AIBlock>
    </Section>

    <Section id="profitability" eyebrow="06 · PROFITABILITY" title={`${company} Profitability Analysis`}>
      <Table headers={['Metric','Current','3Y/5Y Trend']} rows={[
        ['Gross Margin',pct(fundamentals?.gross_margin),financialMetrics?.[0]?pct(financialMetrics[0].five_year_cagr):'—'],
        ['Operating Margin',pct(fundamentals?.operating_margin),financialMetrics?.[0]?pct(financialMetrics[0].five_year_cagr):'—'],
        ['EBITDA Margin',pct(fundamentals?.ebitda_margin),financialMetrics?.[0]?pct(financialMetrics[0].five_year_cagr):'—'],
        ['Net Margin',pct(fundamentals?.net_margin),financialMetrics?.[0]?pct(financialMetrics[0].five_year_cagr):'—'],
        ['ROE',pct(fundamentals?.roe),financialMetrics?.[0]?pct(financialMetrics[0].five_year_cagr):'—'],
        ['ROIC',pct(fundamentals?.roic),financialMetrics?.[0]?pct(financialMetrics[0].five_year_cagr):'—'],
        ['ROA',pct(fundamentals?.roa),financialMetrics?.[0]?pct(financialMetrics[0].five_year_cagr):'—'],
        ['ROCE',pct(fundamentals?.roce),financialMetrics?.[0]?pct(financialMetrics[0].five_year_cagr):'—']
      ]}/>
      <AIBlock title="Profitability interpretation">{research.fundamental_analysis??'AI text pending'}</AIBlock>
    </Section>

    <Section id="balance-sheet" eyebrow="07 · BALANCE SHEET" title={`${company} Balance Sheet Analysis`}>
      <Grid items={[[`Cash`,compactMoney(fundamentals?.cash_and_equivalents)],[`Total Debt`,compactMoney(fundamentals?.total_debt)],[`Long-Term Debt`,compactMoney(fundamentals?.long_term_debt)],[`Assets`,compactMoney(fundamentals?.total_assets)],[`Liabilities`,compactMoney(fundamentals?.total_liabilities)],[`Shareholders Equity`,compactMoney(fundamentals?.shareholders_equity)],[`Working Capital`,compactMoney(fundamentals?.working_capital)],[`Debt / Equity`,num(fundamentals?.debt_equity)]]}/>
      <AIBlock title="Liquidity, leverage and balance-sheet direction">{research.fundamental_analysis??'AI text pending'}</AIBlock>
    </Section>

    <Section id="fcf" eyebrow="08 · CASH FLOW" title={`${company} Free Cash Flow Analysis`}>
      <Grid items={[[`Operating Cash Flow`,compactMoney(fundamentals?.operating_cash_flow)],[`Capital Expenditure`,compactMoney(fundamentals?.capital_expenditure)],[`Free Cash Flow`,compactMoney(fundamentals?.free_cash_flow)],[`FCF Margin`,pct(fundamentals?.fcf_margin)],[`FCF Growth`,pct(fundamentals?.fcf_growth)],[`FCF / Share`,num(fundamentals?.fcf_per_share)],[`FCF Yield`,pct(fundamentals?.fcf_yield)]]}/>
      <AIBlock title="Free cash flow interpretation">{research.fundamental_analysis??'AI text pending'}</AIBlock>
    </Section>

    <Section id="earnings-results" eyebrow="09 · EARNINGS" title={`${company} Latest Earnings Results`}>
      {(earnings??[]).length?<Table headers={['Date','Period','EPS Actual','EPS Estimate','EPS Surprise','Revenue Actual','Revenue Estimate','Revenue Surprise']} rows={(earnings??[]).map(e=>[date(e.earnings_date),e.fiscal_period??'—',num(e.eps_actual),num(e.eps_estimate),pct(e.eps_surprise),compactMoney(e.revenue_actual),compactMoney(e.revenue_estimate),pct(e.revenue_surprise)])}/>:<Empty>Earnings data is not populated yet.</Empty>}
      {latestEarnings?.earnings_growth!=null?<Grid items={[[`Earnings Growth`,pct(latestEarnings.earnings_growth)]]}/>:null}
      <AIBlock title="What changed in the latest quarter?">{research.earnings_analysis??'AI text pending'}</AIBlock>
    </Section>

    <Section id="valuation" eyebrow="10 · VALUATION" title={`${company} Valuation Analysis`}>
      <h3>Current Valuation</h3><Grid items={valuationRows}/>
      {peerMetrics?.length?<><h3>Valuation vs Peers</h3><Table headers={['Metric','Company','Peer Median','Percentile']} rows={peerMetrics.filter(p=>['P/E','PE','pe','Price/Sales','Price/Book','EV/EBITDA'].includes(String(p.metric_name))).map(p=>[p.metric_name,num(p.company_value),num(p.peer_median),num(p.percentile)])}/><AIBlock title="Peer valuation interpretation">{research.valuation_analysis??'AI text pending'}</AIBlock></>:null}
      {hasHistoricalValuation?<><h3>Historical Valuation</h3><Grid items={[[`Valuation Date`,date(valuations.valuation_date)],[`Price`,money(valuations.price)],[`P/E`,num(valuations.pe)],[`Forward P/E`,num(valuations.forward_pe)],[`PEG`,num(valuations.peg)]]}/><AIBlock title="Historical valuation context">{research.valuation_analysis??'AI text pending'}</AIBlock></>:null}
    </Section>

    <Section id="ownership" eyebrow="11 · OWNERSHIP" title={`${company} Institutional Ownership`}>
      <AIBlock title="Ownership trend">{research.fundamental_analysis??'AI text pending'}</AIBlock>
      <div className="research-reading-strip">Institutional and insider ownership snapshots are available in the Evidence/Data Room when populated.</div>
    </Section>

    {hasDividend?<Section id="dividend" eyebrow="12 · DIVIDEND" title={`${company} Dividend Analysis`}>
      <Grid items={[[`Dividend Yield`,pct(fundamentals?.dividend_yield)],[`Payout Ratio`,pct(fundamentals?.payout_ratio)]]}/>
      <AIBlock title="Dividend profile">AI text pending</AIBlock>
    </Section>:null}

    <Section id="peers" eyebrow="13 · PEERS" title={`${company} vs Competitors`}>
      {peerMetrics?.length?<Table headers={['Metric','Company','Peer Median','Peer Average','Min','Max','Percentile']} rows={peerMetrics.map(p=>[p.metric_name??'—',num(p.company_value),num(p.peer_median),num(p.peer_average),num(p.peer_min),num(p.peer_max),num(p.percentile)])}/>:<Empty>Peer comparison data is not populated yet.</Empty>}
      <AIBlock title="Company-specific peer comparison">{research.market_position_analysis??'AI text pending'}</AIBlock>
    </Section>

    <Section id="growth" eyebrow="14 · GROWTH" title={`${company} Growth Drivers & Future Outlook`}>
      <h3>Revenue Growth Drivers</h3><AIBlock title="Revenue growth">{research.growth_analysis??'AI text pending'}</AIBlock>
      <h3>Earnings Growth Drivers</h3><AIBlock title="Earnings growth">{research.growth_analysis??'AI text pending'}</AIBlock>
      <h3>Capital Investment</h3><AIBlock title="Capital investment">{research.growth_analysis??'AI text pending'}</AIBlock>
      <h3>Expansion &amp; New Opportunities</h3><AIBlock title="Expansion">{research.growth_analysis??'AI text pending'}</AIBlock>
      {latestEarnings?.guidance?<><h3>Management Guidance</h3><AIBlock title="Guidance">{textValue(latestEarnings.guidance)}</AIBlock></>:null}
      <h3>Recent Catalysts</h3><AIBlock title="Catalysts">{research.catalysts??'AI text pending'}</AIBlock>
    </Section>

    <Section id="technical" eyebrow="15 · TECHNICAL" title={`${company} Technical Analysis`}>
      <Table headers={['Indicator','Value']} rows={technicalRows}/>
      <h3>RSI Analysis</h3><AIBlock title="RSI interpretation">{research.technical_analysis??'AI text pending'}</AIBlock>
      <h3>MACD &amp; Momentum Analysis</h3><AIBlock title="MACD and momentum">{research.technical_analysis??'AI text pending'}</AIBlock>
      <h3>20, 50, 100 &amp; 200 Day Moving Averages</h3><AIBlock title="Moving averages">{research.technical_analysis??'AI text pending'}</AIBlock>
      <h3>EMA &amp; Trend Analysis</h3><AIBlock title="EMA and trend">{research.technical_analysis??'AI text pending'}</AIBlock>
      <h3>Support and Resistance Levels</h3><AIBlock title="Support and resistance">{research.technical_analysis??'AI text pending'}</AIBlock>
      <h3>Bollinger Bands, ATR, ADX &amp; Volatility</h3><AIBlock title="Volatility indicators">{research.technical_analysis??'AI text pending'}</AIBlock>
      <h3>Stochastic, Momentum &amp; Trend Indicators</h3><AIBlock title="Trend indicators">{research.technical_analysis??'AI text pending'}</AIBlock>
    </Section>

    <Section id="forecast-methodology" eyebrow="16 · FORECAST METHOD" title={`${company} Stock Price Forecast Methodology`}>
      <h3>Short-Term Quantitative Model</h3>
      {predictions?.length?<Table headers={['Horizon','Current Price','Predicted Price','Change','Direction','Confidence','Uncertainty','Signal']} rows={predictions.map(p=>[String(p.horizon).toUpperCase(),money(p.current_price),money(p.predicted_price),pct(p.predicted_change_percent),p.direction??'—',num(p.confidence),num(p.uncertainty),p.signal??'—'])}/>:<Empty>Short-term prediction data is not available yet.</Empty>}
      <h3>Long-Term Forecast Model</h3>
      {longTerm?.length?<Table headers={['Year','Bear','Base','Bull','CAGR','Confidence','Uncertainty']} rows={forecastRows}/>:<Empty>Long-term prediction data is not available yet.</Empty>}
      <AIBlock title="How the model works">Market data → technical features → fundamentals → model → prediction → evaluation. AI text pending for the detailed explanation.</AIBlock>
    </Section>

    {longYears.map(year=><Section key={year} id={`forecast-${year}`} eyebrow={`${year} · MODEL SCENARIO`} title={`${company} Stock Price Forecast ${year}`}>
      {longMap.get(year)?<><Table headers={['Scenario','Forecast']} rows={[[`Bear`,money(longMap.get(year)?.bear_price)],[`Base`,money(longMap.get(year)?.base_price)],[`Bull`,money(longMap.get(year)?.bull_price)]]}/><Grid items={[[`Expected CAGR`,pct(longMap.get(year)?.expected_cagr)],[`Forecast Confidence`,num(longMap.get(year)?.confidence)],[`Uncertainty`,num(longMap.get(year)?.uncertainty)]]}/><AIBlock title={`Why the model produces the ${year} range`}>{textValue(longMap.get(year)?.assumptions??longMap.get(year)?.feature_summary) || 'AI text pending'}</AIBlock></>:<Empty>{year} long-term forecast is not available yet.</Empty>}
    </Section>)}

    <Section id="forecast-summary" eyebrow="23 · FORECAST SUMMARY" title={`${company} Stock Price Forecast 2026–2050`}>
      {longTerm?.length?<Table headers={['Year','Bear','Base','Bull','Expected CAGR']} rows={forecastRows.map(r=>[r[0],r[1],r[2],r[3],r[4]])}/>:<Empty>Long-term forecast summary is not available yet.</Empty>}
      <AIBlock title="Long-term scenario interpretation">AI text pending. Long-term values are model-based scenarios, not guaranteed future prices.</AIBlock>
    </Section>

    <Section id="news" eyebrow="24 · NEWS" title={`${company} Recent News & Developments`}>
      {(news??[]).length?<Table headers={['Date','Source','Headline','Sentiment']} rows={(news??[]).map(n=>[date(n.published_at),n.source??'—',n.title??'—',n.sentiment??'—'])}/>:<Empty>No recent ticker-linked news is available.</Empty>}
      <AIBlock title="What changed recently?">{research.news_summary??research.what_changed_recently??'AI text pending'}</AIBlock>
    </Section>

    <Section id="risks" eyebrow="25 · RISKS" title={`${company} Stock Forecast: Risks`}>
      {risksRows.length?<Grid items={risksRows}/>:<Empty>Risk metrics are not populated yet.</Empty>}
      <h3>Business, Financial, Valuation, Market &amp; Event Risks</h3>
      <AIBlock title="Company-specific risk analysis">{research.risk_analysis??research.risks??'AI text pending'}</AIBlock>
    </Section>

    <Section id="faqs" eyebrow="26 · FAQ" title={`${company} (${symbol}) Stock Forecast FAQs`}>
      {faqRows.map(([q,a])=><div className="faq-template-row" key={String(q)}><h3>{q}</h3><p>{a}</p></div>)}
    </Section>

    <Section id="final-analysis" eyebrow="27 · FINAL ANALYSIS" title={`${company} Final Analysis`}>
      <AIBlock title="Financial Picture">{research.fundamental_analysis??'AI text pending'}</AIBlock>
      <AIBlock title="Valuation Picture">{research.valuation_analysis??'AI text pending'}</AIBlock>
      <AIBlock title="Growth Picture">{research.growth_analysis??'AI text pending'}</AIBlock>
      <AIBlock title="Technical Picture">{research.technical_analysis??'AI text pending'}</AIBlock>
      <AIBlock title="Forecast Range">AI text pending</AIBlock>
      <AIBlock title="Key Risks">{research.risk_analysis??research.risks??'AI text pending'}</AIBlock>
    </Section>

    <Section id="disclaimer" eyebrow="28 · DISCLAIMER" title="Disclaimer">
      <p className="seo-prose">US Market AI separates observed market data, reported financial information and quantitative model outputs. Missing values are not estimated. Forecasts are model estimates or scenarios, not guarantees or personalized financial advice. AI-generated interpretation is based on the supplied research data and should not be treated as a substitute for independent research.</p>
    </Section>
  </div>;
}
