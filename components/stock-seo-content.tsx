import { isValidElement } from 'react';

type Props = {
  stock:any; quote:any; tech:any; predictions:any[]|null; fundamentals:any; financialMetrics:any[];
  earnings:any[]|null; earningsRevisions:any[]; news:any[]|null; results:any[]|null; article?:any;
  aiResearch:any[]; performance:any; risks:any; valuations:any; longTerm:any[]; peerMetrics:any[];
};

const money=(v:any)=>v==null?'—':`$${Number(v).toLocaleString('en-US',{maximumFractionDigits:2})}`;
const compactMoney=(v:any)=>v==null?'—':`$${Number(v).toLocaleString('en-US',{notation:'compact',maximumFractionDigits:2})}`;
const num=(v:any)=>v==null?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
const pct=(v:any)=>v==null?'—':`${Number(v)>=0?'+':''}${Number(v).toFixed(2)}%`;
const renderValue=(v:any):React.ReactNode=>{
  if(v==null)return '—';
  if(isValidElement(v))return v;
  if(v instanceof Date)return Number.isNaN(v.getTime())?'—':v.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
  if(typeof v==='object'){try{return JSON.stringify(v)}catch{return String(v)}}
  return v;
};

function Section({id,eyebrow,title,children,className=''}:{id?:string;eyebrow:string;title:string;children:React.ReactNode;className?:string}){
  return <section className={`research-section ${className}`} id={id}>
    <div className="research-section-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div></div>{children}
  </section>;
}
function MetricGrid({items}:{items:[string,React.ReactNode][]}){
  return <div className="research-metric-grid">{items.map(([k,v])=><div className="research-metric" key={k}><span>{k}</span><strong>{renderValue(v)}</strong></div>)}</div>;
}
function Table({headers,rows}:{headers:string[];rows:any[][]}){
  return <div className="research-table-wrap"><table className="research-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{renderValue(v)}</td>)}</tr>)}</tbody></table></div>;
}
function Explain({title,children}:{title:string;children:React.ReactNode}){return <div className="research-explain"><b>{title}</b><span>{children}</span></div>;}
function Empty({children}:{children:string}){return <div className="research-empty">{children}</div>;}

export default function StockSeoContent({stock,quote,tech,predictions,fundamentals,financialMetrics,earnings,earningsRevisions,news,results,article,aiResearch,performance,risks,valuations,longTerm,peerMetrics}:Props){
  const symbol=stock.symbol, company=stock.company_name;
  const latest=predictions?.[0];
  const longMap=new Map((longTerm??[]).map(r=>[Number(r.target_year),r]));

  const revenueGrowth=fundamentals?.revenue_growth ?? financialMetrics?.[0]?.revenue_growth;
  const netMargin=fundamentals?.net_margin ?? financialMetrics?.[0]?.net_margin;
  const roe=fundamentals?.roe ?? financialMetrics?.[0]?.roe;
  const roic=fundamentals?.roic ?? financialMetrics?.[0]?.roic;
  const debtEquity=fundamentals?.debt_equity;
  const fcf=fundamentals?.free_cash_flow;
  const pe=fundamentals?.pe_ratio ?? valuations?.pe;

  const businessSummary=stock.description || `${company} is a publicly listed company in the ${stock.industry || stock.sector || 'US equity'} space. Use the sections below to understand the business, its financial performance, valuation, market behaviour and key risks.`;

  const fundamentalRows=[
    ['Revenue',compactMoney(fundamentals?.revenue)],['Revenue Growth',pct(revenueGrowth)],['Gross Profit',compactMoney(fundamentals?.gross_profit)],
    ['Operating Income',compactMoney(fundamentals?.operating_income)],['Net Income',compactMoney(fundamentals?.net_income)],['EPS',num(fundamentals?.eps)],
    ['EPS Growth',pct(fundamentals?.eps_growth)],['Free Cash Flow',compactMoney(fcf)],['FCF Growth',pct(fundamentals?.fcf_growth)],
    ['FCF Margin',pct(fundamentals?.fcf_margin)],['Gross Margin',pct(fundamentals?.gross_margin)],['Operating Margin',pct(fundamentals?.operating_margin)],
    ['Net Margin',pct(netMargin)],['ROE',pct(roe)],['ROA',pct(fundamentals?.roa)],['ROIC',pct(roic)],['ROCE',pct(fundamentals?.roce)],
    ['Debt / Equity',num(debtEquity)],['Total Debt',compactMoney(fundamentals?.total_debt)],['Cash & Equivalents',compactMoney(fundamentals?.cash_and_equivalents)],
    ['Working Capital',compactMoney(fundamentals?.working_capital)],['Book Value / Share',num(fundamentals?.book_value_per_share)],['FCF / Share',num(fundamentals?.fcf_per_share)]
  ];
  const valuationRows=[
    ['P/E',num(pe)],['Forward P/E',num(fundamentals?.forward_pe ?? valuations?.forward_pe)],['PEG',num(fundamentals?.peg_ratio ?? valuations?.peg)],
    ['Price / Sales',num(fundamentals?.price_sales ?? valuations?.price_sales)],['Price / Book',num(fundamentals?.price_book ?? valuations?.price_book)],
    ['Price / FCF',num(fundamentals?.price_to_fcf ?? valuations?.price_fcf)],['EV / Revenue',num(fundamentals?.enterprise_value_to_revenue ?? valuations?.ev_revenue)],
    ['EV / EBITDA',num(fundamentals?.enterprise_value_to_ebitda ?? valuations?.ev_ebitda)],['EV / EBIT',num(fundamentals?.ev_to_ebit ?? valuations?.ev_ebit)],
    ['Earnings Yield',pct(fundamentals?.earnings_yield ?? valuations?.earnings_yield)],['FCF Yield',pct(fundamentals?.fcf_yield ?? valuations?.fcf_yield)],
    ['Dividend Yield',pct(fundamentals?.dividend_yield ?? valuations?.dividend_yield)],['Payout Ratio',pct(fundamentals?.payout_ratio ?? valuations?.payout_ratio)]
  ];
  const technicalRows=[
    ['RSI',num(tech?.rsi)],['MACD',num(tech?.macd)],['MACD Signal',num(tech?.macd_signal)],['MACD Histogram',num(tech?.macd_histogram)],
    ['SMA 20',money(tech?.sma_20)],['SMA 50',money(tech?.sma_50)],['SMA 100',money(tech?.sma_100)],['SMA 200',money(tech?.sma_200)],
    ['EMA 20',money(tech?.ema_20)],['EMA 200',money(tech?.ema_200)],['ATR',num(tech?.atr)],['ADX',num(tech?.adx)],
    ['Bollinger Upper',money(tech?.bollinger_upper)],['Bollinger Middle',money(tech?.bollinger_middle)],['Bollinger Lower',money(tech?.bollinger_lower)],
    ['Stochastic',num(tech?.stochastic)],['Williams %R',num(tech?.williams_r)],['CCI',num(tech?.cci)],['MFI',num(tech?.mfi)],
    ['ROC',pct(tech?.roc)],['OBV',num(tech?.obv)],['Volatility',pct(tech?.volatility)],['Momentum',pct(tech?.momentum)],
    ['Support',money(tech?.support_level)],['Resistance',money(tech?.resistance_level)],['Trend',tech?.trend??'—']
  ];
  const performanceRows=performance?[
    ['1D',pct(performance.period_1d)],['5D',pct(performance.period_5d)],['1M',pct(performance.period_1m)],['3M',pct(performance.period_3m)],
    ['6M',pct(performance.period_6m)],['YTD',pct(performance.period_ytd)],['1Y',pct(performance.period_1y)],['3Y',pct(performance.period_3y)],
    ['5Y',pct(performance.period_5y)],['10Y',pct(performance.period_10y)],['Max',pct(performance.period_max)]
  ]:[];
  const riskRows=risks?[
    ['Beta',num(risks.beta)],['Volatility',pct(risks.volatility)],['ATR',num(risks.atr)],['Maximum Drawdown',pct(risks.maximum_drawdown)],
    ['Sharpe Ratio',num(risks.sharpe_ratio)],['Sortino Ratio',num(risks.sortino_ratio)],['Current Ratio',num(risks.current_ratio)],
    ['Quick Ratio',num(risks.quick_ratio)],['Interest Coverage',num(risks.interest_coverage)],['Altman Z-Score',num(risks.altman_z_score)],
    ['Short Interest',num(risks.short_interest)],['Short % Float',pct(risks.short_percent_float)],['Liquidity Risk',risks.liquidity_risk??'—']
  ]:[];

  return <div className="research-flow">
    <Section id="overview" eyebrow="START HERE" title={`What you should know about ${company} (${symbol})`}>
      <div className="research-intro-grid">
        <div className="research-story">
          <h3>In simple words</h3>
          <p>{businessSummary}</p>
          <div className="research-profile">
            <span><b>Sector</b>{stock.sector??'—'}</span><span><b>Industry</b>{stock.industry??'—'}</span><span><b>Exchange</b>{stock.exchange_full_name??stock.exchange??'—'}</span><span><b>Country</b>{stock.country??'United States'}</span>
          </div>
        </div>
        <div className="research-map">
          <div className="research-map-title">How to read this page</div>
          <div><b>1</b><span><strong>Business</strong> — what the company sells and how it earns.</span></div>
          <div><b>2</b><span><strong>Numbers</strong> — growth, profits, cash flow and balance sheet.</span></div>
          <div><b>3</b><span><strong>Price</strong> — valuation and market behaviour.</span></div>
          <div><b>4</b><span><strong>Risks</strong> — what can change the story.</span></div>
          <div><b>5</b><span><strong>Forecasts</strong> — model scenarios, clearly separated from facts.</span></div>
        </div>
      </div>
    </Section>

    <Section id="quick-view" eyebrow="ONE-MINUTE VIEW" title="The company at a glance">
      <div className="research-metric-grid research-glance">
        <div className="research-metric"><span>Share price</span><strong>{money(quote?.price)}</strong><small>{pct(quote?.change_percent)} today</small></div>
        <div className="research-metric"><span>Market cap</span><strong>{compactMoney(quote?.market_cap??stock.market_cap)}</strong><small>Company size in the market</small></div>
        <div className="research-metric"><span>Revenue growth</span><strong>{pct(revenueGrowth)}</strong><small>How fast sales are changing</small></div>
        <div className="research-metric"><span>Net margin</span><strong>{pct(netMargin)}</strong><small>Profit left from revenue</small></div>
        <div className="research-metric"><span>ROE</span><strong>{pct(roe)}</strong><small>Return on shareholders' equity</small></div>
        <div className="research-metric"><span>Debt / Equity</span><strong>{num(debtEquity)}</strong><small>Balance-sheet leverage</small></div>
        <div className="research-metric"><span>Free cash flow</span><strong>{compactMoney(fcf)}</strong><small>Cash generated after capital needs</small></div>
        <div className="research-metric"><span>P/E</span><strong>{num(pe)}</strong><small>Price relative to earnings</small></div>
      </div>
      <div className="research-reading-strip"><b>How to use this:</b> these figures are starting points, not a score. Look at growth, profitability, cash flow, valuation and risk together rather than relying on one number.</div>
    </Section>

    <Section id="business" eyebrow="BUSINESS 101" title="Understand the business before the stock">
      <div className="research-two-col">
        <div><h3>What does the company do?</h3><p>{businessSummary}</p>{(stock.products_services||stock.business_segments)&&<div className="research-facts">{[['Products / services',stock.products_services],['Business segments',stock.business_segments]].filter(([,v])=>v).map(([k,v])=><div key={String(k)}><b>{k}</b><span>{typeof v==='string'?v:JSON.stringify(v)}</span></div>)}</div>}</div>
        <div className="research-learn"><h3>Questions a beginner should answer</h3><ul><li>Who pays the company?</li><li>What makes customers choose it?</li><li>Is revenue recurring or dependent on one-off demand?</li><li>Which industry trends can help or hurt it?</li><li>What could make today's business model weaker?</li></ul></div>
      </div>
    </Section>

    <Section id="financials" eyebrow="FINANCIAL HEALTH" title="Is the business actually making money?">
      <div className="research-two-col">
        <div><MetricGrid items={fundamentalRows.slice(0,12).map(([k,v])=>[String(k),v])}/></div>
        <div className="research-explainer-stack">
          <Explain title="Revenue growth">{revenueGrowth==null?'Not available.':`Shows whether the sales base is expanding or shrinking. Check whether growth is consistent and what is driving it.`}</Explain>
          <Explain title="Profit margins">{netMargin==null?'Not available.':`Shows how much of revenue remains as profit. Compare the trend over several periods, not just one quarter.`}</Explain>
          <Explain title="Free cash flow">{fcf==null?'Not available.':'Profit and cash are not the same. FCF helps show how much cash remains after capital investment.'}</Explain>
          <Explain title="ROE / ROIC">{roe==null&&roic==null?'Not available.':'These return measures help explain how efficiently the company uses capital.'}</Explain>
        </div>
      </div>
      <details className="research-details"><summary>Show detailed financial metrics</summary>{financialMetrics?.length?<Table headers={['Period','FY','Q','Revenue Growth','Net Margin','ROE','ROIC','FCF Growth','3Y CAGR','5Y CAGR','10Y CAGR']} rows={financialMetrics.map(m=>[renderValue(m.period_end),m.fiscal_year??'—',m.fiscal_quarter??'—',pct(m.revenue_growth),pct(m.net_margin),pct(m.roe),pct(m.roic),pct(m.fcf_growth),pct(m.three_year_cagr),pct(m.five_year_cagr),pct(m.ten_year_cagr)])}/>:<Empty>No period-based financial metrics are stored.</Empty>}</details>
    </Section>

    <Section id="valuation" eyebrow="VALUATION" title="What price is the market putting on the business?">
      <div className="research-two-col">
        <div><MetricGrid items={valuationRows.map(([k,v])=>[String(k),v])}/></div>
        <div className="research-learn">
          <h3>Read valuation in context</h3>
          <p><b>P/E:</b> price compared with earnings.</p><p><b>P/S:</b> price compared with sales.</p><p><b>P/B:</b> price compared with book value.</p><p><b>EV/EBITDA:</b> enterprise value compared with operating earnings.</p><p><b>FCF yield:</b> free cash flow relative to market value.</p>
          <div className="research-reading-strip">A low multiple is not automatically cheap, and a high multiple is not automatically expensive. Growth, margins, cash generation, industry economics and expectations all affect how a multiple should be interpreted.</div>
        </div>
      </div>
    </Section>

    <Section id="performance" eyebrow="PRICE HISTORY" title="How has the stock behaved?">
      {performanceRows.length?<MetricGrid items={performanceRows.map(([k,v])=>[String(k),v])}/>:<Empty>Historical performance metrics are not populated yet.</Empty>}
      <div className="research-note">Past performance describes what happened; it does not establish what will happen next.</div>
    </Section>

    <Section id="technical-analysis" eyebrow="TECHNICAL ANALYSIS" title="What is the market trend saying?">
      <div className="research-two-col">
        <div className="research-technical-highlight">
          <MetricGrid items={[[ 'RSI',num(tech?.rsi)],[ 'MACD',num(tech?.macd)],[ 'ADX',num(tech?.adx)],[ 'Volatility',pct(tech?.volatility)],[ 'Support',money(tech?.support_level)],[ 'Resistance',money(tech?.resistance_level)]]}/>
        </div>
        <div className="research-learn"><h3>Beginner translation</h3><p><b>RSI</b> measures recent price momentum. <b>MACD</b> compares moving averages to show momentum changes. <b>ADX</b> describes trend strength. <b>Support/Resistance</b> are price levels derived from market history.</p><p>Technical indicators describe price behaviour; they do not explain whether the underlying business is financially strong.</p></div>
      </div>
      <details className="research-details"><summary>Show all technical indicators</summary><Table headers={['Indicator','Value']} rows={technicalRows}/></details>
    </Section>

    <Section id="predictions" eyebrow="QUANTITATIVE MODEL" title="What the current model estimates">
      {latest?<div className="forecast-grid">{(predictions??[]).map(p=><div className="forecast-card" key={p.id}><span>{String(p.horizon).toUpperCase()}</span><b>{money(p.predicted_price)}</b><strong className={Number(p.predicted_change_percent)>=0?'positive':'negative'}>{pct(p.predicted_change_percent)}</strong><small>{p.direction??'Neutral'} · model confidence {num(p.confidence)}</small></div>)}</div>:<Empty>No current quantitative prediction is available yet.</Empty>}
      <div className="research-reading-strip"><b>Important:</b> model confidence is a model-quality score, not a probability of being correct. Forecasts are estimates and can change when new market data arrives.</div>
      {results?.length?<details className="research-details"><summary>Show historical model evaluation</summary><Table headers={['Evaluated','Horizon','Predicted','Actual','Error','Result']} rows={results.map(r=>[r.evaluated_at?new Date(r.evaluated_at).toLocaleDateString('en-US'):'—',String(r.horizon).toUpperCase(),money(r.predicted_price),money(r.actual_price),pct(r.percentage_error),r.hit?'Hit':'Miss'])}/></details>:null}
    </Section>

    <Section id="long-term" eyebrow="LONG-TERM SCENARIOS" title="2026–2050 scenario map">
      {longTerm?.length?<Table headers={['Year','Bear scenario','Base scenario','Bull scenario','Expected CAGR','Confidence']} rows={[2026,2027,2030,2035,2040,2050].map(y=>{const r=longMap.get(y);return[y,money(r?.bear_price),money(r?.base_price),money(r?.bull_price),pct(r?.expected_cagr),num(r?.confidence)]})}/>:<Empty>Long-term scenario data is not populated yet.</Empty>}
      <div className="research-reading-strip">These are scenario estimates, not promises or guaranteed future prices. Uncertainty increases as the forecast horizon becomes longer.</div>
    </Section>

    <Section id="earnings" eyebrow="EARNINGS" title="What happened around earnings?">
      {(earnings??[]).length?<Table headers={['Date','Period','EPS Est.','EPS Actual','EPS Surprise','Revenue Est.','Revenue Actual','Revenue Surprise']} rows={(earnings??[]).map(e=>[e.earnings_date?new Date(e.earnings_date).toLocaleDateString('en-US'):'—',e.fiscal_period??'—',num(e.eps_estimate),num(e.eps_actual),pct(e.eps_surprise),compactMoney(e.revenue_estimate),compactMoney(e.revenue_actual),pct(e.revenue_surprise)])}/>:<Empty>Earnings data is not populated yet.</Empty>}
      {earningsRevisions?.length?<details className="research-details"><summary>Show analyst estimate revisions</summary><Table headers={['Date','Period','EPS Estimate','Previous EPS','Revenue Estimate','Previous Revenue','Analysts','Direction']} rows={earningsRevisions.map(r=>[renderValue(r.revision_date),r.fiscal_period??'—',num(r.eps_estimate),num(r.previous_eps_estimate),compactMoney(r.revenue_estimate),compactMoney(r.previous_revenue_estimate),num(r.analyst_count),r.direction??'—'])}/></details>:null}
    </Section>

    <Section id="risks" eyebrow="RISK CHECK" title="What could go wrong?">
      <div className="research-two-col">
        <div>{riskRows.length?<MetricGrid items={riskRows.map(([k,v])=>[String(k),v])}/>:<Empty>Risk metrics are not populated yet.</Empty>}</div>
        <div className="research-risk-list"><h3>Use this section as a checklist</h3><div>Business risk — demand, competition, customers and products.</div><div>Financial risk — debt, cash flow, liquidity and interest burden.</div><div>Valuation risk — expectations may already be reflected in the price.</div><div>Market risk — volatility and broad market conditions can move the share price.</div><div>Event risk — earnings, regulation, litigation or major corporate actions.</div></div>
      </div>
    </Section>

    <Section id="company" eyebrow="COMPANY PROFILE" title="Company details">
      <p className="research-prose">{businessSummary}</p>
      <MetricGrid items={[['Ticker',symbol],['Exchange',stock.exchange_full_name??stock.exchange??'—'],['Sector',stock.sector??'—'],['Industry',stock.industry??'—'],['Country',stock.country??'—'],['Founded',renderValue(stock.founded_year)],['Employees',stock.employees!=null?num(stock.employees):'—'],['CEO',stock.ceo??'—'],['Headquarters',stock.headquarters??'—'],['IPO Date',renderValue(stock.ipo_listing_date)]]}/>
    </Section>

    <Section id="peer-analysis" eyebrow="PEER CONTEXT" title="How to compare this company">
      {peerMetrics?.length?<Table headers={['Date','Metric','Company','Peer Median','Peer Average','Min','Max','Percentile']} rows={peerMetrics.map(p=>[renderValue(p.metric_date),p.metric_name??'—',num(p.company_value),num(p.peer_median),num(p.peer_average),num(p.peer_min),num(p.peer_max),num(p.percentile)])}/>:<Empty>Peer metrics are not populated yet.</Empty>}
      <div className="research-reading-strip">Peer comparisons are useful only when the companies have similar business models, economics and accounting characteristics.</div>
    </Section>

    <Section id="news" eyebrow="LATEST INFORMATION" title="News and what changed">
      {(news??[]).length?<div className="research-news">{news.map(n=><a href={n.url??'#'} target="_blank" rel="noreferrer" key={n.id}><div><b>{n.title}</b><span>{n.source??'Market News'} · {n.published_at?new Date(n.published_at).toLocaleDateString('en-US'):'Latest'}</span></div><em>{n.sentiment??'neutral'}</em></a>)}</div>:<Empty>No recent ticker-linked news is available.</Empty>}
      {aiResearch?.length?<div className="research-ai-block"><h3>Research notes</h3>{aiResearch.slice(0,2).map((r:any)=><div key={r.id}><b>{r.research_period??r.research_type??'Research update'}</b><p>{r.what_changed_recently??r.fundamental_analysis??r.company_overview??'Research note available.'}</p></div>)}</div>:null}
    </Section>

    <Section id="faq" eyebrow="LEARN AS YOU GO" title="A simple research workflow">
      <div className="research-checklist">
        <div><b>01</b><strong>Understand the business</strong><span>Know what the company sells and how it earns.</span></div>
        <div><b>02</b><strong>Check the numbers</strong><span>Look for revenue, profit, cash flow, returns and debt trends.</span></div>
        <div><b>03</b><strong>Check the price</strong><span>Interpret valuation using growth, quality and expectations.</span></div>
        <div><b>04</b><strong>Check the chart separately</strong><span>Use technical data for market behaviour, not business quality.</span></div>
        <div><b>05</b><strong>Write down the risks</strong><span>Ask what evidence would make your original view change.</span></div>
        <div><b>06</b><strong>Keep monitoring</strong><span>Revisit the thesis when earnings, guidance or major events change.</span></div>
      </div>
      <div className="research-reading-strip">This page is designed as a research workspace: observed data, explanations and model outputs are kept distinct so a beginner can follow the story while an advanced user can open the detailed tables.</div>
    </Section>
  </div>;
}
