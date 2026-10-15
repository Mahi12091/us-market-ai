import type { Metadata } from 'next'; import { ResearchCategoryPage } from '@/components/research-category-page'; export const metadata = {
  title: "ETF Research: US Funds & Market Proxies",
  description: "Browse tracked US-listed ETFs and market proxies with available prices and company metadata. Fund holdings, fees and flows are shown only when validated data exists.",
  robots: { index: false, follow: true },,
  alternates: { canonical: "/etfs" },
  openGraph: { title: "ETF Research: US Funds & Market Proxies", description: "Browse tracked US-listed ETFs and market proxies with available prices and company metadata. Fund holdings, fees and flows are shown only when validated data exists.", url: "https://usmarketai.com/etfs", siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: "ETF Research: US Funds & Market Proxies", description: "Browse tracked US-listed ETFs and market proxies with available prices and company metadata. Fund holdings, fees and flows are shown only when validated data exists." },
}; export default function Page(){return <ResearchCategoryPage mode="etfs"/>;}