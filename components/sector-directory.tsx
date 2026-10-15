import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createDatabaseClient } from '@/lib/neon';
import { filterCommonEquityRows } from '@/lib/stock-universe';

type Stock = Record<string, any>;
export const slugify = (v: string) => v.toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const money = (v: any) => v == null || !Number.isFinite(Number(v)) ? 'Not available' : '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });

const sectorDescriptions: Record<string, string> = {
  'Technology': 'Software, semiconductors, hardware and digital infrastructure shaping how businesses and consumers work.',
  'Information Technology': 'Software, semiconductor, IT services and hardware companies powering the digital economy.',
  'Financial Services': 'Banks, insurers, payment networks, asset managers and other companies that support capital markets.',
  'Healthcare': 'Healthcare providers, medical technology, services and businesses developing treatments and diagnostics.',
  'Health Care': 'Healthcare providers, medical technology, services and businesses developing treatments and diagnostics.',
  'Consumer Cyclical': 'Retail, travel, vehicles and other businesses whose demand often moves with consumer spending.',
  'Consumer Defensive': 'Everyday essentials such as food, household products and staples-focused retailers.',
  'Communication Services': 'Telecom, media, entertainment and internet platforms connecting audiences and businesses.',
  'Industrials': 'Manufacturing, transportation, aerospace, logistics and business services.',
  'Energy': 'Oil, gas, energy services and other companies tied to energy production and infrastructure.',
  'Basic Materials': 'Chemicals, metals, mining, construction materials and other resource-linked businesses.',
  'Materials': 'Chemicals, metals, mining, construction materials and other resource-linked businesses.',
  'Real Estate': 'Property owners, developers and real estate investment trusts across commercial and residential markets.',
  'Utilities': 'Electricity, gas and water providers that operate essential infrastructure.',
};

function describeSector(name: string) {
  return sectorDescriptions[name] ?? `Explore publicly traded companies classified in the ${name} sector, compare available company data and continue to individual stock research.`;
}

export async function SectorDirectory() {
  const db = createDatabaseClient();
  const { data } = await db.from('stocks').select('id,symbol,slug,company_name,sector,industry,exchange,market_cap').eq('is_active', true).eq('is_indexable', true).eq('asset_type', 'stock').limit(6000);
  const stocks: Stock[] = filterCommonEquityRows((Array.isArray(data) ? data : []) as Stock[]);
  const groups = new Map<string, Stock[]>();
  const industries = new Map<string, Stock[]>();
  let classifiedStocks = 0;
  let marketCapAvailable = 0;

  for (const stock of stocks) {
    const sector = String(stock.sector ?? '').trim();
    const industry = String(stock.industry ?? '').trim();
    if (sector && !['other', 'unknown'].includes(sector.toLowerCase())) {
      groups.set(sector, [...(groups.get(sector) ?? []), stock]);
      classifiedStocks += 1;
    }
    if (industry && !['other', 'unknown'].includes(industry.toLowerCase())) {
      industries.set(industry, [...(industries.get(industry) ?? []), stock]);
    }
    if (stock.market_cap != null && Number.isFinite(Number(stock.market_cap))) marketCapAvailable += 1;
  }

  const sectors = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const industryRows = [...industries.entries()].sort((a, b) => b[1].length - a[1].length);
  const largestSector = sectors[0];
  const totalCompanies = stocks.length.toLocaleString('en-US');
  const sectorCount = sectors.length.toLocaleString('en-US');
  const industryCount = industryRows.length.toLocaleString('en-US');

  return (
    <main className="container research-category sector-directory">
      <nav className="sd-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span>›</span><b>US Stock Sectors</b>
      </nav>

      <section className="page-hero sector-directory-hero">
        <div className="page-hero-content">
          <div className="eyebrow">US EQUITIES · SECTOR & INDUSTRY DIRECTORY</div>
          <h1>Explore US Stocks by Sector</h1>
          <p>Navigate the US equity market from broad sectors to individual companies. Compare the size of each group, discover industry categories and open dedicated stock research pages with available market data, fundamentals and analysis.</p>
          <div className="hero-actions">
            <Link className="blue-btn" href="/stocks">Browse all US stocks <span aria-hidden="true">→</span></Link>
            <Link className="outline-btn" href="/screener">Build a stock screen <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="sd-hero-note"><span className="sd-live-dot" /> Directory built from available company classifications <span>·</span> Market data availability varies by stock</div>
        </div>
        <div className="sd-hero-side" aria-hidden="true">
          <div className="sd-orbit sd-orbit-one" />
          <div className="sd-orbit sd-orbit-two" />
          <div className="sd-hero-mini"><span>MARKET MAP</span><strong>{sectorCount}</strong><small>sector groups</small><div className="sd-mini-bars"><i/><i/><i/><i/><i/><i/><i/></div></div>
          <div className="sd-floating-chip sd-chip-top">US EQUITIES</div>
          <div className="sd-floating-chip sd-chip-bottom">SECTOR → INDUSTRY → STOCK</div>
        </div>
      </section>

      <section className="sd-stat-grid" aria-label="Directory overview">
        <div className="sd-stat-card"><span className="sd-stat-icon">◫</span><div><strong>{totalCompanies}</strong><span>Stock records covered</span><small>Active, indexable US stocks</small></div></div>
        <div className="sd-stat-card"><span className="sd-stat-icon">▦</span><div><strong>{sectorCount}</strong><span>Sector groups</span><small>Based on stored company data</small></div></div>
        <div className="sd-stat-card"><span className="sd-stat-icon">⌘</span><div><strong>{industryCount}</strong><span>Industry categories</span><small>Across the tracked universe</small></div></div>
        <div className="sd-stat-card"><span className="sd-stat-icon">$</span><div><strong>{marketCapAvailable.toLocaleString('en-US')}</strong><span>With market cap data</span><small>Availability varies by source</small></div></div>
      </section>

      <section className="sd-directory-section">
        <div className="sd-section-heading">
          <div><span className="sd-kicker">01 / SECTOR MAP</span><h2>Explore the market by sector</h2><p>Start with a broad market group, see how many companies are covered, then drill into its stock list.</p></div>
          <span className="sd-section-count">{sectorCount} sectors</span>
        </div>
        {largestSector && <div className="sd-leading-sector">
          <div><span className="sd-leading-label">LARGEST GROUP BY STOCK COUNT</span><h3>{largestSector[0]}</h3><p>{describeSector(largestSector[0])}</p></div>
          <div className="sd-leading-number"><strong>{largestSector[1].length.toLocaleString('en-US')}</strong><span>stocks covered</span><Link href={'/sectors/' + slugify(largestSector[0])}>Explore sector →</Link></div>
        </div>}
        <div className="sector-card-grid">
          {sectors.map(([name, items], index) => {
            const top = [...items].filter(s => s.market_cap != null && Number.isFinite(Number(s.market_cap))).sort((a, b) => Number(b.market_cap) - Number(a.market_cap))[0];
            const industryCountForSector = new Set(items.map(s => String(s.industry ?? '').trim()).filter(Boolean)).size;
            return <Link className="sector-feature-card" href={'/sectors/' + slugify(name)} key={name}>
              <div className="sector-feature-top"><span className="sector-icon">{name.slice(0, 1).toUpperCase()}</span><span className="sector-count">{items.length.toLocaleString('en-US')} stocks</span></div>
              <span className="sd-sector-index">SECTOR {String(index + 1).padStart(2, '0')}</span>
              <h3>{name}</h3>
              <p className="sd-sector-description">{describeSector(name)}</p>
              <div className="sd-sector-metrics"><span><strong>{industryCountForSector.toLocaleString('en-US')}</strong> industries</span><span><strong>{items.filter(s => s.market_cap != null).length.toLocaleString('en-US')}</strong> with market cap</span></div>
              <div className="sector-feature-bottom"><span>Largest available market cap</span><strong>{top ? <>{top.symbol} <span className="sd-market-cap">· {money(top.market_cap)}</span></> : 'Not available'}</strong></div>
              <b className="research-open">Explore sector <span aria-hidden="true">→</span></b>
            </Link>;
          })}
        </div>
      </section>

      <section className="sd-directory-section sd-industry-section">
        <div className="sd-section-heading">
          <div><span className="sd-kicker">02 / INDUSTRY DIRECTORY</span><h2>Browse companies by industry</h2><p>Looking for a more specific business category? Explore the industry directory and open its company list.</p></div>
          <span className="sd-section-count">{industryCount} industries</span>
        </div>
        {industryRows.length ? <div className="sd-industry-grid">
          {industryRows.map(([name, items]) => {
            const sectorNames = [...new Set(items.map(s => String(s.sector ?? '').trim()).filter(s => s && !['other', 'unknown'].includes(s.toLowerCase())))];
            return <Link href={'/industries/' + slugify(name)} className="sd-industry-card" key={name}>
              <span className="sd-industry-icon">{name.slice(0, 1).toUpperCase()}</span>
              <span className="sd-industry-main"><strong>{name}</strong><small>{sectorNames.length ? sectorNames.slice(0, 2).join(' · ') : 'Industry classification'}</small></span>
              <span className="sd-industry-count">{items.length.toLocaleString('en-US')} <small>stocks</small></span>
              <span className="sd-industry-arrow" aria-hidden="true">↗</span>
            </Link>;
          })}
        </div> : <div className="research-empty"><p>Industry categories are not available in the current data set.</p></div>}
      </section>

      <section className="sd-how-it-works">
        <div className="sd-how-icon">⌕</div>
        <div><span className="sd-kicker">HOW TO USE THIS DIRECTORY</span><h2>From market overview to company research</h2><p>Choose a sector or industry to view its listed companies. From there, open a ticker to review available price history, fundamentals, technical indicators, earnings, news and model-based research. Data coverage differs across companies, so unavailable values are not treated as confirmed facts.</p></div>
        <Link href="/stocks">Find a company <span aria-hidden="true">→</span></Link>
      </section>

      <div className="sd-data-note"><strong>Explore with context</strong><p>Browse companies by sector and industry, then open a stock profile for more detail. Market data and company information may vary in coverage and update time.</p></div>
    </main>
  );
}

export async function SectorStocksPage({slug,kind='sector'}:{slug:string;kind?:'sector'|'industry'}){const db=createDatabaseClient();const {data}=await db.from('stocks').select('id,symbol,slug,company_name,sector,industry,exchange,market_cap').eq('is_active',true).eq('is_indexable',true).eq('asset_type','stock').limit(6000);const all:Stock[]=filterCommonEquityRows((Array.isArray(data)?data:[]) as Stock[]);const rows=all.filter(s=>slugify(String(kind==='sector'?s.sector??'':s.industry??''))===slug&&(kind!=='sector'||String(s.sector??'').toLowerCase()!=='other')).sort((a,b)=>Number(b.market_cap??0)-Number(a.market_cap??0));const label=(kind==='sector'?rows[0]?.sector:rows[0]?.industry)??slug.split('-').map(x=>x[0]?.toUpperCase()+x.slice(1)).join(' ');if(!rows.length)notFound();return <main className="container research-category sector-directory"><nav className="sd-breadcrumb"><Link href="/">Home</Link><span>›</span><Link href="/sectors">Sectors</Link><span>›</span><b>{label}</b></nav><section className="page-hero"><div className="page-hero-content"><div className="eyebrow">Sector & Industry Research</div><h1>{label} Stocks</h1><p>Explore companies assigned to {label}. Open a stock page for detailed price, fundamentals, technical indicators, forecasts and available filings.</p><div className="hero-actions"><Link className="blue-btn" href="/sectors">All sectors</Link><Link className="outline-btn" href="/screener">Stock Screener</Link></div></div></section><section className="research-explainer"><div><span className="research-label">COMPANY UNIVERSE</span><h2>{label} company directory</h2><p>Sorted by available market capitalization. Missing values remain at the bottom; this is not an investment recommendation.</p></div><div className="research-count"><strong>{rows.length.toLocaleString('en-US')}</strong><span>stocks found</span><small>Database classification</small></div></section>{rows.length?<section className="research-table-card"><div className="research-table-heading"><div><h2>Companies in {label}</h2><p>Click a ticker or company to open its stock research page.</p></div><span>{rows.length} stocks</span></div><div className="research-table-scroll"><table><thead><tr><th>Ticker</th><th>Company</th><th>Industry</th><th>Exchange</th><th>Market cap</th><th>Research</th></tr></thead><tbody>{rows.map(s=><tr key={s.id}><td><Link className="research-symbol" href={'/stocks/'+s.slug}>{s.symbol}</Link></td><td>{s.company_name}</td><td>{s.industry??'—'}</td><td>{s.exchange??'—'}</td><td>{s.market_cap==null?'—':Number(s.market_cap).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}</td><td><Link className="research-open" href={'/stocks/'+s.slug}>Open research →</Link></td></tr>)}</tbody></table></div></section>:<section className="research-empty"><h2>No stocks found for this category</h2><p>The URL may have changed, or no indexable stocks currently match this classification.</p><Link className="research-open" href="/sectors">Return to sector directory →</Link></section>}<p className="research-disclaimer">Classification reflects stored metadata. Market cap may be stale or unavailable. Not financial advice.</p></main>}