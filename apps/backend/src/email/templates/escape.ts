/**
 * HTML escaping for user-controlled values interpolated into templates.
 * Every dynamic value must pass through {@link escapeHtml} (or
 * {@link sanitizeUrl} for link targets) before being embedded in HTML.
 */

/** Escape text for safe interpolation into HTML content or attributes. */
export function escapeHtml(value: unknown): string {
  let str = '';

  if (typeof value === 'string') {
    str = value;
  } else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  ) {
    str = value.toString();
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Allow only http(s) URLs for link targets. Returns the escaped URL when
 * safe, otherwise an empty string so the caller can omit the link.
 */
export function sanitizeUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return escapeHtml(trimmed);
}
