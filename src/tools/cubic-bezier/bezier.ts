export type Bezier = [number, number, number, number]

export const PRESETS: { name: string; b: Bezier }[] = [
  { name: 'linear', b: [0, 0, 1, 1] },
  { name: 'ease', b: [0.25, 0.1, 0.25, 1] },
  { name: 'ease-in', b: [0.42, 0, 1, 1] },
  { name: 'ease-out', b: [0, 0, 0.58, 1] },
  { name: 'ease-in-out', b: [0.42, 0, 0.58, 1] },
  { name: 'easeInOutSine', b: [0.37, 0, 0.63, 1] },
  { name: 'easeOutCubic', b: [0.33, 1, 0.68, 1] },
  { name: 'easeInOutCubic', b: [0.65, 0, 0.35, 1] },
  { name: 'easeOutQuint', b: [0.22, 1, 0.36, 1] },
  { name: 'easeOutExpo', b: [0.16, 1, 0.3, 1] },
  { name: 'easeInOutExpo', b: [0.87, 0, 0.13, 1] },
  { name: 'easeOutCirc', b: [0, 0.55, 0.45, 1] },
  { name: 'easeInBack', b: [0.36, 0, 0.66, -0.56] },
  { name: 'easeOutBack', b: [0.34, 1.56, 0.64, 1] },
  { name: 'easeInOutBack', b: [0.68, -0.6, 0.32, 1.6] },
]

/** One coordinate of a cubic Bézier from 0 to 1 with control values a, b at parameter t. */
const coord = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
const slope = (t: number, a: number, b: number) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t

/** Point on the curve at parameter t. */
export function pointAt([x1, y1, x2, y2]: Bezier, t: number): { x: number; y: number } {
  return { x: coord(t, x1, x2), y: coord(t, y1, y2) }
}

/**
 * The easing value (progress, y) at time x, like a browser evaluates
 * `cubic-bezier()`: solve x(t) = x with Newton's method, falling back to bisection.
 */
export function ease(b: Bezier, x: number): number {
  const [x1, y1, x2, y2] = b
  if (x <= 0) return 0
  if (x >= 1) return 1
  let t = x
  for (let i = 0; i < 8; i++) {
    const err = coord(t, x1, x2) - x
    if (Math.abs(err) < 1e-7) return coord(t, y1, y2)
    const d = slope(t, x1, x2)
    if (Math.abs(d) < 1e-6) break
    t -= err / d
  }
  let lo = 0
  let hi = 1
  t = x
  for (let i = 0; i < 60; i++) {
    const v = coord(t, x1, x2)
    if (Math.abs(v - x) < 1e-7) break
    if (v < x) lo = t
    else hi = t
    t = (lo + hi) / 2
  }
  return coord(t, y1, y2)
}

const num = (n: number) => String(Math.round(n * 1000) / 1000)

export function formatBezier(b: Bezier): string {
  return `cubic-bezier(${b.map(num).join(', ')})`
}

/** Accepts "cubic-bezier(a, b, c, d)", "a, b, c, d" or a keyword preset. x values must be 0–1. */
export function parseBezier(input: string): Bezier | null {
  const t = input.trim().replace(/;$/, '')
  const preset = PRESETS.find((p) => p.name.toLowerCase() === t.toLowerCase())
  if (preset) return [...preset.b]
  const m = t.match(/^(?:cubic-bezier\()?\s*([^,()]+),\s*([^,()]+),\s*([^,()]+),\s*([^,()]+?)\s*\)?$/i)
  if (!m) return null
  const b = m.slice(1, 5).map(Number) as Bezier
  if (b.some((v) => !Number.isFinite(v))) return null
  if (b[0] < 0 || b[0] > 1 || b[2] < 0 || b[2] > 1) return null
  return b
}

/** Reads the progress values of a `linear()` easing with evenly spaced stops (like the site's spring presets). */
export function parseLinear(easing: string): number[] {
  const m = easing.match(/linear\(([^)]*)\)/)
  if (!m) return []
  return m[1]
    .split(',')
    .map((s) => Number(s.trim().split(/\s+/)[0]))
    .filter((v) => Number.isFinite(v))
}

/** Samples a cubic-bezier into an equivalent `linear()` string (handy for comparing or exporting). */
export function toLinear(b: Bezier, steps = 20): string {
  const vals: string[] = []
  for (let i = 0; i <= steps; i++) vals.push(num(ease(b, i / steps)))
  return `linear(${vals.join(', ')})`
}
