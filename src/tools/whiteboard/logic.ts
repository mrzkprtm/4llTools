/** Whiteboard geometry: stroke smoothing, bounds and hit testing. All in world units. */

export type Pt = [number, number]

export type El =
  | { id: number; type: 'pen' | 'hl'; pts: Pt[]; color: string; width: number }
  | { id: number; type: 'rect' | 'ellipse' | 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { id: number; type: 'text'; x: number; y: number; text: string; color: string; size: number }
  | { id: number; type: 'note'; x: number; y: number; w: number; h: number; text: string; color: string }

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Distance from p to the segment a–b. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/**
 * Smooths a freehand stroke: drops points closer than `minDist` to the last
 * kept one, then applies an exponential moving average so jitter fades while
 * the first and last points stay exactly where the pen touched.
 */
export function smoothStroke(pts: readonly Pt[], minDist = 1.5, factor = 0.5): Pt[] {
  if (pts.length < 3) return pts.map((p) => [p[0], p[1]] as Pt)
  const kept: Pt[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const l = kept[kept.length - 1]
    if (Math.hypot(pts[i][0] - l[0], pts[i][1] - l[1]) >= minDist) kept.push(pts[i])
  }
  kept.push(pts[pts.length - 1])
  const out: Pt[] = [[kept[0][0], kept[0][1]]]
  for (let i = 1; i < kept.length - 1; i++) {
    const p = out[i - 1]
    out.push([p[0] + (kept[i][0] - p[0]) * factor, p[1] + (kept[i][1] - p[1]) * factor])
  }
  if (kept.length > 1) out.push([kept[kept.length - 1][0], kept[kept.length - 1][1]])
  return out
}

/** Traces a smooth path through points with quadratic curves between midpoints. */
export function tracePath(ctx: Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'quadraticCurveTo'>, pts: readonly Pt[]) {
  if (!pts.length) return
  ctx.moveTo(pts[0][0], pts[0][1])
  if (pts.length === 1) {
    ctx.lineTo(pts[0][0] + 0.01, pts[0][1])
    return
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2
    const my = (pts[i][1] + pts[i + 1][1]) / 2
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last[0], last[1])
}

/** Rough text width used for bounds and hit tests. */
export const textWidth = (text: string, size: number) => Math.max(...text.split('\n').map((l) => l.length), 1) * size * 0.56

export function bounds(el: El): Box {
  switch (el.type) {
    case 'pen':
    case 'hl': {
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const [x, y] of el.pts) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
      const r = el.width / 2
      return { x: x0 - r, y: y0 - r, w: x1 - x0 + 2 * r, h: y1 - y0 + 2 * r }
    }
    case 'rect':
    case 'ellipse':
    case 'arrow': {
      const r = el.width / 2 + (el.type === 'arrow' ? 10 : 0)
      return { x: Math.min(el.x1, el.x2) - r, y: Math.min(el.y1, el.y2) - r, w: Math.abs(el.x2 - el.x1) + 2 * r, h: Math.abs(el.y2 - el.y1) + 2 * r }
    }
    case 'text':
      return { x: el.x, y: el.y, w: textWidth(el.text, el.size), h: el.text.split('\n').length * el.size * 1.25 }
    case 'note':
      return { x: el.x, y: el.y, w: el.w, h: el.h }
  }
}

/** Union of all element bounds, or null for an empty board. */
export function boundsAll(els: readonly El[]): Box | null {
  if (!els.length) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const e of els) {
    const b = bounds(e)
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.w)
    y1 = Math.max(y1, b.y + b.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** True when (x, y) touches the element, within `tol` world units. Outlines count, not empty insides. */
export function hitTest(el: El, x: number, y: number, tol = 6): boolean {
  switch (el.type) {
    case 'pen':
    case 'hl': {
      const r = el.width / 2 + tol
      if (el.pts.length === 1) return Math.hypot(x - el.pts[0][0], y - el.pts[0][1]) <= r
      for (let i = 1; i < el.pts.length; i++) if (distToSegment(x, y, el.pts[i - 1][0], el.pts[i - 1][1], el.pts[i][0], el.pts[i][1]) <= r) return true
      return false
    }
    case 'arrow':
      return distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= el.width / 2 + tol
    case 'rect': {
      const r = el.width / 2 + tol
      const [ax, bx] = [Math.min(el.x1, el.x2), Math.max(el.x1, el.x2)]
      const [ay, by] = [Math.min(el.y1, el.y2), Math.max(el.y1, el.y2)]
      if (x < ax - r || x > bx + r || y < ay - r || y > by + r) return false
      return Math.abs(x - ax) <= r || Math.abs(x - bx) <= r || Math.abs(y - ay) <= r || Math.abs(y - by) <= r
    }
    case 'ellipse': {
      const cx = (el.x1 + el.x2) / 2
      const cy = (el.y1 + el.y2) / 2
      const rx = Math.abs(el.x2 - el.x1) / 2
      const ry = Math.abs(el.y2 - el.y1) / 2
      if (rx < 1 || ry < 1) return Math.hypot(x - cx, y - cy) <= tol + el.width
      // Normalized radial distance; scale the pixel tolerance by the smaller radius.
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry)
      return Math.abs(d - 1) * Math.min(rx, ry) <= el.width / 2 + tol
    }
    case 'text':
    case 'note': {
      const b = bounds(el)
      return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol
    }
  }
}

/** Topmost element under the point, or undefined. */
export function pick(els: readonly El[], x: number, y: number, tol = 6): El | undefined {
  for (let i = els.length - 1; i >= 0; i--) if (hitTest(els[i], x, y, tol)) return els[i]
  return undefined
}

/** A copy of the element moved by (dx, dy). */
export function moved(el: El, dx: number, dy: number): El {
  switch (el.type) {
    case 'pen':
    case 'hl':
      return { ...el, pts: el.pts.map(([x, y]) => [x + dx, y + dy] as Pt) }
    case 'rect':
    case 'ellipse':
    case 'arrow':
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy }
    default:
      return { ...el, x: el.x + dx, y: el.y + dy }
  }
}
