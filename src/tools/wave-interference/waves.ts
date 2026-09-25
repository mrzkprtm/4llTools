export interface Source {
  x: number
  y: number
  /** Phase offset in radians. */
  phase: number
}

/** Displacement at (x, y) and time t from circular waves of wavelength λ, with 1/√r spreading. */
export function waveAt(sources: Source[], x: number, y: number, t: number, lambda: number, freq: number): number {
  const k = (2 * Math.PI) / lambda
  const w = 2 * Math.PI * freq
  let sum = 0
  for (const s of sources) {
    const r = Math.hypot(x - s.x, y - s.y)
    sum += Math.sin(k * r - w * t + s.phase) / Math.sqrt(1 + r / lambda)
  }
  return sum
}

/** Time-averaged intensity at (x, y): the squared amplitude of the summed phasors. */
export function intensityAt(sources: Source[], x: number, y: number, lambda: number): number {
  const k = (2 * Math.PI) / lambda
  let re = 0
  let im = 0
  for (const s of sources) {
    const r = Math.hypot(x - s.x, y - s.y)
    const a = 1 / Math.sqrt(1 + r / lambda)
    re += a * Math.cos(k * r + s.phase)
    im += a * Math.sin(k * r + s.phase)
  }
  return re * re + im * im
}

/** Path difference between two sources in wavelengths, and whether it interferes constructively. */
export function pathDifference(a: Source, b: Source, x: number, y: number, lambda: number) {
  const d = (Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y)) / lambda + (a.phase - b.phase) / (2 * Math.PI)
  const frac = Math.abs(d - Math.round(d))
  return { waves: d, kind: frac < 0.15 ? ('constructive' as const) : frac > 0.35 ? ('destructive' as const) : ('partial' as const) }
}
