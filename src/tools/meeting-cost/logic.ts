/** Pure cost math for the meeting cost ticker. */

export interface Group {
  id: string
  role: string
  count: number
  /** Salary per person, monthly or hourly depending on the mode. */
  pay: number
}

export type PayMode = 'monthly' | 'hourly'

/** Indonesian full-time norm: 40 h/week × 52 / 12 ≈ 173 working hours a month. */
export const HOURS_PER_MONTH = 173

export function perSecondFromMonthly(monthly: number, hoursPerMonth = HOURS_PER_MONTH): number {
  if (!(hoursPerMonth > 0) || !(monthly > 0)) return 0
  return monthly / hoursPerMonth / 3600
}

/** Cost per second of everyone in the meeting. */
export function costPerSecond(groups: Group[], mode: PayMode, hoursPerMonth = HOURS_PER_MONTH): number {
  return groups.reduce((sum, g) => {
    const each = mode === 'monthly' ? perSecondFromMonthly(g.pay, hoursPerMonth) : Math.max(0, g.pay) / 3600
    return sum + Math.max(0, Math.floor(g.count)) * each
  }, 0)
}

export const CURRENCIES = {
  IDR: { symbol: 'Rp', decimals: 0, locale: 'id-ID', perIdr: 1 },
  USD: { symbol: '$', decimals: 2, locale: 'en-US', perIdr: 16300 },
  EUR: { symbol: '€', decimals: 2, locale: 'de-DE', perIdr: 17700 },
  SGD: { symbol: 'S$', decimals: 2, locale: 'en-SG', perIdr: 12600 },
  MYR: { symbol: 'RM', decimals: 2, locale: 'ms-MY', perIdr: 3700 },
  JPY: { symbol: '¥', decimals: 0, locale: 'ja-JP', perIdr: 108 },
} as const

export type Currency = keyof typeof CURRENCIES

export function money(v: number, cur: Currency): string {
  const c = CURRENCIES[cur]
  return `${c.symbol} ${v.toLocaleString(c.locale, { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals })}`
}

/** Everyday things to compare against, priced in Rupiah (rough Jakarta prices). */
export const THINGS = [
  { emoji: '☕', name: 'cups of coffee', idr: 25000 },
  { emoji: '🍛', name: 'plates of nasi goreng', idr: 20000 },
  { emoji: '🛵', name: 'short ojek rides', idr: 15000 },
  { emoji: '🎬', name: 'cinema tickets', idr: 50000 },
  { emoji: '⛽', name: 'liters of Pertalite', idr: 10000 },
] as const

/** How many of each thing the cost could buy, converting the price into `cur`. */
export function comparisons(cost: number, cur: Currency) {
  return THINGS.map((t) => ({ ...t, n: cost / (t.idr / CURRENCIES[cur].perIdr) }))
}

/**
 * A coin value that keeps the pile under `capacity` coins: starts from a round
 * number worth about a tenth of a minute and doubles until the pile fits.
 */
export function coinValue(perMinute: number, cost: number, capacity: number): number {
  if (!(perMinute > 0)) return 1
  const raw = perMinute / 10
  const mag = 10 ** Math.floor(Math.log10(raw))
  let v = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? 10 * mag
  while (cost / v > capacity) v *= 2
  return v
}

const STACKS = 12
const CAPS = Array.from({ length: STACKS }, (_, s) => Math.round(16 - Math.abs(s - (STACKS - 1) / 2) * 2.2))

/** Coin positions in a heap, bottom row and middle stacks first, so the pile grows like a mound. */
export function pileSlots(w: number, h: number): { x: number; y: number }[] {
  const mid = (STACKS - 1) / 2
  const order = Array.from({ length: STACKS }, (_, s) => s).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))
  const out: { x: number; y: number }[] = []
  for (let l = 0; l < Math.max(...CAPS); l++) for (const s of order) if (l < CAPS[s]) out.push({ x: w / 2 + (s - mid) * 25, y: h - 10 - l * 6 })
  return out
}

export const PILE_CAPACITY = CAPS.reduce((a, b) => a + b, 0)
