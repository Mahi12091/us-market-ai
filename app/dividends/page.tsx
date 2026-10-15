import type { Metadata } from 'next'; import { ResearchCategoryPage } from '@/components/research-category-page'; export const metadata = {
  title: "US Stock Dividend Research & History",
  description: "Review source-validated dividend records with dates and reported amounts where available. Coverage varies, and missing values are not treated as zero.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/dividends" },
  openGraph: { title: "US Stock Dividend Research & History", description: "Review source-validated dividend records with dates and reported amounts where available. Coverage varies, and missing values are not treated as zero.", url: "https://usmarketai.com/dividends", siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: "US Stock Dividend Research & History", description: "Review source-validated dividend records with dates and reported amounts where available. Coverage varies, and missing values are not treated as zero." },
}; export default function Page(){return <ResearchCategoryPage mode="dividends"/>;}