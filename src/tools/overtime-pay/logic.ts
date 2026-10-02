/**
 * Indonesian overtime pay under PP 35/2021 (Art. 31–32), which keeps the
 * multipliers of the earlier Kepmenakertrans 102/2004.
 */

export type DayType = 'work' | 'rest' | 'short'
export type WorkWeek = 5 | 6

export interface Tier {
  hours: number
  mult: number
}

/** Hourly wage: 1/173 of the monthly wage. */
export const hourlyWage = (monthly: number) => monthly / 173

/**
 * Wage used for overtime: base plus fixed allowances, but at least 75% of the
 * whole wage when there are also non-fixed allowances.
 */
export function overtimeBasis(baseAndFixed: number, nonFixed = 0): number {
  const total = baseAndFixed + Math.max(0, nonFixed)
  return nonFixed > 0 ? Math.max(baseAndFixed, 0.75 * total) : baseAndFixed
}

/** The official multiplier bands for a day. The last band is open-ended. */
export function tiers(day: DayType, week: WorkWeek): Tier[] {
  if (day === 'work') return [{ hours: 1, mult: 1.5 }, { hours: Infinity, mult: 2 }]
  if (week === 5) return [{ hours: 8, mult: 2 }, { hours: 1, mult: 3 }, { hours: Infinity, mult: 4 }]
  if (day === 'short') return [{ hours: 5, mult: 2 }, { hours: 1, mult: 3 }, { hours: Infinity, mult: 4 }]
  return [{ hours: 7, mult: 2 }, { hours: 1, mult: 3 }, { hours: Infinity, mult: 4 }]
}

/** Hours allowed by the bands before going past the last defined hour (for warnings). */
export function maxHours(day: DayType, week: WorkWeek): number {
  if (day === 'work') return 4
  if (week === 5) return 12
  return day === 'short' ? 9 : 11
}

export interface Segment {
  from: number
  to: number
  mult: number
}

/** Splits `hours` of overtime into bands with their multipliers. */
export function segments(hours: number, day: DayType, week: WorkWeek): Segment[] {
  const out: Segment[] = []
  let t = 0
  for (const tier of tiers(day, week)) {
    if (t >= hours) break
    const to = Math.min(hours, t + tier.hours)
    out.push({ from: t, to, mult: tier.mult })
    t = to
  }
  return out
}

/** Sum of hours × multiplier, the number that gets multiplied by the hourly wage. */
export function weightedHours(hours: number, day: DayType, week: WorkWeek): number {
  return segments(Math.max(0, hours), day, week).reduce((s, g) => s + (g.to - g.from) * g.mult, 0)
}

/** Overtime pay in rupiah for one day, rounded to whole rupiah. */
export function overtimePay(monthly: number, hours: number, day: DayType, week: WorkWeek): number {
  return Math.round(hourlyWage(monthly) * weightedHours(hours, day, week))
}

export interface DayEntry {
  day: DayType
  hours: number
}

export interface WeekResult {
  pay: number
  weighted: number
  workdayHours: number
  warnings: string[]
}

/** Pays a week of entries and flags the 4 h/day and 18 h/week limits for workday overtime. */
export function weekPay(monthly: number, entries: readonly DayEntry[], week: WorkWeek, names: readonly string[] = []): WeekResult {
  const warnings: string[] = []
  let weighted = 0
  let workdayHours = 0
  entries.forEach((e, i) => {
    weighted += weightedHours(e.hours, e.day, week)
    if (e.day === 'work') workdayHours += e.hours
    if (e.hours > maxHours(e.day, week)) warnings.push(`${names[i] ?? `Day ${i + 1}`}: ${e.hours} h is over the ${maxHours(e.day, week)} h limit for this kind of day.`)
  })
  if (workdayHours > 18) warnings.push(`Workday overtime totals ${workdayHours} h, over the 18 h per week limit.`)
  return { pay: Math.round(hourlyWage(monthly) * weighted), weighted, workdayHours, warnings }
}
