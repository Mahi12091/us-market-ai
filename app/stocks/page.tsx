import type { Metadata } from 'next';
import Link from 'next/link';
import { createDatabaseClient } from '@/lib/neon';

export const metadata: Metadata = {
  title: 'US Stocks',
  description: 'Browse US-listed stocks with dedicated pages for price, technicals, fundamentals, earnings and AI forecasts.',
};

export default async function StocksPage() {
  const supabase = createDatabaseClient();
  const { data: stocks } = await supabase
    .from('stocks')
    .select('symbol,slug,company_name,sector,industry,exchange,asset_type')
    .eq('is_active', true)
    .eq('is_indexable', true)
    .eq('asset_type', 'stock')
    .order('symbol')
    .limit(3000);

  return (
    <div className="container stocks-page">
      <div className="stocks-shell">
        <section className="page-hero">
          <div className="page-hero-content">
            <div className="eyebrow">US Equities · Research Directory</div>
            <h1>US Stocks</h1>
            <p>Explore US-listed companies through dedicated research pages with market price, technical indicators, fundamentals, earnings, news and quantitative AI forecasts.</p>
            <div className="hero-actions">
              <Link className="blue-btn" href="/markets">Market Overview</Link>
              <Link className="outline-btn" href="/analysis">Latest AI Analysis</Link>
            </div>
          </div>
        </section>

        <section>
          <div className="stocks-toolbar">
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Stock research directory</h2>
              <p className="muted" style={{ margin: '5px 0 0', fontSize: 11 }}>{stocks?.length ?? 0} indexable stock pages currently available</p>
            </div>
            <div className="stocks-filter" aria-label="Stock categories">
              <span className="active">All stocks</span><span>Technology</span><span>Financials</span><span>Healthcare</span><span>Consumer</span>
            </div>
          </div>
        </section>

        {stocks?.length ? (
          <div className="stock-directory">
            {stocks.map((stock) => (
              <Link className="directory-card" href={`/stocks/${stock.slug}`} key={stock.symbol}>
                <div className="directory-top">
                  <div className="ticker-badge">{stock.symbol.length > 6 ? stock.symbol.slice(0, 6) : stock.symbol}</div>
                  <span className="research-badge">RESEARCH</span>
                </div>
                <div className="directory-symbol">{stock.symbol}</div>
                <div className="directory-name">{stock.company_name}</div>
                <div className="directory-meta"><span>{stock.exchange ?? 'US'}</span><span>{stock.sector ?? 'Sector pending'}</span>{stock.industry && <span>{stock.industry}</span>}</div>
                <div className="directory-arrow">→</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-directory"><strong>No stock records yet</strong><p>The market-data import will populate the research directory automatically.</p></div>
        )}
      </div>
    </div>
  );
}
