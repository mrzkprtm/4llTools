/** Space-filling curves as point lists: Hilbert, Moore, Peano, Z-order (Morton) and Gosper. */

export type Kind = 'hilbert' | 'moore' | 'peano' | 'zorder' | 'gosper'

/** Hilbert index d → cell (x, y) on an N×N grid (N a power of two). */
export function hilbertD2xy(N: number, d: number): [number, number] {
  let x = 0
  let y = 0
  let t = d
  for (let s = 1; s < N; s *= 2) {
    const rx = 1 & (t / 2)
    const ry = 1 & (t ^ rx)
    ;[x, y] = rotate(s, x, y, rx, ry)
    x += s * rx
    y += s * ry
    t = Math.floor(t / 4)
  }
  return [x, y]
}

/** Cell (x, y) → Hilbert index on an N×N grid. */
export function hilbertXy2d(N: number, x: number, y: number): number {
  let d = 0
  for (let s = N / 2; s >= 1; s /= 2) {
    const rx = (x & s) > 0 ? 1 : 0
    const ry = (y & s) > 0 ? 1 : 0
    d += s * s * ((3 * rx) ^ ry)
    ;[x, y] = rotate(N, x, y, rx, ry)
  }
  return d
}

function rotate(n: number, x: number, y: number, rx: number, ry: number): [number, number] {
  if (ry === 0) {
    if (rx === 1) {
      x = n - 1 - x
      y = n - 1 - y
    }
    return [y, x]
  }
  return [x, y]
}

/** Morton (Z-order) index → cell: x takes the even bits, y the odd bits. */
export function mortonD2xy(d: number): [number, number] {
  let x = 0
  let y = 0
  for (let b = 0; d > 0; b++) {
    x |= (d & 1) << b
    y |= ((d >> 1) & 1) << b
    d = Math.floor(d / 4)
  }
  return [x, y]
}

/** Runs an L-system with a turtle; `draw` symbols move forward one unit. Returns flat [x, y, …] points. */
export function lsystem(axiom: string, rules: Record<string, string>, depth: number, angleDeg: number, draw: string): number[] {
  const out = [0, 0]
  let x = 0
  let y = 0
  let a = 0
  const turn = (angleDeg * Math.PI) / 180
  const walk = (s: string, level: number) => {
    for (const c of s) {
      if (level > 0 && rules[c]) walk(rules[c], level - 1)
      else if (c === '+') a += turn
      else if (c === '-') a -= turn
      else if (draw.includes(c)) {
        x += Math.cos(a)
        y += Math.sin(a)
        out.push(Math.round(x * 1e9) / 1e9, Math.round(y * 1e9) / 1e9)
      }
    }
  }
  walk(axiom, depth)
  return out
}

/** Highest order worth drawing for each curve (about 20 000 points at most). */
export const MAX_ORDER: Record<Kind, number> = { hilbert: 7, moore: 7, zorder: 7, peano: 4, gosper: 5 }

/** Children per parent cell when going up one order (grid curves only). */
export const BRANCH: Record<Kind, number> = { hilbert: 2, moore: 2, zorder: 2, peano: 3, gosper: 0 }

export interface CurveData {
  /** Flat [x, y, …] in cell units (0 … n−1) for grid curves; fitted to that box for Gosper. */
  pts: Float32Array
  /** Cells per side (grid curves) or the box size used for Gosper. */
  n: number
  grid: boolean
}

export function buildCurve(kind: Kind, order: number): CurveData {
  const o = Math.max(1, Math.min(MAX_ORDER[kind], order))
  if (kind === 'hilbert' || kind === 'zorder') {
    const n = 2 ** o
    const pts = new Float32Array(n * n * 2)
    for (let d = 0; d < n * n; d++) {
      const [x, y] = kind === 'hilbert' ? hilbertD2xy(n, d) : mortonD2xy(d)
      pts[2 * d] = x
      pts[2 * d + 1] = y
    }
    return { pts, n, grid: true }
  }
  const raw =
    kind === 'moore'
      ? lsystem('LFL+F+LFL', { L: '-RF+LFL+FR-', R: '+LF-RFR-FL+' }, o - 1, 90, 'F')
      : kind === 'peano'
        ? lsystem('X', { X: 'XFYFX+F+YFXFY-F-XFYFX', Y: 'YFXFY-F-XFYFX+F+YFXFY' }, o, 90, 'F')
        : lsystem('A', { A: 'A-B--B+A++AA+B-', B: '+A-BB--B-A++A+B' }, o, 60, 'AB')
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < raw.length; i += 2) {
    minX = Math.min(minX, raw[i])
    maxX = Math.max(maxX, raw[i])
    minY = Math.min(minY, raw[i + 1])
    maxY = Math.max(maxY, raw[i + 1])
  }
  const pts = new Float32Array(raw.length)
  if (kind === 'gosper') {
    // Fit into a box of the same size as a Hilbert grid, centred.
    const n = 64
    const s = (n - 1) / Math.max(maxX - minX, maxY - minY)
    const ox = (n - 1 - (maxX - minX) * s) / 2
    const oy = (n - 1 - (maxY - minY) * s) / 2
    for (let i = 0; i < raw.length; i += 2) {
      pts[i] = (raw[i] - minX) * s + ox
      pts[i + 1] = (raw[i + 1] - minY) * s + oy
    }
    return { pts, n, grid: false }
  }
  for (let i = 0; i < raw.length; i += 2) {
    pts[i] = Math.round(raw[i] - minX)
    pts[i + 1] = Math.round(raw[i + 1] - minY)
  }
  return { pts, n: Math.round(maxX - minX) + 1, grid: true }
}

/** Total length of the polyline, in cell units. */
export function pathLength(pts: Float32Array): number {
  let s = 0
  for (let i = 2; i < pts.length; i += 2) s += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1])
  return s
}
