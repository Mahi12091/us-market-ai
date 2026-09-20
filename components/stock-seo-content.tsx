type Props = {
  stock: any;
  quote: any;
  tech: any;
  predictions: any[] | null;
  fundamentals: any;
  earnings: any[] | null;
  news: any[] | null;
  results: any[] | null;
  article?: any;
};

const money = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const num = (v: any) => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const pct = (v: any) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

function Card({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="seo-card" id={id}><div className="seo-card-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div></div>{children}</section>;
}

function MetricGrid({ items }: { items: [string, React.ReactNode][] }) {
  return <div className="seo-metric-grid">{items.map(([k, v]) => <div className="seo-metric" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>;
}

function ResearchText({ children }: { children: React.ReactNode }) {
  return <p className="seo-prose">{children}</p>;
}

export default function StockSeoContent({ stock, quote, tech, predictions, fundamentals, earnings, news, results, article }: Props) {
  const symbol = stock.symbol;
  const company = stock.company_name;
  const latest = predictions?.[0];

  return <div className="seo-research-stack">
    <Card id="stock-price" eyebrow="STOCK / PRICE" title={`${company} (${symbol}) Stock Price & Share Price`}>
      <ResearchText><strong>{symbol} stock price</strong> research starts with the latest verified quote and recent price history. The figures below are the current data available to US Market AI; unavailable values are left blank rather than estimated.</ResearchText>
      <MetricGrid items={[
        ['Current Price', money(quote?.price)], ['Open', money(quote?.open)], ['Day High', money(quote?.high)],
        ['Day Low', money(quote?.low)], ['Previous Close', money(quote?.previous_close)],
        ['Volume', quote?.volume ? Number(quote.volume).toLocaleString('en-US') : '—']
      ]} />
      <h3>{company} ({symbol}) Stock Price Today</h3>
      <ResearchText>{quote?.change != null ? `${symbol} is trading at ${money(quote.price)}, with a daily move of ${pct(quote.change_percent)} based on the latest quote. Intraday context should be read together with volume, recent price history and the technical indicators below.` : `The latest verified quote for ${symbol} is currently unavailable.`}</ResearchText>
      <h3>{company} ({symbol}) Recent Stock Price Performance</h3>
      <ResearchText>The price chart above provides the recent closing-price history used by the research page. This section intentionally separates live price data from forecasts and model estimates.</ResearchText>
    </Card>

    <Card id="analysis" eyebrow="AI RESEARCH" title={`${company} (${symbol}) Stock Analysis & AI Research`}>
      {article?.content ? <ResearchText>{article.content}</ResearchText> : article?.summary ? <ResearchText>{article.summary}</ResearchText> : <ResearchText>AI analysis will appear here after a verified research article is published for {symbol}. Until then, the page presents the underlying market, technical and fundamental data without inventing commentary.</ResearchText>}
      <h3>Current Market Position</h3>
      <ResearchText>{latest ? `${symbol} currently has a latest quantitative model output for the ${String(latest.horizon).toUpperCase()} horizon. The model result should be interpreted alongside the technical and fundamental sections rather than as a guaranteed outcome.` : `A quantitative forecast is not currently available for ${symbol}.`}</ResearchText>
      <h3>Key Risks and Research Signals</h3>
      <ResearchText>Readers should consider valuation, earnings, revenue growth, leverage, volatility, sector conditions and company-specific news together. The risk section below keeps these factors separate so the research is easier to review.</ResearchText>
    </Card>

    <Card id="prediction-forecast" eyebrow="PREDICTION & FORECAST" title={`${company} (${symbol}) Stock Prediction & Forecast`}>
      <ResearchText>{latest ? `${symbol}'s latest available quantitative output is shown below. These are model estimates, not guarantees, and the displayed horizon and value come directly from the prediction dataset.` : `No current quantitative forecast is available for ${symbol}.`}</ResearchText>
      <div className="seo-forecast-grid">{(predictions ?? []).map(p => <div className="seo-forecast-card" key={p.id}><span>{String(p.horizon).toUpperCase()}</span><strong>{money(p.predicted_price)}</strong><small>{pct(p.predicted_change_percent)} · {p.direction ?? p.signal ?? 'model output'}</small></div>)}</div>
      <h3>{company} ({symbol}) Stock Price Prediction Next 7 Days</h3><ResearchText>Use the 7D model row when available. It represents a short-horizon quantitative estimate and should not be presented as a certain future price.</ResearchText>
      <h3>{company} ({symbol}) Stock Price Prediction Next 30 Days</h3><ResearchText>Use the 30D model row when available. A longer horizon carries additional uncertainty because new market and company information can change the inputs.</ResearchText>
      <h3>{company} ({symbol}) Stock Forecast This Week & This Month</h3><ResearchText>Weekly and monthly search queries are mapped to the corresponding short-horizon model outputs. US Market AI does not create a separate number when a validated model value is unavailable.</ResearchText>
    </Card>

    <Card id="price-target" eyebrow="PRICE TARGET" title={`${company} (${symbol}) Stock Price Target`}>
      <ResearchText>The US Market AI price target section refers only to available quantitative estimates. It is not analyst consensus and should not be treated as a guaranteed fair value.</ResearchText>
      <MetricGrid items={(predictions ?? []).map(p => [`${String(p.horizon).toUpperCase()} estimate`, money(p.predicted_price)])} />
    </Card>

    <Card id="technical-analysis" eyebrow="TECHNICAL ANALYSIS" title={`${company} (${symbol}) Technical Analysis`}>
      <ResearchText>Technical analysis uses the latest stored indicator snapshot. RSI, MACD, moving averages, ATR, ADX, volatility and support/resistance are shown separately so readers can inspect the underlying numbers.</ResearchText>
      <div className="seo-data-table"><table><tbody>{[
        ['RSI', tech?.rsi], ['MACD', tech?.macd], ['SMA 50', tech?.sma_50], ['SMA 200', tech?.sma_200],
        ['EMA 20', tech?.ema_20], ['ATR', tech?.atr], ['ADX', tech?.adx], ['Volatility', tech?.volatility],
        ['Bollinger Upper', tech?.bollinger_upper], ['Stochastic', tech?.stochastic],
        ['Support', tech?.support_level], ['Resistance', tech?.resistance_level]
      ].map(([k, v]) => <tr key={String(k)}><th>{k}</th><td>{num(v)}</td></tr>)}</tbody></table></div>
      <h3>{company} ({symbol}) RSI, MACD & Moving Average Analysis</h3>
      <ResearchText>RSI helps describe momentum, MACD helps describe trend/momentum relationships, and the 20-, 50- and 200-period averages provide trend context. The actual values above should be used instead of generic buy or sell claims.</ResearchText>
      <h3>{company} ({symbol}) Support & Resistance Levels</h3>
      <ResearchText>When support and resistance values are available, they provide reference levels for technical research. They are not guarantees that price will stop or reverse at those levels.</ResearchText>
    </Card>

    <Card id="financials" eyebrow="FUNDAMENTALS" title={`${company} (${symbol}) Financials, Revenue, EPS & ROE`}>
      <ResearchText>The fundamentals snapshot brings revenue, profit, free cash flow, EPS, EPS growth, ROE and leverage into one place. Missing fields remain marked as unavailable.</ResearchText>
      {fundamentals ? <div className="seo-data-table"><table><tbody>{[
        ['Revenue', money(fundamentals.revenue)], ['Revenue Growth', pct(fundamentals.revenue_growth)],
        ['Gross Profit', money(fundamentals.gross_profit)], ['Operating Income', money(fundamentals.operating_income)],
        ['Net Income', money(fundamentals.net_income)], ['EPS', num(fundamentals.eps)],
        ['EPS Growth', pct(fundamentals.eps_growth)], ['ROE', pct(fundamentals.roe)],
        ['Free Cash Flow', money(fundamentals.free_cash_flow)], ['Debt / Equity', num(fundamentals.debt_equity)]
      ].map(([k,v]) => <tr key={String(k)}><th>{k}</th><td>{v}</td></tr>)}</tbody></table></div> : <div className="seo-empty">Fundamentals data is pending API connection.</div>}
      <h3>{company} ({symbol}) Revenue & Revenue Growth</h3><ResearchText>Revenue and revenue growth help describe the scale and direction of the business. Use the verified figures above when available; no missing growth rate is estimated.</ResearchText>
      <h3>{company} ({symbol}) EPS, Free Cash Flow & ROE</h3><ResearchText>EPS, free cash flow and return on equity provide additional profitability and capital-efficiency context. Each metric should be interpreted with the company's industry and reporting period in mind.</ResearchText>
    </Card>

    <Card id="valuation" eyebrow="VALUATION" title={`${company} (${symbol}) Valuation, PE Ratio & Forward PE`}>
      <ResearchText>Valuation data is presented from the available fundamentals snapshot. PE, forward PE, PEG, price-to-sales, price-to-book, enterprise value and market cap should be compared with the appropriate reporting period and sector context.</ResearchText>
      {fundamentals ? <div className="seo-data-table"><table><tbody>{[
        ['P/E Ratio', num(fundamentals.pe_ratio)], ['Forward P/E', num(fundamentals.forward_pe)],
        ['PEG Ratio', num(fundamentals.peg_ratio)], ['Price / Sales', num(fundamentals.price_sales)],
        ['Price / Book', num(fundamentals.price_book)], ['Enterprise Value', money(fundamentals.enterprise_value)],
        ['Market Cap', money(fundamentals.market_cap ?? stock.market_cap)]
      ].map(([k,v]) => <tr key={String(k)}><th>{k}</th><td>{v}</td></tr>)}</tbody></table></div> : <div className="seo-empty">Valuation data is pending fundamentals ingestion.</div>}
      <h3>{company} ({symbol}) Fair Value & Valuation</h3><ResearchText>US Market AI does not label a missing fair-value estimate as a fact. If a validated valuation model is connected later, its methodology and assumptions can be displayed here.</ResearchText>
    </Card>

    <Card id="earnings" eyebrow="EARNINGS & DIVIDEND" title={`${company} (${symbol}) Earnings, EPS Estimate & Dividend`}>
      <h3>{company} ({symbol}) Earnings Date & Results</h3>
      <ResearchText>The earnings table shows stored earnings dates and EPS estimates/actuals when available. Always verify the company's official investor-relations release for the latest filing or announcement.</ResearchText>
      {(earnings ?? []).length ? <div className="seo-data-table"><table><thead><tr><th>Date</th><th>EPS Estimate</th><th>EPS Actual</th><th>EPS Surprise</th></tr></thead><tbody>{earnings?.map(e => <tr key={e.id}><td>{e.earnings_date ? new Date(e.earnings_date).toLocaleDateString('en-US') : '—'}</td><td>{num(e.eps_estimate)}</td><td>{num(e.eps_actual)}</td><td>{pct(e.eps_surprise)}</td></tr>)}</tbody></table></div> : <div className="seo-empty">Earnings data is pending API connection.</div>}
      <h3>{company} ({symbol}) Earnings Forecast</h3><ResearchText>Earnings forecasts are shown only when verified earnings data is available. The stock-price prediction model is separate from an earnings consensus estimate.</ResearchText>
      <h3>{company} ({symbol}) Dividend & Dividend Yield</h3><ResearchText>Dividend yield, amount, ex-dividend date and payment date are not inferred when the dividend feed is unavailable. A future dividend data connector can populate this section.</ResearchText>
    </Card>

    <Card id="company" eyebrow="COMPANY INFORMATION" title={`${company} (${symbol}) Company Information`}>
      <ResearchText>{company} is covered here using structured company metadata. The page separates company facts from forecasts so readers can distinguish what the company is from what a model estimates about its stock.</ResearchText>
      <MetricGrid items={[
        ['Company', company], ['Ticker', symbol], ['Exchange', stock.exchange ?? '—'],
        ['Sector', stock.sector ?? '—'], ['Industry', stock.industry ?? '—'], ['Market Cap', money(stock.market_cap)]
      ]} />
    </Card>

    <Card id="long-term" eyebrow="LONG-TERM FORECAST" title={`${company} (${symbol}) Long-Term Stock Forecast 2026–2050`}>
      <ResearchText>Long-term search intent is covered with separate year-specific headings so each forecast topic is clear to readers and search engines. US Market AI will show a numerical value only when a dedicated validated long-horizon model supplies it; short-term predictions are not extrapolated into distant years.</ResearchText>

      <h3>{company} ({symbol}) Stock Price Prediction 2026</h3>
      <ResearchText>For {company} ({symbol}) stock price prediction 2026, a dedicated 2026 long-horizon model is required. The current page does not convert a short-term prediction into a 2026 target.</ResearchText>

      <h3>{company} ({symbol}) Stock Price Prediction 2027</h3>
      <ResearchText>For {company} ({symbol}) stock price prediction 2027, US Market AI will display a numerical estimate only when the dedicated 2027 model is validated.</ResearchText>

      <h3>{company} ({symbol}) Stock Price Prediction 2030</h3>
      <ResearchText>For {company} ({symbol}) stock price prediction 2030, a dedicated long-range model is needed. The 7D, 30D or 90D model outputs are not extrapolated into 2030.</ResearchText>

      <h3>{company} ({symbol}) Stock Price Prediction 2035</h3>
      <ResearchText>For {company} ({symbol}) stock price prediction 2035, the page will use a dedicated validated long-horizon model when available rather than inventing a distant price target.</ResearchText>

      <h3>{company} ({symbol}) Stock Price Prediction 2040</h3>
      <ResearchText>For {company} ({symbol}) stock price prediction 2040, any future numerical estimate must come from a dedicated long-range model with documented methodology.</ResearchText>

      <h3>{company} ({symbol}) Stock Price Prediction 2050</h3>
      <ResearchText>For {company} ({symbol}) stock price prediction 2050, US Market AI will not extrapolate short-term data into a distant year. A validated 2050 model is required before publishing a numerical forecast.</ResearchText>
    </Card>
    <Card id="prediction-history" eyebrow="MODEL VALIDATION" title={`${company} (${symbol}) Prediction History & Accuracy`}>
      <ResearchText>Prediction history is kept separate from current forecasts. This lets readers compare matured predictions with later actual prices instead of treating an unevaluated forecast as an accuracy claim.</ResearchText>
      {results?.length ? <div className="seo-data-table"><table><thead><tr><th>Date</th><th>Horizon</th><th>Predicted</th><th>Actual</th><th>Result</th></tr></thead><tbody>{results.map(r => <tr key={r.id}><td>{r.evaluated_at ? new Date(r.evaluated_at).toLocaleDateString('en-US') : '—'}</td><td>{String(r.horizon).toUpperCase()}</td><td>{money(r.predicted_price)}</td><td>{money(r.actual_price)}</td><td>{r.hit ? 'Hit' : 'Miss'}</td></tr>)}</tbody></table></div> : <div className="seo-empty">Prediction history is still building.</div>}
    </Card>

    <Card id="risks" eyebrow="RISK ANALYSIS" title={`${company} (${symbol}) Stock Risks & Risk Analysis`}>
      <ResearchText>Stock research should consider valuation risk, earnings risk, revenue-growth risk, market risk, sector risk, volatility and company-specific events. These are research categories, not predictions that a specific risk will occur.</ResearchText>
      <div className="seo-metric-grid">{['Valuation Risk','Earnings Risk','Revenue Growth Risk','Market Risk','Sector Risk','Volatility Risk','Company-Specific Risk'].map(h => <div className="seo-metric" key={h}><span>{h}</span><strong>Review current data</strong></div>)}</div>
    </Card>

    <Card id="news" eyebrow="NEWS & SENTIMENT" title={`${company} (${symbol}) Stock News & Market Updates`}>
      <ResearchText>The latest ticker-linked news is shown below. Headlines and sentiment are kept separate from the quantitative forecast so a news item is not mistaken for a model prediction.</ResearchText>
      {(news ?? []).length ? <div className="seo-news-list">{news?.map(n => <a href={n.url ?? '#'} target="_blank" rel="noreferrer" key={n.id}><strong>{n.title}</strong><span>{n.source ?? 'Market News'} · {n.published_at ? new Date(n.published_at).toLocaleDateString('en-US') : 'Latest'} · {n.sentiment ?? 'neutral'}</span></a>)}</div> : <div className="seo-empty">No recent ticker-linked news available.</div>}
    </Card>

    <Card id="faq" eyebrow="LONG-TAIL SEO" title={`${company} (${symbol}) Stock FAQ`}>
      {[
        [`What is the current ${symbol} stock price?`, 'See the latest verified quote in the Stock Price section above.'],
        [`What is the ${symbol} stock forecast for 2026?`, 'A dedicated 2026 long-horizon numerical forecast is shown only after that model is validated.'],
        [`What is the ${symbol} stock forecast for 2027?`, 'A dedicated 2027 long-horizon model is required; the 90-day model is not extrapolated to 2027.'],
        [`What is the ${symbol} stock prediction for the next 7 days?`, 'Use the 7D quantitative prediction row when available.'],
        [`What is the ${symbol} price prediction for the next 30 days?`, 'Use the 30D quantitative prediction row when available.'],
        [`What is the long-term ${symbol} stock forecast?`, 'Long-term values depend on a dedicated validated model and are not invented from short-term data.'],
        [`What is the ${symbol} price target?`, 'The price-target section reports available model estimates and does not label them as guaranteed fair value.'],
        [`What is ${symbol} technical analysis showing?`, 'Review RSI, MACD, moving averages, volatility, support and resistance in the Technical Analysis section.'],
        [`What is ${symbol}'s PE ratio?`, 'The current stored PE ratio is displayed in the Valuation section when available.'],
        [`What are ${symbol}'s financials?`, 'Revenue, profit, EPS, free cash flow, ROE and leverage are shown in the Fundamentals section when available.'],
        [`When is ${symbol}'s next earnings date?`, 'The latest stored earnings dates appear in the Earnings section; verify the newest date with the company.'],
        [`Does ${symbol} pay a dividend?`, 'Dividend information is displayed when the dividend feed is connected and verified.'],
        [`Where can I find the latest ${symbol} stock news?`, 'Ticker-linked news is listed in the News & Sentiment section.']
      ].map(([q, a]) => <div className="faq-template-row" key={q}><h3>{q}</h3><p className="seo-prose">{a}</p></div>)}
    </Card>
  </div>;
}
