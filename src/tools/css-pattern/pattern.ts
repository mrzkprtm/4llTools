/** Background patterns as CSS `background` values, plus matching SVG for PNG export. */

export type PatternId = 'polka' | 'stripes' | 'diagonal' | 'checker' | 'grid' | 'zigzag' | 'dots' | 'cross'

export interface PatternPreset {
  id: PatternId
  name: string
}

export const PATTERNS: PatternPreset[] = [
  { id: 'polka', name: 'Polka dots' },
  { id: 'stripes', name: 'Stripes' },
  { id: 'diagonal', name: 'Diagonal' },
  { id: 'checker', name: 'Checker' },
  { id: 'grid', name: 'Grid' },
  { id: 'zigzag', name: 'Zigzag' },
  { id: 'dots', name: 'Dots' },
  { id: 'cross', name: 'Cross' },
]

export interface PatternOpts {
  fg: string
  bg: string
  size: number
  angle: number
}

const clampSize = (n: number) => (Number.isFinite(n) ? Math.min(200, Math.max(4, Math.round(n))) : 24)
const clampAngle = (n: number) => (Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : 0)
const num = (n: number) => Math.round(n * 100) / 100

/** The value for a `background:` declaration. */
export function patternCss(preset: PatternId, opts: PatternOpts): string {
  const { fg, bg } = opts
  const s = clampSize(opts.size)
  const a = clampAngle(opts.angle)
  const half = num(s / 2)
  const quarter = num(s / 4)
  const line = Math.max(1, Math.round(s / 12))
  switch (preset) {
    case 'polka':
      return `radial-gradient(circle at 50% 50%, ${fg} 22%, transparent 23%) 0 0 / ${s}px ${s}px, ${bg}`
    case 'dots':
      return (
        `radial-gradient(${fg} 18%, transparent 19%) 0 0 / ${s}px ${s}px, ` +
        `radial-gradient(${fg} 18%, transparent 19%) ${half}px ${half}px / ${s}px ${s}px, ${bg}`
      )
    case 'stripes':
      return `repeating-linear-gradient(${a}deg, ${fg} 0 ${half}px, ${bg} ${half}px ${s}px)`
    case 'diagonal':
      return `repeating-linear-gradient(${a}deg, ${fg} 0 ${quarter}px, ${bg} ${quarter}px ${half}px)`
    case 'checker':
      return `conic-gradient(${fg} 0 25%, ${bg} 0 50%, ${fg} 0 75%, ${bg} 0) 0 0 / ${s}px ${s}px`
    case 'grid':
      return (
        `repeating-linear-gradient(0deg, ${fg} 0 ${line}px, transparent ${line}px ${s}px), ` +
        `repeating-linear-gradient(90deg, ${fg} 0 ${line}px, transparent ${line}px ${s}px), ${bg}`
      )
    case 'zigzag':
      return (
        `linear-gradient(135deg, ${fg} 25%, transparent 25%) 0 0 / ${s}px ${s}px, ` +
        `linear-gradient(225deg, ${fg} 25%, transparent 25%) 0 0 / ${s}px ${s}px, ${bg}`
      )
    case 'cross':
      return (
        `linear-gradient(${fg} 0 0) 50% 50% / ${line}px ${s}px, ` +
        `linear-gradient(${fg} 0 0) 50% 50% / ${s}px ${line}px, ${bg}`
      )
  }
}

function svgTile(preset: PatternId, fg: string, s: number): string {
  const half = num(s / 2)
  const quarter = num(s / 4)
  const line = Math.max(1, Math.round(s / 12))
  switch (preset) {
    case 'polka':
      return `<circle cx="${half}" cy="${half}" r="${num(s * 0.22)}" fill="${fg}"/>`
    case 'dots':
      return `<circle cx="${quarter}" cy="${quarter}" r="${num(s * 0.16)}" fill="${fg}"/><circle cx="${num(s * 0.75)}" cy="${num(s * 0.75)}" r="${num(s * 0.16)}" fill="${fg}"/>`
    case 'stripes':
      return `<rect width="${half}" height="${s}" fill="${fg}"/>`
    case 'diagonal':
      return `<rect width="${quarter}" height="${s}" fill="${fg}"/>`
    case 'checker':
      return `<rect width="${half}" height="${half}" fill="${fg}"/><rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${fg}"/>`
    case 'grid':
      return `<rect width="${s}" height="${line}" fill="${fg}"/><rect width="${line}" height="${s}" fill="${fg}"/>`
    case 'zigzag':
      return `<path d="M0 ${half} L${quarter} 0 L${half} ${half} L${num(s * 0.75)} 0 L${s} ${half}" fill="none" stroke="${fg}" stroke-width="${line}"/>`
    case 'cross':
      return `<rect x="${num(half - line / 2)}" width="${line}" height="${s}" fill="${fg}"/><rect y="${num(half - line / 2)}" width="${s}" height="${line}" fill="${fg}"/>`
  }
}

/** A self-contained SVG that tiles the pattern, ready to rasterise into a PNG. */
export function patternSvg(preset: PatternId, opts: PatternOpts, width = 640, height = 360): string {
  const s = clampSize(opts.size)
  const a = clampAngle(opts.angle)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><pattern id="p" width="${s}" height="${s}" patternUnits="userSpaceOnUse" patternTransform="rotate(${a})">`,
    svgTile(preset, opts.fg, s),
    `</pattern></defs>`,
    `<rect width="${width}" height="${height}" fill="${opts.bg}"/>`,
    `<rect width="${width}" height="${height}" fill="url(#p)"/>`,
    `</svg>`,
  ].join('')
}
