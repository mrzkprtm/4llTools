/** Binomial maths behind the Galton board: n rows of pegs, each bouncing a ball right with probability p. */

function logFactorial(n: number): number {
  let s = 0
  for (let i = 2; i <= n; i++) s += Math.log(i)
  return s
}

/** P(k rights out of n bounces) = C(n, k) pᵏ (1 − p)ⁿ⁻ᵏ. */
export function binomialPmf(n: number, k: number, p: number): number {
  if (k < 0 || k > n || !Number.isInteger(k)) return 0
  if (p <= 0) return k === 0 ? 1 : 0
  if (p >= 1) return k === n ? 1 : 0
  return Math.exp(logFactorial(n) - logFactorial(k) - logFactorial(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p))
}

/** Mean np and standard deviation √(np(1 − p)) of the bin a ball lands in. */
export function theory(n: number, p: number): { mean: number; sd: number } {
  return { mean: n * p, sd: Math.sqrt(n * p * (1 - p)) }
}

export function normalPdf(x: number, mean: number, sd: number): number {
  if (sd <= 0) return 0
  return Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI))
}

/** One ball's path: the list of bounces (true = right). Its bin is the number of rights. */
export function dropPath(rows: number, p: number, random: () => number): boolean[] {
  return Array.from({ length: rows }, () => random() < p)
}

/** Drops `balls` balls and counts how many land in each of the rows + 1 bins. */
export function simulateBins(rows: number, p: number, balls: number, random: () => number): number[] {
  const bins = new Array<number>(rows + 1).fill(0)
  for (let b = 0; b < balls; b++) bins[dropPath(rows, p, random).filter(Boolean).length]++
  return bins
}

/** Sample mean and standard deviation of bin counts (bin index = value). */
export function binStats(bins: ArrayLike<number>): { total: number; mean: number; sd: number } {
  let total = 0
  let sum = 0
  for (let k = 0; k < bins.length; k++) {
    total += bins[k]
    sum += k * bins[k]
  }
  const mean = total ? sum / total : 0
  let ss = 0
  for (let k = 0; k < bins.length; k++) ss += bins[k] * (k - mean) ** 2
  return { total, mean, sd: total > 1 ? Math.sqrt(ss / (total - 1)) : 0 }
}
