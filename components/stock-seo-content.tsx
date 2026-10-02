type Props = {
  stock: any;
  quote: any;
  tech: any;
  predictions: any[] | null;
  fundamentals: any;
  financialMetrics: any[];
  earnings: any[] | null;
  earningsRevisions: any[];
  news: any[] | null;
  results: any[] | null;
  article?: any;
  aiResearch: any[];
  performance: any;
  risks: any;
  valuations: any;
  longTerm: any[];
  peerMetrics: any[];
};

const money = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const compactMoney = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`;
const num = (v: any) => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const pct = (v: any) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

function Card({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="seo-card" id={id}><div className="seo-card-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div></div>{children}</section>;
}
function MetricGrid({ items }: { items: [string, React.ReactNode][] }) {
  return <div className="seo-metric-grid">{items.map(([k,v]) => <div className="seo-metric" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>;
}
function ResearchText({ children }: { children: React.ReactNode }) { return <p className="seo-prose">{children}</p>; }
function Table({ headers, rows }: { headers:string[]; rows:any[][] }) {
  return <div className="seo-data-table"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>;
}

export default function StockSeoContent({stock,quote,tech,predictions,fundamentals,financialMetrics,earnings,earningsRevisions,news,results,article,aiResearch,performance,risks,valuations,longTerm,peerMetrics}:Props){
  const symbol=stock.symbol, company=stock.company_name, latest=predictions?.[0];
  const longMap=new Map((longTerm??[]).map(r=>[Number(r.target_year),r]));
  const technicalRows=[
    ['RSI',num(tech?.rsi)],['MACD',num(tech?.macd)],['MACD Signal',num(tech?.macd_signal)],['MACD Histogram',num(tech?.macd_histogram)],
    ['SMA 20',money(tech?.sma_20)],['SMA 50',money(tech?.sma_50)],['SMA 100',money(tech?.sma_100)],['SMA 200',money(tech?.sma_200)],
    ['EMA 20',money(tech?.ema_20)],['EMA 200',money(tech?.ema_200)],['ATR',num(tech?.atr)],['ADX',num(tech?.adx)],
    ['Bollinger Upper',money(tech?.bollinger_upper)],['Bollinger Middle',money(tech?.bollinger_middle)],['Bollinger Lower',money(tech?.bollinger_lower)],
    ['Stochastic',num(tech?.stochastic)],['Williams %R',num(tech?.williams_r)],['CCI',num(tech?.cci)],['MFI',num(tech?.mfi)],['ROC',pct(tech?.roc)],
    ['OBV',num(tech?.obv)],['Volatility',pct(tech?.volatility)],['Momentum',pct(tech?.momentum)],['Support',money(tech?.support_level)],['Resistance',money(tech?.resistance_level)],
    ['Trend',tech?.trend??'—'],['Stochastic Signal',tech?.stochastic_signal??'—']
  ];
  const fundamentalRows=[
    ['Fiscal Period',fundamentals?.fiscal_period??'—'],['Market Cap',compactMoney(fundamentals?.market_cap??stock.market_cap)],['Enterprise Value',compactMoney(fundamentals?.enterprise_value)],
    ['Revenue',compactMoney(fundamentals?.revenue)],['Revenue Growth',pct(fundamentals?.revenue_growth)],['Gross Profit',compactMoney(fundamentals?.gross_profit)],
    ['Operating Income',compactMoney(fundamentals?.operating_income)],['Net Income',compactMoney(fundamentals?.net_income)],['EPS',num(fundamentals?.eps)],['EPS Growth',pct(fundamentals?.eps_growth)],
    ['Free Cash Flow',compactMoney(fundamentals?.free_cash_flow)],['FCF Growth',pct(fundamentals?.fcf_growth)],['FCF Margin',pct(fundamentals?.fcf_margin)],
    ['Gross Margin',pct(fundamentals?.gross_margin)],['Operating Margin',pct(fundamentals?.operating_margin)],['Net Margin',pct(fundamentals?.net_margin)],
    ['ROE',pct(fundamentals?.roe)],['ROA',pct(fundamentals?.roa)],['ROIC',pct(fundamentals?.roic)],['ROCE',pct(fundamentals?.roce)],
    ['Debt / Equity',num(fundamentals?.debt_equity)],['Total Debt',compactMoney(fundamentals?.total_debt)],['Cash & Equivalents',compactMoney(fundamentals?.cash_and_equivalents)],
    ['Current Assets',compactMoney(fundamentals?.current_assets)],['Current Liabilities',compactMoney(fundamentals?.current_liabilities)],['Working Capital',compactMoney(fundamentals?.working_capital)],
    ['Shares Outstanding',num(fundamentals?.shares_outstanding)],['Book Value / Share',num(fundamentals?.book_value_per_share)],['Tangible Book / Share',num(fundamentals?.tangible_book_value_per_share)],['FCF / Share',num(fundamentals?.fcf_per_share)]
  ];
  const valuationRows=[
    ['P/E',num(fundamentals?.pe_ratio??valuations?.pe)],['Forward P/E',num(fundamentals?.forward_pe??valuations?.forward_pe)],['PEG',num(fundamentals?.peg_ratio??valuations?.peg)],
    ['Price / Sales',num(fundamentals?.price_sales??valuations?.price_sales)],['Price / Book',num(fundamentals?.price_book??valuations?.price_book)],['Price / FCF',num(fundamentals?.price_to_fcf??valuations?.price_fcf)],
    ['EV / Revenue',num(fundamentals?.enterprise_value_to_revenue??valuations?.ev_revenue)],['EV / EBITDA',num(fundamentals?.enterprise_value_to_ebitda??valuations?.ev_ebitda)],
    ['EV / EBIT',num(fundamentals?.ev_to_ebit??valuations?.ev_ebit)],['Earnings Yield',pct(fundamentals?.earnings_yield??valuations?.earnings_yield)],
    ['FCF Yield',pct(fundamentals?.fcf_yield??valuations?.fcf_yield)],['Dividend Yield',pct(fundamentals?.dividend_yield??valuations?.dividend_yield)],['Payout Ratio',pct(fundamentals?.payout_ratio??valuations?.payout_ratio)]
  ];
  const performanceRows=performance?[
    ['1D',pct(performance.period_1d)],['5D',pct(performance.period_5d)],['1M',pct(performance.period_1m)],['3M',pct(performance.period_3m)],
    ['6M',pct(performance.period_6m)],['YTD',pct(performance.period_ytd)],['1Y',pct(performance.period_1y)],['3Y',pct(performance.period_3y)],
    ['5Y',pct(performance.period_5y)],['10Y',pct(performance.period_10y)],['Max',pct(performance.period_max)]
  ]:[];
  const riskRows=risks?[['Beta',num(risks.beta)],['Volatility',pct(risks.volatility)],['ATR',num(risks.atr)],['Maximum Drawdown',pct(risks.maximum_drawdown)],['Sharpe Ratio',num(risks.sharpe_ratio)],['Sortino Ratio',num(risks.sortino_ratio)],['Current Ratio',num(risks.current_ratio)],['Quick Ratio',num(risks.quick_ratio)],['Interest Coverage',num(risks.interest_coverage)],['Altman Z-Score',num(risks.altman_z_score)],['Short Interest',num(risks.short_interest)],['Short % Float',pct(risks.short_percent_float)],['Liquidity Risk',risks.liquidity_risk??'—']]:[];
  return <div className="seo-research-stack">
    <Card id="stock-price" eyebrow="MARKET SNAPSHOT" title={`${company} (${symbol}) Price, Trading & 52-Week Range`}>
      <MetricGrid items={[[ 'Current Price',money(quote?.price)],['Change',pct(quote?.change_percent)],['Open',money(quote?.open)],['Day High',money(quote?.high)],['Day Low',money(quote?.low)],['Previous Close',money(quote?.previous_close)],['Volume',num(quote?.volume)],['Average Volume',num(quote?.average_volume)],['Dollar Volume',compactMoney(quote?.dollar_volume)],['Market Cap',compactMoney(quote?.market_cap??stock.market_cap)],['52W High',money(quote?.week_52_high)],['52W Low',money(quote?.week_52_low)],['Bid',money(quote?.bid)],['Ask',money(quote?.ask)],['Bid Size',num(quote?.bid_size)],['Ask Size',num(quote?.ask_size)],['Short Interest',num(quote?.short_interest)],['Short % Float',pct(quote?.short_percent_float)]]} />
    </Card>
    <div className="seo-two-column">
      <Card id="analysis" eyebrow="AI RESEARCH" title={`${company} (${symbol}) AI Research`}>
        {article?.summary||article?.content ? <ResearchText>{article.summary??article.content}</ResearchText> : <ResearchText>AI research is not populated yet. The page shows the underlying stored market and financial data without inventing commentary.</ResearchText>}
        {aiResearch?.length?aiResearch.map((r:any)=><div className="research-entry" key={r.id}><h3>{r.research_period??r.research_type??'Research update'}</h3>{[
          ['Company Overview',r.company_overview],['Fundamental Analysis',r.fundamental_analysis],['Technical Analysis',r.technical_analysis],['Valuation Analysis',r.valuation_analysis],['Growth Analysis',r.growth_analysis],['Risk Analysis',r.risk_analysis],['Market Position',r.market_position_analysis],['Earnings Analysis',r.earnings_analysis],['News Summary',r.news_summary],['Bull Case',r.bull_case],['Bear Case',r.bear_case],['Catalysts',r.catalysts],['Risks',r.risks],['What Changed',r.what_changed_recently]
        ].filter(([,v])=>v!=null&&String(v).trim()!=='').map(([k,v])=><p key={String(k)}><b>{k}:</b> {String(v)}</p>)}</div>):null}
      </Card>
      <Card id="performance" eyebrow="PERFORMANCE" title="Returns & Risk-Adjusted Context">
        <MetricGrid items={performanceRows.map(([k,v])=>[String(k),v])}/>
      </Card>
    </div>
    <Card id="predictions" eyebrow="QUANTITATIVE MODEL · V3" title={`${company} (${symbol}) Short-Term Predictions`}>
      {latest?<Table headers={['Horizon','Current','Predicted','Change','Direction','Confidence','Uncertainty']} rows={(predictions??[]).map(p=>[String(p.horizon).toUpperCase(),money(p.current_price),money(p.predicted_price),pct(p.predicted_change_percent),p.direction??'—',num(p.confidence),num(p.uncertainty)])}/>:<ResearchText>No current quantitative prediction is available.</ResearchText>}
      <ResearchText>Confidence is a model-quality score, not a probability of correctness. Forecasts are estimates that can change as new market data arrives.</ResearchText>
    </Card>
    <Card id="technical-analysis" eyebrow="TECHNICAL ANALYSIS" title={`${company} (${symbol}) Complete Technical Dashboard`}>
      <Table headers={['Indicator','Value']} rows={technicalRows}/>
    </Card>
    <div className="seo-two-column">
      <Card id="financials" eyebrow="FUNDAMENTALS" title={`${company} (${symbol}) Fundamental Snapshot`}>
        <Table headers={['Metric','Value']} rows={fundamentalRows}/>
      </Card>
      <Card id="valuation" eyebrow="VALUATION" title={`${company} (${symbol}) Valuation Dashboard`}>
        <Table headers={['Metric','Value']} rows={valuationRows}/>
      </Card>
    </div>
    <Card id="long-term" eyebrow="LONG-TERM MODEL" title={`${company} (${symbol}) Long-Term Scenario Forecast 2026–2050`}>
      {longTerm?.length?<Table headers={['Year','Bear','Base','Bull','CAGR','Confidence','Uncertainty']} rows={[2026,2027,2030,2035,2040,2050].map(y=>{const r=longMap.get(y); return [y,money(r?.bear_price),money(r?.base_price),money(r?.bull_price),pct(r?.expected_cagr),num(r?.confidence),num(r?.uncertainty)];})}/>:<ResearchText>Long-term predictions are not populated yet.</ResearchText>}
      <ResearchText>These are scenario estimates from the dedicated long-horizon model; uncertainty rises materially at longer horizons.</ResearchText>
    </Card>
    <Card id="earnings" eyebrow="EARNINGS & REVISIONS" title={`${company} (${symbol}) Earnings & Estimate Revisions`}>
      {(earnings??[]).length?<Table headers={['Date','Fiscal Period','EPS Est.','EPS Actual','EPS Surprise','Revenue Est.','Revenue Actual','Revenue Surprise','Time','Guidance','Growth']} rows={(earnings??[]).map(e=>[e.earnings_date?new Date(e.earnings_date).toLocaleDateString('en-US'):'—',e.fiscal_period??'—',num(e.eps_estimate),num(e.eps_actual),pct(e.eps_surprise),compactMoney(e.revenue_estimate),compactMoney(e.revenue_actual),pct(e.revenue_surprise),e.earnings_time??'—',e.guidance??'—',pct(e.earnings_growth)])}/>:<ResearchText>Earnings data is not populated yet.</ResearchText>}
      {earningsRevisions?.length?<><h3>Estimate Revisions</h3><Table headers={['Date','Period','EPS Est.','Prev EPS','Revenue Est.','Prev Revenue','Analysts','Direction']} rows={earningsRevisions.map(r=>[r.revision_date??'—',r.fiscal_period??'—',num(r.eps_estimate),num(r.previous_eps_estimate),compactMoney(r.revenue_estimate),compactMoney(r.previous_revenue_estimate),num(r.analyst_count),r.direction??'—'])}/></>:null}
    </Card>
    <Card id="company" eyebrow="COMPANY INFORMATION" title={`${company} (${symbol}) Company Profile`}>
      <ResearchText>{stock.description??'Company description is not available yet.'}</ResearchText>
      <MetricGrid items={[['Ticker',symbol],['Exchange',stock.exchange_full_name??stock.exchange??'—'],['Sector',stock.sector??'—'],['Industry',stock.industry??'—'],['Sub-industry',stock.sub_industry??'—'],['Country',stock.country??'—'],['Founded',stock.founded_year??'—'],['Employees',stock.employees!=null?num(stock.employees):'—'],['CEO',stock.ceo??'—'],['Headquarters',stock.headquarters??'—'],['Company Status',stock.company_status??'—'],['IPO Date',stock.ipo_listing_date??'—'],['Investor Relations',stock.investor_relations_url?<a href={stock.investor_relations_url} target="_blank" rel="noreferrer">Open IR</a>:'—']]}/>
      {(stock.business_segments||stock.products_services||stock.brands||stock.management)?<div className="company-json-grid">{[
        ['Business Segments',stock.business_segments],['Products / Services',stock.products_services],['Brands',stock.brands],['Management',stock.management]
      ].map(([k,v])=><div key={String(k)}><span>{k}</span><pre>{v?JSON.stringify(v,null,2):'—'}</pre></div>)}</div>:null}
    </Card>
    <div className="seo-two-column">
      <Card id="risks" eyebrow="RISK METRICS" title={`${company} (${symbol}) Risk Dashboard`}><Table headers={['Metric','Value']} rows={riskRows}/></Card>
      <Card id="peer-analysis" eyebrow="PEER METRICS" title="Peer Context"><Table headers={['Date','Metric','Company','Peer Median','Peer Avg','Min','Max','Percentile']} rows={(peerMetrics??[]).map(p=>[p.metric_date??'—',p.metric_name??'—',num(p.company_value),num(p.peer_median),num(p.peer_average),num(p.peer_min),num(p.peer_max),num(p.percentile)])}/></Card>
    </div>
    <Card id="model-validation" eyebrow="MODEL VALIDATION" title={`${company} (${symbol}) Prediction History`}>{results?.length?<Table headers={['Evaluated','Horizon','Predicted','Actual','Error','Hit']} rows={results.map(r=>[r.evaluated_at?new Date(r.evaluated_at).toLocaleDateString('en-US'):'—',String(r.horizon).toUpperCase(),money(r.predicted_price),money(r.actual_price),pct(r.percentage_error),r.hit?'Hit':'Miss'])}/>:<ResearchText>No evaluated prediction history yet.</ResearchText>}</Card>
    <Card id="news" eyebrow="NEWS" title={`${company} (${symbol}) Latest News & Sentiment`}>{(news??[]).length?<div className="seo-news-list">{news?.map(n=><a href={n.url??'#'} target="_blank" rel="noreferrer" key={n.id}><strong>{n.title}</strong><span>{n.source??'Market News'} · {n.published_at?new Date(n.published_at).toLocaleDateString('en-US'):'Latest'} · {n.sentiment??'neutral'} · score {n.sentiment_score??'—'} · relevance {n.relevance_score??'—'}</span></a>)}</div>:<ResearchText>No recent ticker-linked news is available.</ResearchText>}</Card>
    <Card id="faq" eyebrow="RESEARCH GUIDE" title={`${company} (${symbol}) Research Guide`}>
      <ResearchText>This page combines the existing stock-page sections with the backend tables currently connected to the stock record. Unavailable datasets remain visibly unavailable rather than being filled with invented values.</ResearchText>
      <MetricGrid items={[['Quote Source',quote?.data_source??'—'],['Technical Calculated',tech?.calculated_at??'—'],['Fundamentals Source',fundamentals?.data_source??'—'],['Valuation Date',valuations?.valuation_date??'—'],['Risk Methodology',risks?.methodology_version??'—']]}/>
    </Card>
  </div>;
}
