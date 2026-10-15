import type { Metadata } from 'next'; import { ResearchCategoryPage } from '@/components/research-category-page'; export const metadata = {
  title: "Compare US Stocks: Company Metrics",
  description: "Compare available company facts across US-listed stocks, including sector, exchange and market capitalization, and continue to detailed stock research.",
  alternates: { canonical: "/compare" },
  openGraph: { title: "Compare US Stocks: Company Metrics", description: "Compare available company facts across US-listed stocks, including sector, exchange and market capitalization, and continue to detailed stock research.", url: "https://usmarketai.com/compare", siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: "Compare US Stocks: Company Metrics", description: "Compare available company facts across US-listed stocks, including sector, exchange and market capitalization, and continue to detailed stock research." },
}; export default function Page(){return <ResearchCategoryPage mode="compare"/>;}