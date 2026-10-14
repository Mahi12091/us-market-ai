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

  // Paginate through every eligible stock. A single .limit(5000) would
  // silently omit pages when the stock universe grows beyond 5,000. The
  // Neon query builder does not support Supabase's .not() filter, so null
  // or blank slugs are excluded safely when creating the URL list.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from('stocks')
      .select('slug,updated_at')
      .eq('is_active', true)
      .eq('is_indexable', true)
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
    { url: `${base}/blog`, changeFrequency: 'daily', priority: 0.7 },
  ];

  const stockRoutes: MetadataRoute.Sitemap = stocks
    .filter((stock): stock is SitemapStock & { slug: string } => Boolean(stock.slug?.trim()))
    .map((stock) => ({
      url: `${base}/stocks/${stock.slug}`,
      ...(stock.updated_at ? { lastModified: new Date(stock.updated_at) } : {}),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

  const entries = [...staticRoutes, ...stockRoutes];

  // Google sitemap protocol limit: 50,000 URLs per sitemap file.
  if (entries.length > 50000) {
    throw new Error(`Sitemap contains ${entries.length} URLs; split into a sitemap index before deploying`);
  }

  return entries;
}
