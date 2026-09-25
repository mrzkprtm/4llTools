import { contrastRatio, hexToRgb, oklchToHex, oklchToRgb, rgbToOklch, type RGB } from '../color-palette/oklch'

export { contrastRatio }

const parseHex = (hex: string): RGB => hexToRgb(hex) ?? { r: 0, g: 0, b: 0 }

/** WCAG 2.2 success criteria thresholds. */
export const WCAG = [
  { id: 'normal-aa', label: 'Normal text AA', min: 4.5, sc: '1.4.3' },
  { id: 'normal-aaa', label: 'Normal text AAA', min: 7, sc: '1.4.6' },
  { id: 'large-aa', label: 'Large text AA', min: 3, sc: '1.4.3' },
  { id: 'large-aaa', label: 'Large text AAA', min: 4.5, sc: '1.4.6' },
  { id: 'ui', label: 'UI components & graphics', min: 3, sc: '1.4.11' },
] as const

export function wcagChecks(ratio: number) {
  // WCAG compares the unrounded ratio, e.g. 4.499 fails AA.
  return WCAG.map((c) => ({ ...c, pass: ratio >= c.min }))
}

/** Formats a ratio like WebAIM: truncated (never rounded up) to 2 decimals. */
export function formatRatio(r: number): string {
  return `${(Math.floor(r * 100) / 100).toFixed(2)}:1`
}

// APCA-W3 0.0.98G-4g constants.
const A = {
  mainTRC: 2.4,
  sRco: 0.2126729,
  sGco: 0.7151522,
  sBco: 0.072175,
  normBG: 0.56,
  normTXT: 0.57,
  revTXT: 0.62,
  revBG: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scaleBoW: 1.14,
  scaleWoB: 1.14,
  loBoWoffset: 0.027,
  loWoBoffset: 0.027,
  deltaYmin: 0.0005,
  loClip: 0.1,
}

/** APCA screen luminance Y (simple 2.4 exponent, no piecewise sRGB curve). */
export function apcaY({ r, g, b }: RGB): number {
  const ch = (v: number) => (Math.max(0, Math.min(255, v)) / 255) ** A.mainTRC
  return A.sRco * ch(r) + A.sGco * ch(g) + A.sBco * ch(b)
}

/**
 * APCA lightness contrast Lc (0.0.98G-4g). Positive for dark text on a light
 * background, negative for light text on dark. Roughly −108 … 106.
 */
export function apcaContrast(text: RGB, bg: RGB): number {
  let yt = apcaY(text)
  let yb = apcaY(bg)
  if (yt < A.blkThrs) yt += (A.blkThrs - yt) ** A.blkClmp
  if (yb < A.blkThrs) yb += (A.blkThrs - yb) ** A.blkClmp
  if (Math.abs(yb - yt) < A.deltaYmin) return 0
  if (yb > yt) {
    const sapc = (yb ** A.normBG - yt ** A.normTXT) * A.scaleBoW
    return sapc < A.loClip ? 0 : (sapc - A.loBoWoffset) * 100
  }
  const sapc = (yb ** A.revBG - yt ** A.revTXT) * A.scaleWoB
  return sapc > -A.loClip ? 0 : (sapc + A.loWoBoffset) * 100
}

/** Plain-language use cases for an APCA Lc value (APCA "bronze simple" guidance). */
export function apcaGuidance(lc: number): { level: string; use: string; tone: 'good' | 'ok' | 'bad' } {
  const v = Math.abs(lc)
  if (v >= 90) return { level: 'Lc 90+', use: 'Preferred for body text: 14px+ at weight 400, or even thin 300 weights at 18px+.', tone: 'good' }
  if (v >= 75) return { level: 'Lc 75+', use: 'Minimum for body text: 18px at 400, 16px at 500 or 14px at 700.', tone: 'good' }
  if (v >= 60) return { level: 'Lc 60+', use: 'Content text that is not body copy: 24px at 400 or 16px at 700.', tone: 'ok' }
  if (v >= 45) return { level: 'Lc 45+', use: 'Large headlines only: 36px at 400 or 24px at 700, and icons.', tone: 'ok' }
  if (v >= 30) return { level: 'Lc 30+', use: 'Spot text such as placeholders, disabled labels and copyright lines; minimum for non-text UI.', tone: 'bad' }
  if (v >= 15) return { level: 'Lc 15+', use: 'Non-text only: dividers, large borders, focus rings. Not for any text.', tone: 'bad' }
  return { level: 'Below Lc 15', use: 'Effectively invisible for many readers. Do not rely on this pair.', tone: 'bad' }
}

/**
 * Finds the text colour closest to `text` (same OKLCH hue and chroma, gamut
 * mapped) whose WCAG ratio against `bg` is at least `target`. Searches lighter
 * and darker; returns the one needing the smaller lightness change, or null.
 */
export function suggestPassing(text: RGB, bg: RGB, target: number): { hex: string; ratio: number; direction: 'lighter' | 'darker' } | null {
  if (contrastRatio(text, bg) >= target) return null
  const base = rgbToOklch(text)
  const found: { hex: string; ratio: number; dl: number; direction: 'lighter' | 'darker' }[] = []
  for (const dir of [1, -1] as const) {
    const end = dir === 1 ? 1 : 0
    const passes = (l: number) => contrastRatio(oklchToRgb({ ...base, l }), bg) >= target
    if (!passes(end)) continue
    // Binary search for the smallest step toward `end` that passes.
    let lo = base.l
    let hi = end
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (passes(mid)) hi = mid
      else lo = mid
    }
    // Rounding to hex can nudge the ratio; step further until the hex itself passes.
    const hexPasses = (l: number) => contrastRatio(parseHex(oklchToHex({ ...base, l })), bg) >= target
    let l = hi
    for (let i = 0; i < 60 && !hexPasses(l); i++) l = Math.min(1, Math.max(0, l + dir * 0.002))
    if (!hexPasses(l)) continue
    const hex = oklchToHex({ ...base, l })
    const ratio = contrastRatio(parseHex(hex), bg)
    found.push({ hex, ratio, dl: Math.abs(l - base.l), direction: dir === 1 ? 'lighter' : 'darker' })
  }
  found.sort((a, b) => a.dl - b.dl)
  const best = found[0]
  return best ? { hex: best.hex, ratio: best.ratio, direction: best.direction } : null
}
