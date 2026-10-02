/** Pure sun-position and map helpers for the world clock. Angles in degrees. */

const RAD = Math.PI / 180
const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180

/**
 * Subsolar point (where the sun is straight overhead) using the low-precision
 * solar coordinates from the Astronomical Almanac, good to about 0.1°.
 */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0
  const L = (280.46 + 0.9856474 * n) % 360
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD
  const eps = (23.439 - 0.0000004 * n) * RAD
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda)) / RAD
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / RAD
  const gmst = 280.46061837 + 360.98564736629 * n
  return { lat: dec, lon: wrap180(ra - gmst) }
}

/** Sun elevation above the horizon at a place, ignoring refraction. */
export function solarElevation(lat: number, lon: number, date: Date, sun = subsolarPoint(date)): number {
  const h = (lon - sun.lon) * RAD
  const s = Math.sin(lat * RAD) * Math.sin(sun.lat * RAD) + Math.cos(lat * RAD) * Math.cos(sun.lat * RAD) * Math.cos(h)
  return Math.asin(Math.max(-1, Math.min(1, s))) / RAD
}

/** True when the sun's center is above the horizon (with the usual 0.833° for refraction and disc size). */
export function isDaylight(lat: number, lon: number, date: Date): boolean {
  return solarElevation(lat, lon, date) > -0.833
}

/** Decodes the packed land outlines into rings of [lon, lat]. */
export function decodeLand(packed: string): [number, number][][] {
  return packed
    .split(' ')
    .filter(Boolean)
    .map((ring) => {
      const pts: [number, number][] = []
      for (let i = 0; i + 3 < ring.length; i += 4) pts.push([parseInt(ring.slice(i, i + 2), 36) / 2 - 180, 90 - parseInt(ring.slice(i + 2, i + 4), 36) / 2])
      return pts
    })
}

/** Equirectangular projection into a w × h canvas. */
export function project(lat: number, lon: number, w: number, h: number): [number, number] {
  return [((lon + 180) / 360) * w, ((90 - lat) / 180) * h]
}

/** Offset of a time zone from UTC in minutes at a moment, from Intl. */
export function tzOffset(zone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(date)
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute'))
  return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000)
}

export function offsetLabel(min: number): string {
  const sign = min < 0 ? '−' : '+'
  const a = Math.abs(min)
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, '0')}` : ''}`
}

export interface City {
  name: string
  lat: number
  lon: number
  tz: string
}

export const CITIES: City[] = [
  { name: 'Jakarta', lat: -6.2, lon: 106.85, tz: 'Asia/Jakarta' },
  { name: 'Makassar', lat: -5.14, lon: 119.43, tz: 'Asia/Makassar' },
  { name: 'Jayapura', lat: -2.53, lon: 140.72, tz: 'Asia/Jayapura' },
  { name: 'Singapore', lat: 1.35, lon: 103.82, tz: 'Asia/Singapore' },
  { name: 'Tokyo', lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo' },
  { name: 'London', lat: 51.51, lon: -0.13, tz: 'Europe/London' },
  { name: 'New York', lat: 40.71, lon: -74.01, tz: 'America/New_York' },
  { name: 'Dubai', lat: 25.2, lon: 55.27, tz: 'Asia/Dubai' },
  { name: 'Sydney', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' },
  { name: 'Medan', lat: 3.6, lon: 98.67, tz: 'Asia/Jakarta' },
  { name: 'Denpasar', lat: -8.65, lon: 115.22, tz: 'Asia/Makassar' },
  { name: 'Kuala Lumpur', lat: 3.14, lon: 101.69, tz: 'Asia/Kuala_Lumpur' },
  { name: 'Bangkok', lat: 13.76, lon: 100.5, tz: 'Asia/Bangkok' },
  { name: 'Manila', lat: 14.6, lon: 120.98, tz: 'Asia/Manila' },
  { name: 'Hong Kong', lat: 22.32, lon: 114.17, tz: 'Asia/Hong_Kong' },
  { name: 'Beijing', lat: 39.9, lon: 116.4, tz: 'Asia/Shanghai' },
  { name: 'Seoul', lat: 37.57, lon: 126.98, tz: 'Asia/Seoul' },
  { name: 'Mumbai', lat: 19.08, lon: 72.88, tz: 'Asia/Kolkata' },
  { name: 'Mecca', lat: 21.39, lon: 39.86, tz: 'Asia/Riyadh' },
  { name: 'Istanbul', lat: 41.01, lon: 28.98, tz: 'Europe/Istanbul' },
  { name: 'Moscow', lat: 55.76, lon: 37.62, tz: 'Europe/Moscow' },
  { name: 'Cairo', lat: 30.04, lon: 31.24, tz: 'Africa/Cairo' },
  { name: 'Nairobi', lat: -1.29, lon: 36.82, tz: 'Africa/Nairobi' },
  { name: 'Lagos', lat: 6.52, lon: 3.38, tz: 'Africa/Lagos' },
  { name: 'Paris', lat: 48.86, lon: 2.35, tz: 'Europe/Paris' },
  { name: 'Berlin', lat: 52.52, lon: 13.4, tz: 'Europe/Berlin' },
  { name: 'Amsterdam', lat: 52.37, lon: 4.9, tz: 'Europe/Amsterdam' },
  { name: 'São Paulo', lat: -23.55, lon: -46.63, tz: 'America/Sao_Paulo' },
  { name: 'Mexico City', lat: 19.43, lon: -99.13, tz: 'America/Mexico_City' },
  { name: 'Toronto', lat: 43.65, lon: -79.38, tz: 'America/Toronto' },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24, tz: 'America/Los_Angeles' },
  { name: 'Honolulu', lat: 21.31, lon: -157.86, tz: 'Pacific/Honolulu' },
  { name: 'Auckland', lat: -36.85, lon: 174.76, tz: 'Pacific/Auckland' },
]

export const DEFAULT_CITIES = ['Jakarta', 'Makassar', 'Jayapura', 'Singapore', 'Tokyo', 'London', 'New York', 'Dubai', 'Sydney']
