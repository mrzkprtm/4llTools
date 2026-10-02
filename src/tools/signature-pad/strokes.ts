/** Pure stroke math for the signature pad: point thinning, pressure/speed widths, smooth outlines and SVG export. */

export interface Pt {
  x: number
  y: number
  /** Pen pressure 0–1 (0.5 when the device has none). */
  p: number
  /** Timestamp in ms. */
  t: number
}

export interface Stroke {
  points: Pt[]
  color: string
  /** Base width in px. */
  size: number
  /** True when real pen pressure was reported. */
  pressure: boolean
}

const r2 = (n: number) => Math.round(n * 100) / 100
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Skip points closer than `min` px to the previous one (keeps paths small and smooth). */
export function shouldAdd(last: Pt | undefined, next: Pt, min = 1.5): boolean {
  return !last || Math.hypot(next.x - last.x, next.y - last.y) >= min
}

/**
 * Width at each point. With a pen, width follows pressure; with a mouse or
 * finger, faster movement makes thinner lines, like ink. Widths are eased so
 * they never jump between neighbours.
 */
export function strokeWidths(points: Pt[], size: number, pressure: boolean): number[] {
  const out: number[] = []
  let w = size
  points.forEach((pt, i) => {
    let target: number
    if (pressure) target = size * (0.3 + 1.2 * clamp(pt.p, 0, 1))
    else if (i === 0) target = size
    else {
      const prev = points[i - 1]
      const dt = Math.max(1, pt.t - prev.t)
      const v = Math.hypot(pt.x - prev.x, pt.y - prev.y) / dt // px per ms
      target = size * clamp(1.4 - v * 0.35, 0.5, 1.4)
    }
    w = i === 0 ? target : w + (target - w) * 0.35
    out.push(w)
  })
  return out
}

const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** A smooth open path through points using quadratic curves between midpoints. */
export function smoothLine(points: { x: number; y: number }[], moveTo = true): string {
  if (!points.length) return ''
  const [p0] = points
  let d = moveTo ? `M${r2(p0.x)} ${r2(p0.y)}` : `L${r2(p0.x)} ${r2(p0.y)}`
  if (points.length === 1) return d
  if (points.length === 2) return `${d} L${r2(points[1].x)} ${r2(points[1].y)}`
  for (let i = 1; i < points.length - 1; i++) {
    const m = mid(points[i], points[i + 1])
    d += ` Q${r2(points[i].x)} ${r2(points[i].y)} ${r2(m.x)} ${r2(m.y)}`
  }
  const last = points[points.length - 1]
  return `${d} L${r2(last.x)} ${r2(last.y)}`
}

function dot(x: number, y: number, r: number): string {
  return `M${r2(x - r)} ${r2(y)} a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0 a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`
}

/**
 * A filled outline for a variable-width stroke: the left edge forwards, a
 * round cap, the right edge backwards and a round cap back to the start.
 */
export function outlinePath(points: Pt[], widths: number[]): string {
  if (!points.length) return ''
  if (points.length === 1) return dot(points[0].x, points[0].y, widths[0] / 2)
  const left: { x: number; y: number }[] = []
  const right: { x: number; y: number }[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    let tx = b.x - a.x
    let ty = b.y - a.y
    const len = Math.hypot(tx, ty) || 1
    tx /= len
    ty /= len
    const h = widths[i] / 2
    left.push({ x: points[i].x - ty * h, y: points[i].y + tx * h })
    right.push({ x: points[i].x + ty * h, y: points[i].y - tx * h })
  }
  const rEnd = r2(widths[widths.length - 1] / 2)
  const rStart = r2(widths[0] / 2)
  const lastR = right[right.length - 1]
  return [
    smoothLine(left),
    `A${rEnd} ${rEnd} 0 0 0 ${r2(lastR.x)} ${r2(lastR.y)}`,
    smoothLine(right.slice().reverse(), false),
    `A${rStart} ${rStart} 0 0 0 ${r2(left[0].x)} ${r2(left[0].y)}Z`,
  ].join(' ')
}

export const strokePath = (s: Stroke) => outlinePath(s.points, strokeWidths(s.points, s.size, s.pressure))

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Bounding box of all strokes including their width, or null when empty. */
export function strokesBounds(strokes: Stroke[]): Box | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of strokes) {
    const pad = s.size * 1.5
    for (const p of s.points) {
      minX = Math.min(minX, p.x - pad)
      minY = Math.min(minY, p.y - pad)
      maxX = Math.max(maxX, p.x + pad)
      maxY = Math.max(maxY, p.y + pad)
    }
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A standalone SVG of the strokes, cropped to their bounds plus `margin`. */
export function strokesToSvg(strokes: Stroke[], margin = 8, background?: string): string {
  const b = strokesBounds(strokes)
  if (!b) return ''
  const vx = r2(b.x - margin)
  const vy = r2(b.y - margin)
  const vw = r2(b.w + 2 * margin)
  const vh = r2(b.h + 2 * margin)
  const bg = background ? `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${esc(background)}"/>` : ''
  const paths = strokes.map((s) => `<path d="${strokePath(s)}" fill="${esc(s.color)}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${Math.ceil(vw)}" height="${Math.ceil(vh)}">${bg}${paths}</svg>`
}

/** An SVG of a typed signature. Font rendering depends on the fonts installed where it is viewed. */
export function textToSvg(text: string, font: string, size: number, color: string, width: number, height: number, background?: string): string {
  const bg = background ? `<rect width="100%" height="100%" fill="${esc(background)}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}" width="${Math.ceil(width)}" height="${Math.ceil(height)}">${bg}<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="${esc(font)}" font-size="${size}" fill="${esc(color)}">${esc(text)}</text></svg>`
}
