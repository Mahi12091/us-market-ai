'use client';

import { useState } from 'react';
import Link from 'next/link';

type NavItem = { label: string; href: string; description: string };
type NavGroup = { label: string; eyebrow: string; description: string; columns: { title: string; items: NavItem[] }[] };

const groups: NavGroup[] = [
  {
    label: 'Markets',
    eyebrow: 'Market pulse',
    description: 'Get oriented with the US market and explore stocks by sector and industry.',
    columns: [
      { title: 'Market overview', items: [
        { label: 'Market Dashboard', href: '/markets', description: 'Market-wide snapshot and trends' },
        { label: 'Sector Directory', href: '/sectors', description: 'Browse stocks by sector' },
      ] },
      { title: 'Explore industries', items: [
        { label: 'Industry Listings', href: '/sectors', description: 'Start with sectors, then drill into industries' },
        { label: 'Market News', href: '/news', description: 'Latest market stories and updates' },
      ] },
    ],
  },
  {
    label: 'Stocks',
    eyebrow: 'Stock tools',
    description: 'Find companies, compare opportunities, and explore market data.',
    columns: [
      { title: 'Discover', items: [
        { label: 'All US Stocks', href: '/stocks', description: 'Browse the stock directory' },
        { label: 'Stock Screener', href: '/screener', description: 'Explore stocks by available metrics' },
        { label: 'Stock Rankings', href: '/rankings', description: 'Browse ranked stock lists' },
      ] },
      { title: 'Compare & track', items: [
        { label: 'Compare Stocks', href: '/compare', description: 'Review companies side by side' },
        { label: 'ETF Research', href: '/etfs', description: 'Explore ETF information' },
        { label: 'IPO Research', href: '/ipo', description: 'Explore IPO-related research' },
      ] },
    ],
  },
  {
    label: 'Research',
    eyebrow: 'Research desk',
    description: 'Read company research, review events, and explore model-based outlooks.',
    columns: [
      { title: 'Company research', items: [
        { label: 'AI Analysis', href: '/analysis', description: 'Evidence-led stock analysis' },
        { label: 'Stock Forecasts', href: '/blog', description: 'Forecast and analysis articles' },
        { label: 'AI Predictions', href: '/predictions', description: 'Explore model-based outlooks' },
      ] },
      { title: 'Events & income', items: [
        { label: 'Earnings', href: '/earnings', description: 'Earnings-related research' },
        { label: 'Dividends', href: '/dividends', description: 'Dividend data and research' },
        { label: 'News', href: '/news', description: 'Company and market updates' },
      ] },
    ],
  },
  {
    label: 'Crypto',
    eyebrow: 'Digital assets',
    description: 'Explore digital-asset market coverage and available model outlooks.',
    columns: [
      { title: 'Crypto research', items: [
        { label: 'Crypto Overview', href: '/crypto', description: 'Explore crypto market coverage' },
        { label: 'Crypto Predictions', href: '/predictions', description: 'View available model outlooks' },
      ] },
    ],
  },
];

export default function SiteHeader() {
  const [open, setOpen] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>('Markets');

  const closeMenu = () => setOpen(null);

  return (
    <header className="site-header nav-header" onKeyDown={(event) => { if (event.key === 'Escape') closeMenu(); }}>
      <div className="container header-inner">
        <Link href="/" className="brand brand-logo" aria-label="US Market AI home" onClick={closeMenu}>
          <img src="/us-market-ai-logo.png" alt="US Market AI" width="260" height="50" />
        </Link>

        <nav className="desktop-nav nav-mega-root" aria-label="Primary navigation">
          {groups.map((group) => (
            <div className="nav-group nav-mega-group" key={group.label}
              onMouseEnter={() => setOpen(group.label)}
              onMouseLeave={() => setOpen(null)}
              onFocus={() => setOpen(group.label)}>
              <button className="nav-button" type="button" aria-expanded={open === group.label}
                aria-controls={`mega-${group.label.toLowerCase()}`}
                onClick={() => setOpen(open === group.label ? null : group.label)}>
                {group.label}<span className="nav-chevron" aria-hidden="true">⌄</span>
              </button>
              {open === group.label && (
                <div className="mega-menu nav-mega-menu" id={`mega-${group.label.toLowerCase()}`}>
                  <div className="nav-mega-intro">
                    <span>{group.eyebrow}</span>
                    <h2>{group.label}</h2>
                    <p>{group.description}</p>
                    <Link href={group.columns[0].items[0].href} onClick={closeMenu}>Explore {group.label.toLowerCase()} <span aria-hidden="true">→</span></Link>
                  </div>
                  <div className="nav-mega-columns">
                    {group.columns.map((column) => (
                      <section className="nav-mega-column" key={column.title}>
                        <h3>{column.title}</h3>
                        {column.items.map((item) => (
                          <Link href={item.href} key={item.href + item.label} onClick={closeMenu} className="nav-mega-item">
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </Link>
                        ))}
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="header-actions">
          <Link className="search-link nav-search-link" href="/search" aria-label="Search US Market AI" title="Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <span>Search</span>
          </Link>
          <button className="mobile-menu" type="button" onClick={() => setOpen(open === 'mobile' ? null : 'mobile')} aria-label={open === 'mobile' ? 'Close navigation' : 'Open navigation'} aria-expanded={open === 'mobile'}>☰</button>
        </div>
      </div>

      {open === 'mobile' && (
        <div className="mobile-nav nav-mobile-panel">
          <div className="container">
            <Link className="mobile-search-link" href="/search" onClick={closeMenu}><span aria-hidden="true">⌕</span> Search stocks, companies & news →</Link>
            {groups.map((group) => (
              <section className="mobile-section nav-mobile-section" key={group.label}>
                <button type="button" className="nav-mobile-toggle" aria-expanded={mobileExpanded === group.label}
                  onClick={() => setMobileExpanded(mobileExpanded === group.label ? null : group.label)}>
                  <span>{group.label}</span><span aria-hidden="true">{mobileExpanded === group.label ? '−' : '+'}</span>
                </button>
                {mobileExpanded === group.label && group.columns.map((column) => (
                  <div className="nav-mobile-column" key={column.title}>
                    <small>{column.title}</small>
                    {column.items.map((item) => <Link href={item.href} key={item.href + item.label} onClick={closeMenu}>
                      <strong>{item.label}</strong><span>{item.description}</span>
                    </Link>)}
                  </div>
                ))}
              </section>
            ))}
            <div className="nav-mobile-company">
              <Link href="/about" onClick={closeMenu}>About</Link>
              <Link href="/contact" onClick={closeMenu}>Contact</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
