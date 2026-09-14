import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDailyAggregates, getLatestTrade } from '@/lib/massive';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TEST_SYMBOLS = ['AAPL', 'AMZN', 'MSFT', 'NVDA', 'TSLA'] as const;

function authorized(request: Request) {
  const secret = process.env.MARKET_DATA_SYNC_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function tradeTimestamp(value: number | undefined) {
  if (!value) return new Date().toISOString();
  return new Date(value > 1_000_000_000_000 ? value / 1_000_000 : value).toISOString();
}

async function syncTestStocks() {
  const supabase = createAdminClient();
  const { data: stocks, error: stockError } = await supabase
    .from('stocks')
    .select('id,symbol')
    .in('symbol', [...TEST_SYMBOLS])
    .eq('is_active', true);

  if (stockError) throw new Error(`Supabase stock lookup failed: ${stockError.message}`);

  const stockMap = new Map((stocks ?? []).map((stock) => [stock.symbol, stock]));
  const to = new Date();
  const from = new Date(to.getTime() - 5 * 24 * 60 * 60 * 1000);
  const results: Array<{ symbol: string; ok: boolean; historyRows?: number; error?: string }> = [];

  for (const symbol of TEST_SYMBOLS) {
    const stock = stockMap.get(symbol);
    if (!stock) {
      results.push({ symbol, ok: false, error: 'Active stock not found in Supabase' });
      continue;
    }

    try {
      const [tradeResponse, aggregateResponse] = await Promise.all([
        getLatestTrade(symbol),
        getDailyAggregates(symbol, isoDate(from), isoDate(to)),
      ]);

      const bars = aggregateResponse.results ?? [];
      const latestTrade = tradeResponse.results;
      if (!latestTrade?.p) throw new Error('Massive returned no latest trade price');
      if (!bars.length) throw new Error('Massive returned no daily aggregate bars');

      const latestBar = bars.at(-1)!;
      const previousClose = bars.length >= 2 ? bars[bars.length - 2].c : latestBar.c;
      const change = latestTrade.p - previousClose;
      const changePercent = previousClose ? (change / previousClose) * 100 : null;
      const now = new Date().toISOString();

      const { error: quoteError } = await supabase.from('latest_quotes').upsert({
        stock_id: stock.id,
        price: latestTrade.p,
        open: latestBar.o,
        high: latestBar.h,
        low: latestBar.l,
        previous_close: previousClose,
        change,
        change_percent: changePercent,
        volume: latestBar.v,
        market_status: 'unknown',
        quote_timestamp: tradeTimestamp(latestTrade.t),
        data_source: 'massive',
        updated_at: now,
      }, { onConflict: 'stock_id' });

      if (quoteError) throw new Error(`latest_quotes upsert failed: ${quoteError.message}`);

      const rows = bars.map((bar) => ({
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

      const { error: historyError } = await supabase
        .from('price_history')
        .upsert(rows, { onConflict: 'stock_id,timeframe,timestamp' });

      if (historyError) throw new Error(`price_history upsert failed: ${historyError.message}`);

      results.push({ symbol, ok: true, historyRows: rows.length });
    } catch (error) {
      results.push({
        symbol,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    mode: 'test',
    tested: TEST_SYMBOLS.length,
    synced: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(await syncTestStocks());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Market data sync failed' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(await syncTestStocks());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Market data sync failed' },
      { status: 500 },
    );
  }
}
