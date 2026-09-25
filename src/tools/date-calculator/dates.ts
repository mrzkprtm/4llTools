/** Parses a yyyy-mm-dd string as a local calendar date. */
export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

/**
 * Calendar difference in whole years, months and days (from <= to). Counts whole months first,
 * clamping to the end of shorter months (Jan 31 + 1 month = Feb 29/28), then the leftover days.
 */
export function diffYmd(from: Date, to: Date): { years: number; months: number; days: number } {
  let total = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) total--
  const y = from.getFullYear()
  const m = from.getMonth() + total
  const lastDay = new Date(y, m + 1, 0).getDate()
  const anchor = new Date(y, m, Math.min(from.getDate(), lastDay))
  return { years: Math.floor(total / 12), months: total % 12, days: daysBetween(anchor, to) }
}

export function daysBetween(from: Date, to: Date): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utc(to) - utc(from)) / 86400000)
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export function toInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
