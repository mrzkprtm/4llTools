import { describe, expect, it } from 'vitest'
import { grow, money, monthlyRate } from './compound'

const base = { principal: 0, monthly: 0, rate: 0, years: 1, perYear: 12, timing: 'end' as const }
const last = (rows: ReturnType<typeof grow>) => rows[rows.length - 1]

describe('compound interest', () => {
  it('compounds a lump sum monthly and yearly', () => {
    expect(last(grow({ ...base, principal: 1000, rate: 12 })).balance).toBeCloseTo(1126.83, 2)
    expect(last(grow({ ...base, principal: 1000, rate: 10, years: 2, perYear: 1 })).balance).toBeCloseTo(1210, 6)
  })

  it('matches the annuity formula for monthly deposits', () => {
    const end = last(grow({ ...base, monthly: 100, rate: 12 }))
    expect(end.balance).toBeCloseTo(1268.25, 2)
    expect(end.contributed).toBe(1200)
    expect(last(grow({ ...base, monthly: 100, rate: 12, timing: 'start' })).balance).toBeCloseTo(1280.93, 2)
  })

  it('gives one row per year plus a start row and adjusts for inflation', () => {
    const rows = grow({ ...base, principal: 1000, years: 3, inflation: 10 })
    expect(rows.map((r) => r.year)).toEqual([0, 1, 2, 3])
    expect(rows[3].real).toBeCloseTo(1000 / 1.331, 4)
    expect(rows[3].interest).toBe(0)
  })

  it('handles daily compounding and partial years', () => {
    expect(monthlyRate(12, 12)).toBeCloseTo(0.01, 10)
    expect(Math.pow(1 + monthlyRate(5, 365), 12)).toBeCloseTo(Math.pow(1 + 0.05 / 365, 365), 10)
    expect(last(grow({ ...base, principal: 100, years: 1.5 })).year).toBe(1.5)
  })

  it('formats IDR without decimals', () => {
    expect(money(1500000, 'IDR').replace(/\s/g, ' ')).toBe('Rp 1.500.000')
    expect(money(12.5, 'USD')).toBe('$12.50')
  })
})
