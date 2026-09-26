/** Travel budget totals. Pure and tested. */

export const CATS = ['stay', 'food', 'transport', 'activities', 'shopping', 'misc'] as const
export type Cat = (typeof CATS)[number]
export type DayCosts = Record<Cat, number>

export const CAT_LABEL: Record<Cat, string> = {
  stay: 'Stay',
  food: 'Food',
  transport: 'Transport',
  activities: 'Activities',
  shopping: 'Shopping',
  misc: 'Misc',
}

export interface OneOff {
  id: string
  name: string
  amount: number
}

export type Basis = 'group' | 'person'

export interface BudgetInput {
  days: DayCosts[]
  oneOffs: OneOff[]
  travelers: number
  /** Whether the amounts entered are for the whole group or for each person. */
  basis: Basis
}

export interface BudgetResult {
  /** Each day's total for the whole group. */
  dayTotals: number[]
  /** Category totals over the trip for the whole group. */
  byCat: DayCosts
  daily: number
  oneOff: number
  total: number
  perPerson: number
  avgPerDay: number
}

export const emptyDay = (): DayCosts => ({ stay: 0, food: 0, transport: 0, activities: 0, shopping: 0, misc: 0 })

export const daySum = (d: DayCosts) => CATS.reduce((s, c) => s + (Number.isFinite(d[c]) ? Math.max(0, d[c]) : 0), 0)

export function budget({ days, oneOffs, travelers, basis }: BudgetInput): BudgetResult {
  const people = Math.max(1, Math.round(travelers))
  const k = basis === 'person' ? people : 1
  const byCat = emptyDay()
  const dayTotals = days.map((d) => {
    for (const c of CATS) byCat[c] += Math.max(0, d[c] || 0) * k
    return daySum(d) * k
  })
  const daily = dayTotals.reduce((a, b) => a + b, 0)
  const oneOff = oneOffs.reduce((s, o) => s + Math.max(0, o.amount || 0), 0) * k
  const total = daily + oneOff
  return { dayTotals, byCat, daily, oneOff, total, perPerson: total / people, avgPerDay: days.length ? daily / days.length : 0 }
}

/** Resizes a per-day list, repeating the last day for new days. */
export function resizeDays(days: DayCosts[], n: number): DayCosts[] {
  const count = Math.max(1, Math.round(n))
  if (days.length >= count) return days.slice(0, count)
  const last = days[days.length - 1] ?? emptyDay()
  return [...days, ...Array.from({ length: count - days.length }, () => ({ ...last }))]
}
