/** The freelance rate formula: from a take-home goal to the hourly rate that pays for it. */

export interface RateInput {
  /** Wanted take-home pay per year, after tax and savings. */
  takeHome: number
  /** Business costs per year. */
  costs: number
  /** Income tax as % of profit. */
  taxPct: number
  /** Savings, pension and insurance as % of profit. */
  savingsPct: number
  vacationWeeks: number
  holidays: number
  sickDays: number
  daysPerWeek: number
  hoursPerDay: number
  /** Share of working hours you can bill, 0–100. */
  billablePct: number
}

export interface RateResult {
  /** Revenue needed per year. */
  revenue: number
  profit: number
  tax: number
  savings: number
  workDays: number
  workHours: number
  billableHours: number
  hourly: number
  daily: number
  /** How one billed hour splits up. They add up to `hourly`. */
  perHour: { takeHome: number; tax: number; savings: number; costs: number }
  ok: boolean
}

/**
 * profit = takeHome / (1 − tax − savings); revenue = profit + costs;
 * billable hours = (weeks × days − vacation − holidays − sick days) × hours/day × billable%.
 */
export function freelanceRate(i: RateInput): RateResult {
  const keep = 1 - (i.taxPct + i.savingsPct) / 100
  const workDays = Math.max(0, (52 - i.vacationWeeks) * i.daysPerWeek - i.holidays - i.sickDays)
  const workHours = workDays * i.hoursPerDay
  const billableHours = (workHours * Math.min(100, Math.max(0, i.billablePct))) / 100
  const ok = keep > 0 && billableHours > 0
  const profit = keep > 0 ? i.takeHome / keep : NaN
  const tax = (profit * i.taxPct) / 100
  const savings = (profit * i.savingsPct) / 100
  const revenue = profit + i.costs
  const per = (v: number) => (billableHours > 0 ? v / billableHours : NaN)
  const hourly = per(revenue)
  return {
    revenue,
    profit,
    tax,
    savings,
    workDays,
    workHours,
    billableHours,
    hourly,
    daily: hourly * i.hoursPerDay,
    perHour: { takeHome: per(i.takeHome), tax: per(tax), savings: per(savings), costs: per(i.costs) },
    ok,
  }
}

/** Rounds a price up to a friendly step: nearest 1,000 for rupiah, 1 for dollars. */
export function niceRound(v: number, step: number): number {
  return Math.ceil(v / step) * step
}
