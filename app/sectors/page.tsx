import type { Metadata } from 'next';
import { SectorDirectory } from '@/components/sector-directory';

export const revalidate = 900;
export const metadata: Metadata = {
  title: 'US Stocks by Sector & Industry | US Market AI',
  description: 'Explore the US stock market by sector and industry. Browse company counts, available market capitalization data and links to individual stock research pages.',
  keywords: ['US stocks by sector', 'stock market sectors', 'US stock industry directory', 'sector analysis', 'industry stocks', 'stock research'],
  alternates: { canonical: 'https://usmarketai.com/sectors' },
  openGraph: {
    title: 'US Stocks by Sector & Industry | US Market AI',
    description: 'Navigate US-listed companies by sector and industry, then continue to detailed stock research and available market data.',
    url: 'https://usmarketai.com/sectors',
    siteName: 'US Market AI',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'US Stocks by Sector & Industry | US Market AI',
    description: 'Browse US stock sectors, industry groups and individual company research.',
  },
};

export default function Page() {
  return <SectorDirectory />;
}
