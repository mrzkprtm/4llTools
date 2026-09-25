/** Sun–Earth geometry for a circular orbit. Angles in degrees unless noted. */

const D2R = Math.PI / 180
export const YEAR = 365.2422
/** Day of the year of the March equinox (about 21 March). */
export const EQUINOX_DAY = 80

/** The Sun's ecliptic longitude in degrees: 0 at the March equinox, 90 at the June solstice. */
export function sunLongitude(dayOfYear: number): number {
  return ((((dayOfYear - EQUINOX_DAY) / YEAR) * 360) % 360 + 360) % 360
}

/** Solar declination (the subsolar latitude): sin δ = sin(tilt) · sin(λ). */
export function declination(dayOfYear: number, tilt: number): number {
  return Math.asin(Math.sin(tilt * D2R) * Math.sin(sunLongitude(dayOfYear) * D2R)) / D2R
}

/**
 * Hours of daylight from the sunrise equation cos H₀ = −tan φ · tan δ, clamped
 * to 24 h in polar day and 0 h in polar night (no refraction, Sun as a point).
 */
export function dayLength(lat: number, decl: number): number {
  const c = -Math.tan(lat * D2R) * Math.tan(decl * D2R)
  if (Number.isNaN(c)) return 12
  if (c <= -1) return 24
  if (c >= 1) return 0
  return (2 * Math.acos(c) * 12) / Math.PI
}

/** Elevation of the Sun at local noon (negative means it stays below the horizon). */
export function noonElevation(lat: number, decl: number): number {
  return 90 - Math.abs(lat - decl)
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'none'

/** Astronomical season, starting at the equinoxes and solstices. */
export function season(dayOfYear: number, north: boolean, tilt: number): Season {
  if (tilt < 0.5) return 'none'
  const q = Math.floor(sunLongitude(dayOfYear) / 90)
  const order: Season[] = north ? ['spring', 'summer', 'autumn', 'winter'] : ['autumn', 'winter', 'spring', 'summer']
  return order[q]
}

/** Label like "21 Mar" for a day of a common (non-leap) year. */
export function dayLabel(dayOfYear: number): string {
  return new Date(Date.UTC(2025, 0, Math.round(dayOfYear))).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
