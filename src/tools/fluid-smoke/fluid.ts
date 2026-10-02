/**
 * Jos Stam's "Stable Fluids" on an nx × ny grid with a one-cell wall around it.
 * Everything is in cell units: velocities in cells per second, viscosity in cells² per second.
 * Row j grows downwards, like the screen.
 */
export interface FluidParams {
  /** Kinematic viscosity (cells²/s). */
  visc?: number
  /** Fraction of dye lost per second. */
  fade?: number
  /** Vorticity confinement strength. */
  vorticity?: number
  /** Upward push per unit of dye (cells/s²). */
  buoyancy?: number
  /** Gauss–Seidel sweeps for diffusion and the pressure solve. */
  iterations?: number
}

const clampTo = (x: number, n: number) => (x < 0.5 ? 0.5 : x > n + 0.5 ? n + 0.5 : x)

/** Bilinear sample of a (nx+2)-wide grid at fractional cell coordinates. */
function sample(d: Float64Array, x: number, y: number, W: number) {
  const i0 = Math.floor(x)
  const j0 = Math.floor(y)
  const s = x - i0
  const t = y - j0
  const k = i0 + W * j0
  return (1 - s) * ((1 - t) * d[k] + t * d[k + W]) + s * ((1 - t) * d[k + 1] + t * d[k + 1 + W])
}

export class Fluid {
  readonly nx: number
  readonly ny: number
  readonly size: number
  u: Float64Array
  v: Float64Array
  u0: Float64Array
  v0: Float64Array
  /** Three dye channels (red, green, blue). */
  dye: Float64Array[]
  private tmp: Float64Array
  private curl: Float64Array
  private bx: Float64Array
  private by: Float64Array

  constructor(nx: number, ny: number) {
    this.nx = nx
    this.ny = ny
    this.size = (nx + 2) * (ny + 2)
    const f = () => new Float64Array(this.size)
    this.u = f()
    this.v = f()
    this.u0 = f()
    this.v0 = f()
    this.dye = [f(), f(), f()]
    this.tmp = f()
    this.curl = f()
    this.bx = f()
    this.by = f()
  }

  IX(i: number, j: number) {
    return i + (this.nx + 2) * j
  }

  clear() {
    for (const a of [this.u, this.v, this.u0, this.v0, ...this.dye]) a.fill(0)
  }

  /** Adds velocity (du, dv) in a soft disc of `radius` cells around (x, y) in cell coordinates. */
  addVelocity(x: number, y: number, du: number, dv: number, radius = 3) {
    this.splat(x, y, radius, (k, w) => {
      this.u[k] += du * w
      this.v[k] += dv * w
    })
  }

  /** Pulls the velocity in a soft disc towards (tu, tv), like a nozzle; `rate` is the fraction per call. */
  nudgeVelocity(x: number, y: number, tu: number, tv: number, radius = 3, rate = 0.3) {
    this.splat(x, y, radius, (k, w) => {
      this.u[k] += (tu - this.u[k]) * w * rate
      this.v[k] += (tv - this.v[k]) * w * rate
    })
  }

  addDye(x: number, y: number, r: number, g: number, b: number, radius = 3) {
    this.splat(x, y, radius, (k, w) => {
      this.dye[0][k] += r * w
      this.dye[1][k] += g * w
      this.dye[2][k] += b * w
    })
  }

  private splat(x: number, y: number, radius: number, fn: (k: number, w: number) => void) {
    const r = Math.ceil(radius)
    const ci = Math.round(x)
    const cj = Math.round(y)
    for (let j = cj - r; j <= cj + r; j++)
      for (let i = ci - r; i <= ci + r; i++) {
        if (i < 1 || j < 1 || i > this.nx || j > this.ny) continue
        const d2 = ((i - x) ** 2 + (j - y) ** 2) / (radius * radius)
        if (d2 < 1) fn(this.IX(i, j), Math.exp(-d2 * 3))
      }
  }

  step(dt: number, { visc = 0, fade = 0, vorticity = 0, buoyancy = 0, iterations = 16 }: FluidParams = {}) {
    // External forces: buoyancy from the dye and vorticity confinement.
    if (buoyancy) {
      const [r, g, b] = this.dye
      for (let k = 0; k < this.size; k++) this.v[k] -= buoyancy * dt * Math.min(3, (r[k] + g[k] + b[k]) / 3)
    }
    if (vorticity) this.confine(vorticity, dt)

    // Velocity: diffuse, project, advect, project.
    this.swapVel()
    this.diffuse(1, this.u, this.u0, visc, dt, iterations)
    this.diffuse(2, this.v, this.v0, visc, dt, iterations)
    this.project(iterations)
    this.swapVel()
    this.backtrace(this.u0, this.v0, dt)
    this.advect(1, this.u, this.u0)
    this.advect(2, this.v, this.v0)
    this.project(iterations)

    // Dye rides along the flow.
    const keep = fade > 0 ? Math.max(0, 1 - fade * dt) : 1
    this.backtrace(this.u, this.v, dt)
    for (let c = 0; c < 3; c++) {
      this.tmp.set(this.dye[c])
      const before = this.interiorSum(this.tmp)
      this.advect(0, this.dye[c], this.tmp)
      // Semi-Lagrangian advection is not conservative; the box is closed, so put back what the interpolation lost or gained.
      const after = this.interiorSum(this.dye[c])
      if (after > 1e-9 && before > 0) {
        const k = before / after
        const d = this.dye[c]
        for (let q = 0; q < this.size; q++) d[q] *= k
      }
      if (keep !== 1) {
        const d = this.dye[c]
        for (let k = 0; k < this.size; k++) d[k] *= keep
      }
    }
  }

  /** Makes the velocity field divergence-free (a Helmholtz projection solved with Gauss–Seidel). */
  project(iterations = 16) {
    const { nx, ny, u, v } = this
    const p = this.u0
    const div = this.v0
    const W = nx + 2
    for (let j = 1; j <= ny; j++)
      for (let i = 1; i <= nx; i++) {
        const k = i + W * j
        div[k] = -0.5 * (u[k + 1] - u[k - 1] + v[k + W] - v[k - W])
        p[k] = 0
      }
    this.bound(0, div)
    this.bound(0, p)
    // Over-relaxed Gauss–Seidel (SOR) settles the smooth pressure modes far faster than plain sweeps.
    this.linSolve(0, p, div, 1, 4, iterations, 1.8)
    for (let j = 1; j <= ny; j++)
      for (let i = 1; i <= nx; i++) {
        const k = i + W * j
        u[k] -= 0.5 * (p[k + 1] - p[k - 1])
        v[k] -= 0.5 * (p[k + W] - p[k - W])
      }
    this.bound(1, u)
    this.bound(2, v)
  }

  /** Sum of |∇·u| over the interior. */
  divergence(): number {
    const { nx, ny, u, v } = this
    const W = nx + 2
    let s = 0
    for (let j = 1; j <= ny; j++)
      for (let i = 1; i <= nx; i++) {
        const k = i + W * j
        s += Math.abs(0.5 * (u[k + 1] - u[k - 1] + v[k + W] - v[k - W]))
      }
    return s
  }

  /** Total dye in the interior across all three channels. */
  totalDye(): number {
    return this.dye.reduce((s, d) => s + this.interiorSum(d), 0)
  }

  private interiorSum(d: Float64Array) {
    const W = this.nx + 2
    let s = 0
    for (let j = 1; j <= this.ny; j++) for (let i = 1, k = 1 + W * j; i <= this.nx; i++, k++) s += d[k]
    return s
  }

  private swapVel() {
    ;[this.u, this.u0] = [this.u0, this.u]
    ;[this.v, this.v0] = [this.v0, this.v]
  }

  private diffuse(b: number, x: Float64Array, x0: Float64Array, diff: number, dt: number, iterations: number) {
    if (diff <= 0) {
      x.set(x0)
      this.bound(b, x)
      return
    }
    const a = dt * diff
    this.linSolve(b, x, x0, a, 1 + 4 * a, iterations)
  }

  private linSolve(b: number, x: Float64Array, x0: Float64Array, a: number, c: number, iterations: number, omega = 1) {
    const { nx, ny } = this
    const W = nx + 2
    const inv = 1 / c
    for (let it = 0; it < iterations; it++) {
      for (let j = 1; j <= ny; j++) {
        let k = 1 + W * j
        // Carry the freshly updated left neighbour in a local: same maths, fewer memory reads.
        let left = x[k - 1]
        for (let i = 1; i <= nx; i++, k++) {
          const gs = (x0[k] + a * (left + x[k + 1] + x[k - W] + x[k + W])) * inv
          left = x[k] = omega === 1 ? gs : x[k] + omega * (gs - x[k])
        }
      }
      this.bound(b, x)
    }
  }

  /** Where each cell's contents came from one step ago: a midpoint (RK2) trace back along the flow. */
  private backtrace(u: Float64Array, v: Float64Array, dt: number) {
    const { nx, ny, bx, by } = this
    const W = nx + 2
    for (let j = 1; j <= ny; j++)
      for (let i = 1; i <= nx; i++) {
        const k = i + W * j
        const mx = clampTo(i - 0.5 * dt * u[k], nx)
        const my = clampTo(j - 0.5 * dt * v[k], ny)
        bx[k] = clampTo(i - dt * sample(u, mx, my, W), nx)
        by[k] = clampTo(j - dt * sample(v, mx, my, W), ny)
      }
  }

  /** Semi-Lagrangian advection using the positions from the last backtrace. */
  private advect(b: number, d: Float64Array, d0: Float64Array) {
    const { nx, ny, bx, by } = this
    const W = nx + 2
    for (let j = 1; j <= ny; j++)
      for (let i = 1; i <= nx; i++) {
        const k = i + W * j
        d[k] = sample(d0, bx[k], by[k], W)
      }
    this.bound(b, d)
  }

  private confine(eps: number, dt: number) {
    const { nx, ny, u, v, curl } = this
    const W = nx + 2
    for (let j = 1; j <= ny; j++)
      for (let i = 1; i <= nx; i++) {
        const k = i + W * j
        curl[k] = 0.5 * (v[k + 1] - v[k - 1] - u[k + W] + u[k - W])
      }
    for (let j = 2; j < ny; j++)
      for (let i = 2; i < nx; i++) {
        const k = i + W * j
        const gx = 0.5 * (Math.abs(curl[k + 1]) - Math.abs(curl[k - 1]))
        const gy = 0.5 * (Math.abs(curl[k + W]) - Math.abs(curl[k - W]))
        const len = Math.hypot(gx, gy) + 1e-5
        const w = curl[k]
        u[k] += dt * eps * (gy / len) * w
        v[k] -= dt * eps * (gx / len) * w
      }
  }

  /** Walls: velocity components normal to a wall are mirrored, everything else is copied. */
  private bound(b: number, x: Float64Array) {
    const { nx, ny } = this
    const W = nx + 2
    for (let i = 1; i <= nx; i++) {
      x[i] = b === 2 ? -x[i + W] : x[i + W]
      x[i + W * (ny + 1)] = b === 2 ? -x[i + W * ny] : x[i + W * ny]
    }
    for (let j = 1; j <= ny; j++) {
      x[W * j] = b === 1 ? -x[1 + W * j] : x[1 + W * j]
      x[nx + 1 + W * j] = b === 1 ? -x[nx + W * j] : x[nx + W * j]
    }
    x[0] = 0.5 * (x[1] + x[W])
    x[W * (ny + 1)] = 0.5 * (x[1 + W * (ny + 1)] + x[W * ny])
    x[nx + 1] = 0.5 * (x[nx] + x[nx + 1 + W])
    x[nx + 1 + W * (ny + 1)] = 0.5 * (x[nx + W * (ny + 1)] + x[nx + 1 + W * ny])
  }
}
