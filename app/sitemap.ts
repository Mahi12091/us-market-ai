import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://us-market-4msyoejtw-mahi12091s-projects.vercel.app';
const forecastSuffix = '-stock-price-prediction-2026-2050';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data } = await supabase.from('stocks').select('slug,updated_at').eq('is_active', true).eq('is_indexable', true).limit(5000);
  const stocks = data ?? [];
  return [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/stocks`, changeFrequency: 'hourly', priority: .9 },
    { url: `${base}/blog`, changeFrequency: 'daily', priority: .9 },
    ...stocks.flatMap((stock) => [
      { url: `${base}/stocks/${stock.slug}`, lastModified: stock.updated_at, changeFrequency: 'hourly' as const, priority: .8 },
      { url: `${base}/blog/${stock.slug}${forecastSuffix}`, lastModified: stock.updated_at, changeFrequency: 'daily' as const, priority: .75 },
    ]),
  ];
}
