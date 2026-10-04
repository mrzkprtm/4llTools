/** Type scale maths: a base size multiplied by a ratio for every step. */

export interface Ratio {
  name: string
  value: number
}

/** Well-known modular ratios, from a gentle step up to the golden ratio. */
export const RATIOS: Ratio[] = [
  { name: 'Minor second', value: 1.067 },
  { name: 'Major second', value: 1.125 },
  { name: 'Minor third', value: 1.2 },
  { name: 'Major third', value: 1.25 },
  { name: 'Perfect fourth', value: 1.333 },
  { name: 'Golden ratio', value: 1.618 },
]

export interface ScaleStep {
  /** Signed step from the base size: 0 is the base, -1 one step down, 1 one step up. */
  step: number
  px: number
  rem: number
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits

const clampNumber = (n: number, min: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min)
const clampInt = (n: number, min: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min)

/** Convert a pixel value to rem, rounded to four decimals. */
export function pxToRem(px: number, root = 16): number {
  if (!Number.isFinite(px) || !Number.isFinite(root) || root <= 0) return 0
  return round(px / root, 4)
}

/** Build a modular scale as px values (plus rem) from `stepsDown` below the base to `stepsUp` above it. */
export function modularScale(base: number, ratio: number, stepsUp: number, stepsDown: number): ScaleStep[] {
  const b = clampNumber(base, 1, 400)
  const r = clampNumber(ratio, 1.001, 4)
  const up = clampInt(stepsUp, 0, 12)
  const down = clampInt(stepsDown, 0, 12)
  const out: ScaleStep[] = []
  for (let step = 0 - down; step <= up; step++) {
    const px = round(b * r ** step, 3)
    out.push({ step, px, rem: pxToRem(px) })
  }
  return out
}

/** Render the scale as a `:root` block of custom properties. */
export function toCssVars(scale: ScaleStep[], root = 16): string {
  const body = scale.map((s) => `  --step-${s.step}: ${pxToRem(s.px, root)}rem;`).join('\n')
  return `:root {\n${body}\n}`
}

/** Render the scale as a Tailwind `fontSize` theme object. */
export function toTailwind(scale: ScaleStep[], root = 16): string {
  const body = scale.map((s) => `  'step-${s.step}': '${pxToRem(s.px, root)}rem',`).join('\n')
  return `fontSize: {\n${body}\n}`
}
