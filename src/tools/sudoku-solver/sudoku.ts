/** Sudoku on a flat array of 81 cells, row by row; 0 is an empty cell. */

export const PRESETS = {
  easy: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
  medium: '009748000700000000020109000007000240064010590098000300000803020000000006000275900',
  hard: '400000805030000000000700000020000060000080400000010000000603070500200000104000000',
  hardest: '800000000003600000070090000050007000000045700000100030001000068008500010090000400',
} as const

export function parseGrid(s: string): number[] {
  const out = new Array<number>(81).fill(0)
  const chars = s.replace(/\s/g, '').slice(0, 81)
  for (let i = 0; i < chars.length; i++) {
    const d = chars.charCodeAt(i) - 48
    out[i] = d >= 1 && d <= 9 ? d : 0
  }
  return out
}

export const rowOf = (i: number) => Math.floor(i / 9)
export const colOf = (i: number) => i % 9
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3)

/** The 20 cells that share a row, column or box with each cell. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const out: number[] = []
  for (let j = 0; j < 81; j++) if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) out.push(j)
  return out
})

/** Bitmask (bits 1…9) of the digits that could go in cell i without clashing with its peers. */
export function candidateMask(g: readonly number[], i: number): number {
  let used = 0
  for (const j of PEERS[i]) used |= 1 << g[j]
  return ~used & 0b1111111110
}

export function maskDigits(m: number): number[] {
  const out: number[] = []
  for (let d = 1; d <= 9; d++) if (m & (1 << d)) out.push(d)
  return out
}

function popcount(m: number) {
  let c = 0
  while (m) {
    m &= m - 1
    c++
  }
  return c
}

/** Cells whose digit also appears in the same row, column or box. */
export function conflicts(g: readonly number[]): Set<number> {
  const bad = new Set<number>()
  for (let i = 0; i < 81; i++) if (g[i]) for (const j of PEERS[i]) if (g[j] === g[i]) bad.add(i)
  return bad
}

export function isSolved(g: readonly number[]): boolean {
  return g.every((d) => d >= 1 && d <= 9) && conflicts(g).size === 0
}

export type SudokuEvent =
  | { kind: 'pick'; cell: number; count: number }
  | { kind: 'place'; cell: number; digit: number; guess: boolean }
  | { kind: 'undo'; cell: number; digit: number }
  | { kind: 'dead'; cell: number }

export interface SudokuState {
  grid: number[]
  guesses: number
  backtracks: number
  placements: number
  done: boolean
  solved: boolean
}

/** Picks the empty cell with the fewest candidates (MRV); -1 when the grid is full. */
function pickCell(g: readonly number[]): { cell: number; mask: number; count: number } {
  let cell = -1
  let mask = 0
  let count = 10
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue
    const m = candidateMask(g, i)
    const c = popcount(m)
    if (c < count) {
      cell = i
      mask = m
      count = c
      if (c <= 1) break
    }
  }
  return { cell, mask, count }
}

/**
 * Step-by-step backtracking. Each round it picks the empty cell with the fewest
 * candidates, tries them in order, and undoes the digit when the rest of the
 * grid runs into a cell with no candidates left.
 */
export function sudokuSearch(puzzle: readonly number[]) {
  const state: SudokuState = { grid: [...puzzle], guesses: 0, backtracks: 0, placements: 0, done: false, solved: false }
  const g = state.grid
  function* search(): Generator<SudokuEvent, boolean> {
    const { cell, mask, count } = pickCell(g)
    if (cell < 0) return true
    if (count === 0) {
      yield { kind: 'dead', cell }
      return false
    }
    yield { kind: 'pick', cell, count }
    for (let d = 1; d <= 9; d++) {
      if (!(mask & (1 << d))) continue
      g[cell] = d
      state.placements++
      if (count > 1) state.guesses++
      yield { kind: 'place', cell, digit: d, guess: count > 1 }
      if (yield* search()) return true
      g[cell] = 0
      state.backtracks++
      yield { kind: 'undo', cell, digit: d }
    }
    return false
  }
  function* run(): Generator<SudokuEvent> {
    if (conflicts(g).size === 0) state.solved = yield* search()
    state.done = true
  }
  return { state, gen: run() }
}

/** Solves at full speed. Returns the solved grid (or null when there is none) and the effort it took. */
export function solveSudoku(puzzle: readonly number[]): { grid: number[] | null; guesses: number; backtracks: number; placements: number } {
  const g = [...puzzle]
  const stats = { guesses: 0, backtracks: 0, placements: 0 }
  if (conflicts(g).size) return { grid: null, ...stats }
  const go = (): boolean => {
    const { cell, mask, count } = pickCell(g)
    if (cell < 0) return true
    for (let d = 1; d <= 9; d++) {
      if (!(mask & (1 << d))) continue
      g[cell] = d
      stats.placements++
      if (count > 1) stats.guesses++
      if (go()) return true
      g[cell] = 0
      stats.backtracks++
    }
    return false
  }
  return { grid: go() ? g : null, ...stats }
}
