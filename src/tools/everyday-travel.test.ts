import { describe, expect, it } from 'vitest'
import { toKmPerLiter, tripCost } from './fuel-cost/logic'
import { chargeTime, powerAt } from './ev-charging/logic'
import { generateList } from './packing-list/logic'
import { makePlan, pieces, tzOffset } from './jet-lag-planner/logic'
import { DEFAULT_MODES, monthly, ranked, tripCost as commuteTrip } from './commute-compare/logic'
import { FACTORS, flightMode, legKg, totalKg, treesFor } from './carbon-footprint/logic'
import { budget, resizeDays, type DayCosts } from './travel-budget/logic'
import { actualSpeed, diffPercent, parseTire, tireStats } from './tire-size/logic'
import { clock, minutesUntil, parkingCost, reminderDue } from './parking-timer/logic'
import { firstFree, gaps, overlaps, place, type Activity } from './trip-itinerary/logic'

describe('fuel-cost', () => {
  it('converts L/100 km to km/L', () => {
    expect(toKmPerLiter(8, 'l100')).toBeCloseTo(12.5)
    expect(toKmPerLiter(14, 'kmpl')).toBe(14)
    expect(toKmPerLiter(0, 'kmpl')).toBeNaN()
  })

  it('costs a round trip and splits it', () => {
    const r = tripCost({ distanceKm: 150, consumption: 12.5, unit: 'kmpl', price: 10000, roundTrip: true, passengers: 4, extras: 200000, tank: 40 })
    expect(r.km).toBe(300)
    expect(r.liters).toBeCloseTo(24)
    expect(r.fuelCost).toBeCloseTo(240000)
    expect(r.total).toBeCloseTo(440000)
    expect(r.perPerson).toBeCloseTo(110000)
    expect(r.perKm).toBeCloseTo(440000 / 300)
    expect(r.refuels).toBe(0)
    expect(tripCost({ distanceKm: 780, consumption: 10, unit: 'kmpl', price: 10000, roundTrip: true, passengers: 1, extras: 0, tank: 40 }).refuels).toBe(3)
  })
})

describe('ev-charging', () => {
  const ev = { maxAc: 11, maxDc: 100 }

  it('holds power flat until 80% and tapers after', () => {
    expect(powerAt(50, 50, ev)).toBe(50)
    expect(powerAt(50, 150, ev)).toBe(100)
    expect(powerAt(50, 22, ev)).toBe(11)
    expect(powerAt(90, 50, ev)).toBeLessThan(50)
    expect(powerAt(100, 50, ev)).toBeCloseTo(7.5)
  })

  it('integrates charging time, with the last 20% slower than the first', () => {
    const flat = chargeTime(60, 20, 80, 7, ev, 1000)
    expect(flat.hours).toBeCloseTo((60 * 0.6) / 7, 3)
    expect(flat.stored).toBeCloseTo(36)
    expect(flat.cost).toBeCloseTo((36 / 0.88) * 1000)
    const low = chargeTime(60, 20, 40, 50, ev, 0).hours
    const high = chargeTime(60, 80, 100, 50, ev, 0).hours
    expect(high).toBeGreaterThan(low * 2)
    expect(chargeTime(27, 20, 80, 50, { maxAc: 6.6, maxDc: 0 }, 0).acFallback).toBe(true)
  })
})

describe('packing-list', () => {
  const base = { type: 'city', weather: 'hot', days: 10, travelers: 1, laundry: false, abroad: false } as const
  const qty = (list: ReturnType<typeof generateList>, id: string) => list.find((i) => i.id === id)?.qty

  it('scales clothes with days and caps them when laundry is available', () => {
    expect(qty(generateList(base), 'underwear')).toBe(11)
    expect(qty(generateList({ ...base, laundry: true }), 'underwear')).toBe(5)
    expect(qty(generateList({ ...base, travelers: 3 }), 'underwear')).toBe(33)
    // Shared items are not multiplied by travelers.
    expect(qty(generateList({ ...base, travelers: 3 }), 'shampoo')).toBe(1)
  })

  it('adds trip- and weather-specific items', () => {
    const umrah = generateList({ ...base, type: 'umrah' }).map((i) => i.id)
    expect(umrah).toContain('ihram')
    expect(umrah).toContain('passport')
    const beach = generateList({ ...base, type: 'beach', weather: 'rainy', days: 3 }).map((i) => i.id)
    expect(beach).toContain('swim')
    expect(beach).toContain('raincoat')
    expect(beach).not.toContain('laptop')
  })
})

describe('jet-lag-planner', () => {
  it('reads time zone offsets, including daylight saving', () => {
    expect(tzOffset('Asia/Jakarta', Date.UTC(2026, 6, 1))).toBe(420)
    expect(tzOffset('Europe/London', Date.UTC(2026, 6, 1))).toBe(60)
    expect(tzOffset('Europe/London', Date.UTC(2026, 0, 1))).toBe(0)
  })

  it('shifts sleep later before a westward flight and reaches local time', () => {
    const p = makePlan({ origin: 'Asia/Jakarta', dest: 'Europe/London', depart: '2026-07-10T21:30', flightHours: 16, sleep: 23 * 60, wake: 7 * 60 })
    expect(p.diff).toBe(-6)
    expect(p.direction).toBe('west')
    expect(p.days.map((d) => d.sleep).slice(0, 3)).toEqual([0, 60, 120])
    expect(p.days[3].flight?.[0]).toBe(21 * 60 + 30)
    const last = p.days[6]
    expect(last.tz).toBe('Europe/London')
    expect(last.sleep).toBe(23 * 60)
    expect(last.seek).toBeUndefined()
  })

  it('advances sleep for an eastward trip and splits spans across midnight', () => {
    const p = makePlan({ origin: 'Asia/Jakarta', dest: 'Asia/Tokyo', depart: '2026-07-10T08:00', flightHours: 7, sleep: 23 * 60, wake: 7 * 60 })
    expect(p.direction).toBe('east')
    expect(p.days[0].sleep).toBe(22 * 60)
    expect(p.days[0].seek?.[0]).toBe(6 * 60)
    expect(pieces([23 * 60, 7 * 60])).toEqual([[1380, 1440], [0, 420]])
  })
})

describe('commute-compare', () => {
  const mode = (id: string) => DEFAULT_MODES.find((m) => m.id === id)!

  it('prices KRL by distance bands and flat bus fares', () => {
    expect(commuteTrip(mode('krl'), 20)).toBe(3000)
    expect(commuteTrip(mode('krl'), 45)).toBe(5000)
    expect(commuteTrip(mode('bus'), 30)).toBe(3500)
  })

  it('works out monthly cost, time and CO2, and ranks by metric', () => {
    const car = monthly(mode('car'), 10, 20)
    expect(car.monthlyCost).toBe(40 * 12000 + 20 * 10000)
    expect(car.monthlyCo2Kg).toBeCloseTo((400 * 170) / 1000)
    expect(car.monthlyHours).toBeCloseTo((40 * ((10 / 22) * 60 + 8)) / 60)
    const all = DEFAULT_MODES.map((m) => monthly(m, 10, 20))
    expect(ranked(all, 'co2')[0].monthlyCo2Kg).toBe(0)
    expect(ranked(all, 'cost')[0].id).toBe('walk')
  })
})

describe('carbon-footprint', () => {
  it('splits car emissions between passengers but not flight emissions', () => {
    const solo = legKg({ id: 'a', mode: 'car-petrol', km: 100, passengers: 1 })
    const shared = legKg({ id: 'b', mode: 'car-petrol', km: 100, passengers: 4 })
    expect(solo).toBeCloseTo(17)
    expect(shared).toBeCloseTo(17 / 4)
    expect(legKg({ id: 'c', mode: 'car-petrol', km: 100, passengers: 4, travelers: 4 })).toBeCloseTo(17)
    expect(legKg({ id: 'd', mode: 'train', km: 100, passengers: 1, travelers: 2, roundTrip: true })).toBeCloseTo(0.035 * 400)
  })

  it('totals legs, counts trees and picks the flight band', () => {
    const legs = [
      { id: 'a', mode: flightMode(980, false), km: 980, passengers: 1, roundTrip: true },
      { id: 'b', mode: 'bus' as const, km: 50, passengers: 1 },
    ]
    expect(legs[0].mode).toBe('flight-short-eco')
    expect(flightMode(11700, true)).toBe('flight-long-biz')
    const kg = totalKg(legs)
    expect(kg).toBeCloseTo(FACTORS['flight-short-eco'].kgPerKm * 1960 + 5)
    expect(treesFor(kg)).toBe(Math.ceil(kg / 22))
    expect(treesFor(0)).toBe(0)
  })
})

describe('travel-budget', () => {
  const day = (n: number): DayCosts => ({ stay: n, food: n, transport: 0, activities: 0, shopping: 0, misc: 0 })

  it('totals days and one-offs and splits per person', () => {
    const r = budget({ days: [day(100), day(50)], oneOffs: [{ id: 'f', name: 'Flights', amount: 600 }], travelers: 3, basis: 'group' })
    expect(r.dayTotals).toEqual([200, 100])
    expect(r.byCat.stay).toBe(150)
    expect(r.total).toBe(900)
    expect(r.perPerson).toBe(300)
    expect(r.avgPerDay).toBe(150)
  })

  it('multiplies per-person amounts by travelers and resizes days', () => {
    const r = budget({ days: [day(100)], oneOffs: [{ id: 'f', name: 'Visa', amount: 50 }], travelers: 2, basis: 'person' })
    expect(r.total).toBe(500)
    expect(r.perPerson).toBe(250)
    const days = resizeDays([day(1), day(2)], 4)
    expect(days).toHaveLength(4)
    expect(days[3].stay).toBe(2)
    expect(resizeDays(days, 1)).toHaveLength(1)
  })
})

describe('tire-size', () => {
  it('parses common size formats', () => {
    expect(parseTire('185/65R15')).toEqual({ width: 185, aspect: 65, rim: 15 })
    expect(parseTire('p205/55 zr16')).toEqual({ width: 205, aspect: 55, rim: 16 })
    expect(parseTire('195-60-15')).toEqual({ width: 195, aspect: 60, rim: 15 })
    expect(parseTire('hello')).toBeNull()
  })

  it('computes diameter, revolutions and speedometer error', () => {
    const a = { width: 185, aspect: 65, rim: 15 }
    const b = { width: 195, aspect: 55, rim: 16 }
    const s = tireStats(a)
    expect(s.sidewall).toBeCloseTo(120.25)
    expect(s.diameter).toBeCloseTo(381 + 240.5)
    expect(s.revsPerKm).toBeCloseTo(1e6 / (Math.PI * 621.5))
    expect(diffPercent(a, b)).toBeCloseTo(((406.4 + 214.5 - 621.5) / 621.5) * 100)
    expect(actualSpeed(a, { width: 185, aspect: 65, rim: 15 }, 100)).toBe(100)
    expect(actualSpeed(a, { width: 225, aspect: 60, rim: 17 }, 100)).toBeGreaterThan(103)
  })
})

describe('parking-timer', () => {
  it('charges every started hour, with an optional daily cap', () => {
    const r = { first: 5000, next: 4000, dailyMax: 0 }
    expect(parkingCost(0, r)).toBe(0)
    expect(parkingCost(30, r)).toBe(5000)
    expect(parkingCost(61, r)).toBe(9000)
    expect(parkingCost(180, r)).toBe(13000)
    expect(parkingCost(600, { ...r, dailyMax: 25000 })).toBe(25000)
  })

  it('counts down, formats and knows when to remind', () => {
    const now = new Date(2026, 8, 26, 22, 30)
    expect(minutesUntil('23:15', now)).toBe(45)
    expect(minutesUntil('01:00', now)).toBe(150)
    expect(clock(65_000)).toBe('1:05')
    expect(clock(3_725_000)).toBe('1:02:05')
    expect(clock(-5_000)).toBe('−0:05')
    const end = 1_000_000
    expect(reminderDue(end, 10, end - 11 * 60_000)).toBe(false)
    expect(reminderDue(end, 10, end - 9 * 60_000)).toBe(true)
    expect(reminderDue(end, 10, end + 1)).toBe(false)
  })
})

describe('trip-itinerary', () => {
  const a = (id: string, day: number | null, start: number, dur: number): Activity => ({ id, name: id, place: '', type: 'sight', day, start, dur })

  it('finds gaps between consecutive stops', () => {
    const acts = [a('x', 0, 540, 60), a('y', 0, 660, 60), a('z', 0, 720, 30), a('w', 1, 600, 60)]
    const g = gaps(acts, 0)
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ from: 'x', to: 'y', start: 600, end: 660, minutes: 60 })
  })

  it('flags overlaps per day and finds the first free slot', () => {
    const acts = [a('x', 0, 540, 90), a('y', 0, 600, 30), a('z', 1, 600, 30), a('i', null, 540, 60)]
    expect([...overlaps(acts)].sort()).toEqual(['x', 'y'])
    expect(firstFree(acts, 0, 60)).toBe(480)
    expect(firstFree(acts, 0, 90)).toBe(630)
    expect(firstFree(acts, 1, 60)).toBe(480)
    expect(place(1430, 60)).toEqual({ start: 1380, dur: 60 })
    expect(place(200, 7)).toEqual({ start: 360, dur: 15 })
  })
})
