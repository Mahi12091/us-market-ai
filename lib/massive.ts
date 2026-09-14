const BASE_URL = 'https://api.massive.com';

function getApiKey() {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) throw new Error('MASSIVE_API_KEY is not configured');
  return key;
}

async function massiveFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, BASE_URL);
  url.searchParams.set('apiKey', getApiKey());
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (!response.ok) throw new Error(`Massive API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export type MassiveAggregate = { o: number; h: number; l: number; c: number; v: number; t: number };
export type MassiveTrade = { p: number; s: number; t: number; x?: number };
export type MassiveTicker = { ticker: string; name?: string; market?: string; locale?: string; primary_exchange?: string; type?: string; active?: boolean; currency_name?: string; market_cap?: number; sic_description?: string; description?: string; homepage_url?: string; branding?: { logo_url?: string } };

export async function getDailyAggregates(ticker: string, from: string, to: string) {
  return massiveFetch<{ results?: MassiveAggregate[]; status?: string }>(`/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000`);
}

export async function getLatestTrade(ticker: string) {
  return massiveFetch<{ results?: MassiveTrade; status?: string }>(`/v2/last/trade/${encodeURIComponent(ticker)}`);
}

export async function getLastQuote(ticker: string) {
  return massiveFetch<{ results?: { P?: number; S?: number; p?: number; s?: number; t?: number }; status?: string }>(`/v2/last/nbbo/${encodeURIComponent(ticker)}`);
}

export async function getTicker(ticker: string) {
  return massiveFetch<{ results?: MassiveTicker; status?: string }>(`/v3/reference/tickers/${encodeURIComponent(ticker)}`);
}
