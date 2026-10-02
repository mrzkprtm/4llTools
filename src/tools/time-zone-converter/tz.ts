/** Zones used when the browser cannot list them (Intl.supportedValuesOf is missing). */
export const FALLBACK_ZONES = [
  'UTC', 'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok',
  'Asia/Manila', 'Asia/Ho_Chi_Minh', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul',
  'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Tehran', 'Asia/Kathmandu', 'Asia/Dhaka',
  'Australia/Perth', 'Australia/Adelaide', 'Australia/Sydney', 'Pacific/Auckland', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Istanbul', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage',
  'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires', 'America/Santiago',
]

export const DEFAULT_ZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'UTC', 'America/New_York', 'Europe/London']

/** Friendly names for zones people search for by another name. */
export const ALIASES: Record<string, string> = {
  'Asia/Jakarta': 'WIB · Jakarta',
  'Asia/Makassar': 'WITA · Makassar, Bali',
  'Asia/Jayapura': 'WIT · Jayapura',
  UTC: 'UTC · Coordinated Universal Time',
}

export function allZones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone')
    if (list && list.length) return list.includes('UTC') ? list : ['UTC', ...list]
  } catch {
    // Older browsers.
  }
  return FALLBACK_ZONES
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

const partsCache = new Map<string, Intl.DateTimeFormat>()
function fmt(zone: string): Intl.DateTimeFormat {
  let f = partsCache.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    partsCache.set(zone, f)
  }
  return f
}

export interface Wall {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** The wall-clock time in `zone` at instant `ms`. */
export function wallTime(zone: string, ms: number): Wall {
  const p: Record<string, number> = {}
  for (const part of fmt(zone).formatToParts(new Date(ms))) if (part.type !== 'literal') p[part.type] = Number(part.value)
  return { year: p.year, month: p.month, day: p.day, hour: p.hour % 24, minute: p.minute, second: p.second }
}

/** Minutes the zone is ahead of UTC at instant `ms` (Jakarta = 420, New York in winter = -300). */
export function offsetMinutes(zone: string, ms: number): number {
  const w = wallTime(zone, ms)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000)
}

/** The instant when the clock in `zone` shows the given wall time. DST gaps resolve forward. */
export function zonedToUtc(zone: string, w: Omit<Wall, 'second'> & { second?: number }): number {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second ?? 0)
  let ms = guess - offsetMinutes(zone, guess) * 60000
  const again = offsetMinutes(zone, ms)
  if (guess - again * 60000 !== ms) ms = guess - again * 60000
  return ms
}

export function formatOffset(min: number): string {
  const sign = min < 0 ? '-' : '+'
  const a = Math.abs(min)
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`
}

/** Short zone name like "EST", "GMT+7" or "WIB" where the browser knows it. */
export function zoneAbbr(zone: string, ms: number, locale = 'en-US'): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' }).formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

export type HourKind = 'work' | 'edge' | 'night'

/** Classifies a local hour: work hours, early/late (still reachable), or night. */
export function hourKind(hour: number, start = 9, end = 17): HourKind {
  if (hour >= start && hour < end) return 'work'
  if (hour >= start - 2 && hour < end + 4) return 'edge'
  return 'night'
}

/** The 24 hourly instants of the day that contains `ms` in the reference zone. */
export function dayHours(zone: string, ms: number): number[] {
  const w = wallTime(zone, ms)
  return Array.from({ length: 24 }, (_, h) => zonedToUtc(zone, { year: w.year, month: w.month, day: w.day, hour: h, minute: 0 }))
}

/** Indexes of `hours` where every zone is inside working hours. */
export function overlap(zones: string[], hours: number[], start = 9, end = 17): number[] {
  return hours.map((ms, i) => (zones.every((z) => hourKind(wallTime(z, ms).hour, start, end) === 'work') ? i : -1)).filter((i) => i >= 0)
}

export function cityName(zone: string): string {
  return ALIASES[zone] ?? zone.split('/').pop()!.replace(/_/g, ' ')
}

/** "YYYY-MM-DDTHH:mm" for a datetime-local input. */
export function toInputValue(w: Wall): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${w.year}-${p(w.month)}-${p(w.day)}T${p(w.hour)}:${p(w.minute)}`
}

export function fromInputValue(v: string): Omit<Wall, 'second'> | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  if (!m) return null
  return { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] }
}
