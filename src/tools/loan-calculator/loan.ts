export type LoanRow = { month: number; payment: number; principal: number; interest: number; balance: number }

/** Monthly payment for a fixed-rate (annuity) loan. */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return NaN
  const r = annualRatePct / 100 / 12
  if (r === 0) return principal / months
  return (principal * r) / (1 - (1 + r) ** -months)
}

export function schedule(principal: number, annualRatePct: number, months: number): LoanRow[] {
  const pay = monthlyPayment(principal, annualRatePct, months)
  const r = annualRatePct / 100 / 12
  const rows: LoanRow[] = []
  let balance = principal
  for (let m = 1; m <= months && Number.isFinite(pay); m++) {
    const interest = balance * r
    const p = m === months ? balance : pay - interest
    balance = Math.max(0, balance - p)
    rows.push({ month: m, payment: p + interest, principal: p, interest, balance })
  }
  return rows
}
