import { gradientEnds, wrapText } from '../youtube-banner/banner'

export const OG_W = 1200
export const OG_H = 630

export interface OgOpts {
  brand: string
  title: string
  description: string
  from: string
  /** Null renders a solid background using `from`. */
  to: string | null
  angle: number
  textColor: string
  stripe: boolean
}

export interface Preset {
  name: string
  from: string
  to: string | null
  textColor: string
}

export const PRESETS: Preset[] = [
  { name: 'Midnight', from: '#0f172a', to: '#312e81', textColor: '#ffffff' },
  { name: 'Ember', from: '#7c2d12', to: '#ea580c', textColor: '#fff7ed' },
  { name: 'Forest', from: '#052e16', to: '#16a34a', textColor: '#f0fdf4' },
  { name: 'Paper', from: '#f5f0e6', to: null, textColor: '#1b1a17' },
  { name: 'Grape', from: '#2e1065', to: '#c026d3', textColor: '#faf5ff' },
]

const FONT = "'Bricolage Grotesque Variable', ui-sans-serif, system-ui, sans-serif"

/**
 * Shrinks a starting font size until the wrapped title fits the width and
 * line budget. `measureAt` builds a measure for a given size so tests can
 * stub it without a canvas.
 */
export function fitFont(
  measureAt: (size: number) => (s: string) => number,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  maxLines = 3,
): { size: number; lines: string[] } {
  let size = start
  for (; size > min; size -= 4) {
    const measure = measureAt(size)
    const needed = wrapText(measure, text, maxWidth, Number.MAX_SAFE_INTEGER).length
    if (needed <= maxLines) return { size, lines: wrapText(measure, text, maxWidth, maxLines) }
  }
  const measure = measureAt(size)
  return { size, lines: wrapText(measure, text, maxWidth, maxLines) }
}

const PAD = 84
const INK_FALLBACK = '#ffffff'

/** Paints the full 1200×630 card; ctx must already be sized to that. */
export function drawOg(ctx: CanvasRenderingContext2D, o: OgOpts) {
  if (o.to) {
    const [x0, y0, x1, y1] = gradientEnds(o.angle, OG_W, OG_H)
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, o.from)
    g.addColorStop(1, o.to)
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = o.from
  }
  ctx.fillRect(0, 0, OG_W, OG_H)

  const ink = o.textColor || INK_FALLBACK
  if (o.stripe) {
    ctx.fillStyle = ink
    ctx.globalAlpha = 0.9
    ctx.fillRect(PAD, OG_H - PAD - 10, OG_W - PAD * 2, 10)
    ctx.globalAlpha = 1
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = ink

  let y = PAD + 46
  if (o.brand.trim()) {
    ctx.globalAlpha = 0.72
    ctx.font = `600 34px ${FONT}`
    ctx.fillText(o.brand.trim().toUpperCase().slice(0, 40), PAD, y)
    ctx.globalAlpha = 1
    y += 58
  }

  const { size, lines } = fitFont(
    (s) => (t) => {
      ctx.font = `800 ${s}px ${FONT}`
      return ctx.measureText(t).width
    },
    o.title.trim() || 'Your title here',
    OG_W - PAD * 2,
    96,
    48,
    3,
  )
  ctx.font = `800 ${size}px ${FONT}`
  const lineH = size * 1.12
  for (const line of lines) {
    y += lineH
    ctx.fillText(line, PAD, y)
  }

  if (o.description.trim()) {
    ctx.globalAlpha = 0.78
    ctx.font = `500 33px ${FONT}`
    const desc = wrapText((s) => ctx.measureText(s).width, o.description.trim(), OG_W - PAD * 2, 2)
    y += 28
    for (const line of desc) {
      y += 44
      ctx.fillText(line, PAD, y)
    }
    ctx.globalAlpha = 1
  }
}
