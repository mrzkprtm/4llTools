/** N-Queens by backtracking. A board is `cols`, where cols[row] is the column of that row's queen. */

/** Known number of solutions for N = 0…14 (OEIS A000170). */
export const KNOWN_SOLUTIONS = [1, 1, 0, 0, 2, 10, 4, 40, 92, 352, 724, 2680, 14200, 73712, 365596]

/** Rows of the queens in `cols` that attack the square (row, col). */
export function attackers(cols: readonly number[], row: number, col: number): number[] {
  const out: number[] = []
  for (let r = 0; r < cols.length; r++) {
    if (r === row) continue
    const c = cols[r]
    if (c === col || Math.abs(c - col) === Math.abs(r - row)) out.push(r)
  }
  return out
}

/** Whether two queens at (r1, c1) and (r2, c2) attack each other. */
export function attacks(r1: number, c1: number, r2: number, c2: number): boolean {
  return (r1 !== r2 || c1 !== c2) && (r1 === r2 || c1 === c2 || Math.abs(r1 - r2) === Math.abs(c1 - c2))
}

export type QueenEvent =
  | { kind: 'try'; row: number; col: number; ok: boolean; attackers: number[] }
  | { kind: 'place'; row: number; col: number }
  | { kind: 'backtrack'; row: number; col: number }
  | { kind: 'solution'; cols: number[] }

export interface QueensState {
  cols: number[]
  tried: number
  backtracks: number
  /** The most recent solutions (up to `keep`). */
  solutions: number[][]
  found: number
  done: boolean
}

/**
 * A step-by-step backtracking search over every solution. Advance `gen` and read
 * `state`: it tries each column of the next row, places a queen on the first safe
 * square, and backtracks when a row has no safe square left. It yields a
 * 'solution' event for each full board and then keeps searching.
 */
export function queensSearch(n: number, keep = 24) {
  const state: QueensState = { cols: [], tried: 0, backtracks: 0, solutions: [], found: 0, done: false }
  function* place(row: number): Generator<QueenEvent> {
    if (row === n) {
      state.found++
      state.solutions.push([...state.cols])
      if (state.solutions.length > keep) state.solutions.shift()
      yield { kind: 'solution', cols: [...state.cols] }
      return
    }
    for (let c = 0; c < n; c++) {
      state.tried++
      const att = attackers(state.cols, row, c)
      yield { kind: 'try', row, col: c, ok: att.length === 0, attackers: att }
      if (att.length) continue
      state.cols.push(c)
      yield { kind: 'place', row, col: c }
      yield* place(row + 1)
      state.cols.pop()
      state.backtracks++
      yield { kind: 'backtrack', row, col: c }
    }
  }
  function* run(): Generator<QueenEvent> {
    yield* place(0)
    state.done = true
  }
  return { state, gen: run() }
}

/** Counts every solution with bitmasks (fast, for checking). */
export function countSolutions(n: number): number {
  const all = (1 << n) - 1
  const go = (cols: number, d1: number, d2: number): number => {
    if (cols === all) return 1
    let count = 0
    let free = all & ~(cols | d1 | d2)
    while (free) {
      const bit = free & -free
      free ^= bit
      count += go(cols | bit, ((d1 | bit) << 1) & all, (d2 | bit) >> 1)
    }
    return count
  }
  return go(0, 0, 0)
}
