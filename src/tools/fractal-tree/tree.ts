export interface TreeParams {
  /** Number of levels, including the trunk. */
  depth: number
  /** Half-angle between the two child branches, in degrees. */
  angle: number
  /** Child length ÷ parent length. */
  ratio: number
  /** Trunk length in world units. */
  trunk: number
  /** −0.5 … 0.5: positive makes left branches bend more and grow shorter. */
  asym: number
  /** Child width ÷ parent width. */
  taper: number
}

export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
  /** 0 for the trunk, depth − 1 for the outermost twigs. */
  level: number
  width: number
}

/**
 * Builds the tree breadth-first from a root at (x, y) growing upward (−y).
 * `bend(level, id)` adds an extra angle in radians to each branch (used for wind);
 * ids number the branches like a binary heap: trunk 1, children 2i and 2i + 1.
 * A tree of depth d has 2^d − 1 segments.
 */
export function branches(p: TreeParams, x = 0, y = 0, bend?: (level: number, id: number) => number): Segment[] {
  const out: Segment[] = []
  const a = (p.angle * Math.PI) / 180
  const lr = Math.min(0.95, p.ratio * (1 - p.asym * 0.35))
  const rr = Math.min(0.95, p.ratio * (1 + p.asym * 0.35))
  const la = a * (1 + p.asym)
  const ra = a * (1 - p.asym)
  // Each frontier entry: start point, heading (radians, 0 = up), length, width, heap id.
  let frontier: [number, number, number, number, number, number][] = [[x, y, 0, p.trunk, Math.max(1, p.trunk / 8), 1]]
  for (let level = 0; level < p.depth; level++) {
    const next: typeof frontier = []
    for (const [sx, sy, heading, len, w, id] of frontier) {
      const h = heading + (bend ? bend(level, id) : 0)
      const ex = sx + Math.sin(h) * len
      const ey = sy - Math.cos(h) * len
      out.push({ x1: sx, y1: sy, x2: ex, y2: ey, level, width: w })
      if (level + 1 < p.depth) {
        next.push([ex, ey, h - la, len * lr, w * p.taper, id * 2])
        next.push([ex, ey, h + ra, len * rr, w * p.taper, id * 2 + 1])
      }
    }
    frontier = next
  }
  return out
}

/** Axis-aligned bounds [minX, minY, maxX, maxY] of a list of segments. */
export function bounds(segs: Segment[]): [number, number, number, number] {
  let a = Infinity
  let b = Infinity
  let c = -Infinity
  let d = -Infinity
  for (const s of segs) {
    a = Math.min(a, s.x1, s.x2)
    b = Math.min(b, s.y1, s.y2)
    c = Math.max(c, s.x1, s.x2)
    d = Math.max(d, s.y1, s.y2)
  }
  return [a, b, c, d]
}
