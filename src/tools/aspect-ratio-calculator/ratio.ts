export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a))
  b = Math.abs(Math.round(b))
  while (b) [a, b] = [b, a % b]
  return a
}

export type Ratio = { w: number; h: number }

/** Reduces width:height to lowest whole terms. Returns null for non-positive input. */
export function simplify(width: number, height: number): Ratio | null {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) return null
  // Scale decimals up so 1.5:1 becomes 3:2.
  let scale = 1
  while ((!Number.isInteger(width * scale) || !Number.isInteger(height * scale)) && scale < 1e6) scale *= 10
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const g = gcd(w, h) || 1
  return { w: w / g, h: h / g }
}

export const NAMED_RATIOS: { label: string; w: number; h: number; use: string }[] = [
  { label: '1:1', w: 1, h: 1, use: 'Square, Instagram posts' },
  { label: '4:3', w: 4, h: 3, use: 'Classic monitors, iPad' },
  { label: '3:2', w: 3, h: 2, use: 'DSLR photos, Surface' },
  { label: '16:10', w: 16, h: 10, use: 'Laptops, MacBook' },
  { label: '16:9', w: 16, h: 9, use: 'HD video, YouTube, TVs' },
  { label: '21:9', w: 21, h: 9, use: 'Ultrawide monitors, cinema' },
  { label: '9:16', w: 9, h: 16, use: 'Stories, Reels, TikTok' },
  { label: '4:5', w: 4, h: 5, use: 'Instagram portrait' },
  { label: '2:3', w: 2, h: 3, use: 'Portrait photos, posters' },
  { label: '3:4', w: 3, h: 4, use: 'Portrait tablets' },
]

/** The named ratio closest to width/height, with the relative difference (0 = exact). */
export function nearestNamed(width: number, height: number) {
  const r = width / height
  let best = NAMED_RATIOS[0]
  let bestDiff = Infinity
  for (const n of NAMED_RATIOS) {
    const diff = Math.abs(n.w / n.h - r) / (n.w / n.h)
    if (diff < bestDiff) {
      best = n
      bestDiff = diff
    }
  }
  return { ...best, diff: bestDiff }
}

/** Given a ratio and one side, returns the other side, rounded to 2 decimals. */
export function heightFor(width: number, ratio: Ratio) {
  return round(width * (ratio.h / ratio.w))
}
export function widthFor(height: number, ratio: Ratio) {
  return round(height * (ratio.w / ratio.h))
}

export function parseRatio(text: string): Ratio | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*[:x/×]\s*(\d+(?:\.\d+)?)$/i)
  if (!m) return null
  const w = Number(m[1])
  const h = Number(m[2])
  return w > 0 && h > 0 ? { w, h } : null
}

export const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

/** Pixels per inch for a screen resolution and diagonal size in inches. */
export function ppi(widthPx: number, heightPx: number, diagonalIn: number) {
  if (!(widthPx > 0 && heightPx > 0 && diagonalIn > 0)) return null
  const diagPx = Math.hypot(widthPx, heightPx)
  const density = diagPx / diagonalIn
  const widthIn = widthPx / density
  const heightIn = heightPx / density
  return { ppi: density, widthIn, heightIn, widthCm: widthIn * 2.54, heightCm: heightIn * 2.54, dotPitchMm: 25.4 / density }
}

export type UnitContext = { rootPx: number; parentPx: number; viewportW: number; viewportH: number }
export type CssUnit = 'px' | 'rem' | 'em' | 'pt' | 'vw' | 'vh' | '%'
export const CSS_UNITS: CssUnit[] = ['px', 'rem', 'em', 'pt', 'vw', 'vh', '%']

/** How many px one of this unit is. `%` is relative to the parent font-size, like font-size: 50%. */
export function pxPerUnit(unit: CssUnit, ctx: UnitContext): number {
  switch (unit) {
    case 'px': return 1
    case 'rem': return ctx.rootPx
    case 'em': return ctx.parentPx
    case 'pt': return 96 / 72
    case 'vw': return ctx.viewportW / 100
    case 'vh': return ctx.viewportH / 100
    case '%': return ctx.parentPx / 100
  }
}

export function convertUnit(value: number, from: CssUnit, to: CssUnit, ctx: UnitContext): number {
  return (value * pxPerUnit(from, ctx)) / pxPerUnit(to, ctx)
}

/** Formats a number without trailing zeros, up to 4 decimals. */
export function fmt(n: number, d = 4) {
  if (!Number.isFinite(n)) return '—'
  return String(round(n, d))
}
