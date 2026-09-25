import { NextResponse } from 'next/server';
import { createDatabaseClient } from '@/lib/neon';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  const db = createDatabaseClient();

  try {
    const [{ data: stocks, error: stockError }, { data: quotes, error: quoteError }, { data: predictions, error: predictionError }, { data: news, error: newsError }] = await Promise.all([
      db.from('stocks').select('id').eq('is_active', true).limit(10000),
      db.from('latest_quotes').select('stock_id').limit(10000),
      db.from('predictions').select('id').order('prediction_time', { ascending: false }).limit(1),
      db.from('news').select('id').order('published_at', { ascending: false }).limit(1),
    ]);

    const errors = [stockError, quoteError, predictionError, newsError].filter(Boolean).map(error => error!.message);
    if (errors.length) {
      return NextResponse.json({ ok: false, database: 'neon', errors, latency_ms: Date.now() - startedAt }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      database: 'neon',
      latency_ms: Date.now() - startedAt,
      counts: {
        active_stocks: stocks?.length ?? 0,
        latest_quotes: quotes?.length ?? 0,
        predictions_sample: predictions?.length ?? 0,
        news_sample: news?.length ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      database: 'neon',
      latency_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 503 });
  }
}
