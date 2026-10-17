/**
 * Vaultix mobile design tokens (#760).
 *
 * Before this module every screen and component hardcoded its own hex palette,
 * so the same surface was a different colour depending on where you were:
 * `app/index.tsx` used `#12121f`, `app/(tabs)/_layout.tsx` used `#1a1a2e`,
 * and `app/(tabs)/settings.tsx` used `#0f172a`. The slate ramp below is the
 * single reconciled palette; the brand purple is kept as the accent.
 *
 * Never write a raw hex literal in `app/` or `components/` — import from here.
 * See `apps/mobile/theme/README.md` for how to add a token.
 */

/**
 * Semantic colour tokens.
 *
 * Names describe the *role* a colour plays, not its appearance, so a future
 * palette change is a single edit in this file rather than a sweep through
 * every screen.
 */
export const colors = {
  // --- Surfaces -----------------------------------------------------------
  /** App canvas / screen background. */
  background: '#0F172A',
  /** Cards, modals, sheets, inputs. */
  surface: '#1E293B',
  /** Raised / pressed surfaces, inactive fills, progress tracks. */
  surfaceRaised: '#334155',
  /** Wells: code blocks, seed containers, timeline rails. */
  surfaceSunken: '#111827',
  /** Scrim behind modals and full-screen overlays. */
  overlay: 'rgba(2, 6, 23, 0.72)',
  /** Camera viewport / true black where a backdrop must be opaque. */
  scrim: '#000000',

  // --- Borders ------------------------------------------------------------
  border: '#334155',
  borderStrong: '#475569',

  // --- Text ---------------------------------------------------------------
  /** Primary body/heading text. */
  text: '#FFFFFF',
  /** Supporting copy: descriptions, helper text, inactive tab labels. */
  textSecondary: '#94A3B8',
  /** Tertiary/disabled copy: placeholders, timestamps, hints. */
  textTertiary: '#64748B',
  /** Text drawn on top of an accent/status fill. */
  textInverse: '#0F172A',
  /** Text drawn on a solid `accent` fill. */
  onAccent: '#FFFFFF',

  // --- Brand / status -----------------------------------------------------
  /** Primary action colour. */
  accent: '#6C63FF',
  /** Lighter accent for borders, progress fills and iconography. */
  accentSoft: '#A78BFA',
  /** Informational state (status chips, in-flight progress). */
  info: '#60A5FA',
  /** Solid informational fill for primary info actions. */
  infoStrong: '#3B82F6',
  /** Secondary informational accent used by QR / share surfaces. */
  infoAlt: '#00B4D8',
  /** Positive state: released, completed, confirmed. */
  success: '#10B981',
  /** Bright success used for the toast fill. */
  successBright: '#06D6A0',
  /** Warning / pending / action-required. */
  warning: '#F59E0B',
  /** Soft amber used for warning surfaces (toasts, inline notices). */
  warningSoft: '#FFD166',
  /** Destructive / failed / disputed. */
  danger: '#EF4444',
  /** Solid destructive fill for primary danger actions. */
  dangerStrong: '#DC2626',
  /** Muted destructive text and icons. */
  dangerSoft: '#FF6B81',

  // --- Tinted surfaces (inline notices behind warning/info banners) -------
  /** Background for a warning banner: pending, action required, read-only. */
  warningSurface: '#3D2F00',
  /** Border for a warning banner. */
  warningSurfaceBorder: '#5C4700',
  /** Translucent danger fill for inline error/dispute cards and badges. */
  dangerSurface: 'rgba(239, 68, 68, 0.13)',
  /** Translucent success fill for "released"/"completed" banners and badges. */
  successSurface: 'rgba(6, 214, 160, 0.13)',
  /** Muted blue fill behind an unread/informational notification row. */
  infoSurface: '#1E1E50',
  /** Translucent raised fill for secondary buttons on a dark surface. */
  raisedSurface: 'rgba(51, 65, 85, 0.4)',

  // --- Shadows ------------------------------------------------------------
  shadow: '#000000',
} as const;

export type ColorToken = keyof typeof colors;

/** 4pt spacing scale. Use instead of ad-hoc pixel values. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
} as const;

/** Corner radii. */
export const radii = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 16,
  pill: 999,
} as const;

/** Font sizes, keyed by role. */
export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const },
  heading: { fontSize: 20, fontWeight: '700' as const },
  sectionTitle: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.6 },
  body: { fontSize: 15 },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 12 },
  micro: { fontSize: 11 },
} as const;

/** Cross-platform elevation for cards, modals and sheets. */
export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  modal: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
} as const;

export const theme = { colors, spacing, radii, typography, shadows } as const;

export default theme;
