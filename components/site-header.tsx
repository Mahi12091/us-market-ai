'use client';

import { useState } from 'react';
import Link from 'next/link';

type MenuLink = { label: string; href: string; detail: string };
type MenuColumn = { title: string; links: MenuLink[] };
type MenuGroup = { label: string; intro: string; landingHref: string; columns: MenuColumn[] };

const groups: MenuGroup[] = [
  {
    label: 'Markets',
    intro: 'Get the market snapshot, follow headlines and explore the US market by sector and industry.',
    landingHref: '/markets',
    columns: [
      { title: 'Market Dashboard', links: [
        { label: 'Market Overview', href: '/markets', detail: 'Broad market snapshot and trends' },
        { label: 'Market News', href: '/news', detail: 'Latest market and company headlines' },
        { label: 'Search', href: '/search', detail: 'Find stocks, companies and research' },
      ]},
      { title: 'Market Structure', links: [
        { label: 'Sector Directory', href: '/sectors', detail: 'Explore stocks grouped by sector' },
        { label: 'Industry Directory', href: '/sectors', detail: 'Browse available industry groups' },
      ]},
    ],
  },
  {
    label: 'Stocks',
    intro: 'Discover US-listed companies, screen the universe and compare available stock data.',
    landingHref: '/stocks',
    columns: [
      { title: 'Discover Stocks', links: [
        { label: 'All US Stocks', href: '/stocks', detail: 'Browse the available stock universe' },
        { label: 'Stock Screener', href: '/screener', detail: 'Explore stocks using available metrics' },
        { label: 'Stock Rankings', href: '/rankings', detail: 'Review stocks by available rankings' },
      ]},
      { title: 'Compare & Explore', links: [
        { label: 'Compare Stocks', href: '/compare', detail: 'Review company data side by side' },
        { label: 'ETF Research', href: '/etfs', detail: 'Explore exchange-traded funds' },
        { label: 'IPO Research', href: '/ipo', detail: 'Explore IPO-related information' },
      ]},
    ],
  },
  {
    label: 'Crypto',
    intro: 'Explore crypto market coverage and available model-based outlooks.',
    landingHref: '/crypto',
    columns: [
      { title: 'Crypto Markets', links: [
        { label: 'Crypto Overview', href: '/crypto', detail: 'Crypto market snapshot and assets' },
        { label: 'Crypto Predictions', href: '/predictions', detail: 'Available prediction and outlook research' },
      ]},
    ],
  },
  {
    label: 'Research',
    intro: 'Research company fundamentals, valuation, forecasts, ownership and key events.',
    landingHref: '/analysis',
    columns: [
      { title: 'Analysis & Forecasts', links: [
        { label: 'AI Analysis', href: '/analysis', detail: 'Company and market research' },
        { label: 'Stock Forecasts & Articles', href: '/blog', detail: 'Forecast articles and explainers' },
        { label: 'Predictions', href: '/predictions', detail: 'Available quantitative outlooks' },
      ]},
      { title: 'Company Events & Data', links: [
        { label: 'Earnings', href: '/earnings', detail: 'Earnings data and research' },
        { label: 'Dividends', href: '/dividends', detail: 'Dividend data and research' },
        { label: 'Company News', href: '/news', detail: 'Market and company headlines' },
        { label: 'Stock Financials & Valuation', href: '/stocks', detail: 'Open a stock page for financials and valuation' },
        { label: 'Ownership & Holders', href: '/stocks', detail: 'Open a stock page for ownership details' },
      ]},
    ],
  },
  {
    label: 'Company',
    intro: 'Learn about US Market AI, contact the team and review our site policies.',
    landingHref: '/about',
    columns: [
      { title: 'About Us', links: [
        { label: 'About US Market AI', href: '/about', detail: 'What the platform provides' },
        { label: 'Contact', href: '/contact', detail: 'Get in touch with the team' },
        { label: 'Research Author', href: '/research-author', detail: 'Research and editorial information' },
      ]},
      { title: 'Policies & Disclosures', links: [
        { label: 'Privacy Policy', href: '/privacy', detail: 'How privacy is addressed' },
        { label: 'Terms of Use', href: '/terms', detail: 'Site terms and conditions' },
        { label: 'Disclaimer', href: '/disclaimer', detail: 'Important research and investing disclosures' },
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
        <Link href="/" className="brand brand-logo" aria-label="US Market AI home" onClick={closeMenu}>
          <img src="/us-market-ai-logo.png" alt="US Market AI" width="260" height="50" />
        </Link>

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
                aria-controls={`mega-menu-${group.label.toLowerCase()}`}
                onClick={() => setOpen(open === group.label ? null : group.label)}
                onFocus={() => setOpen(group.label)}
              >
                {group.label} <span aria-hidden="true">⌄</span>
              </button>
              {open === group.label && (
                <div className="mega-menu" id={`mega-menu-${group.label.toLowerCase()}`} role="region" aria-label={`${group.label} menu`}>
                  <div className="mega-heading">
                    <div className="mega-title">
                      {group.label}
                      <small>{group.intro}</small>
                    </div>
                    <div className="mega-heading-actions">
                      <Link className="mega-view-all" href={group.landingHref} onClick={closeMenu}>Explore all <span aria-hidden="true">→</span></Link>
                      <button className="mega-close" type="button" onClick={closeMenu} aria-label="Close menu">×</button>
                    </div>
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
                  <div className="mega-footer"><span>US Market AI</span><span>Market data · Research · Forecasts</span></div>
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
                <Link className="mobile-view-all" href={group.landingHref} onClick={closeMenu}>Explore {group.label}<span aria-hidden="true">→</span></Link>
                {group.columns.map((column) => (
                  <div className="mobile-link-group" key={column.title}>
                    <small>{column.title}</small>
                    {column.links.map((item) => (
                      <Link href={item.href} key={item.label} onClick={closeMenu}>{item.label}<span aria-hidden="true">→</span></Link>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
