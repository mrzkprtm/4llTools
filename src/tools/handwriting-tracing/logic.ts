export type Pt = [number, number]

export function pathLength(pts: readonly Pt[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return len
}

/** Points every `spacing` units along a polyline, always including both ends. */
export function samplePath(pts: readonly Pt[], spacing: number): Pt[] {
  if (!pts.length) return []
  const out: Pt[] = [[pts[0][0], pts[0][1]]]
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const seg = Math.hypot(x1 - x0, y1 - y0)
    let d = spacing - carry
    while (d <= seg) {
      const t = d / seg
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t])
      d += spacing
    }
    carry = seg - (d - spacing)
  }
  const last = pts[pts.length - 1]
  const tail = out[out.length - 1]
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > 1e-6) out.push([last[0], last[1]])
  return out
}

/** The first `len` units of a polyline (for drawing a stroke as it animates). */
export function partialPath(pts: readonly Pt[], len: number): Pt[] {
  if (!pts.length) return []
  const out: Pt[] = [pts[0]]
  let left = len
  for (let i = 1; i < pts.length && left > 0; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const seg = Math.hypot(x1 - x0, y1 - y0)
    if (seg <= left) out.push(pts[i])
    else out.push([x0 + ((x1 - x0) * left) / seg, y0 + ((y1 - y0) * left) / seg])
    left -= seg
  }
  return out
}

/** Share of `targets` that have at least one of `points` within `tol`. */
export function nearShare(targets: readonly Pt[], points: readonly Pt[], tol: number): number {
  if (!targets.length) return 0
  const t2 = tol * tol
  let hit = 0
  for (const [x, y] of targets) {
    for (const [px, py] of points) {
      if ((px - x) ** 2 + (py - y) ** 2 <= t2) {
        hit++
        break
      }
    }
  }
  return hit / targets.length
}

export interface TraceScore {
  /** Share of the guide path the ink covered (0–1). */
  coverage: number
  /** Share of the ink that stayed on the guide (0–1). */
  precision: number
  /** 0–100, weighted mostly on coverage. */
  score: number
}

/** Scores a tracing attempt: how much of the guide was covered and how much ink stayed near it. */
export function traceScore(guide: readonly Pt[][], ink: readonly Pt[][], tol = 7, spacing = 2): TraceScore {
  const g = guide.flatMap((s) => samplePath(s, spacing))
  const k = ink.flatMap((s) => (s.length === 1 ? [s[0]] : samplePath(s, spacing)))
  if (!k.length || !g.length) return { coverage: 0, precision: 0, score: 0 }
  const coverage = nearShare(g, k, tol)
  const precision = nearShare(k, g, tol)
  return { coverage, precision, score: Math.round(100 * (0.75 * coverage + 0.25 * precision)) }
}

export const stars = (score: number) => (score >= 90 ? 3 : score >= 75 ? 2 : score >= 50 ? 1 : 0)
