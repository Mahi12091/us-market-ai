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

const GENERIC_COMPANY_WORDS = new Set([
  'hope', 'new', 'key', 'home', 'real', 'first', 'american', 'national',
  'general', 'united', 'global', 'central', 'capital', 'resources', 'energy',
  'systems', 'technology', 'technologies', 'international', 'services',
  'health', 'healthcare', 'financial', 'finance', 'industries', 'industrial',
  'markets', 'market', 'solutions', 'partners', 'properties', 'group'
]);

const FINANCIAL_CONTEXT = /\b(?:stock|shares|share price|equity|earnings|revenue|quarter|quarterly|investor|investors|analyst|analysts|market cap|ticker|forecast|valuation|dividend|nasdaq|nyse|sec filing)\b/i;

function normalizedWords(value: unknown): string[] {
  return cleanNewsText(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

/** Validate stored ticker links conservatively to avoid assigning unrelated
 * headlines to a stock merely because a common word appears in the headline. */
export function newsMentionsStock(
  item: { title?: unknown; summary?: unknown },
  stock: { symbol?: unknown; company_name?: unknown }
): boolean {
  const title = cleanNewsText(item.title);
  const story = cleanNewsText(title + ' ' + cleanNewsText(item.summary));
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
  const normalizedStory = ' ' + normalizedWords(story).join(' ') + ' ';
  const phrase = words.join(' ');

  // Multi-word company names must appear as a phrase, not as an isolated word.
  if (words.length >= 2 && phrase.length >= 5 && normalizedStory.includes(' ' + phrase + ' ')) return true;

  // A one-word brand must be accompanied by financial context to avoid ordinary
  // uses of common words being mistaken for a company mention.
  if (words.length === 1) {
    return phrase.length >= 5
      && normalizedStory.includes(' ' + phrase + ' ')
      && FINANCIAL_CONTEXT.test(title);
  }

  // Permit a distinctive brand token for long names, but never generic terms.
  const distinctive = words.filter(word => word.length >= 5 && !GENERIC_COMPANY_WORDS.has(word));
  return distinctive.some(word => new RegExp('\\b' + word + '\\b', 'i').test(story));
}

/** Detach unsupported ticker links; rendering code can then decide whether an
 * unlinked headline qualifies as broad US-market news. */
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

/** Keep validated company stories and explicit US-market headlines. Unlinked
 * stock stories without US context are excluded rather than mislabeled as broad
 * market news. Clearly foreign-market stories never enter this feed. */
export function isLikelyUSMarketStory(item: { stock_id?: unknown; title?: unknown; summary?: unknown }): boolean {
  const text = cleanNewsText(String(item.title ?? '') + ' ' + String(item.summary ?? ''));
  if (!text) return false;

  const hardForeignContext = /\b(?:indonesia|oslo stock exchange|hong kong|china telecom|nippon india|nifty|sensex|boc hong kong|oslo bors|tase|tel aviv stock exchange|london stock exchange|ftse 100|asx 200|tsx composite|nikkei|hang seng|kospi|bse sensex|nse india)\b|(?:\b(?:TASE|LSE|ASX|TSX|TSE|HKEX|BSE|NSE|FWB|XETRA)\s*[:.])|(?:\b\d{4,6}\.(?:IR|L|TO|AX|HK|DE|PA|AS|MI|SW|ST|OL|CO|KS|T|BO|NS)\b)/i.test(text);
  if (hardForeignContext) return false;

  const explicitUSContext = /\b(?:u\.s\.|us stock|us market|united states|wall street|nasdaq|nyse|s&p\s?500|dow jones|russell 2000|federal reserve|fed funds|u\.s\. treasury|sec filing|american stocks|new york stock exchange)\b/i.test(text);
  const foreignCurrencyContext = /\b(?:EUR|AUD|CAD|GBP|INR|HKD|CNY|JPY|NZD|CHF)\s?\d/i.test(text);
  if (foreignCurrencyContext && !explicitUSContext) return false;

  // A non-null stock_id here has already passed newsMentionsStock validation.
  if (item.stock_id != null && item.stock_id !== '') return true;
  return explicitUSContext;
}
