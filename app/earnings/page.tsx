import type { Metadata } from 'next'; import { ResearchCategoryPage } from '@/components/research-category-page'; export const metadata = {
  title: "US Stock Earnings Research & Results",
  description: "Explore reported earnings periods, EPS and revenue values from available company filings. Scheduled earnings dates and estimates appear only when a verified source provides them.",
  alternates: { canonical: "/earnings" },
  openGraph: { title: "US Stock Earnings Research & Results", description: "Explore reported earnings periods, EPS and revenue values from available company filings. Scheduled earnings dates and estimates appear only when a verified source provides them.", url: "https://usmarketai.com/earnings", siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: "US Stock Earnings Research & Results", description: "Explore reported earnings periods, EPS and revenue values from available company filings. Scheduled earnings dates and estimates appear only when a verified source provides them." },
}; export default function Page(){return <ResearchCategoryPage mode="earnings"/>;}