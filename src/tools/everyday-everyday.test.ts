import { describe, expect, it } from 'vitest'
import { hhmm, prayerTimes, qibla } from './prayer-times/prayer'

const minutes = (h: number) => h * 60
const hm = (s: string) => {
  const [a, b] = s.split(':').map(Number)
  return a * 60 + b
}

describe('prayer-times', () => {
  const jakarta = { lat: -6.2088, lng: 106.8456, tz: 7 }
  it('matches known Jakarta times within 3 minutes', () => {
    // 1 Jan 2024, Jakarta: sunrise 05:41, solar noon 11:56, sunset 18:10 (astronomical, no ihtiyat).
    const mwl = prayerTimes(2024, 1, 1, jakarta, { method: 'mwl', asr: 'shafii' })
    expect(Math.abs(minutes(mwl.sunrise) - hm('05:41'))).toBeLessThanOrEqual(3)
    expect(Math.abs(minutes(mwl.dhuhr) - hm('11:56'))).toBeLessThanOrEqual(3)
    expect(Math.abs(minutes(mwl.maghrib) - hm('18:10'))).toBeLessThanOrEqual(3)
    // Kemenag schedule for the same day: Subuh ≈ 04:18, Dzuhur ≈ 11:58, Ashar ≈ 15:24, Maghrib ≈ 18:12, Isya ≈ 19:27.
    const k = prayerTimes(2024, 1, 1, jakarta, { method: 'kemenag', asr: 'shafii' })
    for (const [key, want] of [['fajr', '04:18'], ['dhuhr', '11:58'], ['asr', '15:24'], ['maghrib', '18:12'], ['isha', '19:27']] as const) {
      expect(Math.abs(minutes(k[key]) - hm(want))).toBeLessThanOrEqual(3)
    }
    expect(minutes(k.fajr - k.imsak)).toBeCloseTo(10)
    expect(hhmm(k.dhuhr)).toMatch(/^11:5\d$/)
  })
  it('Hanafi asr is later than Shafii', () => {
    const s = prayerTimes(2024, 6, 1, jakarta, { method: 'kemenag', asr: 'shafii' })
    const h = prayerTimes(2024, 6, 1, jakarta, { method: 'kemenag', asr: 'hanafi' })
    expect(h.asr - s.asr).toBeGreaterThan(0.5)
  })
  it('gives the qibla bearing', () => {
    expect(qibla(-6.2088, 106.8456)).toBeCloseTo(295.1, 0)
    expect(qibla(51.5074, -0.1278)).toBeCloseTo(119, 0)
  })
})
