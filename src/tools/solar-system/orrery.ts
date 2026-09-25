/** Approximate planetary positions from mean orbital elements at J2000 (ecliptic, inclination ignored). */

export interface Planet {
  name: string
  /** Semi-major axis in AU. */
  a: number
  e: number
  /** Sidereal orbital period in days. */
  period: number
  /** Mean longitude at J2000, degrees. */
  L0: number
  /** Longitude of perihelion, degrees. */
  peri: number
  moons: number
  color: string
  size: number
  note: string
}

export const PLANETS: Planet[] = [
  { name: 'Mercury', a: 0.3871, e: 0.2056, period: 87.969, L0: 252.2503, peri: 77.4578, moons: 0, color: '#b5aca1', size: 3, note: 'Smallest planet, fastest orbit' },
  { name: 'Venus', a: 0.7233, e: 0.0068, period: 224.701, L0: 181.9791, peri: 131.6025, moons: 0, color: '#e8c27a', size: 5, note: 'Hottest planet, spins backwards' },
  { name: 'Earth', a: 1.0, e: 0.0167, period: 365.256, L0: 100.4646, peri: 102.9377, moons: 1, color: '#4dabf7', size: 5.5, note: 'The only known world with life' },
  { name: 'Mars', a: 1.5237, e: 0.0934, period: 686.98, L0: 355.4466, peri: 336.0564, moons: 2, color: '#f76707', size: 4, note: 'Red from iron oxide dust' },
  { name: 'Jupiter', a: 5.2029, e: 0.0484, period: 4332.59, L0: 34.3964, peri: 14.7285, moons: 97, color: '#d9a066', size: 10, note: 'Largest planet, a gas giant' },
  { name: 'Saturn', a: 9.5367, e: 0.0539, period: 10759.22, L0: 49.9542, peri: 92.5989, moons: 274, color: '#f1d18a', size: 9, note: 'Famous for its bright rings' },
  { name: 'Uranus', a: 19.1892, e: 0.0473, period: 30688.5, L0: 313.2381, peri: 170.9543, moons: 29, color: '#99e9f2', size: 7, note: 'Ice giant tipped on its side' },
  { name: 'Neptune', a: 30.0699, e: 0.0086, period: 60182, L0: 304.88, peri: 44.9648, moons: 16, color: '#5c7cfa', size: 7, note: 'Windiest planet, farthest out' },
]

const J2000 = Date.UTC(2000, 0, 1, 12)
const DAY_MS = 86400000

/** Days since the J2000 epoch (2000-01-01 12:00 UTC). */
export function dayNumber(date: Date): number {
  return (date.getTime() - J2000) / DAY_MS
}

export function dateFromDay(d: number): Date {
  return new Date(J2000 + d * DAY_MS)
}

export const wrap360 = (deg: number) => ((deg % 360) + 360) % 360

/** Mean longitude in degrees [0, 360) after d days. */
export function meanLongitude(p: Planet, d: number): number {
  return wrap360(p.L0 + (360 * d) / p.period)
}

/** Solves Kepler's equation E − e·sin E = M (radians) by Newton's method. */
export function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI
  for (let k = 0; k < 20; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-12) break
  }
  return E
}

/** Heliocentric ecliptic longitude (degrees) and distance (AU) after d days. */
export function position(p: Planet, d: number, elliptical = true): { lon: number; r: number } {
  const L = meanLongitude(p, d)
  if (!elliptical) return { lon: L, r: p.a }
  const M = ((L - p.peri) * Math.PI) / 180
  const E = solveKepler(M, p.e)
  const nu = 2 * Math.atan2(Math.sqrt(1 + p.e) * Math.sin(E / 2), Math.sqrt(1 - p.e) * Math.cos(E / 2))
  return { lon: wrap360((nu * 180) / Math.PI + p.peri), r: p.a * (1 - p.e * Math.cos(E)) }
}

/** Distance from the Sun (AU) on the orbit at true anomaly ν (radians). */
export function orbitRadius(p: Planet, nu: number): number {
  return (p.a * (1 - p.e * p.e)) / (1 + p.e * Math.cos(nu))
}
