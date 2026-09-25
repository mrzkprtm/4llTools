export type Timing = 'start' | 'end'

export interface CompoundInput {
  principal: number
  monthly: number
  /** Annual rate in percent. */
  rate: number
  years: number
  /** Compounding periods per year (1, 2, 4, 12, 365). */
  perYear: number
  timing: Timing
  /** Annual inflation in percent, 0 to ignore. */
  inflation?: number
}

export interface YearRow {
  year: number
  contributed: number
  interest: number
  balance: number
  /** Balance in today's money after inflation. */
  real: number
}

/** The monthly rate that grows money exactly as `perYear` compounding does. */
export function monthlyRate(rate: number, perYear: number): number {
  return Math.pow(1 + rate / 100 / perYear, perYear / 12) - 1
}

/**
 * Simulates month by month. Deposits earn interest from the month they are
 * added, at the equivalent monthly rate of the chosen compounding.
 */
export function grow(input: CompoundInput): YearRow[] {
  const { principal, monthly, rate, years, perYear, timing, inflation = 0 } = input
  const i = monthlyRate(rate, perYear)
  const months = Math.round(years * 12)
  let balance = principal
  let contributed = principal
  const rows: YearRow[] = [{ year: 0, contributed, interest: 0, balance, real: balance }]
  for (let m = 1; m <= months; m++) {
    if (timing === 'start') {
      balance += monthly
      balance *= 1 + i
    } else {
      balance *= 1 + i
      balance += monthly
    }
    contributed += monthly
    if (m % 12 === 0 || m === months) {
      const year = m / 12
      rows.push({ year, contributed, interest: balance - contributed, balance, real: balance / Math.pow(1 + inflation / 100, year) })
    }
  }
  return rows
}

export const CURRENCIES = {
  IDR: { locale: 'id-ID', digits: 0 },
  USD: { locale: 'en-US', digits: 2 },
  EUR: { locale: 'de-DE', digits: 2 },
} as const

export type Currency = keyof typeof CURRENCIES

export function money(n: number, currency: Currency, compact = false): string {
  if (!Number.isFinite(n)) return '—'
  const c = CURRENCIES[currency]
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : c.digits,
    minimumFractionDigits: compact ? 0 : c.digits,
  }).format(n)
}
