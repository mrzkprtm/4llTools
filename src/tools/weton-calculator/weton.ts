/** Javanese weton: the 7-day week combined with the 5-day pasaran cycle (35 days). */

export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
export const DAY_NEPTU = [5, 4, 3, 7, 8, 6, 9]
export const PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon']
export const PASARAN_NEPTU = [5, 9, 7, 4, 8]

/** Traditional names for a weton's neptu total, from common primbon tables (tradition, not prediction). */
export const NEPTU_NAMES: Record<number, [string, string]> = {
  7: ['Lebu katiup angin', 'dust blown by the wind'],
  8: ['Lakuning geni', 'the way of fire'],
  9: ['Lakuning angin', 'the way of wind'],
  10: ['Pandito mbangun teki', 'a sage in contemplation'],
  11: ['Aras tuding', 'the pointing finger'],
  12: ['Aras kembang', 'the blossom'],
  13: ['Lakuning lintang', 'the way of the stars'],
  14: ['Lakuning rembulan', 'the way of the moon'],
  15: ['Lakuning srengenge', 'the way of the sun'],
  16: ['Lakuning banyu', 'the way of water'],
  17: ['Lakuning bumi', 'the way of the earth'],
  18: ['Paripurna', 'completeness'],
}

/** Julian day number of a Gregorian date. */
export function jdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
}

export function fromJdn(n: number): { year: number; month: number; day: number } {
  const a = n + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  return { day: e - Math.floor((153 * m + 2) / 5) + 1, month: m + 3 - 12 * Math.floor(m / 10), year: 100 * b + d - 4800 + Math.floor(m / 10) }
}

const mod = (a: number, n: number) => ((a % n) + n) % n

export interface Weton {
  dayIndex: number
  pasaranIndex: number
  day: string
  pasaran: string
  dayNeptu: number
  pasaranNeptu: number
  neptu: number
}

/** Weton of a day number. JDN mod 5 gives the pasaran directly (1 Jan 1900 = Senin Pahing). */
export function wetonOfJdn(n: number): Weton {
  const dayIndex = mod(n + 1, 7)
  const pasaranIndex = mod(n, 5)
  return {
    dayIndex,
    pasaranIndex,
    day: DAYS[dayIndex],
    pasaran: PASARAN[pasaranIndex],
    dayNeptu: DAY_NEPTU[dayIndex],
    pasaranNeptu: PASARAN_NEPTU[pasaranIndex],
    neptu: DAY_NEPTU[dayIndex] + PASARAN_NEPTU[pasaranIndex],
  }
}

export function weton(y: number, m: number, d: number): Weton {
  return wetonOfJdn(jdn(y, m, d))
}

/** The next `count` day numbers strictly after `after` that share the weton of `from`: every 35 days. */
export function nextSameWeton(from: number, count: number, after = from): number[] {
  const gap = mod(from - after, 35)
  const start = after + (gap === 0 ? 35 : gap)
  return Array.from({ length: count }, (_, i) => start + i * 35)
}
