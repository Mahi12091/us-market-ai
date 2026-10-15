import type { Metadata } from 'next'; import { ResearchCategoryPage } from '@/components/research-category-page'; export const metadata = {
  title: "IPO Research: Newly Listed US Companies",
  description: "Explore tracked companies with available IPO metadata. This directory is not an upcoming IPO calendar; dates are not invented when an event feed is unavailable.",
  alternates: { canonical: "/ipo" },
  openGraph: { title: "IPO Research: Newly Listed US Companies", description: "Explore tracked companies with available IPO metadata. This directory is not an upcoming IPO calendar; dates are not invented when an event feed is unavailable.", url: "https://usmarketai.com/ipo", siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: "IPO Research: Newly Listed US Companies", description: "Explore tracked companies with available IPO metadata. This directory is not an upcoming IPO calendar; dates are not invented when an event feed is unavailable." },
}; export default function Page(){return <ResearchCategoryPage mode="ipo"/>;}