import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDailyAggregates, getLatestTrade } from '@/lib/massive';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.MARKET_DATA_SYNC_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createClient();
  const { data: stocks, error } = await supabase.from('stocks').select('id,symbol').eq('is_active', true).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const to = new Date();
  const from = new Date(to.getTime() - 5 * 24 * 60 * 60 * 1000);
  const results: { symbol: string; ok: boolean; error?: string }[] = [];

  for (const stock of stocks ?? []) {
    try {
      const [trade, aggregates] = await Promise.all([
        getLatestTrade(stock.symbol),
        getDailyAggregates(stock.symbol, isoDate(from), isoDate(to)),
      ]);
      const bars = aggregates.results ?? [];
      const latest = trade.results;
      if (latest?.p != null) {
        const previousClose = bars.length >= 2 ? bars[bars.length - 2].c : bars.at(-1)?.c ?? null;
        const change = previousClose != null ? latest.p - previousClose : null;
        const changePercent = previousClose ? (change! / previousClose) * 100 : null;
        await supabase.from('latest_quotes').upsert({
          stock_id: stock.id,
          price: latest.p,
          previous_close: previousClose,
          change,
          change_percent: changePercent,
          quote_timestamp: latest.t ? new Date(latest.t / 1_000_000).toISOString() : new Date().toISOString(),
          data_source: 'massive',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stock_id' });
      }
      const rows = bars.map(bar => ({
        stock_id: stock.id,
        timeframe: '1d',
        timestamp: new Date(bar.t).toISOString(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        data_source: 'massive',
      }));
      if (rows.length) await supabase.from('price_history').upsert(rows, { onConflict: 'stock_id,timeframe,timestamp' });
      results.push({ symbol: stock.symbol, ok: true });
    } catch (e) {
      results.push({ symbol: stock.symbol, ok: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  return NextResponse.json({ synced: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = await createClient();
  const { count } = await supabase.from('stocks').select('*', { count: 'exact', head: true }).eq('is_active', true);
  return NextResponse.json({ status: 'ready', activeStocks: count ?? 0 });
}
