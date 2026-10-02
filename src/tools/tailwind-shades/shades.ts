import { contrastRatio, formatOklch, oklchToHex, oklchToRgb, rgbToOklch, toGamut, type OKLCH, type RGB } from '../color-palette/oklch'

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
export type Step = (typeof STEPS)[number]

/** Lightness of Tailwind v4's default palettes (averaged over hues), 50 → 950. */
export const DEFAULT_L = [0.975, 0.945, 0.9, 0.83, 0.745, 0.67, 0.58, 0.5, 0.44, 0.39, 0.275]
/** Relative chroma per step: pale tints and deep shades carry less colour. */
export const CHROMA_CURVE = [0.12, 0.24, 0.45, 0.7, 0.9, 1, 0.98, 0.88, 0.75, 0.62, 0.45]
const TOP = 0.985
const BOTTOM = 0.2

export type Shade = { step: Step; color: OKLCH; hex: string; onWhite: number; onBlack: number; text: 'white' | 'black'; aa: boolean; isInput: boolean }

/** Index of the step whose default lightness is closest to `l`. */
export function nearestStep(l: number): number {
  return DEFAULT_L.reduce((best, s, i) => (Math.abs(s - l) < Math.abs(DEFAULT_L[best] - l) ? i : best), 0)
}

const WHITE: RGB = { r: 255, g: 255, b: 255 }
const BLACK: RGB = { r: 0, g: 0, b: 0 }

/**
 * Builds an 11-step 50–950 scale in OKLCH. The input colour lands unchanged on
 * the nearest step; lighter steps spread evenly up to near-white and darker
 * ones down to a deep shade, following Tailwind's lightness curve. Chroma
 * follows a bell curve relative to the input, then is gamut-mapped.
 */
export function buildShades(input: RGB): Shade[] {
  const base = rgbToOklch(input)
  const k = nearestStep(base.l)
  const kL = DEFAULT_L[k]
  const hi = Math.max(TOP, base.l)
  const lo = Math.min(BOTTOM, base.l)
  return STEPS.map((step, i) => {
    let l: number
    if (i === k) l = base.l
    else if (i < k) {
      const span = TOP - kL
      const t = span > 1e-6 ? (DEFAULT_L[i] - kL) / span : 1
      l = base.l + t * (hi - base.l)
    } else {
      const span = kL - BOTTOM
      const t = span > 1e-6 ? (kL - DEFAULT_L[i]) / span : 1
      l = base.l - t * (base.l - lo)
    }
    const color = i === k ? base : toGamut({ l, c: (base.c * CHROMA_CURVE[i]) / CHROMA_CURVE[k], h: base.h })
    const hex = oklchToHex(color)
    const rgb = oklchToRgb(color)
    const onWhite = contrastRatio(rgb, WHITE)
    const onBlack = contrastRatio(rgb, BLACK)
    const text = onWhite >= onBlack ? 'white' : 'black'
    return { step, color, hex, onWhite, onBlack, text, aa: Math.max(onWhite, onBlack) >= 4.5, isInput: i === k }
  })
}

/** Lower-case, dash-separated colour name safe for CSS variables and JS keys. */
export function slugName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'brand'
  )
}

export function themeV4(name: string, shades: Shade[], format: 'oklch' | 'hex' = 'oklch'): string {
  const n = slugName(name)
  const lines = shades.map((s) => `  --color-${n}-${s.step}: ${format === 'hex' ? s.hex : formatOklch(s.color)};`)
  return `@theme {\n${lines.join('\n')}\n}`
}

export function configV3(name: string, shades: Shade[]): string {
  const n = slugName(name)
  const key = /^[a-z_$][\w$]*$/.test(n) ? n : `'${n}'`
  const body = shades.map((s) => `          ${s.step}: '${s.hex}',`).join('\n')
  return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        ${key}: {\n${body}\n        },\n      },\n    },\n  },\n}`
}
