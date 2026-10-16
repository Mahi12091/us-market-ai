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
  // News providers sometimes double- or triple-encode HTML before ingestion.
  // Decode until stable (with a hard cap), then strip markup before rendering.
  for (let i = 0; i < 8; i++) {
    const decoded = decodeEntities(text);
    if (decoded === text) break;
    text = decoded;
  }
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\b(?:href|target|rel|class|style)\s*=\s*["'][^"']*["']/gi, ' ')
    .replace(/&(?:nbsp|amp|quot|lt|gt|apos|#\d+|#x[\da-f]+);?/gi, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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


const GENERIC_TICKER_WORDS = new Set([
  'ALL', 'ARE', 'BE', 'BEST', 'BIO', 'BULL', 'BUY', 'CASH', 'CAT', 'COST', 'CUT',
  'DAY', 'DEAL', 'EAT', 'EVER', 'FAST', 'FOR', 'FUN', 'GAP', 'GOOD', 'GO',
  'HAS', 'HE', 'HI', 'HOME', 'HOPE', 'IT', 'KEY', 'LOW', 'MAN', 'NEW', 'NOW',
  'ON', 'ONE', 'OPEN', 'OUT', 'PAY', 'PLAY', 'RUN', 'SAFE', 'SEE', 'SO',
  'THE', 'TOP', 'TRUE', 'UP', 'US', 'V', 'YOU'
]);

const LEGAL_COMPANY_WORDS = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'company', 'co', 'ltd',
  'limited', 'plc', 'class', 'common', 'stock', 'shares', 'ordinary',
  'holding', 'holdings', 'group', 'the', 'delaware', 'par', 'value'
]);

function normalizedWords(value: unknown): string[] {
  return cleanNewsText(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(/\\s+/).filter(Boolean);
}

/** Check that a stored ticker association is actually supported by the story.
 * Very short/common-word tickers require explicit ticker syntax; company-name
 * matching ignores legal suffixes and avoids matching generic one-word fragments. */
export function newsMentionsStock(
  item: { title?: unknown; summary?: unknown },
  stock: { symbol?: unknown; company_name?: unknown }
): boolean {
  const story = cleanNewsText(`${cleanNewsText(item.title)} ${cleanNewsText(item.summary)}`);
  if (!story) return false;
  const upperStory = story.toUpperCase();
  const symbol = cleanNewsText(stock.symbol).toUpperCase();
  if (symbol) {
    const escapedSymbol = symbol.replace(/\./g, '\\.');
    const explicitTicker = new RegExp('(?:\\$|\\(|\\b(?:NASDAQ|NYSE|NYSEAMERICAN|AMEX)\\s*:\\s*)' + escapedSymbol + '(?:\\)|\\b)', 'i');
    if (explicitTicker.test(upperStory)) return true;
    const tokens: string[] = upperStory.match(/[A-Z0-9]+/g) ?? [];
    if (symbol.length >= 4 && !GENERIC_TICKER_WORDS.has(symbol) && tokens.includes(symbol)) return true;
  }

  const words = normalizedWords(stock.company_name).filter(word => !LEGAL_COMPANY_WORDS.has(word));
  if (!words.length) return false;
  const normalizedStory = ` ${normalizedWords(story).join(' ')} `;
  const phrase = words.join(' ');
  if (phrase.length >= 5 && normalizedStory.includes(` ${phrase} `)) return true;

  // A distinctive brand word is useful for names such as "Verizon Communications".
  // Do not accept short words like "Bio" on their own ("Braveheart Bio" != Bio-Techne).
  const distinctive = words.filter(word => word.length >= 5);
  return distinctive.some(word => new RegExp('\\b' + word + '\\b', 'i').test(story));
}

/** Preserve a story when its ticker mapping is unsupported, but remove the
 * incorrect stock association so the UI won't attribute it to the wrong company
 * or sector. */
export function detachUnsupportedNewsAssociations<
  T extends { stock_id?: unknown; title?: unknown; summary?: unknown }
>(
  items: T[],
  stocksById: Map<string, { symbol?: unknown; company_name?: unknown }>
): T[] {
  return items.map(item => {
    if (item.stock_id == null || item.stock_id === '') return item;
    const stock = stocksById.get(String(item.stock_id));
    if (!stock || !newsMentionsStock(item, stock)) return { ...item, stock_id: null } as T;
    return item;
  });
}


/** Exclude clearly non-US market headlines from the US equity feed unless the
 * story also contains explicit US-market context. Ticker-linked company stories
 * are validated separately by newsMentionsStock. */
export function isLikelyUSMarketStory(item: { title?: unknown; summary?: unknown }): boolean {
  const text = cleanNewsText(String(item.title ?? '') + ' ' + String(item.summary ?? '')).toLowerCase();
  if (!text) return false;
  const clearlyNonUS = /\b(?:indonesia|oslo stock exchange|hong kong|china telecom|nippon india|nifty|sensex|boc hong kong|hk[d]?|cny|eur\s?\d|a\$\s?\d|oslo bors)\b/i.test(text);
  const explicitUSContext = /\b(?:u\.s\.|us stock|us market|united states|wall street|nasdaq|nyse|s&p\s?500|dow jones|russell 2000|federal reserve|fed funds|u\.s\. treasury|sec filing|american stocks)\b/i.test(text);
  return !clearlyNonUS || explicitUSContext;
}
