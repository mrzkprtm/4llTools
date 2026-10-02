/** Parking timer math. Pure and tested. */

const MIN = 60_000

/** Milliseconds left until `end` (negative once overdue). */
export function remainingMs(end: number, now: number): number {
  return end - now
}

/** Minutes from `now` until the next time the clock shows "HH:MM" (today, or tomorrow if it has passed). */
export function minutesUntil(clock: string, now: Date): number {
  const m = clock.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return NaN
  const target = new Date(now)
  target.setHours(Number(m[1]), Number(m[2]), 0, 0)
  let diff = (target.getTime() - now.getTime()) / MIN
  if (diff <= 0) diff += 24 * 60
  return Math.ceil(diff)
}

export interface Rates {
  /** Charge for the first (started) hour. */
  first: number
  /** Charge for each further started hour. */
  next: number
  /** Most you pay per 24 hours (0 = no cap). */
  dailyMax: number
}

/** Common Indonesian mall rates for a car, Rp. */
export const DEFAULT_RATES: Rates = { first: 5000, next: 4000, dailyMax: 0 }

/** Cost of parking for `minutes`, charging every started hour. */
export function parkingCost(minutes: number, r: Rates): number {
  if (!(minutes > 0)) return 0
  const fullDays = Math.floor(minutes / (24 * 60))
  const rest = minutes - fullDays * 24 * 60
  const hoursCost = (m: number) => {
    const h = Math.ceil(m / 60)
    if (h <= 0) return 0
    const c = r.first + (h - 1) * r.next
    return r.dailyMax > 0 ? Math.min(c, r.dailyMax) : c
  }
  return fullDays * hoursCost(24 * 60) + hoursCost(rest)
}

/** "1:05:09" or "5:09"; negative values get a leading minus. */
export function clock(ms: number): string {
  const neg = ms < 0
  const s = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const body = h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
  return (neg ? '−' : '') + body
}

/** Whether the reminder `before` minutes ahead of `end` should fire now. */
export function reminderDue(end: number, before: number, now: number): boolean {
  return before > 0 && now >= end - before * MIN && now < end
}
