import { TAU } from '../../sim/math'

/** Mean length of the lunar (synodic) month in days: new moon to new moon. */
export const SYNODIC = 29.530589

export const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent']

export const norm = (a: number) => ((a % TAU) + TAU) % TAU

/**
 * Name of the phase for the Sun–Earth–Moon angle θ (radians, 0 = new moon,
 * π = full moon), using eight equal 45° slices centred on each named phase.
 */
export function phaseName(angle: number): string {
  return PHASES[Math.round(norm(angle) / (TAU / 8)) % 8]
}

/** Fraction of the visible disc that is lit: (1 − cos θ) / 2. */
export function illumination(angle: number): number {
  return (1 - Math.cos(angle)) / 2
}

/** Days since the last new moon. */
export function moonAge(angle: number): number {
  return (norm(angle) / TAU) * SYNODIC
}

export function daysToFull(angle: number): number {
  return (norm(Math.PI - angle) / TAU) * SYNODIC
}

/** Waxing when the lit side grows (θ between 0 and π). */
export const waxing = (angle: number) => norm(angle) < Math.PI

/**
 * Where the terminator crosses each row, as a multiple k of the half-width of the
 * disc at that row. The lit part spans [k, 1] when waxing and [−1, k] when waning
 * (for a northern-hemisphere view, lit side on the right while waxing).
 */
export function terminatorK(angle: number): number {
  return waxing(angle) ? Math.cos(angle) : -Math.cos(angle)
}

/**
 * Observer's position on Earth for a local solar time in hours: 12 h faces the Sun
 * (angle 0), 0 h faces away. Earth spins counter-clockwise seen from the north.
 */
export const observerAngle = (hour: number) => Math.PI + (hour / 24) * TAU

/** The Moon is above the horizon when it is less than 90° from the observer's zenith. */
export function moonUp(angle: number, hour: number): boolean {
  return Math.cos(angle - observerAngle(hour)) > 1e-9
}

/** Local times (hours, 0–24) of moonrise and moonset, ignoring the Moon's motion during the day. */
export function riseSet(angle: number): { rise: number; set: number } {
  const toHour = (psi: number) => ((norm(psi - Math.PI) / TAU) * 24) % 24
  return { rise: toHour(angle - Math.PI / 2), set: toHour(angle + Math.PI / 2) }
}
