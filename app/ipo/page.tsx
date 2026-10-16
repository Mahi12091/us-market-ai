import type { Metadata } from 'next'; import { ResearchCategoryPage } from '@/components/research-category-page'; export const metadata = {
  title: "IPO & Recent Listing Research: US Companies",
  description: "Explore tracked companies with recorded listing dates from the last five years. Historical listing research only, not an upcoming IPO calendar.",
  alternates: { canonical: "/ipo" },
  openGraph: { title: "IPO & Recent Listing Research: US Companies", description: "Explore tracked companies with recorded listing dates from the last five years. Historical listing research only, not an upcoming IPO calendar.", url: "https://usmarketai.com/ipo", siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: "IPO & Recent Listing Research: US Companies", description: "Explore tracked companies with recorded listing dates from the last five years. Historical listing research only, not an upcoming IPO calendar." },
}; export default function Page(){return <ResearchCategoryPage mode="ipo"/>;}