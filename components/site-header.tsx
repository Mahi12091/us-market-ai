'use client';

import { useState } from 'react';

const groups = [
  { label: 'Markets', items: [['Market Overview','/markets'],['Gainers','/markets/gainers'],['Losers','/markets/losers'],['Most Active','/markets/active'],['Sectors','/sectors']] },
  { label: 'Stocks', items: [['All US Stocks','/stocks'],['Trending Stocks','/stocks/trending'],['AI Predictions','/predictions'],['Prediction Accuracy','/predictions/accuracy'],['Watchlist','/watchlist']] },
  { label: 'Crypto', items: [['Crypto Overview','/crypto'],['Top Crypto','/crypto'],['Crypto Predictions','/crypto/predictions']] },
  { label: 'Research', items: [['Market News','/news'],['AI Analysis','/analysis'],['Earnings','/earnings'],['Tools','/tools']] },
];

export default function SiteHeader() {
  const [open, setOpen] = useState<string | null>(null);
  return <header className="site-header">
    <div className="container header-inner">
      <a href="/" className="brand"><span>US Market</span> <b>AI</b></a>
      <nav className="desktop-nav">
        {groups.map(g => <div className="nav-group" key={g.label} onMouseEnter={() => setOpen(g.label)} onMouseLeave={() => setOpen(null)}>
          <button className="nav-button">{g.label} <span>⌄</span></button>
          {open === g.label && <div className="mega-menu">
            <div className="mega-title">{g.label}<small>Explore US market intelligence</small></div>
            <div className="mega-grid">{g.items.map(([name,href]) => <a href={href} key={href}><strong>{name}</strong><span>View latest market insights →</span></a>)}</div>
          </div>}
        </div>)}
      </nav>
      <div className="header-actions"><a className="search-link" href="/search">⌕ <span>Search</span></a><a className="watch-link" href="/watchlist">☆</a><button className="mobile-menu" onClick={() => setOpen(open ? null : 'mobile')} aria-label="Open menu">☰</button></div>
    </div>
    {open === 'mobile' && <div className="mobile-nav"><div className="container">{groups.map(g => <div className="mobile-section" key={g.label}><b>{g.label}</b>{g.items.map(([name,href]) => <a href={href} key={href}>{name}</a>)}</div>)}</div></div>}
  </header>;
}
