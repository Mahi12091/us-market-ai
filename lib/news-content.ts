const decodeEntities = (value: string) => value
  .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;|&#x22;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

export function cleanNewsText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  let text = value;
  for (let i = 0; i < 3; i++) text = decodeEntities(text);
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\b(?:href|target|rel|class|style)\s*=\s*["'][^"']*["']/gi, ' ')
    .replace(/&(?:nbsp|amp|quot|lt|gt|#\d+|#x[\da-f]+);?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


/** Keep unrelated headlines out of the US-equity research feed.
 * A ticker association alone is not enough: broad RSS feeds can attach an
 * unrelated story to a symbol by accident (for example, "stock" as a verb).
 */
export function isMarketRelevantNews(item: { title?: unknown; summary?: unknown }): boolean {
  const title = cleanNewsText(item.title);
  const summary = cleanNewsText(item.summary);
  const text = `${title} ${summary}`.toLowerCase();
  if (!title) return false;

  const financialContext = /\b(shares?|earnings?|revenue|profits?|sales growth|dividends?|analysts?|price target|upgrade|downgrade|investors?|market cap|nasdaq|nyse|s\s*&\s*p\s*500|dow jones|russell 2000|etf|ipo|sec filing|buyback|acquisition|merger|guidance|forecast|trading|market rally|market selloff|market volatility|stock futures|futures|treasury yields?|federal reserve|\bfed\b|inflation|interest rates|bond yields?|economic data|economic growth|jobs report|central bank|monetary policy|recession|tariffs|cpi|ppi|pce|manufacturing|gold prices?|silver prices?|crude oil|oil prices?|commodit(?:y|ies)|currency|dollar|yen|euro|gdp|unemployment|crypto|bitcoin|ethereum|quarter(?:ly)? results|operating margin|cash flow|balance sheet|debt refinancing|institutional stake|short interest|options market)\b/i;
  const stockPhrase = /\b(stock market|stock price|stocks? (?:rose|rises|fell|falls|jumped|jumps|surged|surges|slid|slides|gained|gains|dropped|drops|rallied|rallies|plunged|soared|outperformed|underperformed|to watch|to buy|to sell)|market shares)\b/i;

  return financialContext.test(text) || stockPhrase.test(text);
}

export function safeNewsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function newsSummary(value: unknown, title: unknown, maxLength = 280): string {
  const summary = cleanNewsText(value);
  const cleanTitle = cleanNewsText(title);
  if (!summary || summary.toLowerCase() === cleanTitle.toLowerCase()) return '';
  return summary.length > maxLength ? summary.slice(0, maxLength - 1).trimEnd() + '…' : summary;
}


/** Remove duplicate syndicated stories before rendering a feed. URL tracking
 * parameters are ignored, and repeated headlines for the same ticker collapse
 * to one item. Original publisher links and source text remain untouched. */
export function dedupeNewsItems<T extends { title?: unknown; url?: unknown; stock_id?: unknown }>(items: T[], limit = 40): T[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const title = cleanNewsText(item.title);
    if (!title) continue;
    const titleKey = `${String(item.stock_id ?? 'market')}:${title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
    const safeUrl = safeNewsUrl(item.url);
    let urlKey = '';
    if (safeUrl) {
      try {
        const parsed = new URL(safeUrl);
        for (const key of [...parsed.searchParams.keys()]) {
          if (/^(utm_.+|gclid|fbclid|mc_cid|mc_eid)$/i.test(key)) parsed.searchParams.delete(key);
        }
        urlKey = parsed.toString().replace(/\/$/, '');
      } catch {
        urlKey = '';
      }
    }
    if (seenTitles.has(titleKey) || (urlKey && seenUrls.has(urlKey))) continue;
    seenTitles.add(titleKey);
    if (urlKey) seenUrls.add(urlKey);
    unique.push(item);
    if (unique.length >= limit) break;
  }
  return unique;
}
