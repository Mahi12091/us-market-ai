import type { Metadata } from 'next'; import { ResearchCategoryPage } from '@/components/research-category-page'; export const metadata = {
  title: "US Stock Rankings & Company Research",
  description: "Discover tracked US stocks using available company metrics, then inspect the underlying data and risks. Rankings are not guarantees of future performance.",
  alternates: { canonical: "/rankings" },
  openGraph: { title: "US Stock Rankings & Company Research", description: "Discover tracked US stocks using available company metrics, then inspect the underlying data and risks. Rankings are not guarantees of future performance.", url: "https://usmarketai.com/rankings", siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: "US Stock Rankings & Company Research", description: "Discover tracked US stocks using available company metrics, then inspect the underlying data and risks. Rankings are not guarantees of future performance." },
}; export default function Page(){return <ResearchCategoryPage mode="rankings"/>;}