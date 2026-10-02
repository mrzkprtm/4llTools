/** Life-like cellular automata on a wrap-around (toroidal) grid. */

export interface Rule {
  birth: boolean[]
  survive: boolean[]
}

/**
 * Parses "B3/S23" style rules (any case, either order), plus the older "23/3"
 * survive/birth form. "B2/S" (nothing survives) is allowed. Returns null when invalid.
 */
export function parseRule(input: string): Rule | null {
  const s = input.replace(/\s/g, '').toUpperCase()
  const birth = new Array<boolean>(9).fill(false)
  const survive = new Array<boolean>(9).fill(false)
  const set = (arr: boolean[], digits: string) => {
    for (const ch of digits) arr[Number(ch)] = true
  }
  let m = s.match(/^B([0-8]*)\/?S([0-8]*)$/)
  if (m) {
    set(birth, m[1])
    set(survive, m[2])
    return { birth, survive }
  }
  m = s.match(/^S([0-8]*)\/?B([0-8]*)$/)
  if (m) {
    set(survive, m[1])
    set(birth, m[2])
    return { birth, survive }
  }
  m = s.match(/^([0-8]*)\/([0-8]*)$/)
  if (m) {
    set(survive, m[1])
    set(birth, m[2])
    return { birth, survive }
  }
  return null
}

export function ruleToString(r: Rule): string {
  const digits = (a: boolean[]) => a.map((v, i) => (v ? i : '')).join('')
  return `B${digits(r.birth)}/S${digits(r.survive)}`
}

/**
 * One generation. `cells` holds 0 for dead, otherwise the cell's age in
 * generations (1 = just born). Writes into `out` and returns the population.
 */
export function lifeStep(cells: Uint16Array, out: Uint16Array, w: number, h: number, rule: Rule): number {
  let pop = 0
  for (let y = 0; y < h; y++) {
    const up = ((y - 1 + h) % h) * w
    const row = y * w
    const down = ((y + 1) % h) * w
    for (let x = 0; x < w; x++) {
      const l = (x - 1 + w) % w
      const r = (x + 1) % w
      const n =
        (cells[up + l] ? 1 : 0) + (cells[up + x] ? 1 : 0) + (cells[up + r] ? 1 : 0) +
        (cells[row + l] ? 1 : 0) + (cells[row + r] ? 1 : 0) +
        (cells[down + l] ? 1 : 0) + (cells[down + x] ? 1 : 0) + (cells[down + r] ? 1 : 0)
      const age = cells[row + x]
      const alive = age ? rule.survive[n] : rule.birth[n]
      out[row + x] = alive ? (age ? Math.min(65535, age + 1) : 1) : 0
      if (alive) pop++
    }
  }
  return pop
}

/** Patterns as rows of 'O' (alive) and '.' (dead). */
export const PATTERNS = {
  glider: ['.O.', '..O', 'OOO'],
  lwss: ['.O..O', 'O....', 'O...O', 'OOOO.'],
  pulsar: [
    '..OOO...OOO..',
    '.............',
    'O....O.O....O',
    'O....O.O....O',
    'O....O.O....O',
    '..OOO...OOO..',
    '.............',
    '..OOO...OOO..',
    'O....O.O....O',
    'O....O.O....O',
    'O....O.O....O',
    '.............',
    '..OOO...OOO..',
  ],
  gun: [
    '........................O...........',
    '......................O.O...........',
    '............OO......OO............OO',
    '...........O...O....OO............OO',
    'OO........O.....O...OO..............',
    'OO........O...O.OO....O.O...........',
    '..........O.....O.......O...........',
    '...........O...O....................',
    '............OO......................',
  ],
  rpentomino: ['.OO', 'OO.', '.O.'],
  acorn: ['.O.....', '...O...', 'OO..OOO'],
  diehard: ['......O.', 'OO......', '.O...OOO'],
  blinker: ['OOO'],
} as const

export type PatternName = keyof typeof PATTERNS

/** Live cells of a pattern as [x, y] offsets, rotated a quarter turn clockwise `turns` times. */
export function patternCells(rows: readonly string[], turns = 0): [number, number][] {
  let cells: [number, number][] = []
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === 'O' && cells.push([x, y])))
  let hgt = rows.length
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    cells = cells.map(([x, y]) => [hgt - 1 - y, x])
    hgt = Math.max(...cells.map(([, y]) => y)) + 1
  }
  return cells
}

/** Sets the pattern's cells alive at (ox, oy), wrapping round the edges. */
export function stamp(cells: Uint16Array, w: number, h: number, pattern: [number, number][], ox: number, oy: number) {
  for (const [dx, dy] of pattern) cells[(((oy + dy) % h) + h) % h * w + ((((ox + dx) % w) + w) % w)] = 1
}
