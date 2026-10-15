import type { Metadata } from 'next'; import { ResearchCategoryPage } from '@/components/research-category-page'; export const metadata = {
  title: "US Stock Screener: Filter & Explore Companies",
  description: "Screen the US stock universe using available company classification and market data. Missing source values remain unavailable rather than estimated.",
  alternates: { canonical: "/screener" },
  openGraph: { title: "US Stock Screener: Filter & Explore Companies", description: "Screen the US stock universe using available company classification and market data. Missing source values remain unavailable rather than estimated.", url: "https://usmarketai.com/screener", siteName: 'US Market AI', type: 'website' },
  twitter: { card: 'summary', title: "US Stock Screener: Filter & Explore Companies", description: "Screen the US stock universe using available company classification and market data. Missing source values remain unavailable rather than estimated." },
}; export default function Page(){return <ResearchCategoryPage mode="screener"/>;}