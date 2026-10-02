/** Pure working-day math. Dates are ISO days (YYYY-MM-DD) handled in UTC to avoid DST drift. */

import type { Holiday } from './holidays'

export interface Options {
  /** 5 = Monday–Friday, 6 = Monday–Saturday. */
  week: 5 | 6
  /** Dates that are days off, with their names. */
  off: Map<string, Holiday>
}

const DAY = 86400000

export function toMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number): string {
  return fromMs(toMs(iso) + n * DAY)
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: string): number {
  return new Date(toMs(iso)).getUTCDay()
}

export function isWeekend(iso: string, week: 5 | 6): boolean {
  const d = weekday(iso)
  return d === 0 || (week === 5 && d === 6)
}

export function isWorkingDay(iso: string, o: Options): boolean {
  return !isWeekend(iso, o.week) && !o.off.has(iso)
}

export function offMap(list: Holiday[], withCuti = true): Map<string, Holiday> {
  const m = new Map<string, Holiday>()
  for (const h of list) if (withCuti || h.kind === 'holiday') if (!m.has(h.date) || h.kind === 'holiday') m.set(h.date, h)
  return m
}

export interface Tally {
  working: number
  calendar: number
  weekend: number
  /** Holidays and cuti bersama that fall on a would-be working day. */
  holidays: Holiday[]
  /** The working days themselves, in order. */
  days: string[]
}

/** Counts working days from `start` to `end` (swapped if reversed). */
export function countWorkingDays(start: string, end: string, o: Options, includeStart = true, includeEnd = true): Tally {
  let a = toMs(start)
  let b = toMs(end)
  if (b < a) [a, b] = [b, a]
  if (!includeStart) a += DAY
  if (!includeEnd) b -= DAY
  const t: Tally = { working: 0, calendar: 0, weekend: 0, holidays: [], days: [] }
  for (let ms = a; ms <= b; ms += DAY) {
    const d = fromMs(ms)
    t.calendar++
    if (isWeekend(d, o.week)) t.weekend++
    else if (o.off.has(d)) t.holidays.push(o.off.get(d)!)
    else {
      t.working++
      t.days.push(d)
    }
  }
  return t
}

/**
 * The date `n` working days after `start` (before it when n is negative).
 * The start day itself is not counted; n = 0 returns the start if it is a
 * working day, otherwise the next working day.
 */
export function addWorkingDays(start: string, n: number, o: Options): string {
  let d = start
  const step = n < 0 ? -1 : 1
  let left = Math.abs(Math.trunc(n))
  if (left === 0) {
    while (!isWorkingDay(d, o)) d = addDays(d, 1)
    return d
  }
  while (left > 0) {
    d = addDays(d, step)
    if (isWorkingDay(d, o)) left--
  }
  return d
}
