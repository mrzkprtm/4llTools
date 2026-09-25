/** One damped pendulum: amplitude, angular frequency (rad/s), phase (rad) and damping rate (1/s). */
export interface Pendulum {
  A: number
  f: number
  p: number
  d: number
}

/** A sin(f t + p) e^(−d t): the swing of a damped pendulum at time t. */
export const swing = (q: Pendulum, t: number, extraPhase = 0) => q.A * Math.sin(q.f * t + q.p + extraPhase) * Math.exp(-q.d * t)

export interface Machine {
  /** Moves the pen left–right. */
  x: Pendulum
  /** Moves the pen up–down. */
  y: Pendulum
  /** Optional third pendulum under the paper; rotary means it swings in a circle. */
  table: Pendulum | null
  rotary: boolean
}

/**
 * Pen position relative to the paper at time t:
 * x = A₁ sin(f₁t + p₁)e^(−d₁t) + A₃ sin(f₃t + p₃)e^(−d₃t)
 * y = A₂ sin(f₂t + p₂)e^(−d₂t) + A₃ sin(f₃t + p₃ + φ)e^(−d₃t), with φ = 90° for a rotary table.
 */
export function penAt(m: Machine, t: number): [number, number] {
  let x = swing(m.x, t)
  let y = swing(m.y, t)
  if (m.table) {
    x += swing(m.table, t)
    y += m.rotary ? swing(m.table, t, Math.PI / 2) : 0
  }
  return [x, y]
}

/** The largest remaining swing envelope, relative to the start (1 → 0 as the pendulums die down). */
export function envelope(m: Machine, t: number): number {
  const ps = [m.x, m.y, ...(m.table ? [m.table] : [])]
  return Math.max(...ps.map((q) => Math.exp(-q.d * t)))
}

/** Time until every pendulum has decayed to `fraction` of its amplitude. */
export function settleTime(m: Machine, fraction = 0.02): number {
  const ps = [m.x, m.y, ...(m.table ? [m.table] : [])]
  return Math.max(...ps.map((q) => (q.d > 0 ? Math.log(1 / fraction) / q.d : Infinity)))
}

/** Frequency ratios that give pleasing, nearly closed figures. */
export const PLEASANT: [number, number][] = [
  [1, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [3, 2],
  [2, 1],
  [3, 1],
  [4, 3],
  [1, 3],
  [4, 5],
]
