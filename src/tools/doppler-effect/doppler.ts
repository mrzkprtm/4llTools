/**
 * Observed frequency for a moving source and observer in still air.
 * `vs` is the source's speed towards the observer and `vo` the observer's speed
 * towards the source (both positive when closing in). Returns Infinity when the
 * source moves towards the observer at or above the wave speed (the fronts pile up).
 */
export function dopplerObserved(f: number, c: number, vs: number, vo = 0): number {
  const den = c - vs
  if (den <= 1e-12) return Infinity
  return (f * (c + vo)) / den
}

/** Half-angle of the Mach cone in radians, or null below Mach 1 (no cone). */
export function machAngle(M: number): number | null {
  return M >= 1 ? Math.asin(1 / M) : null
}

/** The component of the velocity (vx, vy) at (sx, sy) that points at (ox, oy). */
export function approachSpeed(sx: number, sy: number, vx: number, vy: number, ox: number, oy: number): number {
  const dx = ox - sx
  const dy = oy - sy
  const d = Math.hypot(dx, dy)
  return d > 0 ? (vx * dx + vy * dy) / d : 0
}
