/** Binary and linear search as step generators, plus helpers for the demo data. */

export interface BinaryStep {
  lo: number
  hi: number
  mid: number
  /** Sign of a[mid] − target: −1 means go right, 1 means go left, 0 means found. */
  cmp: -1 | 0 | 1
}

export interface LinearStep {
  i: number
  match: boolean
}

export function* binarySearch(a: readonly number[], target: number): Generator<BinaryStep, number, undefined> {
  let lo = 0
  let hi = a.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const cmp = a[mid] === target ? 0 : a[mid] < target ? -1 : 1
    yield { lo, hi, mid, cmp }
    if (cmp === 0) return mid
    if (cmp < 0) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}

export function* linearSearch(a: readonly number[], target: number): Generator<LinearStep, number, undefined> {
  for (let i = 0; i < a.length; i++) {
    const match = a[i] === target
    yield { i, match }
    if (match) return i
  }
  return -1
}

/** Runs a search generator to the end and reports the index and comparisons made. */
export function run<T>(g: Generator<T, number, undefined>): { index: number; comparisons: number } {
  let comparisons = 0
  for (;;) {
    const r = g.next()
    if (r.done) return { index: r.value, comparisons }
    comparisons++
  }
}

/** Most probes binary search can need on n items. */
export const worstCase = (n: number) => Math.ceil(Math.log2(n + 1))

/** A strictly increasing array of n numbers with random gaps of 1–4. */
export function sortedData(n: number, random: () => number = Math.random): number[] {
  const out: number[] = []
  let v = 1 + Math.floor(random() * 4)
  for (let i = 0; i < n; i++) {
    out.push(v)
    v += 1 + Math.floor(random() * 4)
  }
  return out
}

/** The guesses the halving strategy makes to find `secret` in [lo, hi]. */
export function halvingGuesses(secret: number, lo = 1, hi = 100): number[] {
  const out: number[] = []
  while (lo <= hi) {
    const g = (lo + hi) >> 1
    out.push(g)
    if (g === secret) break
    if (g < secret) lo = g + 1
    else hi = g - 1
  }
  return out
}
