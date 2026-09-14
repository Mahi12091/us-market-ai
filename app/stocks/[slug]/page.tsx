import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{slug:string}> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: stock } = await supabase.from('stocks').select('company_name,symbol,description').eq('slug',slug).maybeSingle();
  if (!stock) return { title:'Stock Not Found' };
  return { title:`${stock.company_name} (${stock.symbol})`, description: stock.description ?? `Market intelligence, technical analysis and predictions for ${stock.symbol}.`, alternates:{canonical:`/stocks/${slug}`} };
}

export default async function StockPage({ params }: { params: Promise<{slug:string}> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: stock } = await supabase.from('stocks').select('*').eq('slug',slug).eq('is_active',true).maybeSingle();
  if (!stock) notFound();
  const [{data:quote},{data:tech},{data:predictions},{data:article}] = await Promise.all([
    supabase.from('latest_quotes').select('*').eq('stock_id',stock.id).maybeSingle(),
    supabase.from('technical_indicators').select('*').eq('stock_id',stock.id).eq('timeframe','1d').maybeSingle(),
    supabase.from('predictions').select('*').eq('stock_id',stock.id).order('prediction_time',{ascending:false}).limit(4),
    supabase.from('ai_articles').select('title,summary,content,updated_at').eq('stock_id',stock.id).eq('is_published',true).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  return <div className="container" style={{padding:'38px 0'}}><div className="muted" style={{fontSize:13}}><a href="/stocks">Stocks</a> / {stock.symbol}</div><div style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'end',marginTop:20,flexWrap:'wrap'}}><div><div className="muted">{stock.exchange ?? 'US'} · {stock.sector ?? 'Market'}</div><h1 style={{fontSize:42,margin:'6px 0'}}>{stock.company_name}</h1><div className="muted">{stock.symbol}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:34,fontWeight:800}}>{quote?.price != null ? `$${Number(quote.price).toFixed(2)}` : '—'}</div><div className="muted">{quote?.change_percent != null ? `${Number(quote.change_percent).toFixed(2)}% today` : 'No live quote'}</div></div></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,marginTop:28}}><section className="panel" style={{padding:22}}><h2>AI Prediction</h2><p className="muted">Quantitative model outlook</p>{predictions?.map(p=><div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'13px 0',borderTop:'1px solid #1d3048'}}><span>{p.horizon}</span><strong>{p.predicted_price != null ? `$${Number(p.predicted_price).toFixed(2)}` : '—'} · {p.direction ?? '—'}</strong></div>)}</section><section className="panel" style={{padding:22}}><h2>Technical snapshot</h2>{[['RSI',tech?.rsi],['MACD',tech?.macd],['SMA 50',tech?.sma_50],['SMA 200',tech?.sma_200],['ATR',tech?.atr],['Volatility',tech?.volatility]].map(([k,v])=><div key={String(k)} style={{display:'flex',justifyContent:'space-between',padding:'9px 0'}}><span className="muted">{k}</span><strong>{v == null ? '—' : Number(v).toFixed(2)}</strong></div>)}</section></div><section className="panel" style={{padding:24,marginTop:18}}><h2>{article?.title ?? 'AI Market Analysis'}</h2><p className="muted">{article?.summary ?? 'AI analysis will appear after verified market data and article generation are connected.'}</p>{article?.content && <p style={{lineHeight:1.8,whiteSpace:'pre-line'}}>{article.content}</p>}</section><p className="muted" style={{fontSize:12,marginTop:24}}>Predictions are estimates generated from historical and market data. They are not guaranteed and do not constitute financial advice.</p></div>;
}
