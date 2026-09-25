import type { Metadata } from 'next';
import Link from 'next/link';
import { createDatabaseClient } from '@/lib/neon';
import './search.css';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Search US Market AI',
  description: 'Search US stocks, companies, sectors, industries and ticker-linked market news across US Market AI.',
  robots: { index: false, follow: true },
};

function cleanQuery(value: string) {
  return value.replace(/[%,]/g, ' ').replace(/_/g, ' ').trim().slice(0, 80);
}

function formatDate(value: string | null) {
  if (!value) return 'Latest';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = cleanQuery(params.q ?? '');
  const supabase = createDatabaseClient();

  let stocks: Array<{ symbol: string; slug: string; company_name: string; sector: string | null; industry: string | null; exchange: string | null }> = [];
  let news: Array<{ id: number; title: string; summary: string | null; url: string | null; source: string | null; published_at: string | null; sentiment: string | null; stock_id: number | null }> = [];

  if (query) {
    const pattern = `%${query}%`;
    const [stockResult, newsResult] = await Promise.all([
      supabase.from('stocks').select('symbol,slug,company_name,sector,industry,exchange').eq('is_active', true).eq('is_indexable', true).eq('asset_type', 'stock').or(`symbol.ilike.${pattern},company_name.ilike.${pattern},sector.ilike.${pattern},industry.ilike.${pattern},exchange.ilike.${pattern}`).order('symbol').limit(60),
      supabase.from('news').select('id,title,summary,url,source,published_at,sentiment,stock_id').or(`title.ilike.${pattern},summary.ilike.${pattern},source.ilike.${pattern}`).order('published_at', { ascending: false, nullsFirst: false }).limit(30),
    ]);
    stocks = Array.isArray(stockResult.data) ? stockResult.data : stockResult.data ? [stockResult.data] : [];
    news = Array.isArray(newsResult.data) ? newsResult.data : newsResult.data ? [newsResult.data] : [];
  }

  const newsStockIds = [...new Set(news.map(item => item.stock_id).filter((id): id is number => id != null))];
  const { data: newsStocks } = newsStockIds.length ? await supabase.from('stocks').select('id,symbol,slug').in('id', newsStockIds) : { data: [] };
  const stockMap = new Map((newsStocks ?? []).map(stock => [stock.id, stock]));

  return (
    <div className="search-page">
      <div className="container search-shell">
        <section className="search-hero">
          <div className="eyebrow">Market intelligence search</div>
          <h1>Search the US market.</h1>
          <p>Search ticker symbols, company names, sectors, industries, exchanges and ticker-linked news from the US Market AI research database.</p>
          <form className="global-search-form" action="/search" method="get">
            <div className="search-input-wrap">
              <span aria-hidden="true">⌕</span>
              <input name="q" defaultValue={query} autoFocus={!query} placeholder="Try AAPL, Apple, semiconductor, technology, Microsoft..." aria-label="Search US Market AI" />
              {query && <Link href="/search" className="clear-search" aria-label="Clear search">×</Link>}
            </div>
            <button type="submit">Search</button>
          </form>
          <div className="search-suggestions">
            {['AAPL', 'NVDA', 'Microsoft', 'Technology', 'Semiconductor'].map(term => <Link key={term} href={`/search?q=${encodeURIComponent(term)}`}>{term}</Link>)}
          </div>
        </section>

        {!query ? (
          <section className="search-empty"><div className="search-empty-icon">⌕</div><h2>Search stocks and market news</h2><p>Use the search above to find companies by ticker or name, discover sectors and industries, or find relevant news stories.</p></section>
        ) : (
          <section className="search-results">
            <div className="search-results-head"><div><div className="eyebrow">Search results</div><h2>Results for “{query}”</h2></div><span>{stocks.length + news.length} matches</span></div>

            <div className="search-result-section">
              <div className="result-section-head"><div><h3>Stocks & companies</h3><p>Matching ticker, company, sector, industry or exchange.</p></div><b>{stocks.length}</b></div>
              {stocks.length ? <div className="search-stock-grid">{stocks.map(stock => <Link href={`/stocks/${stock.slug}`} className="search-stock-card" key={stock.symbol}><div className="search-stock-top"><span>{stock.symbol}</span><small>{stock.exchange ?? 'US'}</small></div><h4>{stock.company_name}</h4><p>{stock.sector ?? 'Sector pending'}{stock.industry ? ` · ${stock.industry}` : ''}</p><strong>View research →</strong></Link>)}</div> : <div className="no-results">No stock or company matched this search.</div>}
            </div>

            <div className="search-result-section">
              <div className="result-section-head"><div><h3>Market news</h3><p>Matching stories stored by the ticker-linked news pipeline.</p></div><b>{news.length}</b></div>
              {news.length ? <div className="search-news-list">{news.map(item => { const stock = item.stock_id ? stockMap.get(item.stock_id) : null; const href = item.url ?? (stock ? `/stocks/${stock.slug}#news` : '/news'); return <a href={href} target={item.url ? '_blank' : undefined} rel={item.url ? 'noreferrer' : undefined} className="search-news-card" key={item.id}><div><div className="search-news-meta">{stock?.symbol ?? 'MARKET'} · {item.source ?? 'Market News'} · {formatDate(item.published_at)}</div><h4>{item.title}</h4><p>{item.summary ?? 'Open the story for the full market update.'}</p></div><span>↗</span></a>; })}</div> : <div className="no-results">No matching market news was found.</div>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
