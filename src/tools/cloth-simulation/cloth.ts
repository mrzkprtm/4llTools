export type PinMode = 'row' | 'corners' | 'every4'

export interface ClothStep {
  /** Downward acceleration (px/s²). */
  gravity: number
  /** Extra acceleration at a point, e.g. gusting wind. */
  force?: (x: number, y: number) => [number, number]
  /** Constraint relaxation passes per step. */
  iterations: number
  /** Fraction of velocity kept each step (air drag). */
  damping?: number
  /** Links break when stretched beyond this multiple of their rest length (0 = never). */
  tearAt?: number
}

/** A sheet of point masses joined by distance constraints, integrated with position Verlet. */
export class Cloth {
  readonly cols: number
  readonly rows: number
  readonly n: number
  x: Float64Array
  y: Float64Array
  px: Float64Array
  py: Float64Array
  pinned: Uint8Array
  /** Constraint endpoints, rest lengths and whether each link is still intact. */
  ca: Int32Array
  cb: Int32Array
  rest: Float64Array
  alive: Uint8Array
  /** Index of the link to the right of / below each point, or −1. */
  right: Int32Array
  down: Int32Array
  grabbed = -1
  private gx = 0
  private gy = 0

  constructor(cols: number, rows: number, spacing: number, ox: number, oy: number, pin: PinMode = 'row') {
    this.cols = cols
    this.rows = rows
    this.n = cols * rows
    const f = () => new Float64Array(this.n)
    this.x = f()
    this.y = f()
    this.px = f()
    this.py = f()
    this.pinned = new Uint8Array(this.n)
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i
        this.x[k] = this.px[k] = ox + i * spacing
        this.y[k] = this.py[k] = oy + j * spacing
        if (j === 0 && (pin === 'row' || (pin === 'corners' && (i === 0 || i === cols - 1)) || (pin === 'every4' && (i % 4 === 0 || i === cols - 1)))) this.pinned[k] = 1
      }
    const a: number[] = []
    const b: number[] = []
    this.right = new Int32Array(this.n).fill(-1)
    this.down = new Int32Array(this.n).fill(-1)
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i
        if (i < cols - 1) (this.right[k] = a.length), a.push(k), b.push(k + 1)
        if (j < rows - 1) (this.down[k] = a.length), a.push(k), b.push(k + cols)
      }
    this.ca = Int32Array.from(a)
    this.cb = Int32Array.from(b)
    this.rest = new Float64Array(a.length).fill(spacing)
    this.alive = new Uint8Array(a.length).fill(1)
  }

  step(dt: number, { gravity, force, iterations, damping = 0.995, tearAt = 0 }: ClothStep) {
    const { x, y, px, py, pinned } = this
    const dt2 = dt * dt
    for (let k = 0; k < this.n; k++) {
      if (pinned[k]) continue
      if (k === this.grabbed) {
        px[k] = x[k]
        py[k] = y[k]
        x[k] = this.gx
        y[k] = this.gy
        continue
      }
      let ax = 0
      let ay = gravity
      if (force) {
        const [fx, fy] = force(x[k], y[k])
        ax += fx
        ay += fy
      }
      const vx = (x[k] - px[k]) * damping
      const vy = (y[k] - py[k]) * damping
      px[k] = x[k]
      py[k] = y[k]
      x[k] += vx + ax * dt2
      y[k] += vy + ay * dt2
    }
    this.satisfy(iterations, tearAt)
  }

  /** Moves linked points towards their rest distance; pinned and grabbed points do not move. */
  satisfy(iterations: number, tearAt = 0) {
    const { x, y, ca, cb, rest, alive, pinned } = this
    const fixed = (k: number) => pinned[k] === 1 || k === this.grabbed
    for (let it = 0; it < iterations; it++)
      for (let c = 0; c < ca.length; c++) {
        if (!alive[c]) continue
        const a = ca[c]
        const b = cb[c]
        const dx = x[b] - x[a]
        const dy = y[b] - y[a]
        const d = Math.hypot(dx, dy) || 1e-9
        if (tearAt > 0 && d > rest[c] * tearAt) {
          alive[c] = 0
          continue
        }
        const fa = fixed(a)
        const fb = fixed(b)
        if (fa && fb) continue
        const diff = (d - rest[c]) / d
        const wa = fa ? 0 : fb ? 1 : 0.5
        const wb = fb ? 0 : fa ? 1 : 0.5
        x[a] += dx * diff * wa
        y[a] += dy * diff * wa
        x[b] -= dx * diff * wb
        y[b] -= dy * diff * wb
      }
  }

  /** Nearest free point within r of (x, y), or −1. */
  nearest(x: number, y: number, r: number): number {
    let best = -1
    let bd = r * r
    for (let k = 0; k < this.n; k++) {
      const d = (this.x[k] - x) ** 2 + (this.y[k] - y) ** 2
      if (d < bd && !this.pinned[k]) (bd = d), (best = k)
    }
    return best
  }

  grab(k: number, x: number, y: number) {
    this.grabbed = k
    this.gx = x
    this.gy = y
  }

  /** Puts the grabbed point where the pointer is without giving it any speed (used while paused). */
  snap() {
    const k = this.grabbed
    if (k < 0) return
    this.x[k] = this.px[k] = this.gx
    this.y[k] = this.py[k] = this.gy
  }

  release() {
    this.grabbed = -1
  }

  /** Breaks every link whose midpoint lies within r of the segment (x0, y0)–(x1, y1). Returns how many broke. */
  cut(x0: number, y0: number, x1: number, y1: number, r: number): number {
    let broke = 0
    const sx = x1 - x0
    const sy = y1 - y0
    const L2 = sx * sx + sy * sy || 1e-9
    for (let c = 0; c < this.ca.length; c++) {
      if (!this.alive[c]) continue
      const mx = (this.x[this.ca[c]] + this.x[this.cb[c]]) / 2
      const my = (this.y[this.ca[c]] + this.y[this.cb[c]]) / 2
      const t = Math.max(0, Math.min(1, ((mx - x0) * sx + (my - y0) * sy) / L2))
      if ((mx - x0 - sx * t) ** 2 + (my - y0 - sy * t) ** 2 < r * r) {
        this.alive[c] = 0
        broke++
      }
    }
    return broke
  }

  /** Largest relative stretch (length / rest − 1) over intact links. */
  maxStretch(): number {
    let m = 0
    for (let c = 0; c < this.ca.length; c++) {
      if (!this.alive[c]) continue
      const d = Math.hypot(this.x[this.cb[c]] - this.x[this.ca[c]], this.y[this.cb[c]] - this.y[this.ca[c]])
      m = Math.max(m, Math.abs(d / this.rest[c] - 1))
    }
    return m
  }
}
