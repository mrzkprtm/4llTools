/** One Collatz step: halve even numbers, send odd n to 3n + 1. */
export const next = (n: number) => (n % 2 === 0 ? n / 2 : 3 * n + 1)

/** The hailstone sequence from n down to 1, both included. */
export function collatz(n: number): number[] {
  const out = [n]
  while (n > 1) {
    n = next(n)
    out.push(n)
  }
  return out
}

/** Total stopping time: the number of steps to reach 1 (27 takes 111). */
export function totalStoppingTime(n: number): number {
  let k = 0
  while (n > 1) {
    n = next(n)
    k++
  }
  return k
}

/** Stopping time: steps until the sequence first drops below its start (0 for n ≤ 1). */
export function stoppingTime(n: number): number {
  if (n <= 1) return 0
  let v = n
  let k = 0
  while (v >= n) {
    v = next(v)
    k++
  }
  return k
}

export interface Coral {
  values: number[]
  x: number[]
  y: number[]
  /** Index of the node one step closer to 1 (−1 for the root). */
  parent: number[]
  /** Steps from the node to 1. */
  depth: number[]
  maxDepth: number
}

/**
 * The Collatz "coral": every sequence from 1…N drawn backwards from 1 as a path of
 * unit segments, turning left by `even` radians at even numbers and right by `odd`
 * radians at odd ones. Shared tails become shared branches.
 */
export function coral(N: number, even: number, odd: number): Coral {
  const index = new Map<number, number>([[1, 0]])
  const c: Coral = { values: [1], x: [0], y: [0], parent: [-1], depth: [0], maxDepth: 0 }
  const heading: number[] = [0]
  const path: number[] = []
  for (let n = 2; n <= N; n++) {
    let v = n
    path.length = 0
    while (!index.has(v)) {
      path.push(v)
      v = next(v)
    }
    for (let k = path.length - 1; k >= 0; k--) {
      const p = index.get(v)!
      const val = path[k]
      const h = heading[p] + (val % 2 === 0 ? -even : odd)
      const i = c.values.length
      c.values.push(val)
      c.x.push(c.x[p] + Math.sin(h))
      c.y.push(c.y[p] - Math.cos(h))
      c.parent.push(p)
      c.depth.push(c.depth[p] + 1)
      heading.push(h)
      c.maxDepth = Math.max(c.maxDepth, c.depth[p] + 1)
      index.set(val, i)
      v = val
    }
  }
  return c
}
