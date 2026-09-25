/** The golden angle, 360°·(2 − φ) = 180°·(3 − √5) ≈ 137.5078°. */
export const GOLDEN_ANGLE = 180 * (3 - Math.sqrt(5))

/** Vogel's model: seed n sits at angle n·α and radius c·√n, so every seed gets the same area. */
export function seedPosition(n: number, angleDeg: number, c: number): [number, number] {
  const a = (n * angleDeg * Math.PI) / 180
  const r = c * Math.sqrt(n)
  return [r * Math.cos(a), r * Math.sin(a)]
}

export function fibonacci(count: number): number[] {
  const out = [1, 2]
  while (out.length < count) out.push(out[out.length - 1] + out[out.length - 2])
  return out.slice(0, count)
}

export const isFibonacci = (v: number) => fibonacci(30).includes(v)

/**
 * The two parastichy numbers visible near seed m: the index gaps to its two nearest
 * neighbours that lie in different directions. For the golden angle they are consecutive
 * Fibonacci numbers, and they grow as you move outwards.
 */
export function parastichies(m: number, angleDeg: number, c = 1): [number, number] {
  // Returns [a, 0] when only one family (straight rays) is visible.
  const [x, y] = seedPosition(m, angleDeg, c)
  const cand: { d: number; dist: number; dir: number }[] = []
  for (let d = 1; d <= Math.min(m, 600); d++) {
    const [px, py] = seedPosition(m - d, angleDeg, c)
    cand.push({ d, dist: Math.hypot(px - x, py - y), dir: Math.atan2(py - y, px - x) })
  }
  cand.sort((a, b) => a.dist - b.dist)
  if (cand.length < 2) return [1, 1]
  const first = cand[0]
  // The second family must point a clearly different way (not the same arm further along).
  const second = cand.find((q) => q.d !== first.d && Math.abs(Math.cos(q.dir - first.dir)) < 0.85)
  if (!second || second.dist > 2.5 * first.dist) return [first.d, 0]
  return first.d < second.d ? [first.d, second.d] : [second.d, first.d]
}
