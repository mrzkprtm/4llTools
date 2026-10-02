/** Sieve of Eratosthenes: `isPrime[k]` is 1 when k is prime, for 0 ≤ k ≤ n. */
export function sieve(n: number): Uint8Array {
  const p = new Uint8Array(n + 1).fill(1)
  p[0] = 0
  if (n >= 1) p[1] = 0
  for (let i = 2; i * i <= n; i++) if (p[i]) for (let j = i * i; j <= n; j += i) p[j] = 0
  return p
}

/**
 * Position of the k-th cell (k ≥ 1) on the square Ulam spiral, with y pointing up:
 * 1 at (0, 0), 2 at (1, 0), 3 at (1, 1), 4 at (0, 1), then anticlockwise outward.
 */
export function spiralCoord(k: number): [number, number] {
  if (k <= 1) return [0, 0]
  const r = Math.ceil((Math.sqrt(k) - 1) / 2) // ring number
  const j = k - (2 * r - 1) ** 2 // 1 … 8r along the ring
  if (j <= 2 * r) return [r, -r + j] // right side, going up
  if (j <= 4 * r) return [r - (j - 2 * r), r] // top, going left
  if (j <= 6 * r) return [-r, r - (j - 4 * r)] // left side, going down
  return [-r + (j - 6 * r), -r] // bottom, going right
}

/** The inverse of `spiralCoord`: which cell index sits at grid point (x, y). */
export function spiralIndex(x: number, y: number): number {
  const r = Math.max(Math.abs(x), Math.abs(y))
  if (r === 0) return 1
  const base = (2 * r - 1) ** 2
  if (x === r && y > -r) return base + y + r
  if (y === r) return base + 2 * r + (r - x)
  if (x === -r) return base + 4 * r + (r - y)
  return base + 6 * r + (x + r)
}

/** Sacks spiral: n sits at radius √n and angle 2π√n, so perfect squares line up on the positive x-axis. */
export function sacksCoord(n: number): [number, number] {
  const r = Math.sqrt(n)
  return [r * Math.cos(2 * Math.PI * r), r * Math.sin(2 * Math.PI * r)]
}

/** Prime factors with multiplicity, smallest first (empty for 0 and 1). */
export function factorize(n: number): number[] {
  const out: number[] = []
  if (n < 2) return out
  let m = n
  for (let p = 2; p * p <= m; p += p === 2 ? 1 : 2)
    while (m % p === 0) {
      out.push(p)
      m /= p
    }
  if (m > 1) out.push(m)
  return out
}

/** True when n = k² + k + 41 for some k ≥ 0 (Euler's prime-rich polynomial). */
export function isEuler(n: number): boolean {
  // k² + k + 41 − n = 0  ⇒  k = (−1 + √(4n − 163)) / 2
  const d = 4 * n - 163
  if (d < 1) return false
  const s = Math.round(Math.sqrt(d))
  return s * s === d && (s - 1) % 2 === 0
}
