/**
 * Gregorian ↔ Hijri conversion.
 * - Tabular (arithmetical, "Kuwaiti") calendar: 30-year cycle with 11 leap years, civil epoch 16 July 622.
 * - Umm al-Qura via Intl ('islamic-umalqura') where the browser supports it.
 * Official Indonesian dates follow the government's sighting (isbat) and may differ by a day.
 */

export interface HDate {
  year: number
  month: number
  day: number
}

export const MONTHS_ID = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir', 'Rajab', "Sya'ban", 'Ramadhan', 'Syawal', "Dzulqa'dah", 'Dzulhijjah']
export const MONTHS_AR = ['Muḥarram', 'Ṣafar', 'Rabīʿ al-Awwal', 'Rabīʿ al-Thānī', 'Jumādā al-Ūlā', 'Jumādā al-Ākhirah', 'Rajab', 'Shaʿbān', 'Ramaḍān', 'Shawwāl', 'Dhū al-Qaʿdah', 'Dhū al-Ḥijjah']

const EPOCH = 1948439.5

/** Julian day number (at noon, integer) of a Gregorian date. */
export function gregorianToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
}

export function jdnToGregorian(jdn: number): HDate {
  const a = jdn + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  return { day: e - Math.floor((153 * m + 2) / 5) + 1, month: m + 3 - 12 * Math.floor(m / 10), year: 100 * b + d - 4800 + Math.floor(m / 10) }
}

function tabularToJd(y: number, m: number, d: number): number {
  return d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + Math.floor((3 + 11 * y) / 30) + EPOCH - 1
}

export function isTabularLeap(y: number): boolean {
  return (14 + 11 * y) % 30 < 11
}

export function tabularMonthLength(y: number, m: number): number {
  return m % 2 === 1 || (m === 12 && isTabularLeap(y)) ? 30 : 29
}

/** Gregorian → tabular Hijri. */
export function toHijriTabular(y: number, m: number, d: number): HDate {
  // JD at the midnight that starts the day.
  const j = gregorianToJdn(y, m, d) - 0.5
  const year = Math.floor((30 * (j - EPOCH) + 10646) / 10631)
  const month = Math.min(12, Math.ceil((j - (29 + tabularToJd(year, 1, 1))) / 29.5) + 1)
  const day = j - tabularToJd(year, month, 1) + 1
  return { year, month, day: Math.round(day) }
}

/** Tabular Hijri → Gregorian. */
export function fromHijriTabular(y: number, m: number, d: number): HDate {
  return jdnToGregorian(Math.round(tabularToJd(y, m, d) + 0.5))
}

let fmt: Intl.DateTimeFormat | null | undefined

/** Gregorian → Umm al-Qura via Intl, or null when unsupported. */
export function toHijriUmmAlQura(y: number, m: number, d: number): HDate | null {
  if (fmt === undefined) {
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' })
      fmt = f.resolvedOptions().calendar === 'islamic-umalqura' ? f : null
    } catch {
      fmt = null
    }
  }
  if (!fmt) return null
  const parts = fmt.formatToParts(new Date(Date.UTC(y, m - 1, d, 12)))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value.replace(/\D/g, ''))
  const out = { year: get('year') || get('relatedYear'), month: get('month'), day: get('day') }
  return Number.isFinite(out.year) && out.year > 0 && out.month > 0 && out.day > 0 ? out : null
}

/** Umm al-Qura Hijri → Gregorian by searching around the tabular estimate. */
export function fromHijriUmmAlQura(y: number, m: number, d: number): HDate | null {
  const est = fromHijriTabular(y, m, d)
  const base = gregorianToJdn(est.year, est.month, est.day)
  for (const off of [0, -1, 1, -2, 2, -3, 3]) {
    const g = jdnToGregorian(base + off)
    const h = toHijriUmmAlQura(g.year, g.month, g.day)
    if (!h) return null
    if (h.year === y && h.month === m && h.day === d) return g
  }
  return null
}

export type Engine = 'umalqura' | 'tabular'

export function toHijri(engine: Engine, y: number, m: number, d: number): HDate {
  return (engine === 'umalqura' && toHijriUmmAlQura(y, m, d)) || toHijriTabular(y, m, d)
}

export function fromHijri(engine: Engine, y: number, m: number, d: number): HDate {
  return (engine === 'umalqura' && fromHijriUmmAlQura(y, m, d)) || fromHijriTabular(y, m, d)
}

const SYNODIC = 29.530588853
/** JD of a reference new moon: 6 Jan 2000 18:14 UTC. */
const NEW_MOON = 2451550.26

/** Moon phase as a fraction of the synodic month: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonPhase(y: number, m: number, d: number, hourUtc = 12): number {
  const jd = gregorianToJdn(y, m, d) - 0.5 + hourUtc / 24
  const p = ((jd - NEW_MOON) / SYNODIC) % 1
  return p < 0 ? p + 1 : p
}

/** Fraction of the disc that is lit (0–1). */
export function illumination(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2
}

export function phaseName(p: number): string {
  if (p < 0.0339 || p > 0.9661) return 'New moon'
  if (p < 0.2161) return 'Waxing crescent'
  if (p < 0.2839) return 'First quarter'
  if (p < 0.4661) return 'Waxing gibbous'
  if (p < 0.5339) return 'Full moon'
  if (p < 0.7161) return 'Waning gibbous'
  if (p < 0.7839) return 'Last quarter'
  return 'Waning crescent'
}

/** SVG path of the lit part of a moon of radius r centred at 0,0. */
export function moonPath(p: number, r: number): string {
  const rx = Math.abs(Math.cos(2 * Math.PI * p)) * r
  const waxing = p < 0.5
  const outer = waxing ? 1 : 0
  const q = p % 0.5
  const inner = waxing ? (q < 0.25 ? 0 : 1) : q < 0.25 ? 0 : 1
  return `M0,${-r} A${r},${r} 0 0 ${outer} 0,${r} A${rx.toFixed(2)},${r} 0 0 ${inner} 0,${-r} Z`
}

export interface HolyDay {
  key: string
  name: string
  month: number
  day: number
}

export const HOLY_DAYS: HolyDay[] = [
  { key: 'ramadan', name: '1 Ramadhan', month: 9, day: 1 },
  { key: 'fitri', name: 'Idul Fitri', month: 10, day: 1 },
  { key: 'adha', name: 'Idul Adha', month: 12, day: 10 },
  { key: 'muharram', name: '1 Muharram', month: 1, day: 1 },
]

/** The next Gregorian date (on or after today) of a Hijri month/day, with days left. */
export function nextOccurrence(engine: Engine, today: HDate, month: number, day: number): { date: HDate; hijriYear: number; days: number } {
  const h = toHijri(engine, today.year, today.month, today.day)
  const t = gregorianToJdn(today.year, today.month, today.day)
  for (const hy of [h.year, h.year + 1]) {
    const g = fromHijri(engine, hy, month, day)
    const j = gregorianToJdn(g.year, g.month, g.day)
    if (j >= t) return { date: g, hijriYear: hy, days: j - t }
  }
  const g = fromHijri(engine, h.year + 2, month, day)
  return { date: g, hijriYear: h.year + 2, days: gregorianToJdn(g.year, g.month, g.day) - t }
}
