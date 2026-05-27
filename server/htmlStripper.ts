/**
 * Server-side HTML stripping utility for proper metrics calculation
 * Ensures paragraph tokens are preserved for alignment but removed for metrics
 */

export const PARA_TOKEN = '[[PARA]]';

/**
 * Strip HTML tags and entities while preserving paragraph breaks as PARA_TOKEN
 * Used for alignment calculations where we need to maintain paragraph structure
 */
export function stripHtmlPreserveParagraphs(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // First, normalize newlines
  let s = html.replace(/\r\n|\r/g, '\n');

  // Replace block-level tags with newlines
  s = s.replace(/<\s*br\s*\/?>/gi, '\n\n');
  s = s.replace(/<\s*\/\s*p\s*>/gi, '\n\n');
  s = s.replace(/<\s*p[^>]*>/gi, '\n\n');
  s = s.replace(/<\s*\/\s*div\s*>/gi, '\n\n');
  s = s.replace(/<\s*div[^>]*>/gi, '\n\n');

  // Strip all remaining HTML tags (replace with space so adjacent
  // inline tags like </span><span> don't merge words together)
  s = s.replace(/<[^>]+>/g, ' ');

  // Strip HTML entities
  s = stripHtmlEntities(s);

  // Collapse newlines into PARA_TOKEN
  s = s.replace(/\n+/g, ` ${PARA_TOKEN} `);

  // Collapse multiple spaces but preserve token
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Strip HTML tags but do NOT preserve paragraphs
 * Used for metrics calculation where paragraph tokens should not be counted
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // First, normalize newlines
  let s = html.replace(/\r\n|\r/g, '\n');

  // Replace block-level tags with spaces (not newlines, to avoid PARA_TOKEN)
  s = s.replace(/<\s*br\s*\/?>/gi, ' ');
  s = s.replace(/<\s*\/\s*p\s*>/gi, ' ');
  s = s.replace(/<\s*p[^>]*>/gi, ' ');
  s = s.replace(/<\s*\/\s*div\s*>/gi, ' ');
  s = s.replace(/<\s*div[^>]*>/gi, ' ');

  // Strip all remaining HTML tags (replace with space so adjacent
  // inline tags like </span><span> don't merge words together)
  s = s.replace(/<[^>]+>/g, ' ');

  // Strip HTML entities
  s = stripHtmlEntities(s);

  // Collapse multiple spaces and newlines
  s = s.replace(/[\s\n]+/g, ' ').trim();
  // Remove spaces before punctuation (artefact of replacing HTML tags with spaces)
  s = s.replace(/\s+([,।॥.;:!?)\]])/g, '$1');

  return s;
}

/**
 * Strip HTML entities like &nbsp;, &lt;, etc.
 */
export function stripHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

/**
 * Remove PARA_TOKENs from text
 * Used after metrics calculation to clean up text for display
 */
export function removeParaTokens(text: string): string {
  if (!text) return '';
  return text.replace(new RegExp(PARA_TOKEN, 'g'), '').replace(/\s+/g, ' ').trim();
}

/**
 * Count words in text, optionally excluding para tokens
 */
export function countWords(text: string, excludeParaTokens: boolean = false): number {
  if (!text) return 0;

  let processed = text;
  if (excludeParaTokens) {
    processed = processed.replace(new RegExp(PARA_TOKEN, 'g'), ' ');
  }

  return processed.trim().split(/\s+/).filter(w => w && w !== PARA_TOKEN).length;
}


