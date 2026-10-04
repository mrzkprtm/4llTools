/** Border-radius maths: per-corner CSS shorthand and Tailwind classes. */

export type Unit = 'px' | '%'

export interface RadiusValues {
  tl: number
  tr: number
  br: number
  bl: number
}

export interface RadiusInput extends RadiusValues {
  /** When true, the top-left value is used for every corner. */
  linked: boolean
  unit: Unit
  /** Optional vertical radii, which switch on the elliptical `horizontal / vertical` syntax. */
  v?: RadiusValues | null
}

/** Keep a radius inside 0–999 and round it to one decimal. */
export function clampRadius(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.min(999, Math.max(0, n)) * 10) / 10
}

const format = (n: number, unit: Unit) => `${clampRadius(n)}${unit}`

/** Collapse four equal/paired values into the shortest valid shorthand form. */
function collapse(values: number[]): number[] {
  const [a, b, c, d] = values
  if (a === b && b === c && c === d) return [a]
  if (a === c && b === d) return [a, b]
  if (b === c) return [a, b, d]
  return [a, b, c, d]
}

/** A `border-radius: …;` declaration, with per-corner and elliptical support. */
export function radiusCss(input: RadiusInput): string {
  const h: RadiusValues = input.linked ? { tl: input.tl, tr: input.tl, br: input.tl, bl: input.tl } : { tl: input.tl, tr: input.tr, br: input.br, bl: input.bl }
  const hParts = collapse([h.tl, h.tr, h.br, h.bl]).map((n) => format(n, input.unit))
  if (input.v) {
    const v = input.linked ? { tl: input.v.tl, tr: input.v.tl, br: input.v.tl, bl: input.v.tl } : input.v
    const vParts = collapse([v.tl, v.tr, v.br, v.bl]).map((n) => format(n, input.unit))
    return `border-radius: ${hParts.join(' ')} / ${vParts.join(' ')};`
  }
  return `border-radius: ${hParts.join(' ')};`
}

/** Tailwind rounded-* utilities for the four corners. */
export function tailwindClasses(values: RadiusValues, unit: Unit = 'px'): string {
  const cls = (side: string, n: number) => `rounded-${side}-[${format(n, unit)}]`
  const tl = values.tl
  if (values.tl === values.tr && values.tr === values.br && values.br === values.bl) return `rounded-[${format(tl, unit)}]`
  return [cls('tl', values.tl), cls('tr', values.tr), cls('br', values.br), cls('bl', values.bl)].join(' ')
}
