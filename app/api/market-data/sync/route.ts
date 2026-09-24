import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
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
  const databaseUrl = process.env.NEON_DATABASE_URL;
  if (!databaseUrl) throw new Error('NEON_DATABASE_URL is not configured.');

  const sql = neon(databaseUrl);
  const rows = await sql.query(`
    SELECT id,symbol
    FROM public.stocks
    WHERE is_active = true
      AND asset_type = 'stock'
      AND symbol = ANY($1)
    ORDER BY id
  `, [[...TEST_SYMBOLS]]);

  const stockMap = new Map(rows.map((stock) => [stock.symbol, stock]));
  const to = new Date();
  const from = new Date(to.getTime() - 5 * 24 * 60 * 60 * 1000);
  const results: Array<{ symbol: string; ok: boolean; historyRows?: number; error?: string }> = [];

  for (const symbol of TEST_SYMBOLS) {
    const stock = stockMap.get(symbol);
    if (!stock) {
      results.push({ symbol, ok: false, error: 'Active stock not found in Neon' });
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

      await sql.query(
        `INSERT INTO public.latest_quotes
          (stock_id,price,open,high,low,previous_close,change,change_percent,volume,market_status,quote_timestamp,data_source,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unknown',$10,'massive',$11)
         ON CONFLICT (stock_id) DO UPDATE SET
           price=EXCLUDED.price,open=EXCLUDED.open,high=EXCLUDED.high,low=EXCLUDED.low,
           previous_close=EXCLUDED.previous_close,change=EXCLUDED.change,
           change_percent=EXCLUDED.change_percent,volume=EXCLUDED.volume,
           market_status=EXCLUDED.market_status,quote_timestamp=EXCLUDED.quote_timestamp,
           data_source=EXCLUDED.data_source,updated_at=EXCLUDED.updated_at`,
        [stock.id, latestTrade.p, latestBar.o, latestBar.h, latestBar.l, previousClose, change, changePercent, latestBar.v, tradeTimestamp(latestTrade.t), now],
      );

      const historyRows = bars.map((bar) => ({
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

      for (const bar of historyRows) {
        await sql.query(
          `INSERT INTO public.price_history
            (stock_id,timeframe,timestamp,open,high,low,close,volume,data_source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (stock_id,timeframe,timestamp) DO UPDATE SET
             open=EXCLUDED.open,high=EXCLUDED.high,low=EXCLUDED.low,
             close=EXCLUDED.close,volume=EXCLUDED.volume,data_source=EXCLUDED.data_source`,
          [bar.stock_id, bar.timeframe, bar.timestamp, bar.open, bar.high, bar.low, bar.close, bar.volume, bar.data_source],
        );
      }

      results.push({ symbol, ok: true, historyRows: historyRows.length });
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
