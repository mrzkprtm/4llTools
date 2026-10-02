/**
 * Small colour-math kit shared by the Design colour tools: sRGB ⇄ OKLab ⇄ OKLCH,
 * gamut mapping by chroma reduction, parsing, formatting and WCAG luminance.
 * Channels are 0–255 floats in RGB, L is 0–1, C is ~0–0.4 and H is degrees.
 */
export type RGB = { r: number; g: number; b: number }
export type OKLCH = { l: number; c: number; h: number }
export type OKLab = { l: number; a: number; b: number }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d

const toLinear = (v: number) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.sign(v) * Math.abs(v) ** (1 / 2.4) - 0.055)

export function rgbToOklab({ r, g, b }: RGB): OKLab {
  const R = toLinear(r)
  const G = toLinear(g)
  const B = toLinear(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

/** OKLab → linear sRGB (may fall outside 0–1 when out of gamut). */
function oklabToLinear({ l: L, a, b }: OKLab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function oklabToOklch({ l, a, b }: OKLab): OKLCH {
  const c = Math.hypot(a, b)
  let h = (Math.atan2(b, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l, c, h: c < 1e-4 ? 0 : h }
}

export function oklchToOklab({ l, c, h }: OKLCH): OKLab {
  const r = (h * Math.PI) / 180
  return { l, a: c * Math.cos(r), b: c * Math.sin(r) }
}

export const rgbToOklch = (rgb: RGB): OKLCH => oklabToOklch(rgbToOklab(rgb))

export function inGamut(c: OKLCH, eps = 1e-4): boolean {
  return oklabToLinear(oklchToOklab(c)).every((v) => v >= -eps && v <= 1 + eps)
}

/** Keeps L and H and lowers chroma until the colour fits in sRGB. */
export function toGamut(c: OKLCH): OKLCH {
  const l = clamp(c.l, 0, 1)
  const h = ((c.h % 360) + 360) % 360
  if (inGamut({ l, c: c.c, h })) return { l, c: Math.max(0, c.c), h }
  let lo = 0
  let hi = c.c
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut({ l, c: mid, h })) lo = mid
    else hi = mid
  }
  return { l, c: lo, h }
}

/** OKLCH → sRGB, gamut-mapped and clamped to 0–255 (still floats). */
export function oklchToRgb(c: OKLCH): RGB {
  const [r, g, b] = oklabToLinear(oklchToOklab(toGamut(c))).map((v) => clamp(fromLinear(clamp(v, 0, 1)), 0, 255))
  return { r, g, b }
}

export function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
}

export function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3,4}$/i.test(h)) h = [...h].map((c) => c + c).join('')
  if (/^[0-9a-f]{8}$/i.test(h)) h = h.slice(0, 6)
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export const oklchToHex = (c: OKLCH) => rgbToHex(oklchToRgb(c))

export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max - min < 1e-9) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s: s * 100, l: l * 100 }
}

function hslToRgb(h: number, s: number, l: number): RGB {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 }
}

/** Parses #hex, rgb(), hsl() or oklch() (CSS syntax, commas optional). */
export function parseColor(input: string): RGB | null {
  const t = input.trim().toLowerCase()
  const num = String.raw`(-?\d*\.?\d+)`
  const rgb = t.match(new RegExp(String.raw`^rgba?\(\s*${num}[\s,]+${num}[\s,]+${num}`))
  if (rgb) {
    const [r, g, b] = rgb.slice(1, 4).map(Number)
    return [r, g, b].every((v) => v >= 0 && v <= 255) ? { r, g, b } : null
  }
  const hsl = t.match(new RegExp(String.raw`^hsla?\(\s*${num}(?:deg)?[\s,]+${num}%[\s,]+${num}%`))
  if (hsl) {
    const [h, s, l] = hsl.slice(1, 4).map(Number)
    return hslToRgb(((h % 360) + 360) % 360, clamp(s, 0, 100), clamp(l, 0, 100))
  }
  const ok = t.match(new RegExp(String.raw`^oklch\(\s*${num}(%?)\s+${num}\s+${num}`))
  if (ok) {
    const l = Number(ok[1]) / (ok[2] ? 100 : 1)
    return oklchToRgb({ l: clamp(l, 0, 1), c: Math.max(0, Number(ok[3])), h: Number(ok[4]) })
  }
  return hexToRgb(t)
}

export function formatRgb(c: RGB): string {
  return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`
}

export function formatHsl(c: RGB): string {
  const { h, s, l } = rgbToHsl(c)
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
}

export function formatOklch(c: OKLCH): string {
  return `oklch(${round(c.l * 100, 1)}% ${round(c.c, 3)} ${round(c.c < 1e-4 ? 0 : c.h, 1)})`
}

/** WCAG 2 relative luminance (0–1). */
export function luminance({ r, g, b }: RGB): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/** WCAG 2 contrast ratio (1–21). */
export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Picks black or white text for a background, whichever contrasts more. */
export function bestTextColor(bg: RGB): '#000000' | '#ffffff' {
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }
  return contrastRatio(bg, black) >= contrastRatio(bg, white) ? '#000000' : '#ffffff'
}
