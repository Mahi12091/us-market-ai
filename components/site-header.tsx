'use client';

import { useState } from 'react';
import Link from 'next/link';

type MenuLink = { label: string; href: string; detail: string };
type MenuColumn = { title: string; links: MenuLink[] };
type MenuGroup = { label: string; intro: string; columns: MenuColumn[] };

const groups: MenuGroup[] = [
  {
    label: 'Markets',
    intro: 'Explore market performance, sectors and industries.',
    columns: [
      { title: 'Market Dashboard', links: [
        { label: 'Market Overview', href: '/markets', detail: 'Broad market snapshot' },
        { label: 'Market News', href: '/news', detail: 'Latest market headlines' },
      ]},
      { title: 'Market Structure', links: [
        { label: 'Sector Directory', href: '/sectors', detail: 'Explore stocks by sector' },
        { label: 'Industry Research', href: '/sectors', detail: 'Browse industry groups' },
      ]},
    ],
  },
  {
    label: 'Stocks',
    intro: 'Find, compare and research US-listed companies.',
    columns: [
      { title: 'Discover Stocks', links: [
        { label: 'All US Stocks', href: '/stocks', detail: 'Browse the stock universe' },
        { label: 'Stock Screener', href: '/screener', detail: 'Find stocks by metrics' },
        { label: 'Stock Rankings', href: '/rankings', detail: 'Explore ranked stocks' },
      ]},
      { title: 'Compare & Explore', links: [
        { label: 'Compare Stocks', href: '/compare', detail: 'Review companies side by side' },
        { label: 'ETF Research', href: '/etfs', detail: 'Explore exchange-traded funds' },
        { label: 'IPO Research', href: '/ipo', detail: 'New listings and IPO research' },
      ]},
    ],
  },
  {
    label: 'Crypto',
    intro: 'Crypto market coverage and model-based outlooks.',
    columns: [
      { title: 'Crypto Markets', links: [
        { label: 'Crypto Overview', href: '/crypto', detail: 'Market snapshot and assets' },
        { label: 'Crypto Predictions', href: '/predictions', detail: 'Forecasts and outlooks' },
      ]},
    ],
  },
  {
    label: 'Research',
    intro: 'Evidence-led analysis, company events and forecast research.',
    columns: [
      { title: 'Research & Analysis', links: [
        { label: 'AI Analysis', href: '/analysis', detail: 'Company and market insights' },
        { label: 'Stock Forecasts', href: '/blog', detail: 'Forecast articles and explainers' },
        { label: 'Predictions', href: '/predictions', detail: 'Quantitative outlooks' },
      ]},
      { title: 'Company Events', links: [
        { label: 'Earnings', href: '/earnings', detail: 'Earnings research and events' },
        { label: 'Dividends', href: '/dividends', detail: 'Dividend data and research' },
        { label: 'News', href: '/news', detail: 'Market and company news' },
      ]},
    ],
  },
];

export default function SiteHeader() {
  const [open, setOpen] = useState<string | null>(null);

  const closeMenu = () => setOpen(null);

  return (
    <header className="site-header" onKeyDown={(event) => { if (event.key === 'Escape') closeMenu(); }}>
      <div className="container header-inner">
        <Link href="/" className="brand brand-logo" aria-label="US Market AI home" onClick={closeMenu}><img src="/us-market-ai-logo.png" alt="US Market AI" width="260" height="50" /></Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {groups.map((group) => (
            <div
              className={`nav-group${open === group.label ? ' is-open' : ''}`}
              key={group.label}
              onMouseEnter={() => setOpen(group.label)}
              onMouseLeave={() => setOpen(null)}
            >
              <button
                className="nav-button"
                type="button"
                aria-expanded={open === group.label}
                onClick={() => setOpen(open === group.label ? null : group.label)}
                onFocus={() => setOpen(group.label)}
              >
                {group.label} <span aria-hidden="true">⌄</span>
              </button>
              {open === group.label && (
                <div className="mega-menu" role="region" aria-label={`${group.label} menu`}>
                  <div className="mega-heading">
                    <div className="mega-title">{group.label}<small>{group.intro}</small></div>
                    <button className="mega-close" type="button" onClick={closeMenu} aria-label="Close menu">×</button>
                  </div>
                  <div className="mega-columns">
                    {group.columns.map((column) => (
                      <section className="mega-column" key={column.title}>
                        <h3>{column.title}</h3>
                        {column.links.map((item) => (
                          <Link href={item.href} key={item.label} onClick={closeMenu}>
                            <strong>{item.label}</strong>
                            <span>{item.detail}</span>
                          </Link>
                        ))}
                      </section>
                    ))}
                  </div>
                  <div className="mega-footer"><span>US Market AI</span><span>Research tools · Market data · Forecasts</span></div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="header-actions">
          <Link className="search-link" href="/search" aria-label="Search US Market AI" title="Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <span>Search</span>
          </Link>
          <button className="mobile-menu" type="button" onClick={() => setOpen(open === 'mobile' ? null : 'mobile')} aria-label={open === 'mobile' ? 'Close navigation' : 'Open navigation'} aria-expanded={open === 'mobile'}>☰</button>
        </div>
      </div>

      {open === 'mobile' && (
        <div className="mobile-nav">
          <div className="container">
            <Link className="mobile-search-link" href="/search" onClick={closeMenu}><span aria-hidden="true">⌕</span> Search stocks, companies & news →</Link>
            {groups.map((group) => (
              <section className="mobile-section" key={group.label}>
                <b>{group.label}</b>
                <p>{group.intro}</p>
                {group.columns.flatMap((column) => column.links).map((item) => (
                  <Link href={item.href} key={`${group.label}-${item.label}`} onClick={closeMenu}>{item.label}<span aria-hidden="true">→</span></Link>
                ))}
              </section>
            ))}
            <section className="mobile-section">
              <b>Company & Help</b>
              <Link href="/about" onClick={closeMenu}>About</Link>
              <Link href="/contact" onClick={closeMenu}>Contact</Link>
              <Link href="/disclaimer" onClick={closeMenu}>Disclaimer</Link>
            </section>
          </div>
        </div>
      )}
    </header>
  );
}
