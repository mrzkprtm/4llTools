/** Life-in-weeks math: one row per year of age, 52 week cells per row. Dates are 'YYYY-MM-DD'. */

const DAY = 86400000

/** Days since 1970-01-01 for an ISO date (UTC, so time zones never shift it). */
export function dayNum(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / DAY)
}

export function isoOf(n: number): string {
  return new Date(n * DAY).toISOString().slice(0, 10)
}

/** Day number of the birthday at a given age (29 Feb rolls to 1 Mar in common years). */
export function birthdayAt(birth: string, age: number): number {
  const [y, m, d] = birth.split('-').map(Number)
  return Math.floor(Date.UTC(y + age, m - 1, d) / DAY)
}

/** Full years of age on a date. */
export function ageOn(birth: string, date: string): number {
  const t = dayNum(date)
  const [y] = birth.split('-').map(Number)
  const [ty] = date.split('-').map(Number)
  let age = ty - y
  while (age > 0 && birthdayAt(birth, age) > t) age--
  while (birthdayAt(birth, age + 1) <= t) age++
  return age
}

/** Total whole weeks lived. */
export function weeksLived(birth: string, date: string): number {
  return Math.max(0, Math.floor((dayNum(date) - dayNum(birth)) / 7))
}

/** Grid cell for a date: row = age in years, col = week since that birthday (0–51; the last one takes the extra 1–2 days). */
export function cellOf(birth: string, date: string): { row: number; col: number } {
  if (dayNum(date) < dayNum(birth)) return { row: 0, col: 0 }
  const row = ageOn(birth, date)
  const col = Math.min(51, Math.floor((dayNum(date) - birthdayAt(birth, row)) / 7))
  return { row, col }
}

/** First and last day of a cell. */
export function cellRange(birth: string, row: number, col: number): [string, string] {
  const start = birthdayAt(birth, row) + col * 7
  const end = col === 51 ? birthdayAt(birth, row + 1) - 1 : start + 6
  return [isoOf(start), isoOf(end)]
}

export interface LifeStats {
  days: number
  weeks: number
  weeksTotal: number
  weeksLeft: number
  percent: number
  heartbeats: number
  sleepYears: number
  fullMoons: number
}

/** Fun estimates: 70 bpm resting heart rate, 8 h of sleep a day. */
export function lifeStats(birth: string, today: string, lifespan: number): LifeStats {
  const days = Math.max(0, dayNum(today) - dayNum(birth))
  const weeks = Math.floor(days / 7)
  const weeksTotal = lifespan * 52
  const cell = cellOf(birth, today)
  const filled = Math.min(weeksTotal, cell.row * 52 + cell.col)
  return {
    days,
    weeks,
    weeksTotal,
    weeksLeft: Math.max(0, weeksTotal - filled),
    percent: Math.min(100, (filled / weeksTotal) * 100),
    heartbeats: days * 24 * 60 * 70,
    sleepYears: (days / 3) / 365.25,
    fullMoons: Math.floor(days / 29.530588853),
  }
}
