/** Returns a uniformly random 32-bit unsigned integer. */
export type Rand32 = () => number

export const cryptoRand32: Rand32 = () => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0]
}

/** Uniform integer in [0, n) with rejection sampling, so there is no modulo bias. */
export function randomInt(n: number, rand: Rand32 = cryptoRand32): number {
  if (!(n >= 1)) return 0
  const limit = Math.floor(0x100000000 / n) * n
  let x = rand()
  while (x >= limit) x = rand()
  return x % n
}

export function parseItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rand: Rand32 = cryptoRand32): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rand)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** N distinct random items (or all of them, shuffled, if N is larger). */
export function pickN<T>(items: readonly T[], n: number, rand: Rand32 = cryptoRand32): T[] {
  return shuffle(items, rand).slice(0, Math.max(0, Math.floor(n)))
}

/** Splits into `teams` groups whose sizes differ by at most one. */
export function splitTeams<T>(items: readonly T[], teams: number, rand: Rand32 = cryptoRand32): T[][] {
  const k = Math.max(1, Math.min(Math.floor(teams) || 1, items.length || 1))
  const groups: T[][] = Array.from({ length: k }, () => [])
  shuffle(items, rand).forEach((x, i) => groups[i % k].push(x))
  return groups
}

export interface Dice {
  count: number
  sides: number
  modifier: number
}

/** Parses dice notation like "2d6", "d20", "3d8+2" or "4d6-1". */
export function parseDice(text: string): Dice | null {
  const m = /^\s*(\d*)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(text)
  if (!m) return null
  const count = m[1] ? Number(m[1]) : 1
  const sides = Number(m[2])
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null
  const modifier = m[4] ? Number(m[4]) * (m[3] === '-' ? -1 : 1) : 0
  return { count, sides, modifier }
}

export function rollDice(d: Dice, rand: Rand32 = cryptoRand32): { rolls: number[]; total: number } {
  const rolls = Array.from({ length: d.count }, () => randomInt(d.sides, rand) + 1)
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + d.modifier }
}

export function flipCoin(rand: Rand32 = cryptoRand32): 'Heads' | 'Tails' {
  return randomInt(2, rand) === 0 ? 'Heads' : 'Tails'
}

/**
 * The wheel draws segment i from angle i·seg to (i+1)·seg, clockwise from the
 * pointer at 12 o'clock. Returns which segment sits under the pointer after
 * rotating the wheel clockwise by `rotation` degrees.
 */
export function indexAtPointer(rotation: number, n: number): number {
  const seg = 360 / n
  const a = (((360 - (rotation % 360)) % 360) + 360) % 360
  return Math.min(n - 1, Math.floor(a / seg))
}

/**
 * Final rotation (always ahead of `current`) that lands segment `index` under
 * the pointer after `spins` full turns. `offset` in [0, 1) picks where inside
 * the segment it stops (0.5 = centre), kept away from the edges.
 */
export function wheelTarget(current: number, index: number, n: number, spins = 5, offset = 0.5): number {
  const seg = 360 / n
  const within = 0.1 + Math.min(Math.max(offset, 0), 1) * 0.8
  const landing = 360 - (index + within) * seg
  const base = current - (((current % 360) + 360) % 360)
  let target = base + spins * 360 + landing
  while (target <= current + 360) target += 360
  return target
}

/** Ease with a small overshoot at the end, like a wheel settling against its pointer. */
export function spinEase(t: number): number {
  if (t >= 1) return 1
  const c = 1 - Math.pow(1 - t, 4)
  return c + Math.sin(Math.PI * Math.min(1, t)) * 0.012 * Math.pow(t, 6)
}
