import type { MetadataRoute } from 'next';
import { createDatabaseClient } from '@/lib/neon';

const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://usmarketai.com').replace(/\/$/, '');
const PAGE_SIZE = 1000;

type SitemapStock = {
  slug: string | null;
  updated_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createDatabaseClient();
  const stocks: SitemapStock[] = [];

  // Read the complete eligible stock set in pages. A single .limit(5000)
  // silently excluded eligible stock URLs when the database grew past 5,000.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from('stocks')
      .select('slug,updated_at')
      .eq('is_active', true)
      .eq('is_indexable', true)
      .not('slug', 'is', null)
      .order('slug', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Sitemap stock query failed:', error.message);
      throw new Error('Unable to build the stock sitemap');
    }

    const batch = (data ?? []) as SitemapStock[];
    stocks.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/stocks`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/markets`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/news`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/predictions`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/sectors`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/blog`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/search`, changeFrequency: 'weekly', priority: 0.5 },
  ];

  const stockRoutes: MetadataRoute.Sitemap = stocks
    .filter((stock): stock is SitemapStock & { slug: string } => Boolean(stock.slug?.trim()))
    .map((stock) => ({
      url: `${base}/stocks/${stock.slug}`,
      ...(stock.updated_at ? { lastModified: new Date(stock.updated_at) } : {}),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

  // Long-term research article routes are generated from eligible stock slugs.
  const researchRoutes: MetadataRoute.Sitemap = stocks
    .filter((stock): stock is SitemapStock & { slug: string } => Boolean(stock.slug?.trim()))
    .map((stock) => ({
      url: `${base}/blog/${stock.slug}-stock-price-prediction-2026-2050`,
      ...(stock.updated_at ? { lastModified: new Date(stock.updated_at) } : {}),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  const entries = [...staticRoutes, ...stockRoutes, ...researchRoutes];

  // Sitemap protocol allows at most 50,000 URLs per sitemap file.
  if (entries.length > 50000) {
    throw new Error(`Sitemap contains ${entries.length} URLs; split into a sitemap index before deploying`);
  }

  return entries;
}
