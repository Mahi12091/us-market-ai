import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data } = await supabase.from('stocks').select('slug,updated_at').eq('is_active',true).eq('is_indexable',true).limit(5000);
  const base='https://us-market-ai.vercel.app';
  return [{url:base,changeFrequency:'hourly',priority:1},{url:`${base}/stocks`,changeFrequency:'hourly',priority:.9},...(data??[]).map(s=>({url:`${base}/stocks/${s.slug}`,lastModified:s.updated_at,changeFrequency:'hourly' as const,priority:.8}))];
}
