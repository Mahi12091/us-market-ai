type Props = {
  stock: any;
  quote: any;
  tech: any;
  predictions: any[] | null;
  fundamentals: any;
  earnings: any[] | null;
  news: any[] | null;
  results: any[] | null;
};

const money = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const num = (v: any) => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const pct = (v: any) => v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

function AI({ children }: { children: React.ReactNode }) {
  return <div className="ai-placeholder"><span className="ai-badge">AI CONTENT</span><p>{children}</p></div>;
}

function Card({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="seo-card" id={id}><div className="seo-card-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div></div>{children}</section>;
}

export default function StockSeoContent({ stock, quote, tech, predictions, fundamentals, earnings, news, results }: Props) {
  const symbol = stock.symbol;
  const company = stock.company_name;

  return <div className="seo-research-stack">

<Card id="stock-price" eyebrow="STOCK / PRICE" title={`${symbol} Stock Price`}>
      <AI>Write a unique, data-driven explanation of the current {symbol} stock price, today's movement, trading volume, previous close and recent performance using only verified quote and price-history data.</AI>
      <div className="seo-metric-grid">
        {[['Current Price', money(quote?.price)], ['Open', money(quote?.open)], ['Day High', money(quote?.high)], ['Day Low', money(quote?.low)], ['Previous Close', money(quote?.previous_close)], ['Volume', quote?.volume ? Number(quote.volume).toLocaleString() : '—']].map(([k,v]) => <div className="seo-metric" key={k}><span>{k}</span><strong>{v}</strong></div>)}
      </div>
      <h3>{symbol} Stock Today</h3>
      <AI>Explain what is happening with {symbol} stock today using the latest verified price, percentage change, volume and market context. Do not invent intraday events.</AI>
      <h3>{symbol} Share Price</h3>
      <AI>Explain the latest {symbol} share price and how it compares with the recent trading range.</AI>
    </Card>

<Card id="prediction-forecast" eyebrow="PREDICTION & FORECAST" title={`${symbol} Stock Prediction & Forecast`}>
      <AI>Generate a unique forecast explanation for {symbol} using the quantitative model outputs supplied to the AI. Explain 7-day, 30-day and available longer-horizon context. Never invent a forecast value.</AI>
      <div className="seo-forecast-grid">{(predictions ?? []).map(p => <div className="seo-forecast-card" key={p.id}><span>{String(p.horizon).toUpperCase()}</span><strong>{money(p.predicted_price)}</strong><small>{pct(p.predicted_change_percent)} · {p.direction ?? p.signal ?? 'model output'}</small></div>)}</div>
      <h3>{symbol} Stock Forecast Next 7 Days</h3><AI>Explain the verified 7-day quantitative output and the technical/model factors behind it.</AI>
      <h3>{symbol} Stock Forecast Next 30 Days</h3><AI>Explain the verified 30-day quantitative output and the uncertainty of a longer horizon.</AI>
      <h3>{symbol} Stock Forecast This Week</h3><AI>Translate the current short-horizon model into a concise weekly research explanation without adding unsupported numbers.</AI>
      <h3>{symbol} Stock Forecast This Month</h3><AI>Explain the monthly model outlook from supplied data.</AI>
      <h3>{symbol} Stock Forecast 2026</h3><AI>Write only after a validated long-horizon 2026 model is connected. Until then, explicitly say the long-horizon numerical forecast is pending.</AI>
      <h3>{symbol} Stock Forecast 2027</h3><AI>Write only from a validated 2027 model/data source. Do not extrapolate the 90-day model as a 2027 target.</AI>
      <h3>Long Term {symbol} Stock Forecast</h3><AI>Explain long-term drivers, assumptions and uncertainty only from supplied validated data.</AI>
    </Card>

<Card id="prediction-details" eyebrow="QUANTITATIVE MODEL" title={`${symbol} Prediction Details`}>
      <AI>Write unique explanations for today's, 7-day and 30-day predictions using the model output and supporting indicators. Clearly call them estimates, not guarantees.</AI>
      <h3>{symbol} Stock Prediction Today</h3><AI>Explain the latest short-term model direction and confidence from supplied data.</AI>
      <h3>{symbol} Stock Prediction Next 7 Days</h3><AI>Explain the 7-day model output and the strongest contributing signals.</AI>
      <h3>{symbol} Stock Prediction Next 30 Days</h3><AI>Explain the 30-day model output and additional uncertainty.</AI>
      <h3>{symbol} Price Prediction</h3><AI>Explain the current model-implied price estimate/range without creating a new number.</AI>
      <h3>{symbol} Future Stock Price</h3><AI>Explain future-price scenarios only where validated model outputs exist.</AI>
      <h3>{symbol} Future Stock Price Prediction</h3><AI>Summarize the model's available future-price estimates and limitations.</AI>
    </Card>

<Card id="price-target" eyebrow="PRICE TARGET" title={`${symbol} Price Target`}>
      <AI>Explain the model-derived target using only the supplied forecast values. Distinguish it from analyst consensus and never call it guaranteed.</AI>
      <div className="seo-metric-grid">{(predictions ?? []).map(p => <div className="seo-metric" key={`target-${p.id}`}><span>{String(p.horizon).toUpperCase()} estimate</span><strong>{money(p.predicted_price)}</strong></div>)}</div>
    </Card>

<Card id="technical-analysis" eyebrow="TECHNICAL ANALYSIS" title={`${symbol} Technical Analysis`}>
      <AI>Write a complete technical-analysis overview using the actual indicator values below. Explain momentum, trend, volatility and key levels without inventing signals.</AI>
      <div className="seo-data-table"><table><tbody>{[['RSI', tech?.rsi], ['MACD', tech?.macd], ['SMA 50', tech?.sma_50], ['SMA 200', tech?.sma_200], ['EMA 20', tech?.ema_20], ['ATR', tech?.atr], ['ADX', tech?.adx], ['Volatility', tech?.volatility], ['Bollinger Upper', tech?.bollinger_upper], ['Stochastic', tech?.stochastic], ['Support', tech?.support_level], ['Resistance', tech?.resistance_level]].map(([k,v]) => <tr key={String(k)}><th>{k}</th><td>{num(v)}</td></tr>)}</tbody></table></div>
      {['RSI','MACD','Moving Average','50 Day Moving Average','200 Day Moving Average','Support and Resistance Levels'].map(h => <div key={h}><h3>{symbol} {h}</h3><AI>Write a stock-specific explanation of {symbol}'s {h} using the supplied technical values. Mention the actual value when available and explain what it means in context.</AI></div>)}
    </Card>

<Card id="financials" eyebrow="FUNDAMENTALS" title={`${symbol} Financials`}>
      <AI>Write a comprehensive fundamental overview covering revenue, revenue growth, profit, free cash flow, EPS, EPS growth and ROE using only verified financial data.</AI>
      {fundamentals ? <div className="seo-data-table"><table><tbody>{[['Revenue',money(fundamentals.revenue)],['Revenue Growth',pct(fundamentals.revenue_growth)],['Gross Profit',money(fundamentals.gross_profit)],['Operating Income',money(fundamentals.operating_income)],['Net Income',money(fundamentals.net_income)],['EPS',num(fundamentals.eps)],['EPS Growth',pct(fundamentals.eps_growth)],['ROE',pct(fundamentals.roe)],['Free Cash Flow',money(fundamentals.free_cash_flow)],['Debt / Equity',num(fundamentals.debt_equity)]].map(([k,v]) => <tr key={String(k)}><th>{k}</th><td>{v}</td></tr>)}</tbody></table></div> : <div className="seo-empty">Fundamentals data is pending API connection.</div>}
      {['Revenue','Revenue Growth','Profit','Free Cash Flow','EPS','EPS Growth','ROE'].map(h => <div key={h}><h3>{symbol} {h}</h3><AI>Write a detailed {symbol} {h.toLowerCase()} explanation from the verified fundamentals snapshot. If data is unavailable, say so rather than estimating.</AI></div>)}
    </Card>

<Card id="valuation" eyebrow="VALUATION" title={`${symbol} Valuation`}>
      <AI>Explain {symbol}'s valuation using P/E, forward P/E, PEG, price/sales, price/book, enterprise value and market cap when verified data is available.</AI>
      {fundamentals ? <div className="seo-data-table"><table><tbody>{[['P/E Ratio',num(fundamentals.pe_ratio)],['Forward P/E',num(fundamentals.forward_pe)],['PEG Ratio',num(fundamentals.peg_ratio)],['Price / Sales',num(fundamentals.price_sales)],['Price / Book',num(fundamentals.price_book)],['Enterprise Value',money(fundamentals.enterprise_value)],['Market Cap',money(fundamentals.market_cap ?? stock.market_cap)]].map(([k,v]) => <tr key={String(k)}><th>{k}</th><td>{v}</td></tr>)}</tbody></table></div> : <div className="seo-empty">Valuation data is pending fundamentals ingestion.</div>}
      {['PE Ratio','Forward PE','Stock Valuation','Fair Value'].map(h => <div key={h}><h3>{symbol} {h}</h3><AI>Write a stock-specific {symbol} {h.toLowerCase()} explanation from verified data and clearly state the methodology or data source. Do not invent fair value.</AI></div>)}
    </Card>

<Card id="earnings" eyebrow="EARNINGS" title={`${symbol} Earnings`}>
      <AI>Write an earnings overview using verified earnings dates, EPS estimates/actuals, revenue estimates/actuals and surprises. Never invent an earnings date or estimate.</AI>
      {(earnings ?? []).length ? <div className="seo-data-table"><table><thead><tr><th>Date</th><th>EPS Estimate</th><th>EPS Actual</th><th>EPS Surprise</th></tr></thead><tbody>{earnings?.map(e => <tr key={e.id}><td>{e.earnings_date ? new Date(e.earnings_date).toLocaleDateString('en-US') : '—'}</td><td>{num(e.eps_estimate)}</td><td>{num(e.eps_actual)}</td><td>{pct(e.eps_surprise)}</td></tr>)}</tbody></table></div> : <div className="seo-empty">Earnings data is pending API connection.</div>}
      {['Earnings Date','Earnings Results','Earnings Forecast','EPS Estimate','Revenue Estimate','Earnings Analysis'].map(h => <div key={h}><h3>{symbol} {h}</h3><AI>Write a detailed {symbol} {h.toLowerCase()} explanation using only verified earnings data.</AI></div>)}
    </Card>

<Card id="dividend" eyebrow="DIVIDEND" title={`${symbol} Dividend`}>
      <AI>Write the dividend section from verified dividend yield, payment amount, ex-dividend date, payment date and dividend history once the dividend API is connected. Do not infer missing dividend data.</AI>
      <div className="seo-empty">Dividend history and dates: API connection pending.</div>
    </Card>

<Card id="financial-statements" eyebrow="FINANCIAL STATEMENTS" title={`${symbol} Income Statement, Balance Sheet, Debt & EPS`}>
      <h3>{symbol} Income Statement</h3><AI>Explain the verified income statement: revenue, gross profit, operating income, net income and EPS.</AI>
      <h3>{symbol} Balance Sheet</h3><AI>Explain verified assets, liabilities, cash, debt and shareholders' equity.</AI>
      <h3>{symbol} Debt</h3><AI>Explain debt, cash, debt/equity and leverage from verified fundamentals.</AI>
      <h3>{symbol} EPS</h3><AI>Explain EPS and EPS growth using verified financial data.</AI>
    </Card>

<Card id="company" eyebrow="COMPANY INFORMATION" title={`About ${company}`}>
      <AI>Write a unique company overview from verified company metadata: business description, sector, industry, exchange, headquarters, founding year and other available facts.</AI>
      <div className="seo-metric-grid"><div className="seo-metric"><span>Company</span><strong>{company}</strong></div><div className="seo-metric"><span>Ticker</span><strong>{symbol}</strong></div><div className="seo-metric"><span>Exchange</span><strong>{stock.exchange ?? '—'}</strong></div><div className="seo-metric"><span>Sector</span><strong>{stock.sector ?? '—'}</strong></div><div className="seo-metric"><span>Industry</span><strong>{stock.industry ?? '—'}</strong></div></div>
    </Card>

<Card id="analysis" eyebrow="AI RESEARCH" title={`${symbol} Stock Analysis`}>
      <AI>Generate 300–500 words of unique {symbol} stock analysis combining current price action, technicals, fundamentals, valuation, earnings, news sentiment and quantitative forecasts. Use only supplied verified data.</AI>
      {['Current Market Position','What Is Driving '+symbol+'?','Key Positive Signals','Key Risk Signals','Overall Quantitative Outlook'].map(h => <div key={h}><h3>{h}</h3><AI>Write a stock-specific paragraph for {symbol} based only on the verified data snapshot.</AI></div>)}
    </Card>

<Card id="ai-market-analysis" eyebrow="AI MARKET ANALYSIS" title={`${symbol} Market Outlook`}>
      <AI>Generate the main 500–700 word unique AI market analysis using the complete verified data snapshot: price, technicals, fundamentals, valuation, earnings, news, sentiment, predictions and market context.</AI>
      {['Current Market Position','Technical Picture','Fundamental Picture','Earnings & Business Performance','Valuation','News & Market Sentiment','Forecast Drivers','Key Risks','Overall Outlook'].map(h => <div key={h}><h3>{h}</h3><AI>Write this subsection specifically for {symbol} from supplied verified data.</AI></div>)}
    </Card>

<Card id="long-term" eyebrow="LONG-TERM FORECAST" title={`${symbol} Long-Term Stock Forecast`}>
      <AI>Generate long-term forecast commentary only after a dedicated validated long-horizon model is connected. Do not convert 90-day predictions into 2026–2050 targets.</AI>
      {['2026','2027','2030','2035','2040','2050'].map(y => <div key={y}><h3>{symbol} Stock Forecast {y}</h3><AI>Write the {y} forecast section from validated long-horizon model output. If unavailable, state that the forecast is pending.</AI></div>)}
    </Card>

<Card id="prediction-history" eyebrow="MODEL VALIDATION" title={`${symbol} Prediction History & Accuracy`}>
      <AI>Write a transparent explanation of model performance from matured prediction results. Never claim an accuracy percentage without enough evaluated observations.</AI>
      {results?.length ? <div className="seo-data-table"><table><thead><tr><th>Date</th><th>Horizon</th><th>Predicted</th><th>Actual</th><th>Result</th></tr></thead><tbody>{results.map(r => <tr key={r.id}><td>{r.evaluated_at ? new Date(r.evaluated_at).toLocaleDateString('en-US') : '—'}</td><td>{String(r.horizon).toUpperCase()}</td><td>{money(r.predicted_price)}</td><td>{money(r.actual_price)}</td><td>{r.hit ? 'Hit' : 'Miss'}</td></tr>)}</tbody></table></div> : <div className="seo-empty">Prediction history is still building.</div>}
    </Card>

<Card id="risks" eyebrow="RISK ANALYSIS" title={`${symbol} Stock Risks`}>
      {['Valuation Risk','Earnings Risk','Revenue Growth Risk','Market Risk','Sector Risk','Volatility Risk','Company-Specific Risk'].map(h => <div key={h}><h3>{h}</h3><AI>Write a stock-specific risk explanation using verified data. Avoid generic filler and do not make unsupported claims.</AI></div>)}
    </Card>

<Card id="news" eyebrow="NEWS & SENTIMENT" title={`${symbol} Stock News`}>
      <AI>Write a concise stock-specific news and sentiment synthesis from the latest ticker-associated articles. Do not invent events or attribute claims not present in the supplied news.</AI>
      {(news ?? []).length ? <div className="seo-news-list">{news?.map(n => <a href={n.url ?? '#'} target="_blank" rel="noreferrer" key={n.id}><strong>{n.title}</strong><span>{n.source ?? 'Market News'} · {n.published_at ? new Date(n.published_at).toLocaleDateString('en-US') : 'Latest'} · {n.sentiment ?? 'neutral'}</span></a>)}</div> : <div className="seo-empty">No recent ticker-linked news available.</div>}
    </Card>

<Card id="related-stocks" eyebrow="INTERNAL RESEARCH" title="Related Stocks">
      <AI>Write a short explanation of why the selected related stocks are relevant using sector, industry and market-cap relationships.</AI>
    </Card>

<Card id="faq" eyebrow="LONG-TAIL SEO" title={`${symbol} Stock FAQ`}>
      {[
        `What is the current ${symbol} stock price?`, `What is the ${symbol} stock forecast for 2026?`, `What is the ${symbol} stock forecast for 2027?`, `What is the ${symbol} stock prediction for the next 7 days?`, `What is the ${symbol} price prediction for the next 30 days?`, `What is the long-term ${symbol} stock forecast?`, `What is the ${symbol} price target?`, `What is ${symbol} technical analysis showing?`, `What is ${symbol}'s RSI?`, `What is ${symbol}'s MACD?`, `What are ${symbol}'s support and resistance levels?`, `What is ${symbol}'s PE ratio?`, `What is ${symbol}'s forward PE?`, `What are ${symbol}'s financials?`, `What is ${symbol}'s revenue?`, `What is ${symbol}'s revenue growth?`, `What is ${symbol}'s EPS?`, `What is ${symbol}'s free cash flow?`, `What is ${symbol}'s ROE?`, `What is ${symbol}'s market cap?`, `What is ${symbol}'s debt?`, `When is ${symbol}'s next earnings date?`, `What are ${symbol}'s latest earnings results?`, `Does ${symbol} pay a dividend?`, `What is ${symbol}'s 52-week high?`, `Where can I find the latest ${symbol} stock news?`
      ].map(q => <div className="faq-template-row" key={q}><h3>{q}</h3><AI>Write a concise, direct answer using the current verified data snapshot. If the requested data is unavailable, say so.</AI></div>)}
    </Card>

<Card id="disclaimer" eyebrow="RESEARCH NOTE" title={`${symbol} Stock Forecast Disclaimer`}>
      <p className="seo-prose">US Market AI forecasts and AI-generated analysis are estimates based on available market data and quantitative models. They are not guaranteed and are not personalized financial advice.</p>
    </Card>
="disclaimer" eyebrow="RESEARCH NOTE" title={`${symbol} Stock Forecast Disclaimer`}>
      <p className="seo-prose">US Market AI forecasts and AI-generated analysis are estimates based on available market data and quantitative models. They are not guaranteed and are not personalized financial advice.</p>
    </Card>
  </div>;
}
