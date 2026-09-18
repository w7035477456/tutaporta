/** Strip HTML tags and collapse whitespace for RAG / search plain text. */
export function recordVaultHtmlToPlainText(html) {
  const raw = String(html || '');
  if (!raw.trim()) return '';
  const withoutTags = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
  return withoutTags;
}
