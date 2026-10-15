import type { Metadata } from 'next';
import Link from 'next/link';
import { createDatabaseClient } from '@/lib/neon';
import { filterCommonEquityRows } from '@/lib/stock-universe';

type StocksSearchParams = { page?: string; sector?: string };
const getPageNumber = (value?: string) => {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1000 ? parsed : 1;
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<StocksSearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const page = getPageNumber(params.page);
  const sector = (params.sector ?? '').trim();
  const query = new URLSearchParams();
  if (sector) query.set('sector', sector);
  if (page > 1) query.set('page', String(page));
  const canonical = `/stocks${query.size ? `?${query.toString()}` : ''}`;
  const title = sector
    ? `${sector} Stocks Directory${page > 1 ? ` – Page ${page}` : ''}`
    : `US Stocks: Company Directory & Research${page > 1 ? ` – Page ${page}` : ''}`;
  const description = sector
    ? `Browse tracked ${sector} stocks with company classifications and links to available research${page > 1 ? ` (page ${page})` : ''}. Missing data is not estimated.`
    : `Browse US-listed companies through available company profiles, market data, fundamentals and quantitative research${page > 1 ? ` (page ${page})` : ''}.`;
  return {
    title, description,
    alternates: { canonical },
    openGraph: { title, description, url: `https://usmarketai.com${canonical}`, siteName: 'US Market AI', type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

const PAGE_SIZE = 100;

type StocksSearchParams = { page?: string; sector?: string };
type DirectoryStock = { symbol: string; slug: string | null; company_name: string; sector: string | null; industry: string | null; exchange: string | null; asset_type: string | null };

export default async function StocksPage({ searchParams }: { searchParams: Promise<StocksSearchParams> }) {
  const params = await searchParams;
  const page = getPageNumber(params.page);
  const sector = (params.sector ?? '').trim();
  const supabase = createDatabaseClient();
  let query = supabase
    .from('stocks')
    .select('symbol,slug,company_name,sector,industry,exchange,asset_type')
    .eq('is_active', true)
    .eq('is_indexable', true)
    .eq('asset_type', 'stock');
  if (sector) query = query.eq('sector', sector);
  const { data: pageRows, error } = await query
    .order('symbol')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (error) console.error('[stocks] Directory query failed:', error.message);
  const fetchedRows = filterCommonEquityRows((pageRows ?? []) as DirectoryStock[]);
  const hasNextPage = (pageRows ?? []).length > PAGE_SIZE;
  const stocks = fetchedRows.slice(0, PAGE_SIZE).filter((stock) => Boolean(stock.slug?.trim()));
  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams();
    query.set('page', String(nextPage));
    if (sector) query.set('sector', sector);
    return `/stocks?${query.toString()}`;
  };

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
              <p className="muted" style={{ margin: '5px 0 0', fontSize: 11 }}>Showing {stocks.length} stock pages · Page {page}</p>
            </div>
            <nav className="stocks-filter" aria-label="Stock categories">
              <Link className={!sector ? 'active' : ''} href="/stocks?page=1">All stocks</Link>
              <Link className={sector === 'Technology' ? 'active' : ''} href="/stocks?sector=Technology&page=1">Technology</Link>
              <Link className={sector === 'Financial Services' ? 'active' : ''} href="/stocks?sector=Financial%20Services&page=1">Financials</Link>
              <Link className={sector === 'Healthcare' ? 'active' : ''} href="/stocks?sector=Healthcare&page=1">Healthcare</Link>
              <Link className={sector === 'Consumer' ? 'active' : ''} href="/stocks?sector=Consumer&page=1">Consumer</Link>
            </nav>
          </div>
        </section>

        {stocks.length ? (
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
          <div className="empty-directory"><strong>No stock records found</strong><p>{sector ? `No indexable stocks are currently listed in the ${sector} sector.` : 'No indexable stock records are available right now.'}</p></div>
        )}
        <nav className="stocks-pagination" aria-label="Stock directory pages">
          {page > 1 ? <Link className="outline-btn" href={pageHref(page - 1)}>← Previous</Link> : <span />}
          <span>Page {page}</span>
          {hasNextPage ? <Link className="blue-btn" href={pageHref(page + 1)}>Next →</Link> : <span />}
        </nav>
      </div>
    </div>
  );
}
