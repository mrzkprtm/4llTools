export type Pt = { x: number; y: number }
export type Shape =
  | { kind: 'polygon'; points: Pt[] }
  | { kind: 'circle'; r: number; cx: number; cy: number }
  | { kind: 'ellipse'; rx: number; ry: number; cx: number; cy: number }
  | { kind: 'inset'; top: number; right: number; bottom: number; left: number; round: number }

const poly = (...xy: number[]): Shape => {
  const points: Pt[] = []
  for (let i = 0; i < xy.length; i += 2) points.push({ x: xy[i], y: xy[i + 1] })
  return { kind: 'polygon', points }
}

export const PRESETS: { name: string; shape: Shape }[] = [
  { name: 'Triangle', shape: poly(50, 0, 100, 100, 0, 100) },
  { name: 'Trapezoid', shape: poly(20, 0, 80, 0, 100, 100, 0, 100) },
  { name: 'Parallelogram', shape: poly(25, 0, 100, 0, 75, 100, 0, 100) },
  { name: 'Rhombus', shape: poly(50, 0, 100, 50, 50, 100, 0, 50) },
  { name: 'Pentagon', shape: poly(50, 0, 100, 38, 82, 100, 18, 100, 0, 38) },
  { name: 'Hexagon', shape: poly(25, 0, 75, 0, 100, 50, 75, 100, 25, 100, 0, 50) },
  { name: 'Octagon', shape: poly(30, 0, 70, 0, 100, 30, 100, 70, 70, 100, 30, 100, 0, 70, 0, 30) },
  { name: 'Star', shape: poly(50, 0, 61, 35, 98, 35, 68, 57, 79, 91, 50, 70, 21, 91, 32, 57, 2, 35, 39, 35) },
  { name: 'Arrow', shape: poly(0, 20, 60, 20, 60, 0, 100, 50, 60, 100, 60, 80, 0, 80) },
  { name: 'Chevron', shape: poly(75, 0, 100, 50, 75, 100, 0, 100, 25, 50, 0, 0) },
  { name: 'Message', shape: poly(0, 0, 100, 0, 100, 75, 75, 75, 75, 100, 50, 75, 0, 75) },
  { name: 'Circle', shape: { kind: 'circle', r: 50, cx: 50, cy: 50 } },
  { name: 'Ellipse', shape: { kind: 'ellipse', rx: 50, ry: 35, cx: 50, cy: 50 } },
  { name: 'Inset', shape: { kind: 'inset', top: 10, right: 10, bottom: 10, left: 10, round: 24 } },
]

/** Number to at most one decimal, without trailing zeros. */
const n = (v: number) => String(Math.round(v * 10) / 10)
const pct = (v: number) => `${n(v)}%`

export function toCss(s: Shape): string {
  switch (s.kind) {
    case 'polygon':
      return `polygon(${s.points.map((p) => `${pct(p.x)} ${pct(p.y)}`).join(', ')})`
    case 'circle':
      return `circle(${pct(s.r)} at ${pct(s.cx)} ${pct(s.cy)})`
    case 'ellipse':
      return `ellipse(${pct(s.rx)} ${pct(s.ry)} at ${pct(s.cx)} ${pct(s.cy)})`
    case 'inset':
      return `inset(${[s.top, s.right, s.bottom, s.left].map(pct).join(' ')}${s.round > 0 ? ` round ${n(s.round)}px` : ''})`
  }
}

export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v))

/** Clamps to 0–100 and, when grid > 0, snaps to the nearest multiple of grid. */
export function snap(v: number, grid: number): number {
  const c = clamp(v)
  return grid > 0 ? clamp(Math.round(c / grid) * grid) : Math.round(c * 10) / 10
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Inserts `p` into the polygon edge closest to it. Returns the new points and the new index. */
export function insertPoint(points: Pt[], p: Pt): { points: Pt[]; index: number } {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < points.length; i++) {
    const d = distToSegment(p, points[i], points[(i + 1) % points.length])
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  const out = [...points]
  out.splice(best + 1, 0, p)
  return { points: out, index: best + 1 }
}

/** Adds a point at the middle of the longest edge. */
export function addMidpoint(points: Pt[]): { points: Pt[]; index: number } {
  let best = 0
  let bestL = -1
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    if (l > bestL) {
      bestL = l
      best = i
    }
  }
  const a = points[best]
  const b = points[(best + 1) % points.length]
  const out = [...points]
  out.splice(best + 1, 0, { x: Math.round(((a.x + b.x) / 2) * 10) / 10, y: Math.round(((a.y + b.y) / 2) * 10) / 10 })
  return { points: out, index: best + 1 }
}

/** Removes point i, keeping at least a triangle. */
export function removePoint(points: Pt[], i: number): Pt[] {
  if (points.length <= 3) return points
  return points.filter((_, j) => j !== i)
}
