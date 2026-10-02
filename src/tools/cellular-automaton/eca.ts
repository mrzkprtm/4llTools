/** Elementary (one-dimensional, two-state, radius-1) cellular automata in Wolfram's numbering. */

/** out[p] is the new state for neighbourhood p = 4·left + 2·centre + right. */
export function ruleTable(rule: number): number[] {
  return Array.from({ length: 8 }, (_, p) => (rule >> p) & 1)
}

export function ruleFromTable(table: readonly number[]): number {
  return table.reduce((r, v, p) => r | ((v & 1) << p), 0)
}

/** One generation. With `wrap` the row is a ring; otherwise cells beyond the edges count as 0. */
export function ecaStep(row: Uint8Array, out: Uint8Array, rule: number, wrap: boolean) {
  const n = row.length
  for (let i = 0; i < n; i++) {
    const l = i > 0 ? row[i - 1] : wrap ? row[n - 1] : 0
    const r = i < n - 1 ? row[i + 1] : wrap ? row[0] : 0
    out[i] = (rule >> ((l << 2) | (row[i] << 1) | r)) & 1
  }
}

export function singleCell(n: number): Uint8Array {
  const row = new Uint8Array(n)
  row[Math.floor(n / 2)] = 1
  return row
}

export function randomRow(n: number, random: () => number, density = 0.5): Uint8Array {
  return Uint8Array.from({ length: n }, () => (random() < density ? 1 : 0))
}

/** Rules Wolfram lists as class 4 (complex, with long-lived local structures). */
const CLASS4 = new Set([54, 106, 110, 120, 124, 137, 147, 169, 193, 225])

/**
 * A rough guess at Wolfram's class from one random run on a ring: 1 = everything
 * becomes uniform, 2 = settles into something fixed, periodic or simply shifting,
 * 3 = stays chaotic, 4 = a known complex rule.
 */
export function guessClass(rule: number, random: () => number, n = 101, steps = 300): 1 | 2 | 3 | 4 {
  if (CLASS4.has(rule)) return 4
  // An odd ring size avoids the short cycles additive rules like 90 and 150 fall into on even rings.
  let row: Uint8Array = randomRow(n, random)
  let next: Uint8Array = new Uint8Array(n)
  const history: Uint8Array[] = []
  for (let t = 0; t < steps; t++) {
    ecaStep(row, next, rule, true)
    ;[row, next] = [next, row]
    history.push(row.slice())
  }
  const last = history[history.length - 1]
  const lastIsUniform = last.every((v) => v === last[0])
  // Uniform for the last few generations (a blinking all-0/all-1 row counts too).
  if (lastIsUniform && history.slice(-4).every((r) => r.every((v) => v === r[0]))) return 1
  // Periodic up to a sideways shift?
  for (let p = 1; p <= 24; p++) {
    const prev = history[history.length - 1 - p]
    for (let s = -24; s <= 24; s++) {
      let same = true
      for (let i = 0; i < n && same; i++) if (last[i] !== prev[(((i + s) % n) + n) % n]) same = false
      if (same) return 2
    }
  }
  return 3
}
