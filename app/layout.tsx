import type { Metadata } from 'next';
import './globals.css';
import './stock-page.css';
import './market-pages.css';
import './predictions-page.css';
import './info-pages.css';
import './blog/blog.css';
import './blog/article.css';
import './ui-polish.css';
import './home-premium.css';
import SiteHeader from '@/components/site-header';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: { default: 'US Market AI', template: '%s | US Market AI' },
  description: 'US stocks and crypto market intelligence, technical analysis and quantitative predictions.',
  robots: { index: true, follow: true },
  openGraph: { title: 'US Market AI', description: 'US market intelligence, quantitative predictions and research.', type: 'website', ...(siteUrl ? { url: siteUrl } : {}) },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-US"><body><SiteHeader /><main>{children}</main><footer className="site-footer"><div className="container footer-grid"><div><a href="/" className="brand"><span>US Market</span> <b>AI</b></a><p className="muted">Market intelligence, quantitative forecasts and research for US stocks and crypto.</p></div><div><b>Markets</b><a href="/stocks">Stocks</a><a href="/crypto">Crypto</a><a href="/markets">Market Overview</a></div><div><b>Research</b><a href="/blog">Stock Forecasts</a><a href="/news">News</a><a href="/analysis">AI Analysis</a><a href="/predictions">Predictions</a></div><div><b>Company</b><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div></div><div className="container footer-bottom">© {new Date().getFullYear()} US Market AI · Estimates only, not financial advice.</div></footer></body></html>;
}
