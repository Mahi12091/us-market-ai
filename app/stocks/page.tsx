import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'US Stocks', description: 'Browse US stocks with market intelligence and quantitative predictions.' };

export default async function StocksPage() {
  const supabase = await createClient();
  const { data: stocks } = await supabase.from('stocks').select('symbol,slug,company_name,sector,exchange').eq('is_active',true).eq('is_indexable',true).order('symbol').limit(3000);
  return <div className="container" style={{padding:'44px 0'}}><h1>US Stocks</h1><p className="muted">{stocks?.length ?? 0} indexed assets</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,marginTop:24}}>{stocks?.map(s=><a className="panel" style={{padding:18}} href={`/stocks/${s.slug}`} key={s.symbol}><strong>{s.symbol}</strong><div style={{marginTop:6}}>{s.company_name}</div><small className="muted">{s.exchange ?? 'US'} · {s.sector ?? '—'}</small></a>)}</div></div>;
}
