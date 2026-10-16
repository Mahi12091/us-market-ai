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
