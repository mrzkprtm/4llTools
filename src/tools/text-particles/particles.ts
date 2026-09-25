/** Sampling text into target points, and a spring-driven particle swarm that flows between them. */

/**
 * Picks grid points (every `gap` pixels) whose alpha is above the threshold.
 * `data` is RGBA like ImageData.data; returns a flat [x0, y0, x1, y1, …] array of pixel centres.
 */
export function sampleText(data: ArrayLike<number>, w: number, h: number, gap: number, threshold = 128): number[] {
  const out: number[] = []
  const g = Math.max(1, Math.round(gap))
  for (let y = Math.floor(g / 2); y < h; y += g)
    for (let x = Math.floor(g / 2); x < w; x += g) if (data[(y * w + x) * 4 + 3] > threshold) out.push(x + 0.5, y + 0.5)
  return out
}

export interface Swarm {
  n: number
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  tx: Float32Array
  ty: Float32Array
  /** A fixed colour coordinate in [0, 1] from where the particle first appeared. */
  hue: Float32Array
  /** 0 → 1 while fading in, 1 when settled, and counting down to 0 while leaving. */
  life: Float32Array
  dying: Uint8Array
}

export function makeSwarm(cap: number): Swarm {
  const f = () => new Float32Array(cap)
  return { n: 0, x: f(), y: f(), vx: f(), vy: f(), tx: f(), ty: f(), hue: f(), life: f(), dying: new Uint8Array(cap) }
}

/**
 * Gives the swarm a new set of targets. Particles and targets are both ordered left to right,
 * so the swarm flows across rather than criss-crossing. Spare particles fade out and missing ones
 * are born next to existing particles (or at `spawn` → [x, y, hue] when the swarm is empty).
 */
export function retarget(s: Swarm, targets: number[], spawn: () => [number, number, number]) {
  const m = Math.min(targets.length / 2, s.x.length)
  // Drop particles that were already leaving.
  let k = 0
  for (let i = 0; i < s.n; i++) if (!s.dying[i]) copy(s, i, k++)
  s.n = k
  const order = Array.from({ length: s.n }, (_, i) => i).sort((a, b) => s.x[a] - s.x[b])
  const tOrder = Array.from({ length: m }, (_, i) => i).sort((a, b) => targets[2 * a] - targets[2 * b] || targets[2 * a + 1] - targets[2 * b + 1])
  const alive = s.n
  // Surplus particles leave: spread them evenly through the ordering so every letter loses some.
  const keep = new Uint8Array(alive)
  if (alive > m) for (let q = 0; q < m; q++) keep[order[Math.floor((q * alive) / m)]] = 1
  else keep.fill(1)
  let q = 0
  for (const i of order) {
    if (keep[i]) {
      const t = tOrder[q++]
      s.tx[i] = targets[2 * t]
      s.ty[i] = targets[2 * t + 1]
    } else {
      s.dying[i] = 1
      s.tx[i] = s.x[i] + (Math.random() - 0.5) * 120
      s.ty[i] = s.y[i] + (Math.random() - 0.5) * 120
    }
  }
  // Newcomers for the remaining targets.
  for (; q < m && s.n < s.x.length; q++) {
    const t = tOrder[q]
    const i = s.n++
    let px: number
    let py: number
    let hue: number
    if (alive > 0) {
      const src = order[Math.floor(Math.random() * alive)]
      px = s.x[src] + (Math.random() - 0.5) * 8
      py = s.y[src] + (Math.random() - 0.5) * 8
      hue = s.hue[src]
    } else [px, py, hue] = spawn()
    s.x[i] = px
    s.y[i] = py
    s.vx[i] = 0
    s.vy[i] = 0
    s.tx[i] = targets[2 * t]
    s.ty[i] = targets[2 * t + 1]
    s.hue[i] = hue
    s.life[i] = 0
    s.dying[i] = 0
  }
}

function copy(s: Swarm, from: number, to: number) {
  if (from === to) return
  for (const a of [s.x, s.y, s.vx, s.vy, s.tx, s.ty, s.hue, s.life]) a[to] = a[from]
  s.dying[to] = s.dying[from]
}

export interface StepOpts {
  stiffness: number
  damping: number
  /** Pointer position, or null when it is away. */
  px: number | null
  py: number
  radius: number
  force: number
}

/** Semi-implicit Euler step: springs pull toward targets, damping slows, the pointer pushes away. */
export function stepSwarm(s: Swarm, dt: number, o: StepOpts) {
  const { x, y, vx, vy, tx, ty, life, dying } = s
  const r2 = o.radius * o.radius
  for (let i = 0; i < s.n; i++) {
    let ax = o.stiffness * (tx[i] - x[i]) - o.damping * vx[i]
    let ay = o.stiffness * (ty[i] - y[i]) - o.damping * vy[i]
    if (o.px !== null) {
      const dx = x[i] - o.px
      const dy = y[i] - o.py
      const d2 = dx * dx + dy * dy
      if (d2 < r2 && d2 > 1e-6) {
        const d = Math.sqrt(d2)
        const f = o.force * (1 - d / o.radius)
        ax += (dx / d) * f
        ay += (dy / d) * f
      }
    }
    vx[i] += ax * dt
    vy[i] += ay * dt
    x[i] += vx[i] * dt
    y[i] += vy[i] * dt
    life[i] = dying[i] ? life[i] - dt * 1.5 : Math.min(1, life[i] + dt * 1.5)
  }
  // Remove particles that have faded out.
  for (let i = s.n - 1; i >= 0; i--)
    if (dying[i] && life[i] <= 0) {
      copy(s, s.n - 1, i)
      s.n--
    }
}

/** Gives every particle a random outward kick from (cx, cy). */
export function explode(s: Swarm, cx: number, cy: number, power: number) {
  for (let i = 0; i < s.n; i++) {
    const a = Math.atan2(s.y[i] - cy, s.x[i] - cx) + (Math.random() - 0.5) * 1.2
    const v = power * (0.4 + Math.random())
    s.vx[i] += Math.cos(a) * v
    s.vy[i] += Math.sin(a) * v
  }
}
