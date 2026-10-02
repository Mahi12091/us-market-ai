import React from 'react';
import PriceChart, { type ChartPoint } from '@/components/price-chart';

type Props = {
  stock: any;
  quote: any;
  tech: any;
  predictions: any[];
  longTerm: any[];
  fundamentals: any;
  earnings: any[];
  news: any[];
  results: any[];
  article?: any;
  chart: ChartPoint[];
};

const money = (v: any, digits = 2) => v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const compactMoney = (v: any) => v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const num = (v: any) => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const pct = (v: any) => v == null ? '—' : (Number(v) >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';
const label = (v: any) => v == null ? '—' : String(v).replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());

function Stat({ name, value, sub }: { name:string; value:any; sub?:any }) {
  return <div className="stockx-stat"><span>{name}</span><strong>{value}</strong>{sub != null && <em>{sub}</em>}</div>;
}
function Section({ id, eyebrow, title, children, action }: { id?:string; eyebrow:string; title:string; children:React.ReactNode; action?:React.ReactNode }) {
  return <section id={id} className="stockx-section"><div className="stockx-section-head"><div><span className="stockx-eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>{children}</section>;
}
function Empty({ text }: { text:string }) { return <div className="stockx-empty">{text}</div>; }

export default function StockResearchDashboard({ stock, quote, tech, predictions, longTerm, fundamentals, earnings, news, results, article, chart }: Props) {
  const symbol = stock.symbol;
  const company = stock.company_name;
  const change = quote?.change_percent;
  const direction = predictions?.[0]?.direction ?? 'neutral';
  const riskItems = [
    ['Valuation', fundamentals?.pe_ratio != null ? `P/E ${num(fundamentals.pe_ratio)}` : 'Review valuation multiples'],
    ['Earnings', fundamentals?.eps_growth != null ? `EPS growth ${pct(fundamentals.eps_growth)}` : 'Review earnings trend'],
    ['Growth', fundamentals?.revenue_growth != null ? `Revenue growth ${pct(fundamentals.revenue_growth)}` : 'Review revenue trend'],
    ['Leverage', fundamentals?.debt_to_equity != null ? `Debt/Equity ${num(fundamentals.debt_to_equity)}` : 'Review balance sheet'],
    ['Volatility', tech?.volatility != null ? `Volatility ${pct(tech.volatility)}` : 'Review price volatility'],
    ['Company-specific', news?.length ? `${news.length} recent linked items` : 'No recent linked news'],
  ];
  const longYears = [2026,2027,2030,2035,2040,2050];
  const longByYear = new Map((longTerm ?? []).map(r => [Number(r.target_year), r]));
  const latestLong = longYears.map(y => longByYear.get(y)).filter(Boolean)[0];
  const fundamentalsCards = [
    ['Revenue', compactMoney(fundamentals?.revenue), pct(fundamentals?.revenue_growth)],
    ['Net Income', compactMoney(fundamentals?.net_income), null],
    ['EPS', money(fundamentals?.eps), pct(fundamentals?.eps_growth)],
    ['Free Cash Flow', compactMoney(fundamentals?.free_cash_flow), pct(fundamentals?.fcf_growth)],
  ];
  const profitability = [
    ['Gross Margin', pct(fundamentals?.gross_margin)],
    ['Operating Margin', pct(fundamentals?.operating_margin)],
    ['Net Margin', pct(fundamentals?.net_margin)],
    ['ROE', pct(fundamentals?.roe)],
    ['ROIC', pct(fundamentals?.roic)],
    ['Revenue Growth', pct(fundamentals?.revenue_growth)],
    ['EPS Growth', pct(fundamentals?.eps_growth)],
    ['FCF Growth', pct(fundamentals?.fcf_growth)],
  ];
  const valuation = [
    ['P/E', num(fundamentals?.pe_ratio)], ['Forward P/E', num(fundamentals?.forward_pe)],
    ['PEG', num(fundamentals?.peg_ratio)], ['P/S', num(fundamentals?.price_to_sales)],
    ['P/B', num(fundamentals?.price_to_book)], ['EV/EBITDA', num(fundamentals?.ev_to_ebitda)],
    ['Market Cap', compactMoney(fundamentals?.market_cap ?? stock.market_cap)], ['FCF Yield', pct(fundamentals?.fcf_yield)],
  ];

  return <div className="stockx-dashboard">
    <div className="stockx-mobile-tabs">
      {['Overview','Analysis','Predictions','Long-Term','Fundamentals','Financials','News','Risks'].map((x,i) => <a key={x} className={i===0?'active':''} href={'#'+(['overview','analysis','predictions','long-term','fundamentals','financial-statements','news','risks'][i])}>{x}</a>)}
    </div>

    <section id="overview" className="stockx-hero-card">
      <div className="stockx-company">
        <div className="stockx-logo">{symbol.slice(0,1)}</div>
        <div>
          <span className="stockx-eyebrow">{stock.exchange ?? 'US MARKET'} · {stock.sector ?? 'EQUITY'}</span>
          <h1>{company}</h1>
          <p>{symbol} · {stock.industry ?? 'Public company'}</p>
        </div>
      </div>
      <div className="stockx-price">
        <strong>{money(quote?.price)}</strong>
        <span className={Number(change)>=0?'positive':'negative'}>{quote?.change != null ? `${Number(quote.change)>=0?'+':''}${money(quote.change)} · ${pct(change)}` : 'Quote unavailable'}</span>
        <small>{quote?.quote_timestamp ? `Updated ${new Date(quote.quote_timestamp).toLocaleString('en-US')}` : 'Waiting for market feed'}</small>
      </div>
      <div className="stockx-hero-stats">
        <Stat name="Market Cap" value={compactMoney(stock.market_cap ?? fundamentals?.market_cap)} />
        <Stat name="Volume" value={quote?.volume ? Number(quote.volume).toLocaleString('en-US') : '—'} />
        <Stat name="52W High" value={money(tech?.week_52_high ?? quote?.fifty_two_week_high)} />
        <Stat name="52W Low" value={money(tech?.week_52_low ?? quote?.fifty_two_week_low)} />
        <Stat name="P/E" value={num(fundamentals?.pe_ratio)} />
        <Stat name="Dividend Yield" value={pct(fundamentals?.dividend_yield)} />
      </div>
    </section>

    <Section id="price" eyebrow="PRICE CHART & PERFORMANCE" title="Price performance">
      <div className="stockx-chart"><PriceChart data={chart}/></div>
    </Section>

    <Section id="analysis" eyebrow="AI RESEARCH" title={`${company} (${symbol}) AI Research`}>
      <div className="stockx-analysis-grid">
        <div className="stockx-ai-summary">
          <div className="stockx-signal-row"><span className={`stockx-signal ${direction}`}>{label(direction)}</span><small>{article?.updated_at ? `Updated ${new Date(article.updated_at).toLocaleDateString('en-US')}` : 'Model-driven summary'}</small></div>
          <p>{article?.summary || article?.content || `${symbol} research combines the latest quote, technical indicators, fundamentals, quantitative forecasts and company-linked news. Commentary is shown only when supported by stored data; unavailable metrics are not estimated.`}</p>
          <a href="#analysis-detail">Read detailed research ↓</a>
        </div>
        <div className="stockx-key-points">
          <h3>Key research signals</h3>
          <ul>
            <li>Trend: {tech?.sma_50 != null && tech?.sma_200 != null ? (Number(tech.sma_50) > Number(tech.sma_200) ? '50-day average is above 200-day average' : '50-day average is below 200-day average') : 'Moving-average context unavailable'}</li>
            <li>Momentum: RSI {num(tech?.rsi)} · MACD {num(tech?.macd)}</li>
            <li>Growth: Revenue {pct(fundamentals?.revenue_growth)} · EPS {pct(fundamentals?.eps_growth)}</li>
            <li>Cash generation: FCF {compactMoney(fundamentals?.free_cash_flow)}</li>
            <li>Valuation: P/E {num(fundamentals?.pe_ratio)} · Forward P/E {num(fundamentals?.forward_pe)}</li>
            <li>News: {news?.length ? `${news.length} recent ticker-linked items` : 'No recent ticker-linked news'}</li>
          </ul>
        </div>
      </div>
    </Section>

    <div className="stockx-two-col">
      <Section id="predictions" eyebrow="QUANTITATIVE MODEL · V3" title="Short-term predictions">
        {predictions?.length ? <div className="stockx-table-wrap"><table className="stockx-table"><thead><tr><th>Horizon</th><th>Estimate</th><th>Change</th><th>Direction</th><th>Confidence</th></tr></thead><tbody>{predictions.map(p => <tr key={p.id}><td>{String(p.horizon).toUpperCase()}</td><td>{money(p.predicted_price)}</td><td className={Number(p.predicted_change_percent)>=0?'positive':'negative'}>{pct(p.predicted_change_percent)}</td><td>{label(p.direction ?? p.signal)}</td><td>{p.confidence != null ? Number(p.confidence).toFixed(0) : '—'}</td></tr>)}</tbody></table></div> : <Empty text="Fresh quantitative forecasts will appear after the model runs."/>}
        <p className="stockx-note">Confidence is a model-quality score, not a probability of being correct. Forecasts are estimates and can change when new market data arrives.</p>
      </Section>

      <Section id="long-term" eyebrow="LONG-TERM MODEL · V1" title="2026–2050 scenario forecast">
        {longTerm?.length ? <div className="stockx-table-wrap"><table className="stockx-table"><thead><tr><th>Year</th><th>Bear</th><th>Base</th><th>Bull</th></tr></thead><tbody>{longYears.map(y => { const r=longByYear.get(y); return <tr key={y}><td>{y}</td><td>{money(r?.bear_price)}</td><td><b>{money(r?.base_price)}</b></td><td>{money(r?.bull_price)}</td></tr>; })}</tbody></table></div> : <Empty text="Long-term scenario forecasts will appear after the dedicated long-horizon model runs."/>}
        {latestLong && <div className="stockx-long-meta"><span>Base CAGR {pct(latestLong.expected_cagr)}</span><span>Confidence {num(latestLong.confidence)}</span><span>Uncertainty {num(latestLong.uncertainty)}</span></div>}
        <p className="stockx-note">Bear/Base/Bull are scenario estimates, not guaranteed future prices. Uncertainty is materially higher for 2035–2050.</p>
      </Section>
    </div>

    <Section id="technicals" eyebrow="TECHNICAL ANALYSIS" title={`${symbol} technical dashboard`}>
      <div className="stockx-tech-grid">{[
        ['RSI',num(tech?.rsi)],['MACD',num(tech?.macd)],['SMA 50',money(tech?.sma_50)],['SMA 200',money(tech?.sma_200)],
        ['EMA 20',money(tech?.ema_20)],['ATR',num(tech?.atr)],['ADX',num(tech?.adx)],['Volatility',pct(tech?.volatility)],
        ['Bollinger Upper',money(tech?.bollinger_upper)],['Stochastic',num(tech?.stochastic)],['Support',money(tech?.support)],['Resistance',money(tech?.resistance)]
      ].map(([k,v])=><Stat key={k} name={k} value={v}/>)}</div>
      <p className="stockx-note">Indicators are shown as stored by the technical engine. A missing value is intentionally displayed as unavailable rather than estimated.</p>
    </Section>

    <div className="stockx-two-col">
      <Section id="fundamentals" eyebrow="FUNDAMENTALS" title="Growth, earnings & cash flow">
        <div className="stockx-fund-grid">{fundamentalsCards.map(([k,v,s])=><div className="stockx-big-metric" key={k}><span>{k}</span><strong>{v}</strong>{s && <em>{s}</em>}</div>)}</div>
        <div className="stockx-mini-grid">{profitability.map(([k,v])=><Stat key={k} name={k} value={v}/>)}</div>
      </Section>
      <Section id="valuation" eyebrow="VALUATION" title="Valuation dashboard">
        <div className="stockx-mini-grid">{valuation.map(([k,v])=><Stat key={k} name={k} value={v}/>)}</div>
        <p className="stockx-note">Multiples should be interpreted with the reporting period, business model and sector context. US Market AI does not invent a fair-value number when the required inputs are unavailable.</p>
      </Section>
    </div>

    <Section id="financial-statements" eyebrow="FINANCIAL STATEMENTS" title="Income statement, balance sheet & cash flow">
      <div className="stockx-financial-callout"><b>Detailed financial statements</b><span>Historical statement tables remain available below with the full stored dataset.</span><a href="#financial-statements-detail">View detailed tables ↓</a></div>
    </Section>

    <div className="stockx-two-col">
      <Section id="earnings" eyebrow="EARNINGS & DIVIDEND" title="Earnings, EPS & dividend">
        {earnings?.length ? <div className="stockx-list">{earnings.slice(0,4).map(e=><div key={e.id} className="stockx-list-row"><div><b>{e.earnings_date ? new Date(e.earnings_date).toLocaleDateString('en-US') : '—'}</b><small>{e.fiscal_period ?? 'Reported earnings'}</small></div><span>EPS {num(e.eps_actual)} / est {num(e.eps_estimate)}</span><span>Revenue {compactMoney(e.revenue_actual)}</span></div>)}</div> : <Empty text="Earnings data is currently unavailable."/>}
      </Section>
      <Section id="news" eyebrow="NEWS & SENTIMENT" title="Latest ticker-linked news">
        {news?.length ? <div className="stockx-news">{news.map(n=><a key={n.id} href={n.url ?? '#'} target="_blank" rel="noreferrer"><strong>{n.title}</strong><span>{n.source ?? 'Market News'} · {n.published_at ? new Date(n.published_at).toLocaleDateString('en-US') : 'Latest'} · {label(n.sentiment)}</span></a>)}</div> : <Empty text="No recent ticker-linked news available."/>}
      </Section>
    </div>

    <Section id="risks" eyebrow="RISK ANALYSIS" title="What to monitor">
      <div className="stockx-risk-grid">{riskItems.map(([k,v])=><div key={k}><span>{k} Risk</span><strong>{v}</strong></div>)}</div>
    </Section>

    <Section id="prediction-history" eyebrow="MODEL VALIDATION" title="Prediction history">
      {results?.length ? <div className="stockx-table-wrap"><table className="stockx-table"><thead><tr><th>Date</th><th>Horizon</th><th>Predicted</th><th>Actual</th><th>Result</th></tr></thead><tbody>{results.map(r=><tr key={r.id}><td>{r.evaluated_at ? new Date(r.evaluated_at).toLocaleDateString('en-US') : '—'}</td><td>{String(r.horizon).toUpperCase()}</td><td>{money(r.predicted_price)}</td><td>{money(r.actual_price)}</td><td>{r.hit ? 'Hit' : 'Miss'}</td></tr>)}</tbody></table></div> : <Empty text="Prediction history is still building."/>}
    </Section>

    <div id="analysis-detail" className="stockx-hidden-anchor" />
  </div>;
}
