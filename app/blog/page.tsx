import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import './blog.css';

export const metadata: Metadata = {
  title: 'Stock Price Predictions 2026–2050',
  description: 'Explore US stock price prediction research, long-term forecast methodology, quantitative signals and links to live stock intelligence.',
  alternates: { canonical: '/blog' },
};

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: stocks } = await supabase
    .from('stocks')
    .select('symbol,slug,company_name,sector,industry')
    .eq('is_active', true)
    .eq('is_indexable', true)
    .order('market_cap', { ascending: false })
    .limit(24);

  return <main className="blog-page">
    <div className="container">
      <section className="blog-hero">
        <div className="eyebrow">US MARKET AI · FORECAST RESEARCH</div>
        <h1>Stock Price Predictions <span>2026–2050</span></h1>
        <p>Long-term forecast research connecting quantitative predictions, technicals, fundamentals, historical validation and live stock intelligence.</p>
        <div className="blog-actions"><a className="button primary" href="/predictions">Explore AI Predictions →</a><a className="button" href="/stocks">Browse US Stocks</a></div>
      </section>

      <section className="blog-principles">
        <article><b>Quantitative first</b><span>Forecast values come from the prediction engine, not invented article copy.</span></article>
        <article><b>Historical validation</b><span>Previous forecasts can be compared with actual prices as evaluations become available.</span></article>
        <article><b>Connected research</b><span>Every forecast is designed to link naturally to its underlying stock page and related companies.</span></article>
      </section>

      <section className="blog-directory">
        <div className="section-head"><div><div className="eyebrow">FORECAST LIBRARY</div><h2>Stock forecast research</h2><p className="muted">Forecast articles appear as validated model outputs become available.</p></div></div>
        <div className="blog-stock-grid">
          {(stocks ?? []).map((stock) => <a className="blog-stock-card" href={`/blog/${stock.slug}-stock-price-prediction-2026-2050`} key={stock.symbol}>
            <div className="stock-logo">{stock.symbol.slice(0, 1)}</div>
            <div><small>{stock.symbol} · {stock.sector || stock.industry || 'US market'}</small><h3>{stock.company_name} Stock Price Prediction 2026–2050</h3><span>Open forecast research →</span></div>
          </a>)}
        </div>
      </section>

      <section className="blog-methodology">
        <div><div className="eyebrow">METHODOLOGY</div><h2>Forecasts should be measurable, not mysterious.</h2></div>
        <div className="method-grid"><span>Price &amp; volume history</span><span>Technical indicators</span><span>Fundamentals &amp; earnings</span><span>Market &amp; sector context</span><span>News &amp; sentiment</span><span>Prediction evaluation</span></div>
      </section>

      <div className="blog-disclaimer">Forecasts are estimates generated from available data and models. They are not financial advice and are not guarantees of future performance.</div>
    </div>
  </main>;
}
