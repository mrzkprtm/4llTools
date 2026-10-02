export type Pt = [number, number]
export type Tri = [number, number, number]

/** Circumcircle (centre and squared radius) of three points, or null when they are collinear. */
export function circumcircle(a: Pt, b: Pt, c: Pt): { x: number; y: number; r2: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
  if (Math.abs(d) < 1e-12) return null
  const a2 = a[0] * a[0] + a[1] * a[1]
  const b2 = b[0] * b[0] + b[1] * b[1]
  const c2 = c[0] * c[0] + c[1] * c[1]
  const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d
  const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d
  return { x, y, r2: (a[0] - x) ** 2 + (a[1] - y) ** 2 }
}

/**
 * Delaunay triangulation by the Bowyer–Watson algorithm: start from a huge "super
 * triangle", insert points one at a time, remove every triangle whose circumcircle
 * contains the new point and re-triangulate the hole as a fan from that point.
 */
export function delaunay(pts: readonly Pt[]): Tri[] {
  const n = pts.length
  if (n < 3) return []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const span = Math.max(maxX - minX, maxY - minY, 1) * 1000
  const mx = (minX + maxX) / 2
  const my = (minY + maxY) / 2
  const P: Pt[] = [...pts, [mx - span, my - span], [mx + span, my - span], [mx, my + span]]

  interface T {
    v: Tri
    x: number
    y: number
    r2: number
  }
  const make = (a: number, b: number, c: number): T | null => {
    const cc = circumcircle(P[a], P[b], P[c])
    return cc && { v: [a, b, c], ...cc }
  }
  let tris: T[] = [make(n, n + 1, n + 2)!]
  const M = n + 3
  for (let i = 0; i < n; i++) {
    const [px, py] = P[i]
    const keep: T[] = []
    const edges = new Map<number, [number, number]>()
    const seen = new Map<number, number>()
    for (const t of tris) {
      const dx = px - t.x
      const dy = py - t.y
      if (dx * dx + dy * dy < t.r2 * (1 - 1e-12)) {
        const [a, b, c] = t.v
        for (const [u, w] of [[a, b], [b, c], [c, a]] as const) {
          const key = u < w ? u * M + w : w * M + u
          seen.set(key, (seen.get(key) ?? 0) + 1)
          edges.set(key, [u, w])
        }
      } else keep.push(t)
    }
    // The hole's boundary is every edge used by exactly one removed triangle.
    for (const [key, [u, w]] of edges) {
      if (seen.get(key) !== 1) continue
      const t = make(u, w, i)
      if (t) keep.push(t)
    }
    tris = keep
  }
  return tris.filter((t) => t.v[0] < n && t.v[1] < n && t.v[2] < n).map((t) => t.v)
}

/** Each point's Delaunay neighbours. */
export function neighbours(tris: readonly Tri[], n: number): number[][] {
  const out: Set<number>[] = Array.from({ length: n }, () => new Set())
  for (const [a, b, c] of tris) {
    out[a].add(b).add(c)
    out[b].add(a).add(c)
    out[c].add(a).add(b)
  }
  return out.map((s) => [...s])
}

/** Keeps the part of a convex polygon that is closer to p than to q (Sutherland–Hodgman). */
export function clipToward(poly: Pt[], p: Pt, q: Pt): Pt[] {
  const nx = q[0] - p[0]
  const ny = q[1] - p[1]
  const c = (nx * (p[0] + q[0])) / 2 + (ny * (p[1] + q[1])) / 2
  const side = (v: Pt) => v[0] * nx + v[1] * ny - c // < 0 means closer to p
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i]
    const B = poly[(i + 1) % poly.length]
    const sa = side(A)
    const sb = side(B)
    if (sa <= 0) out.push(A)
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
      const t = sa / (sa - sb)
      out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t])
    }
  }
  return out
}

/**
 * Voronoi cells clipped to the rectangle [0, w] × [0, h]. A cell is the intersection of
 * the half-planes "closer to me than to q" over its Delaunay neighbours q (the dual graph).
 */
export function voronoiCells(pts: readonly Pt[], tris: readonly Tri[], w: number, h: number): Pt[][] {
  const nb = neighbours(tris, pts.length)
  return pts.map((p, i) => {
    let poly: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]]
    // With fewer than 3 points there are no triangles, so fall back to all other points.
    const others = pts.length < 3 ? pts.map((_, j) => j).filter((j) => j !== i) : nb[i]
    for (const j of others) {
      poly = clipToward(poly, p, pts[j])
      if (poly.length === 0) break
    }
    return poly
  })
}

/** Area-weighted centroid of a simple polygon (for Lloyd relaxation). */
export function centroid(poly: readonly Pt[]): Pt | null {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    const cr = x0 * y1 - x1 * y0
    a += cr
    cx += (x0 + x1) * cr
    cy += (y0 + y1) * cr
  }
  if (Math.abs(a) < 1e-9) return null
  return [cx / (3 * a), cy / (3 * a)]
}

export type Metric = 'euclid' | 'manhattan'

/** Index of the nearest point to (x, y) under the metric. */
export function nearest(pts: readonly Pt[], x: number, y: number, metric: Metric): number {
  let best = -1
  let bd = Infinity
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i][0] - x
    const dy = pts[i][1] - y
    const d = metric === 'euclid' ? dx * dx + dy * dy : Math.abs(dx) + Math.abs(dy)
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}
