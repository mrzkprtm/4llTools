import { describe, expect, it } from 'vitest'
import { nisabFor, parseRupiah, rupiah, zakatFitrah, zakatIncome, zakatMal } from './zakat'

const empty = { cash: 0, savings: 0, gold: 0, silver: 0, stocks: 0, receivables: 0, inventory: 0, debts: 0, basis: 'gold' as const, goldPrice: 1_000_000, silverPrice: 10_000 }

describe('zakat', () => {
  it('uses 85 g gold or 595 g silver for nisab', () => {
    expect(nisabFor('gold', 1_000_000, 10_000)).toBe(85_000_000)
    expect(nisabFor('silver', 1_000_000, 10_000)).toBe(5_950_000)
  })

  it('charges 2.5% of net wealth only at or above nisab', () => {
    const r = zakatMal({ ...empty, cash: 50_000_000, savings: 60_000_000, debts: 10_000_000 })
    expect(r.total).toBe(110_000_000)
    expect(r.net).toBe(100_000_000)
    expect(r.due).toBe(true)
    expect(r.zakat).toBe(2_500_000)
    expect(zakatMal({ ...empty, cash: 84_999_999 }).zakat).toBe(0)
    expect(zakatMal({ ...empty, cash: 10_000_000, basis: 'silver' }).zakat).toBe(250_000)
  })

  it('never lets debts push wealth below zero or count negative inputs', () => {
    expect(zakatMal({ ...empty, cash: 5, debts: 100, stocks: -50 }).net).toBe(0)
  })

  it('computes monthly zakat penghasilan against 85 g / 12', () => {
    const r = zakatIncome(10_000_000, 0, 1_200_000)
    expect(r.nisab).toBe(8_500_000)
    expect(r.zakat).toBe(250_000)
    expect(zakatIncome(8_000_000, 0, 1_200_000).due).toBe(false)
    expect(zakatIncome(10_000_000, 0, 1_200_000, 2_000_000).due).toBe(false)
  })

  it('computes zakat fitrah per person', () => {
    expect(zakatFitrah(4, 45_000)).toEqual({ people: 4, riceKg: 10, riceL: 14, money: 180_000 })
  })

  it('formats and parses rupiah', () => {
    expect(rupiah(2500000)).toBe('Rp 2.500.000')
    expect(parseRupiah('Rp 1.500.000')).toBe(1_500_000)
    expect(parseRupiah('')).toBe(0)
  })
})
