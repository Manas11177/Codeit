/**
 * Selectable accent palettes (unlocked by the accent-theme goodie).
 * Stored as progress.rewards.accentThemeId.
 * Legacy value "accent-theme" maps to "rose".
 *
 * Intentionally NOT themed (keep semantic / medal / streak colours):
 * - correct / success greens (#10b981, #34d399, .is-correct, .is-good)
 * - wrong / error reds (#ef4444, #f87171, .is-wrong, .is-low)
 * - timer amber & red warning states
 * - "Needs revision" and similar status chips
 * - medal tier colours (bronze / silver / gold)
 * - streak flame / orange streak UI (#f97316, #ea580c)
 */

export type AccentThemeId = 'rose' | 'violet' | 'amber' | 'emerald'

export type AccentThemeTokens = {
  id: AccentThemeId
  name: string
  icon: string
  /** Main brand accent (hex) */
  accent: string
  /** "r, g, b" for rgb(var(--cm-accent-rgb) / a) */
  accentRgb: string
  /** Soft translucent fill */
  soft: string
  /** Text/icon colour on solid accent backgrounds (WCAG AA) */
  contrast: string
}

/** Default teal — matches pre-theme brand; applied when no theme is selected. */
export const DEFAULT_ACCENT_TOKENS = {
  accent: '#00a99d',
  accentRgb: '0, 169, 157',
  soft: 'rgba(0, 169, 157, 0.14)',
  contrast: '#ffffff',
} as const

export const ACCENT_THEMES: AccentThemeTokens[] = [
  {
    id: 'rose',
    name: 'Rose',
    icon: '🌹',
    accent: '#e11d48',
    accentRgb: '225, 29, 72',
    soft: 'rgba(225, 29, 72, 0.14)',
    contrast: '#ffffff',
  },
  {
    id: 'violet',
    name: 'Violet',
    icon: '💜',
    accent: '#7c3aed',
    accentRgb: '124, 58, 237',
    soft: 'rgba(124, 58, 237, 0.14)',
    contrast: '#ffffff',
  },
  {
    id: 'amber',
    name: 'Amber',
    icon: '🧡',
    // Darker amber so solid fills keep readable dark contrast text
    accent: '#b45309',
    accentRgb: '180, 83, 9',
    soft: 'rgba(180, 83, 9, 0.14)',
    contrast: '#ffffff',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    icon: '💚',
    // Mid emerald: AA as text on dark surfaces and with white contrast on fills
    accent: '#059669',
    accentRgb: '5, 150, 105',
    soft: 'rgba(5, 150, 105, 0.14)',
    contrast: '#ffffff',
  },
]

export function normalizeAccentThemeId(
  raw: string | null | undefined,
): AccentThemeId | null {
  if (!raw) return null
  if (raw === 'accent-theme') return 'rose'
  if (ACCENT_THEMES.some((t) => t.id === raw)) return raw as AccentThemeId
  return null
}

export function getAccentTheme(id: string | null | undefined) {
  const normalized = normalizeAccentThemeId(id)
  if (!normalized) return null
  return ACCENT_THEMES.find((t) => t.id === normalized) ?? null
}

export function applyAccentTokens(
  root: HTMLElement,
  theme: AccentThemeTokens | null,
) {
  const tokens = theme ?? DEFAULT_ACCENT_TOKENS
  root.style.setProperty('--cm-accent', tokens.accent)
  root.style.setProperty('--cm-accent-rgb', tokens.accentRgb)
  root.style.setProperty('--cm-accent-soft', tokens.soft)
  root.style.setProperty('--cm-accent-contrast', tokens.contrast)
  if (theme) {
    root.dataset.accentTheme = theme.id
  } else {
    delete root.dataset.accentTheme
  }
}
