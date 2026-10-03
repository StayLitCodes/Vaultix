import { escapeHtml, sanitizeUrl } from './escape';

/**
 * Reusable Vaultix base email layout.
 *
 * Email-client compatibility notes:
 * - Table-based layout with `role="presentation"` (works in Outlook/Gmail).
 * - All critical styles are inline; no external CSS, fonts, or JavaScript.
 * - System font stack only (no web-font dependency).
 * - Single-column, max-width 600px, readable on mobile without media queries.
 * - CTA is a coloured table-cell link plus a plain-text URL fallback below.
 *
 * Branding follows the Vaultix web app: near-black background (#0a0a0f),
 * card surface (#12121a) and the purple-to-blue gradient accent
 * (#8b5cf6 -> #3b82f6) used in the Navbar logo treatment.
 */

export interface BaseLayoutOptions {
  /** Short preview text shown by most inboxes next to the subject. */
  preheader: string;
  /** Heading rendered inside the card. */
  heading: string;
  /** Already-escaped inner HTML for the main content area. */
  bodyHtml: string;
  /** Optional call-to-action button. Omitted when the URL is unsafe. */
  cta?: { label: string; url: string };
  /** Raw URL shown as a copy/paste fallback under the CTA. */
  fallbackUrl?: string;
}

const BRAND_NAME = 'Vaultix';
const BRAND_TAGLINE = 'Secure escrow on Stellar';

export function baseLayout(options: BaseLayoutOptions): string {
  const { preheader, heading, bodyHtml, cta, fallbackUrl } = options;

  const safeCtaUrl = cta ? sanitizeUrl(cta.url) : '';
  const safeFallbackUrl = fallbackUrl ? sanitizeUrl(fallbackUrl) : '';

  const ctaHtml =
    cta && safeCtaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;"><tr><td align="center" bgcolor="#8b5cf6" style="border-radius:8px;"><a href="${safeCtaUrl}" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a></td></tr></table>`
      : '';

  const fallbackHtml =
    safeFallbackUrl && (!cta || safeCtaUrl)
      ? `<p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#9ca3af;word-break:break-all;">Or copy and paste this link into your browser:<br/><a href="${safeFallbackUrl}" style="color:#a78bfa;text-decoration:underline;">${safeFallbackUrl}</a></p>`
      : '';

  return (
    `<!DOCTYPE html>` +
    `<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(heading)} - ${BRAND_NAME}</title></head>` +
    `<body style="margin:0;padding:0;background-color:#0a0a0f;">` +
    `<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</span>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0a0a0f;padding:24px 12px;">` +
    `<tr><td align="center">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">` +
    // Header with text-based brand treatment (no external image dependency).
    `<tr><td align="center" style="padding:12px 0 20px 0;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td align="center" valign="middle" width="36" height="36" bgcolor="#8b5cf6" style="border-radius:9px;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:#ffffff;">V</td>` +
    `<td width="10"></td>` +
    `<td align="left" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">${BRAND_NAME}</td>` +
    `</tr></table>` +
    `<p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;">${BRAND_TAGLINE}</p>` +
    `</td></tr>` +
    // Main content card.
    `<tr><td bgcolor="#12121a" style="border:1px solid #23232e;border-radius:12px;padding:32px 28px;">` +
    `<h1 style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:30px;color:#ffffff;">${escapeHtml(heading)}</h1>` +
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#d1d5db;">${bodyHtml}</div>` +
    ctaHtml +
    fallbackHtml +
    `</td></tr>` +
    // Footer.
    `<tr><td align="center" style="padding:20px 8px 8px 8px;">` +
    `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;">This email was sent by ${BRAND_NAME}. If you did not expect it, you can safely ignore it.</p>` +
    `<p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#4b5563;">&copy; ${BRAND_NAME} - Secure escrow on Stellar</p>` +
    `</td></tr>` +
    `</table>` +
    `</td></tr></table>` +
    `</body></html>`
  );
}

/** Shared paragraph style for template body copy. */
export function paragraph(text: string): string {
  return `<p style="margin:0 0 12px 0;">${escapeHtml(text)}</p>`;
}

/** Shared key/value detail row for escrow, dispute and milestone facts. */
export function detailRow(label: string, value: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 6px 0;">` +
    `<tr>` +
    `<td width="40%" valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#9ca3af;padding:6px 8px 6px 0;">${escapeHtml(label)}</td>` +
    `<td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#f3f4f6;padding:6px 0;">${escapeHtml(value)}</td>` +
    `</tr></table>`
  );
}

/** Greeting line shared by all templates. */
export function greeting(userName?: string): string {
  const name =
    typeof userName === 'string' && userName.trim().length > 0
      ? userName.trim()
      : '';
  // Note: `paragraph` performs the HTML escaping; do not pre-escape here.
  return paragraph(name ? `Hi ${name},` : 'Hi,');
}
