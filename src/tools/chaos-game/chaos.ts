export type Pt = [number, number]
export type Rule = 'any' | 'no-repeat' | 'not-next' | 'not-neighbour'

export const RULES: [Rule, string][] = [
  ['any', 'Any corner'],
  ['no-repeat', 'Never the same corner twice'],
  ['not-next', 'Not the corner after the last one'],
  ['not-neighbour', 'Not a neighbour of the last corner'],
]

export interface ChaosState {
  x: number
  y: number
  /** Index of the last corner jumped toward (−1 before the first jump). */
  last: number
}

/** Whether corner v may follow corner `last` among n corners under the rule. */
export function allowed(rule: Rule, v: number, last: number, n: number): boolean {
  if (last < 0) return true
  if (rule === 'no-repeat') return v !== last
  if (rule === 'not-next') return v !== (last + 1) % n
  if (rule === 'not-neighbour') return v !== (last + 1) % n && v !== (last + n - 1) % n
  return true
}

/** One move of the chaos game: pick an allowed corner at random and jump a fraction r of the way to it. Returns the corner. */
export function chaosStep(s: ChaosState, vertices: Pt[], r: number, rule: Rule, random: () => number): number {
  const n = vertices.length
  let v = Math.floor(random() * n)
  for (let tries = 0; tries < 32 && !allowed(rule, v, s.last, n); tries++) v = Math.floor(random() * n)
  s.x += (vertices[v][0] - s.x) * r
  s.y += (vertices[v][1] - s.y) * r
  s.last = v
  return v
}

/**
 * The jump fraction at which the n shrunken copies of the polygon just touch
 * (0.5 for triangles and squares, the golden 0.618 for pentagons, 2/3 for hexagons).
 */
export function optimalR(n: number): number {
  let s = 1
  for (let k = 1; k <= Math.floor(n / 4); k++) s += Math.cos((2 * Math.PI * k) / n)
  return 1 - 1 / (2 * s)
}

/** Corners of a regular n-gon around (cx, cy), with one corner at the top. */
export function regularPolygon(n: number, cx: number, cy: number, radius: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius] as Pt
  })
}

/** Barnsley's fern: four affine maps chosen with probabilities 1%, 85%, 7%, 7%. Returns the map used. */
export function fernStep(s: { x: number; y: number }, random: () => number): number {
  const u = random()
  const { x, y } = s
  if (u < 0.01) {
    s.x = 0
    s.y = 0.16 * y
    return 0
  }
  if (u < 0.86) {
    s.x = 0.85 * x + 0.04 * y
    s.y = -0.04 * x + 0.85 * y + 1.6
    return 1
  }
  if (u < 0.93) {
    s.x = 0.2 * x - 0.26 * y
    s.y = 0.23 * x + 0.22 * y + 1.6
    return 2
  }
  s.x = -0.15 * x + 0.28 * y
  s.y = 0.26 * x + 0.24 * y + 0.44
  return 3
}

/** True when p lies inside (or on) the convex polygon. */
export function insideConvex(p: Pt, poly: Pt[], eps = 1e-9): boolean {
  let sign = 0
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[(i + 1) % poly.length]
    const c = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)
    if (Math.abs(c) <= eps) continue
    if (sign === 0) sign = Math.sign(c)
    else if (Math.sign(c) !== sign) return false
  }
  return true
}
