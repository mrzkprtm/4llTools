import { formatHsl, formatOklch, formatRgb, oklchToHex, oklchToRgb, toGamut, type OKLCH, type RGB } from './oklch'

export type Harmony = 'analogous' | 'complementary' | 'triadic' | 'tetradic' | 'split-complementary' | 'monochromatic' | 'random'

export const HARMONIES: { id: Harmony; label: string; hint: string }[] = [
  { id: 'analogous', label: 'Analogous', hint: 'Neighbouring hues, calm and cohesive.' },
  { id: 'complementary', label: 'Complementary', hint: 'Opposite hues for strong contrast.' },
  { id: 'triadic', label: 'Triadic', hint: 'Three hues spaced 120° apart, lively but balanced.' },
  { id: 'tetradic', label: 'Tetradic', hint: 'Two complementary pairs, rich and varied.' },
  { id: 'split-complementary', label: 'Split-complementary', hint: 'Base plus the two neighbours of its opposite.' },
  { id: 'monochromatic', label: 'Monochromatic', hint: 'One hue in several lightness steps.' },
  { id: 'random', label: 'Random pleasing', hint: 'A random harmony with tuned lightness and chroma.' },
]

export type Swatch = { color: OKLCH; hex: string; locked: boolean }

const wrap = (h: number) => ((h % 360) + 360) % 360
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Five colours for a harmony, built in OKLCH so steps look perceptually even.
 * `jitter` (0–1 random source) varies lightness a little so regenerating
 * a harmony still gives something new; pass () => 0.5 for a stable result.
 */
export function harmony(base: OKLCH, kind: Exclude<Harmony, 'random'>, jitter: () => number = () => 0.5): OKLCH[] {
  const { l, c, h } = base
  const j = (amp: number) => (jitter() - 0.5) * 2 * amp
  const cc = Math.max(c, 0.04)
  const mk = (hue: number, dl = 0, cm = 1): OKLCH => toGamut({ l: clamp(l + dl + j(0.04), 0.2, 0.96), c: cc * cm, h: wrap(hue) })
  switch (kind) {
    case 'analogous':
      return [mk(h - 40, 0.08, 0.9), mk(h - 20, 0.04), toGamut(base), mk(h + 20, -0.04), mk(h + 40, -0.08, 0.9)]
    case 'complementary':
      return [mk(h, 0.22, 0.45), toGamut(base), mk(h, -0.18, 0.8), mk(h + 180), mk(h + 180, 0.2, 0.45)]
    case 'triadic':
      return [toGamut(base), mk(h, 0.2, 0.5), mk(h + 120), mk(h + 240), mk(h + 240, -0.18, 0.8)]
    case 'tetradic':
      return [toGamut(base), mk(h + 90), mk(h + 180), mk(h + 270), mk(h, 0.25, 0.3)]
    case 'split-complementary':
      return [toGamut(base), mk(h, 0.22, 0.4), mk(h + 150), mk(h + 210), mk(h + 180, -0.2, 0.7)]
    case 'monochromatic': {
      const steps = [0.93, 0.8, 0.66, 0.5, 0.34]
      // Replace the step nearest the base with the base itself.
      const nearest = steps.reduce((best, s, i) => (Math.abs(s - l) < Math.abs(steps[best] - l) ? i : best), 0)
      return steps.map((s, i) => (i === nearest ? toGamut(base) : toGamut({ l: clamp(s + j(0.02), 0, 1), c: cc * (1 - Math.abs(s - 0.6) * 1.1), h })))
    }
  }
}

/** A "pleasing" random base: mid lightness, moderate chroma, any hue. */
export function randomBase(rand: () => number = Math.random): OKLCH {
  return toGamut({ l: 0.45 + rand() * 0.35, c: 0.08 + rand() * 0.1, h: rand() * 360 })
}

export function randomPalette(rand: () => number = Math.random): OKLCH[] {
  const kinds: Exclude<Harmony, 'random'>[] = ['analogous', 'complementary', 'triadic', 'tetradic', 'split-complementary', 'monochromatic']
  const kind = kinds[Math.floor(rand() * kinds.length) % kinds.length]
  return harmony(randomBase(rand), kind, rand)
}

export function generate(base: OKLCH, kind: Harmony, rand: () => number = Math.random): OKLCH[] {
  return kind === 'random' ? randomPalette(rand) : harmony(base, kind, rand)
}

/** Replaces only the unlocked swatches with the fresh colours. */
export function mergeLocked(current: Swatch[], fresh: OKLCH[]): Swatch[] {
  return fresh.map((color, i) => (current[i]?.locked ? current[i] : { color, hex: oklchToHex(color), locked: false }))
}

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch'

export function formatAs(c: OKLCH, f: ColorFormat): string {
  const rgb: RGB = oklchToRgb(c)
  if (f === 'rgb') return formatRgb(rgb)
  if (f === 'hsl') return formatHsl(rgb)
  if (f === 'oklch') return formatOklch(c)
  return oklchToHex(c)
}

/** Friendly names for exports: primary, secondary, … */
export const SLOT_NAMES = ['primary', 'secondary', 'accent', 'highlight', 'neutral']
const nameAt = (i: number) => SLOT_NAMES[i] ?? `color-${i + 1}`

export function exportCss(hexes: string[], f: ColorFormat = 'hex', colors?: OKLCH[]): string {
  const lines = hexes.map((h, i) => `  --${nameAt(i)}: ${colors && f !== 'hex' ? formatAs(colors[i], f) : h};`)
  return `:root {\n${lines.join('\n')}\n}`
}

export function exportTailwind(hexes: string[]): string {
  const body = hexes.map((h, i) => `        ${nameAt(i)}: '${h}',`).join('\n')
  return `// tailwind.config.js\nexport default {\n  theme: {\n    extend: {\n      colors: {\n${body}\n      },\n    },\n  },\n}`
}

export function exportJson(colors: OKLCH[]): string {
  return JSON.stringify(
    colors.map((c, i) => ({ name: nameAt(i), hex: oklchToHex(c), rgb: formatRgb(oklchToRgb(c)), hsl: formatHsl(oklchToRgb(c)), oklch: formatOklch(c) })),
    null,
    2,
  )
}

/** Tiny seeded PRNG (mulberry32) for repeatable tests. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
