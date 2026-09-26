/** Jet lag plan: shift sleep about an hour a day toward the destination. Pure and tested. */

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** UTC offset of `tz` at instant `ms`, in minutes (Jakarta = 420). */
const formatters = new Map<string, Intl.DateTimeFormat>()

export function tzOffset(tz: string, ms: number): number {
  let f = formatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    formatters.set(tz, f)
  }
  const parts = f.formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000)
}

/** Converts a wall-clock time in `tz` ("2026-07-10T20:30") to a UTC instant. */
export function localToUtc(local: string, tz: string): number {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return NaN
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))
  let t = guess - tzOffset(tz, guess) * 60000
  t = guess - tzOffset(tz, t) * 60000
  return t
}

/** The local calendar date (YYYY-MM-DD) of instant `ms` in `tz`. */
export function localDate(ms: number, tz: string): string {
  const d = new Date(ms + tzOffset(tz, ms) * 60000)
  return d.toISOString().slice(0, 10)
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10)
}

const wrap = (min: number) => ((Math.round(min) % 1440) + 1440) % 1440

export type Span = [number, number]

export interface PlanDay {
  offset: number
  label: string
  date: string
  tz: string
  /** Minutes after local midnight; `sleep` may be later than `wake` (crosses midnight). */
  sleep: number
  wake: number
  seek?: Span
  avoid?: Span
  /** Part of the flight during this local day, minutes after midnight. */
  flight?: Span
  /** Hours of the total shift reached by this day. */
  shifted: number
}

export interface PlanInput {
  origin: string
  dest: string
  /** Departure wall-clock time in the origin time zone, "YYYY-MM-DDTHH:mm". */
  depart: string
  flightHours: number
  /** Usual bedtime and wake time, minutes after midnight. */
  sleep: number
  wake: number
}

export interface Plan {
  /** Destination minus origin, hours, normalized to (-12, 12]. Positive = fly east. */
  diff: number
  direction: 'east' | 'west' | 'none'
  departUtc: number
  arriveUtc: number
  days: PlanDay[]
}

const PRE_RATE = 1
const LABELS = ['3 days before', '2 days before', 'Day before', 'Flight day', 'Arrival day', 'Day 2 there', 'Day 3 there']

export function makePlan(p: PlanInput): Plan {
  const departUtc = localToUtc(p.depart, p.origin)
  const arriveUtc = departUtc + Math.max(0, p.flightHours) * HOUR
  let diff = (tzOffset(p.dest, arriveUtc) - tzOffset(p.origin, departUtc)) / 60
  while (diff > 12) diff -= 24
  while (diff <= -12) diff += 24
  const sign = Math.sign(diff)
  const need = Math.abs(diff)
  // Delaying the body clock (flying west) is easier than advancing it.
  const postRate = diff > 0 ? 1 : 1.5
  const departDate = localDate(departUtc, p.origin)
  const arriveDate = localDate(arriveUtc, p.dest)
  const days: PlanDay[] = []
  for (let k = -3; k <= 3; k++) {
    const pre = k <= 0
    const B = sign * Math.min(need, pre ? Math.min(3, 4 + k) * PRE_RATE : 3 * PRE_RATE + k * postRate)
    const tz = pre ? p.origin : p.dest
    const date = pre ? addDays(departDate, k) : addDays(arriveDate, k - 1)
    // Before the flight, times are in origin clock time; after, in destination clock time.
    const shiftMin = pre ? -B * 60 : (diff - B) * 60
    const sleep = wrap(p.sleep + shiftMin)
    const wake = wrap(p.wake + shiftMin)
    const remaining = Math.abs(diff - B)
    const day: PlanDay = { offset: k, label: LABELS[k + 3], date, tz, sleep, wake, shifted: Math.abs(B) }
    if (remaining > 0.01) {
      if (diff > 0) {
        day.seek = [wake, wrap(wake + 180)]
        day.avoid = [wrap(sleep - 180), sleep]
      } else {
        day.seek = [wrap(sleep - 180), sleep]
        day.avoid = [wake, wrap(wake + 120)]
      }
    }
    const start = localToUtc(date, tz)
    const a = Math.max(start, departUtc)
    const b = Math.min(start + DAY, arriveUtc)
    if (b > a) day.flight = [Math.round((a - start) / 60000), Math.round((b - start) / 60000)]
    days.push(day)
  }
  return { diff, direction: diff > 0 ? 'east' : diff < 0 ? 'west' : 'none', departUtc, arriveUtc, days }
}

/** Splits a span that may cross midnight into one or two [start, end] pieces within 0..1440. */
export function pieces([a, b]: Span): Span[] {
  if (b === a) return []
  return b > a ? [[a, b]] : [[a, 1440], [0, b]]
}

export const hhmm = (min: number) => `${String(Math.floor(wrap(min) / 60)).padStart(2, '0')}:${String(wrap(min) % 60).padStart(2, '0')}`
