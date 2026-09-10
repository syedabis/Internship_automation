// Admin palette, taken from the same validated categorical/status color
// system used across the org's internal tools (see the dataviz method: fixed
// categorical order for identity, reserved status hues for state). Never
// cycle these — a given metric always maps to the same slot.
//
// Values are CSS custom properties (defined per-theme in app/globals.css,
// under `:root` for light and `.dark` for dark), not literal hex — so toggling
// the `.dark` class on the admin shell repaints every consumer (inline
// `style`, and SVG `fill`/`stroke` attributes, which also resolve `var()`)
// instantly via the CSS cascade, with no React re-render needed.

export const INK = {
  primary: 'var(--adm-ink-primary)',
  secondary: 'var(--adm-ink-secondary)',
  muted: 'var(--adm-ink-muted)',
};

export const SURFACE = {
  page: 'var(--adm-surface-page)',
  card: 'var(--adm-surface-card)',
  cardAlt: 'var(--adm-surface-card-alt)',
  border: 'var(--adm-surface-border)',
  grid: 'var(--adm-surface-grid)',
};

// Fixed categorical order — identity, not severity. Only reach past slot 1
// when a second *identity* (not state) needs its own color.
export const CATEGORICAL = {
  blue: 'var(--adm-cat-blue)',
  orange: 'var(--adm-cat-orange)',
  aqua: 'var(--adm-cat-aqua)',
  yellow: 'var(--adm-cat-yellow)',
  magenta: 'var(--adm-cat-magenta)',
  green: 'var(--adm-cat-green)',
  violet: 'var(--adm-cat-violet)',
  red: 'var(--adm-cat-red)',
};

// Reserved for state — never reused as a generic series color. Fixed across
// light/dark by design (the dataviz palette specifies these as theme-invariant
// hex, distinguished by an icon + label pairing rather than by contrast alone).
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};
