import type { MetadataRoute } from 'next';
import { createDatabaseClient } from '@/lib/neon';

const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://usmarketai.com').replace(/\/$/, '');
export const dynamic = 'force-dynamic';
const PAGE_SIZE = 1000;
type SitemapStock = { slug: string | null; updated_at: string | null; sector: string | null; industry: string | null; asset_type: string | null };
type Category = { slug: string; label: string; count: number; latest: string | null };
const slugify = (value: string) => value.toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/stocks`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/markets`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/news`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/predictions`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/sectors`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/blog`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/screener`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/compare`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/rankings`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/earnings`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/ipo`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/crypto`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/analysis`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/research-author`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/disclaimer`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
  const stocks: SitemapStock[] = [];
  const db = createDatabaseClient();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db.from('stocks').select('slug,updated_at,sector,industry,asset_type')
      .eq('is_active', true).eq('is_indexable', true).order('slug', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error('Sitemap stock query failed; returning static routes:', error.message);
      return staticRoutes;
    }
    const batch = (data ?? []) as SitemapStock[];
    stocks.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  const stockRoutes: MetadataRoute.Sitemap = stocks
    .filter((stock): stock is SitemapStock & { slug: string } => Boolean(stock.slug?.trim()))
    .map(stock => ({ url: `${base}/stocks/${stock.slug}`, ...(stock.updated_at ? { lastModified: new Date(stock.updated_at) } : {}), changeFrequency: 'daily' as const, priority: 0.8 }));

  const categories = (field: 'sector' | 'industry') => {
    const map = new Map<string, Category>();
    for (const stock of stocks) {
      if (stock.asset_type && stock.asset_type !== 'stock') continue;
      const label = stock[field]?.trim();
      if (!label || label.toLowerCase() === 'other') continue;
      const slug = slugify(label);
      if (!slug) continue;
      const existing = map.get(slug);
      if (existing) {
        existing.count += 1;
        if (stock.updated_at && (!existing.latest || stock.updated_at > existing.latest)) existing.latest = stock.updated_at;
      } else map.set(slug, { slug, label, count: 1, latest: stock.updated_at });
    }
    return [...map.values()].filter(item => item.count >= 3);
  };
  const sectorRoutes: MetadataRoute.Sitemap = categories('sector').map(item => ({ url: `${base}/sectors/${item.slug}`, ...(item.latest ? { lastModified: new Date(item.latest) } : {}), changeFrequency: 'weekly', priority: 0.6 }));
  const industryRoutes: MetadataRoute.Sitemap = categories('industry').map(item => ({ url: `${base}/industries/${item.slug}`, ...(item.latest ? { lastModified: new Date(item.latest) } : {}), changeFrequency: 'weekly', priority: 0.5 }));
  const entries = [...staticRoutes, ...sectorRoutes, ...industryRoutes, ...stockRoutes];
  if (entries.length > 50000) throw new Error(`Sitemap contains ${entries.length} URLs; split into a sitemap index before deploying`);
  return entries;
}
