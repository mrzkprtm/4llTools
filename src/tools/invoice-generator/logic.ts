/** Invoice math and formatting. Pure, so it is shared by the preview, the PDF and the tests. */

export interface Item {
  id: number
  desc: string
  qty: number
  price: number
}

export type DiscountType = 'pct' | 'fixed'

export interface CurrencyInfo {
  symbol: string
  decimals: number
  thousands: string
  decimal: string
  /** Space between the symbol and the number (Rp 10.000). */
  space: boolean
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  IDR: { symbol: 'Rp', decimals: 0, thousands: '.', decimal: ',', space: true },
  USD: { symbol: '$', decimals: 2, thousands: ',', decimal: '.', space: false },
  EUR: { symbol: '€', decimals: 2, thousands: '.', decimal: ',', space: true },
  SGD: { symbol: 'S$', decimals: 2, thousands: ',', decimal: '.', space: false },
  MYR: { symbol: 'RM', decimals: 2, thousands: ',', decimal: '.', space: false },
  AUD: { symbol: 'A$', decimals: 2, thousands: ',', decimal: '.', space: false },
  GBP: { symbol: '£', decimals: 2, thousands: ',', decimal: '.', space: false },
  JPY: { symbol: '¥', decimals: 0, thousands: ',', decimal: '.', space: false },
}

const info = (currency: string) => CURRENCIES[currency] ?? CURRENCIES.USD

/** Rounds half away from zero to the currency's minor unit, avoiding 1.005 → 1.00 float errors. */
export function roundMoney(v: number, currency: string): number {
  const f = 10 ** info(currency).decimals
  const s = Math.sign(v)
  return (s * Math.round(Math.abs(v) * f + 1e-7)) / f
}

/** Groups digits with the currency's separators: 1234567 → "1.234.567" for IDR. */
export function formatNumber(v: number, currency: string): string {
  const c = info(currency)
  const r = roundMoney(Math.abs(v), currency)
  const [int, frac] = r.toFixed(c.decimals).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, c.thousands)
  return (v < 0 && r !== 0 ? '-' : '') + (frac ? grouped + c.decimal + frac : grouped)
}

/** "Rp 1.234.567", "$1,234.50", "-€12,00". */
export function formatMoney(v: number, currency: string): string {
  const c = info(currency)
  const n = formatNumber(Math.abs(v), currency)
  const neg = v < 0 && roundMoney(Math.abs(v), currency) !== 0
  return `${neg ? '-' : ''}${c.symbol}${c.space ? ' ' : ''}${n}`
}

export interface Totals {
  subtotal: number
  discount: number
  taxable: number
  tax: number
  total: number
}

export function lineAmount(item: Pick<Item, 'qty' | 'price'>, currency: string): number {
  return roundMoney((Number(item.qty) || 0) * (Number(item.price) || 0), currency)
}

/** Subtotal of rounded line amounts, then discount, then tax on what is left. */
export function computeTotals(items: readonly Item[], discountType: DiscountType, discount: number, taxRate: number, currency: string): Totals {
  const subtotal = roundMoney(items.reduce((s, it) => s + lineAmount(it, currency), 0), currency)
  const rawDisc = discountType === 'pct' ? (subtotal * Math.min(100, Math.max(0, discount))) / 100 : Math.max(0, discount)
  const disc = Math.min(subtotal, roundMoney(rawDisc, currency))
  const taxable = roundMoney(subtotal - disc, currency)
  const tax = roundMoney((taxable * Math.max(0, taxRate)) / 100, currency)
  return { subtotal, discount: disc, taxable, tax, total: roundMoney(taxable + tax, currency) }
}

/**
 * Greedy word wrap: splits `text` into lines no wider than `max` according to
 * `measure`. Keeps explicit line breaks and breaks words that are too long.
 */
export function wrapText(text: string, max: number, measure: (s: string) => number): string[] {
  const out: string[] = []
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean)
    if (!words.length) {
      out.push('')
      continue
    }
    let line = ''
    for (let w of words) {
      while (measure(w) > max && w.length > 1) {
        if (line) {
          out.push(line)
          line = ''
        }
        let cut = w.length - 1
        while (cut > 1 && measure(w.slice(0, cut)) > max) cut--
        out.push(w.slice(0, cut))
        w = w.slice(cut)
      }
      const next = line ? `${line} ${w}` : w
      if (measure(next) <= max) line = next
      else {
        if (line) out.push(line)
        line = w
      }
    }
    out.push(line)
  }
  return out
}

/** Replaces characters the PDF standard fonts (WinAnsi) cannot draw. */
export function pdfSafe(s: string): string {
  const extra = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
  return [...s]
    .map((ch) => {
      const c = ch.codePointAt(0)!
      if (ch === '\t') return ' '
      if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || extra.includes(ch)) return ch
      if (ch === '\n') return ch
      return '?'
    })
    .join('')
}
