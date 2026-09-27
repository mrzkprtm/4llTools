import { describe, expect, it } from 'vitest'
import { hhmm, prayerTimes, qibla } from './prayer-times/prayer'
import { counterReducer, initCounter, PRESETS } from './digital-tasbih/counter'
import { fromHijriTabular, moonPhase, toHijriTabular } from './hijri-calendar/hijri'
import { jdn, nextSameWeton, weton } from './weton-calculator/weton'
import { cellOf, cellRange, weeksLived } from './life-in-weeks/life'
import { dueDate, progress } from './pregnancy-week/pregnancy'
import { newMatch, point, situation, ttServer, type MatchState, type Side } from './scoreboard/rules'
import { fasterThan, normalCdf, stats } from './reaction-time/reaction'
import { lookup, matchMeasure, TABLES } from './clothing-size/sizes'
import { calcTip, roundUpTo } from './tip-calculator/tip'

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

describe('digital-tasbih', () => {
  it('advances through the 33/33/34 sequence and counts rounds', () => {
    let s = initCounter(PRESETS[0].seq)
    for (let i = 0; i < 32; i++) s = counterReducer(s, { type: 'tap' })
    expect([s.index, s.count]).toEqual([0, 32])
    s = counterReducer(s, { type: 'tap' })
    expect([s.index, s.count, s.event]).toEqual([1, 0, 'target'])
    for (let i = 0; i < 33 + 34; i++) s = counterReducer(s, { type: 'tap' })
    expect([s.index, s.rounds, s.total, s.event]).toEqual([0, 1, 100, 'round'])
  })
  it('undoes across a target and resets', () => {
    let s = initCounter([{ label: 'x', target: 2 }, { label: 'y', target: 0 }])
    s = counterReducer(counterReducer(s, { type: 'tap' }), { type: 'tap' })
    expect(s.index).toBe(1)
    s = counterReducer(s, { type: 'undo' })
    expect([s.index, s.count, s.total]).toEqual([0, 1, 1])
    for (let i = 0; i < 50; i++) s = counterReducer(s, { type: 'tap' })
    expect(s.count).toBe(49) // free tally has no target
    expect(counterReducer(s, { type: 'reset' }).total).toBe(0)
  })
})

describe('hijri-calendar', () => {
  it('converts known dates both ways (tabular)', () => {
    expect(toHijriTabular(2000, 1, 1)).toEqual({ year: 1420, month: 9, day: 24 })
    expect(toHijriTabular(2024, 3, 11)).toEqual({ year: 1445, month: 9, day: 1 })
    expect(fromHijriTabular(1445, 9, 1)).toEqual({ year: 2024, month: 3, day: 11 })
    for (const [y, m, d] of [[1990, 5, 17], [2031, 12, 2]]) {
      const h = toHijriTabular(y, m, d)
      expect(fromHijriTabular(h.year, h.month, h.day)).toEqual({ year: y, month: m, day: d })
    }
  })
  it('computes moon phase', () => {
    expect(Math.min(moonPhase(2024, 1, 11), 1 - moonPhase(2024, 1, 11))).toBeLessThan(0.03) // new moon
    expect(Math.abs(moonPhase(2024, 4, 23) - 0.5)).toBeLessThan(0.03) // full moon
  })
})

describe('weton-calculator', () => {
  it('finds day, pasaran and neptu', () => {
    expect(weton(1900, 1, 1)).toMatchObject({ day: 'Senin', pasaran: 'Pahing' })
    expect(weton(1945, 8, 17)).toMatchObject({ day: 'Jumat', pasaran: 'Legi', neptu: 11 })
    expect(weton(2000, 1, 1)).toMatchObject({ day: 'Sabtu', pasaran: 'Legi', neptu: 14 })
  })
  it('repeats every 35 days', () => {
    const b = jdn(1945, 8, 17)
    const next = nextSameWeton(b, 2, b + 100)
    expect(next[0]).toBe(b + 105)
    expect(weton(1945, 8, 17).neptu).toBe(11)
  })
})

describe('life-in-weeks', () => {
  it('maps dates to week cells', () => {
    expect(weeksLived('2000-01-01', '2000-01-15')).toBe(2)
    expect(cellOf('1995-06-15', '1995-06-15')).toEqual({ row: 0, col: 0 })
    expect(cellOf('1995-06-15', '2005-06-14')).toEqual({ row: 9, col: 51 })
    expect(cellOf('1995-06-15', '2005-06-29')).toEqual({ row: 10, col: 2 })
    expect(cellRange('1995-06-15', 10, 2)).toEqual(['2005-06-29', '2005-07-05'])
  })
})

describe('pregnancy-week', () => {
  it("uses Naegele's rule with cycle adjustment", () => {
    expect(dueDate({ basis: 'lmp', date: '2025-01-01', cycle: 28 })).toBe('2025-10-08')
    expect(dueDate({ basis: 'lmp', date: '2025-01-01', cycle: 32 })).toBe('2025-10-12')
    expect(dueDate({ basis: 'conception', date: '2025-01-15' })).toBe('2025-10-08')
    expect(dueDate({ basis: 'ivf', date: '2025-01-20', embryoDays: 5 })).toBe('2025-10-08')
  })
  it('gives gestational age and trimester', () => {
    const p = progress({ basis: 'lmp', date: '2025-01-01', cycle: 28 }, '2025-05-10')
    expect([p.weeks, p.days, p.trimester]).toEqual([18, 3, 2])
  })
})

describe('scoreboard', () => {
  const play = (m: MatchState, seq: Side[]) => seq.reduce(point, m)
  it('badminton: win by 2, cap at 30, rally-winner serves', () => {
    let m = play(newMatch('badminton'), [...Array(20).fill(0), ...Array(20).fill(1)])
    expect(m.score).toEqual([20, 20])
    expect(situation(m)).toBe('Deuce')
    m = point(m, 0)
    expect(m.won).toEqual([0, 0])
    expect(m.server).toBe(0)
    m = play(m, [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1])
    expect(m.score).toEqual([29, 29])
    m = point(m, 1)
    expect(m.won).toEqual([0, 1])
    expect(m.games[0]).toEqual([29, 30])
  })
  it('table tennis serve alternates every 2, then every point at deuce', () => {
    expect([0, 1, 2, 3, 4].map((p) => ttServer(0, p, 0))).toEqual([0, 0, 1, 1, 0])
    expect(ttServer(0, 10, 10)).toBe(0)
    expect(ttServer(0, 11, 10)).toBe(1)
    expect(ttServer(0, 11, 11)).toBe(0)
  })
  it('volleyball deciding set goes to 15 and switches ends at 8', () => {
    let m = newMatch('volleyball')
    for (const w of [0, 1, 0, 1] as Side[]) m = play(m, Array(25).fill(w))
    expect(m.won).toEqual([2, 2])
    m = play(m, Array(7).fill(0))
    expect(point(m, 0).changeEnds).toBe(true)
    m = play(m, Array(8).fill(0))
    expect(m.winner).toBe(0)
  })
})

describe('reaction-time', () => {
  it('computes stats and percentiles', () => {
    const s = stats([250, 300, 200, 350, 260])
    expect(s.mean).toBe(272)
    expect(s.median).toBe(260)
    expect(s.best).toBe(200)
    expect(normalCdf(273, 273, 50)).toBeCloseTo(0.5, 6)
    expect(normalCdf(323, 273, 50)).toBeCloseTo(0.8413, 3)
    expect(fasterThan(223)).toBeCloseTo(84.13, 1)
  })
})

describe('clothing-size', () => {
  it('looks up sizes and matches measurements', () => {
    const shoes = TABLES.find((t) => t.id === 'shoes-men')!
    const i = lookup(shoes, 'us', '9')
    expect(shoes.rows[i].sizes.eu).toBe('42.5')
    expect(shoes.rows[matchMeasure(shoes, { foot: 25.3 })!.index].sizes.cm).toBe('25.5')
    const women = TABLES.find((t) => t.id === 'women-tops')!
    const m = matchMeasure(women, { chest: 90, waist: 72, hip: 98 })!
    expect(women.rows[m.index].sizes.intl).toBe('M')
    expect(m.exact).toBe(true)
    // Measurements that disagree pick the larger size.
    expect(women.rows[matchMeasure(women, { chest: 86, hip: 101 })!.index].sizes.intl).toBe('L')
  })
})

describe('tip-calculator', () => {
  it('splits and rounds up per person', () => {
    const r = calcTip({ bill: 385000, tipPct: 10, people: 3, roundUp: true, step: 1000, decimals: 0 })
    expect(r.tip).toBe(38500)
    expect(r.total).toBe(423500)
    expect(r.perPersonFinal).toBe(142000)
    expect(r.totalFinal).toBe(426000)
    expect(r.tipFinal).toBe(41000)
    const u = calcTip({ bill: 86.5, tipPct: 18, people: 2, roundUp: false, step: 1, decimals: 2 })
    expect(u.tip).toBe(15.57)
    expect(u.perPerson).toBe(51.04)
    expect(roundUpTo(3000, 1000)).toBe(3000)
  })
})
