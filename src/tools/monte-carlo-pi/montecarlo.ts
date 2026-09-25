/** Monte Carlo estimate of π from random darts thrown at a square with a circle in it. */

export type Target = 'quarter' | 'full'

/** The circle covers π/4 of the square either way, so π ≈ 4 × inside / total. */
export function estimatePi(inside: number, total: number): number {
  return total > 0 ? (4 * inside) / total : 0
}

/** One standard error of the estimate after n darts: 4·√(p(1−p)/n) with p = π/4, about 1.64/√n. */
export function standardError(n: number): number {
  const p = Math.PI / 4
  return n > 0 ? 4 * Math.sqrt((p * (1 - p)) / n) : Infinity
}

/** A dart position: in [0, 1]² for the quarter circle, or [−1, 1]² for the full circle. */
export function dart(random: () => number, target: Target): [number, number] {
  const x = random()
  const y = random()
  return target === 'quarter' ? [x, y] : [2 * x - 1, 2 * y - 1]
}

export const isInside = (x: number, y: number) => x * x + y * y <= 1

/** Throws n darts and counts how many land inside the circle. */
export function throwDarts(n: number, random: () => number, target: Target = 'quarter'): number {
  let inside = 0
  for (let i = 0; i < n; i++) {
    const [x, y] = dart(random, target)
    if (isInside(x, y)) inside++
  }
  return inside
}
