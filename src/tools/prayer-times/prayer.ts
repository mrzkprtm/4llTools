/**
 * Prayer time calculation, following the standard astronomical method used by
 * PrayTimes.org: sun declination and equation of time for the day, then the
 * hour angle at which the sun reaches each prayer's depression angle.
 */

export type MethodId = 'kemenag' | 'mwl' | 'isna' | 'egypt' | 'makkah' | 'jakim'
export type AsrSchool = 'shafii' | 'hanafi'

export interface Method {
  name: string
  fajr: number
  /** Isha as a depression angle, or a fixed number of minutes after maghrib. */
  isha: number | { minutes: number }
  /** Minutes of ihtiyat (safety margin) added to every prayer; subtracted from sunrise. */
  ihtiyat: number
  note: string
}

export const METHODS: Record<MethodId, Method> = {
  kemenag: { name: 'Kemenag RI', fajr: 20, isha: 18, ihtiyat: 2, note: 'Fajr 20°, Isha 18°, plus 2 minutes ihtiyat on each prayer (sunrise 2 minutes earlier), as in Indonesian schedules.' },
  mwl: { name: 'Muslim World League', fajr: 18, isha: 17, ihtiyat: 0, note: 'Fajr 18°, Isha 17°.' },
  isna: { name: 'ISNA (North America)', fajr: 15, isha: 15, ihtiyat: 0, note: 'Fajr 15°, Isha 15°.' },
  egypt: { name: 'Egyptian Authority', fajr: 19.5, isha: 17.5, ihtiyat: 0, note: 'Fajr 19.5°, Isha 17.5°.' },
  makkah: { name: 'Umm al-Qura (Makkah)', fajr: 18.5, isha: { minutes: 90 }, ihtiyat: 0, note: 'Fajr 18.5°, Isha 90 minutes after Maghrib.' },
  jakim: { name: 'Singapore / JAKIM', fajr: 20, isha: 18, ihtiyat: 1, note: 'Fajr 20°, Isha 18°, with a 1 minute margin.' },
}

export type PrayerKey = 'imsak' | 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
export const PRAYER_KEYS: PrayerKey[] = ['imsak', 'fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
export const PRAYER_LABEL: Record<PrayerKey, string> = {
  imsak: 'Imsak',
  fajr: 'Subuh',
  sunrise: 'Terbit',
  dhuhr: 'Dzuhur',
  asr: 'Ashar',
  maghrib: 'Maghrib',
  isha: 'Isya',
}

/** Local clock hours (0–24, fractional) for each time. NaN when the sun never reaches the angle. */
export type Times = Record<PrayerKey, number>

const d2r = (d: number) => (d * Math.PI) / 180
const r2d = (r: number) => (r * 180) / Math.PI
const sin = (d: number) => Math.sin(d2r(d))
const cos = (d: number) => Math.cos(d2r(d))
const tan = (d: number) => Math.tan(d2r(d))
const asin = (x: number) => r2d(Math.asin(x))
const acos = (x: number) => r2d(Math.acos(x))
const atan2 = (y: number, x: number) => r2d(Math.atan2(y, x))
const acot = (x: number) => r2d(Math.atan(1 / x))
const fix = (a: number, b: number) => {
  const r = a - b * Math.floor(a / b)
  return r < 0 ? r + b : r
}
const fixAngle = (a: number) => fix(a, 360)
const fixHour = (a: number) => fix(a, 24)

/** Julian day at 0h UT for a Gregorian date. */
export function julian(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1
    month += 12
  }
  const A = Math.floor(year / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5
}

/** Sun declination (degrees) and equation of time (hours) for a Julian day. */
export function sunPosition(jd: number): { decl: number; eqt: number } {
  const D = jd - 2451545.0
  const g = fixAngle(357.529 + 0.98560028 * D)
  const q = fixAngle(280.459 + 0.98564736 * D)
  const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g))
  const e = 23.439 - 0.00000036 * D
  const RA = atan2(cos(e) * sin(L), cos(L)) / 15
  const eqt = q / 15 - fixHour(RA)
  const decl = asin(sin(e) * sin(L))
  return { decl, eqt }
}

export interface Place {
  lat: number
  lng: number
  /** Hours from UTC for the date being computed. */
  tz: number
}

export interface Options {
  method: MethodId
  asr: AsrSchool
}

/** Prayer times for one date and place, in local clock hours. */
export function prayerTimes(year: number, month: number, day: number, place: Place, opts: Options): Times {
  const { lat, lng, tz } = place
  const m = METHODS[opts.method]
  const jDate = julian(year, month, day) - lng / (15 * 24)

  const sun = (t: number) => sunPosition(jDate + t)
  const midDay = (t: number) => fixHour(12 - sun(t).eqt)
  const angleTime = (angle: number, t: number, ccw: boolean) => {
    const decl = sun(t).decl
    const noon = midDay(t)
    const h = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15
    return noon + (ccw ? -h : h)
  }
  const asrTime = (factor: number, t: number) => {
    const decl = sun(t).decl
    const angle = -acot(factor + tan(Math.abs(lat - decl)))
    return angleTime(angle, t, false)
  }

  // Two passes: estimate, then refine each time with the sun position at that moment.
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 }
  for (let i = 0; i < 2; i++) {
    const p = (h: number) => h / 24
    t = {
      fajr: angleTime(m.fajr, p(t.fajr), true),
      sunrise: angleTime(0.833, p(t.sunrise), true),
      dhuhr: midDay(p(t.dhuhr)),
      asr: asrTime(opts.asr === 'hanafi' ? 2 : 1, p(t.asr)),
      sunset: angleTime(0.833, p(t.sunset), false),
      isha: typeof m.isha === 'number' ? angleTime(m.isha, p(t.isha), false) : t.isha,
    }
  }

  const shift = tz - lng / 15
  const out: Times = {
    imsak: 0,
    fajr: t.fajr + shift + m.ihtiyat / 60,
    sunrise: t.sunrise + shift - m.ihtiyat / 60,
    dhuhr: t.dhuhr + shift + m.ihtiyat / 60,
    asr: t.asr + shift + m.ihtiyat / 60,
    maghrib: t.sunset + shift + m.ihtiyat / 60,
    isha: 0,
  }
  out.isha = typeof m.isha === 'number' ? t.isha + shift + m.ihtiyat / 60 : out.maghrib + m.isha.minutes / 60

  // Far from the equator the sun may not get deep enough: fall back to a slice of the night (angle-based rule).
  const night = 24 - (out.maghrib - out.sunrise)
  if (!Number.isFinite(out.fajr) || out.sunrise - out.fajr > (m.fajr / 60) * night) out.fajr = out.sunrise - (m.fajr / 60) * night
  if (typeof m.isha === 'number' && (!Number.isFinite(out.isha) || out.isha - out.maghrib > (m.isha / 60) * night)) out.isha = out.maghrib + (m.isha / 60) * night

  out.imsak = out.fajr - 10 / 60
  return out
}

/** Round a clock hour to the minute and format as HH:MM (24 h). Kemenag-style: seconds round up. */
export function hhmm(h: number): string {
  if (!Number.isFinite(h)) return '--:--'
  const total = Math.ceil(fixHour(h) * 60 - 1e-6) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export const KAABA = { lat: 21.4225, lng: 39.8262 }

/** Initial great-circle bearing from a place to the Kaaba, degrees clockwise from true north. */
export function qibla(lat: number, lng: number): number {
  const dl = d2r(KAABA.lng - lng)
  const p1 = d2r(lat)
  const p2 = d2r(KAABA.lat)
  const y = Math.sin(dl)
  const x = Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dl)
  return fixAngle(r2d(Math.atan2(y, x)))
}

/** Great-circle distance to the Kaaba in km. */
export function kaabaDistance(lat: number, lng: number): number {
  const p1 = d2r(lat)
  const p2 = d2r(KAABA.lat)
  const dp = p2 - p1
  const dl = d2r(KAABA.lng - lng)
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Sun altitude in degrees at a local clock hour (for drawing the sky arc). */
export function sunAltitude(year: number, month: number, day: number, hour: number, place: Place): number {
  const jd = julian(year, month, day) + (hour - place.tz) / 24
  const { decl, eqt } = sunPosition(jd)
  const solar = hour - place.tz + place.lng / 15 + eqt
  const H = (solar - 12) * 15
  return asin(sin(place.lat) * sin(decl) + cos(place.lat) * cos(decl) * cos(H))
}

/** Hours from UTC for an IANA zone at a moment, via Intl. Falls back to `fallback`. */
export function zoneOffset(zone: string, ms: number, fallback: number): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date(ms))
    const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d\d))?/)
    if (!m) return name === 'GMT' ? 0 : fallback
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3] ?? 0) / 60)
  } catch {
    return fallback
  }
}
