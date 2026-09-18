import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://usmarketai.com').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('stocks')
    .select('slug,updated_at')
    .eq('is_active', true)
    .eq('is_indexable', true)
    .limit(5000);

  const stocks = data ?? [];

  return [
    { url: base, changeFrequency: 'hourly' as const, priority: 1 },
    { url: `${base}/stocks`, changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: `${base}/blog`, changeFrequency: 'daily' as const, priority: 0.9 },
    ...stocks.map((stock) => ({
      url: `${base}/stocks/${stock.slug}`,
      lastModified: stock.updated_at,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
  ];
}
