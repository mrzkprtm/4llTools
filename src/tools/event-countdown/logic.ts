/** Pure helpers for the event countdown: time breakdown, share-link hash and presets. */

export interface Parts {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** True once the moment has arrived (everything is then zero). */
  done: boolean
}

export function breakdown(ms: number): Parts {
  if (!(ms > 0)) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true }
  // Round up so the display hits 0:00:00 exactly when the event starts.
  const s = Math.ceil(ms / 1000)
  return { days: Math.floor(s / 86400), hours: Math.floor(s / 3600) % 24, minutes: Math.floor(s / 60) % 60, seconds: s % 60, done: false }
}

export interface EventInfo {
  name: string
  /** Local date and time, YYYY-MM-DDTHH:mm. */
  at: string
  /** When the countdown was created (epoch ms), for the progress ring. */
  created?: number
}

const AT = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/

export function encodeHash(e: EventInfo): string {
  const p = new URLSearchParams({ n: e.name, t: e.at })
  if (e.created) p.set('c', String(Math.round(e.created / 1000)))
  return `#${p.toString()}`
}

export function decodeHash(hash: string): EventInfo | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const at = p.get('t') ?? ''
  if (!AT.test(at) || Number.isNaN(parseLocal(at).getTime())) return null
  const c = Number(p.get('c'))
  return { name: (p.get('n') ?? '').slice(0, 80) || 'My event', at, ...(c > 0 ? { created: c * 1000 } : {}) }
}

export function parseLocal(at: string): Date {
  const [d, t] = at.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = (t ?? '00:00').split(':').map(Number)
  return new Date(y, m - 1, day, hh, mm)
}

export function toLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 0 at creation, 1 at the event. */
export function progress(created: number, target: number, now: number): number {
  if (target <= created) return 1
  return Math.min(1, Math.max(0, (now - created) / (target - created)))
}

/** The next time this month/day comes around (today counts if it has not passed midnight's start). */
export function nextAnnual(month: number, day: number, now: Date): Date {
  const d = new Date(now.getFullYear(), month - 1, day)
  if (d.getTime() <= now.getTime() - 86400000 + 1) d.setFullYear(d.getFullYear() + 1)
  return d
}

/**
 * Idul Fitri (1 Syawal) dates as set or expected in Indonesia. The government
 * confirms each date after the sighting session (sidang isbat), so later years
 * can shift by a day.
 */
export const IDUL_FITRI = ['2025-03-31', '2026-03-21', '2027-03-10', '2028-02-27', '2029-02-14', '2030-02-04']

export function nextIdulFitri(now: Date): string | null {
  const today = toLocal(now).slice(0, 10)
  return IDUL_FITRI.find((d) => d >= today) ?? null
}
