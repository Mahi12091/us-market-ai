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
