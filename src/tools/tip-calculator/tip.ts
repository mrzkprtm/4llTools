/** Tip, split and rounding math. */

export interface Currency {
  code: string
  /** Step used when rounding up per person (e.g. Rp1.000). */
  step: number
  decimals: number
  locale: string
}

export const CURRENCIES: Currency[] = [
  { code: 'IDR', step: 1000, decimals: 0, locale: 'id-ID' },
  { code: 'USD', step: 1, decimals: 2, locale: 'en-US' },
  { code: 'EUR', step: 1, decimals: 2, locale: 'de-DE' },
  { code: 'GBP', step: 1, decimals: 2, locale: 'en-GB' },
  { code: 'SGD', step: 1, decimals: 2, locale: 'en-SG' },
  { code: 'MYR', step: 1, decimals: 2, locale: 'ms-MY' },
  { code: 'AUD', step: 1, decimals: 2, locale: 'en-AU' },
  { code: 'JPY', step: 100, decimals: 0, locale: 'ja-JP' },
  { code: 'THB', step: 10, decimals: 0, locale: 'th-TH' },
]

export interface TipInput {
  bill: number
  tipPct: number
  people: number
  roundUp: boolean
  step: number
  decimals: number
}

export interface TipResult {
  tip: number
  total: number
  perPerson: number
  /** Tip including any extra from rounding up. */
  tipFinal: number
  totalFinal: number
  perPersonFinal: number
  /** Effective tip percentage after rounding. */
  effectivePct: number
}

/** Round to the currency's smallest unit to avoid floating-point dust. */
export function money(v: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(v * f) / f
}

/** Round up to a multiple of `step` (with a tiny tolerance so exact multiples stay put). */
export function roundUpTo(v: number, step: number): number {
  if (step <= 0) return v
  return Math.ceil(v / step - 1e-9) * step
}

export function calcTip({ bill, tipPct, people, roundUp, step, decimals }: TipInput): TipResult {
  const b = Math.max(0, Number.isFinite(bill) ? bill : 0)
  const n = Math.max(1, Math.floor(people) || 1)
  const tip = money((b * Math.max(0, tipPct)) / 100, decimals)
  const total = money(b + tip, decimals)
  const perPerson = money(total / n, decimals)
  const perPersonFinal = roundUp ? roundUpTo(total / n, step) : perPerson
  const totalFinal = roundUp ? money(perPersonFinal * n, decimals) : total
  const tipFinal = money(totalFinal - b, decimals)
  return { tip, total, perPerson, tipFinal, totalFinal, perPersonFinal, effectivePct: b ? (tipFinal / b) * 100 : 0 }
}

export function format(v: number, c: Currency): string {
  try {
    return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.code, minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals }).format(v)
  } catch {
    return `${c.code} ${v.toFixed(c.decimals)}`
  }
}
