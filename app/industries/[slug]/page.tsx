import type { Metadata } from 'next';
import { SectorStocksPage } from '@/components/sector-directory';

const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://usmarketai.com').replace(/\/$/, '');
const labelFromSlug = (slug: string) => slug.split('-').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const label = labelFromSlug(slug);
  const title = `${label} Stocks: Industry Directory & Research`;
  const description = `Browse US-listed companies in the ${label} industry, review available market data and continue to individual company research. Coverage depends on source data.`;
  return {
    title, description,
    alternates: { canonical: `/industries/${slug}` },
    openGraph: { title, description, type: 'website', url: `${base}/industries/${slug}`, siteName: 'US Market AI' },
    twitter: { card: 'summary', title, description },
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SectorStocksPage slug={slug} kind="industry" />;
}
