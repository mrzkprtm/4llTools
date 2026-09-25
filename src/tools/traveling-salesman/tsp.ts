/** Travelling salesman heuristics as step-by-step generators. A tour is a closed loop of city indices. */

export interface City {
  x: number
  y: number
}

export const cityDist = (a: City, b: City) => Math.hypot(a.x - b.x, a.y - b.y)

export function tourLength(c: readonly City[], tour: readonly number[]): number {
  let s = 0
  for (let i = 0; i < tour.length; i++) s += cityDist(c[tour[i]], c[tour[(i + 1) % tour.length]])
  return tour.length > 1 ? s : 0
}

export interface TspStep {
  tour: number[]
  len: number
  best: number[]
  bestLen: number
  iter: number
  /** A 2-opt move: edges a–b and c–d are swapped for a–c and b–d. */
  swap?: [number, number, number, number]
  /** Whether the move was made (for checks and annealing proposals). */
  accepted?: boolean
  /** Nearest neighbour: the city it just walked from. */
  from?: number
  T?: number
  done?: boolean
}

/** Greedy construction: always walk to the closest city not yet visited. */
export function* nearestNeighbour(c: readonly City[], start = 0): Generator<TspStep> {
  const n = c.length
  if (!n) return
  const seen = new Uint8Array(n)
  const tour = [start]
  seen[start] = 1
  let path = 0
  while (tour.length < n) {
    const last = tour[tour.length - 1]
    let best = -1
    let bd = Infinity
    for (let j = 0; j < n; j++) {
      if (seen[j]) continue
      const d = cityDist(c[last], c[j])
      if (d < bd) {
        bd = d
        best = j
      }
    }
    seen[best] = 1
    tour.push(best)
    path += bd
    yield { tour: [...tour], len: path, best: [], bestLen: Infinity, iter: tour.length - 1, from: last }
  }
  const len = tourLength(c, tour)
  yield { tour, len, best: tour, bestLen: len, iter: n, done: true }
}

function reverse(t: number[], i: number, j: number) {
  while (i < j) {
    const x = t[i]
    t[i++] = t[j]
    t[j--] = x
  }
}

/** Gain from reversing tour[i..j]: replaces edges (i−1, i) and (j, j+1) with (i−1, j) and (i, j+1). */
function twoOptDelta(c: readonly City[], t: readonly number[], i: number, j: number): [number, number, number, number, number] {
  const n = t.length
  const a = t[i - 1]
  const b = t[i]
  const cc = t[j]
  const d = t[(j + 1) % n]
  return [cityDist(c[a], c[cc]) + cityDist(c[b], c[d]) - cityDist(c[a], c[b]) - cityDist(c[cc], c[d]), a, b, cc, d]
}

/** 2-opt: keep untangling pairs of edges while any swap makes the tour shorter. Never makes it longer. */
export function* twoOpt(c: readonly City[], init: readonly number[]): Generator<TspStep> {
  const t = [...init]
  const n = t.length
  let len = tourLength(c, t)
  let iter = 0
  let improved = n > 3
  while (improved) {
    improved = false
    for (let i = 1; i < n - 1; i++)
      for (let j = i + 1; j < n; j++) {
        if (i === 1 && j === n - 1) continue
        const [delta, a, b, cc, d] = twoOptDelta(c, t, i, j)
        iter++
        const ok = delta < -1e-9
        if (ok) {
          reverse(t, i, j)
          len += delta
          improved = true
        }
        yield { tour: t, len, best: t, bestLen: len, iter, swap: [a, b, cc, d], accepted: ok }
      }
  }
  len = tourLength(c, t)
  yield { tour: t, len, best: t, bestLen: len, iter, done: true }
}

export interface AnnealOptions {
  T0: number
  /** Temperature multiplier per iteration, just under 1. Read live, so it can change mid-run. */
  cooling: number
  minT?: number
}

/**
 * Simulated annealing with random 2-opt moves: a longer tour is still accepted
 * with probability e^(−Δ/T), so it can climb out of local minima while hot and
 * settles down as T cools.
 */
export function* anneal(c: readonly City[], init: readonly number[], opts: AnnealOptions, random: () => number = Math.random): Generator<TspStep> {
  const t = [...init]
  const n = t.length
  let len = tourLength(c, t)
  let best = [...t]
  let bestLen = len
  let T = opts.T0
  let iter = 0
  const minT = opts.minT ?? 0.01
  if (n < 4) return yield { tour: t, len, best, bestLen, iter, T, done: true }
  while (T > minT) {
    T *= opts.cooling
    iter++
    let i = 1 + Math.floor(random() * (n - 1))
    let j = 1 + Math.floor(random() * (n - 1))
    if (i > j) [i, j] = [j, i]
    if (i === j || (i === 1 && j === n - 1)) continue
    const [delta, a, b, cc, d] = twoOptDelta(c, t, i, j)
    const ok = delta < 0 || random() < Math.exp(-delta / T)
    if (ok) {
      reverse(t, i, j)
      len += delta
      if (len < bestLen - 1e-9) {
        best = [...t]
        bestLen = len
      }
    }
    if (iter % 1000 === 0) len = tourLength(c, t)
    yield { tour: t, len, best, bestLen, iter, T, swap: [a, b, cc, d], accepted: ok }
  }
  yield { tour: best, len: bestLen, best, bestLen, iter, T, done: true }
}

/** Rearranges `p` into the next permutation in lexicographic order; false after the last one. */
function nextPermutation(p: number[]): boolean {
  let i = p.length - 2
  while (i >= 0 && p[i] >= p[i + 1]) i--
  if (i < 0) return false
  let j = p.length - 1
  while (p[j] <= p[i]) j--
  ;[p[i], p[j]] = [p[j], p[i]]
  reverse(p, i + 1, p.length - 1)
  return true
}

export const BRUTE_MAX = 9

/** Tries every tour starting at city 0 (skipping mirror images). Only sensible for a handful of cities. */
export function* bruteForce(c: readonly City[]): Generator<TspStep> {
  const n = c.length
  if (n > BRUTE_MAX || n < 2) return yield { tour: [], len: 0, best: [], bestLen: 0, iter: 0, done: true }
  const perm = Array.from({ length: n - 1 }, (_, i) => i + 1)
  let best = [0, ...perm]
  let bestLen = tourLength(c, best)
  let iter = 0
  do {
    if (perm.length > 1 && perm[0] > perm[perm.length - 1]) continue
    const tour = [0, ...perm]
    const len = tourLength(c, tour)
    iter++
    if (len < bestLen - 1e-9) {
      best = tour
      bestLen = len
    }
    yield { tour, len, best, bestLen, iter }
  } while (nextPermutation(perm))
  yield { tour: best, len: bestLen, best, bestLen, iter, done: true }
}

/** Runs any of the generators to the end and returns its last step. */
export function finish(gen: Generator<TspStep>): TspStep | undefined {
  let last: TspStep | undefined
  for (const s of gen) last = s
  return last
}
