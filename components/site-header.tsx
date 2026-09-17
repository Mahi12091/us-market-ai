'use client';

import { useState } from 'react';
import Link from 'next/link';

const groups = [
  { label: 'Markets', items: [['Market Overview', '/markets']] },
  { label: 'Stocks', items: [['All US Stocks', '/stocks'], ['AI Predictions', '/predictions']] },
  { label: 'Crypto', items: [['Crypto Overview', '/crypto'], ['Crypto Predictions', '/predictions']] },
  { label: 'Research', items: [['Market News', '/news'], ['AI Analysis', '/analysis'], ['Predictions', '/predictions']] },
];

export default function SiteHeader() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="US Market AI home"><span>US Market</span> <b>AI</b></Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.label} onMouseEnter={() => setOpen(group.label)} onMouseLeave={() => setOpen(null)}>
              <button className="nav-button" type="button" aria-expanded={open === group.label}>
                {group.label} <span aria-hidden="true">⌄</span>
              </button>
              {open === group.label && (
                <div className="mega-menu">
                  <div className="mega-title">{group.label}<small>Explore US market intelligence</small></div>
                  <div className="mega-grid">
                    {group.items.map(([name, href]) => (
                      <Link href={href} key={`${group.label}-${href}`}>
                        <strong>{name}</strong>
                        <span>Explore research →</span>
                      </Link>
                    ))}
                  </div>
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
          <button className="mobile-menu" type="button" onClick={() => setOpen(open === 'mobile' ? null : 'mobile')} aria-label="Open navigation" aria-expanded={open === 'mobile'}>☰</button>
        </div>
      </div>

      {open === 'mobile' && (
        <div className="mobile-nav">
          <div className="container">
            <Link className="mobile-search-link" href="/search" onClick={() => setOpen(null)}><span aria-hidden="true">⌕</span> Search stocks, companies & news →</Link>
            {groups.map((group) => (
              <div className="mobile-section" key={group.label}>
                <b>{group.label}</b>
                {group.items.map(([name, href]) => <Link href={href} key={`${group.label}-${href}`} onClick={() => setOpen(null)}>{name}</Link>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
