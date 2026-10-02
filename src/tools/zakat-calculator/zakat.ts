export const RATE = 0.025
export const GOLD_NISAB_G = 85
export const SILVER_NISAB_G = 595
export const FITRAH_RICE_KG = 2.5
export const FITRAH_RICE_L = 3.5

export type Basis = 'gold' | 'silver'

export interface MalInput {
  cash: number
  savings: number
  gold: number
  silver: number
  stocks: number
  receivables: number
  inventory: number
  debts: number
  basis: Basis
  goldPrice: number
  silverPrice: number
}

export interface MalResult {
  total: number
  net: number
  nisab: number
  due: boolean
  zakat: number
}

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

export function nisabFor(basis: Basis, goldPrice: number, silverPrice: number): number {
  return basis === 'gold' ? GOLD_NISAB_G * pos(goldPrice) : SILVER_NISAB_G * pos(silverPrice)
}

/** Zakat mal: 2.5% of net zakatable wealth once it reaches nisab (and has been held one haul). */
export function zakatMal(i: MalInput): MalResult {
  const total = pos(i.cash) + pos(i.savings) + pos(i.gold) + pos(i.silver) + pos(i.stocks) + pos(i.receivables) + pos(i.inventory)
  const net = Math.max(0, total - pos(i.debts))
  const nisab = nisabFor(i.basis, i.goldPrice, i.silverPrice)
  const due = nisab > 0 && net >= nisab
  return { total, net, nisab, due, zakat: due ? net * RATE : 0 }
}

export interface IncomeResult {
  income: number
  nisab: number
  due: boolean
  zakat: number
}

/**
 * Zakat penghasilan (profesi), monthly: nisab is 85 g of gold divided by 12,
 * and zakat is 2.5% of income (BAZNAS uses gross income; `deductions` is
 * optional for those who follow the net-income opinion).
 */
export function zakatIncome(monthly: number, other: number, goldPrice: number, deductions = 0): IncomeResult {
  const income = Math.max(0, pos(monthly) + pos(other) - pos(deductions))
  const nisab = (GOLD_NISAB_G * pos(goldPrice)) / 12
  const due = nisab > 0 && income >= nisab
  return { income, nisab, due, zakat: due ? income * RATE : 0 }
}

export function zakatFitrah(people: number, moneyPerPerson: number) {
  const n = Math.max(0, Math.floor(pos(people)))
  return { people: n, riceKg: n * FITRAH_RICE_KG, riceL: n * FITRAH_RICE_L, money: n * pos(moneyPerPerson) }
}

export function rupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.round(n)).replace(/\s/g, ' ')
}

/** Parses "1.500.000", "1,500,000" or "1500000" into a number. */
export function parseRupiah(text: string): number {
  const digits = text.replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}
