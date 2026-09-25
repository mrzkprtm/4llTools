import { describe, expect, it } from 'vitest'
import { BoundedStack, CircularDeque, checkBrackets } from './stack-queue/structures'
import { applyMove, isLegal, movesNeeded, positions, solveFrom, solveHanoi, startPegs } from './tower-of-hanoi/hanoi'
import { countSolutions, queensSearch } from './n-queens/queens'
import { PRESETS, conflicts, isSolved, parseGrid, solveSudoku, sudokuSearch } from './sudoku-solver/sudoku'

describe('stack-queue', () => {
  it('circular queue wraps round and keeps FIFO order', () => {
    const q = new CircularDeque<number>(3)
    expect(q.pushBack(1) && q.pushBack(2) && q.pushBack(3)).toBe(true)
    expect(q.pushBack(4)).toBe(false)
    expect(q.popFront()).toBe(1)
    expect(q.pushBack(4)).toBe(true)
    // 4 was written into slot 0, behind the head at slot 1.
    expect(q.head).toBe(1)
    expect(q.tail).toBe(1)
    expect(q.buf[0]).toBe(4)
    expect(q.toArray()).toEqual([2, 3, 4])
    expect([q.popFront(), q.popFront(), q.popFront(), q.popFront()]).toEqual([2, 3, 4, undefined])
    expect(q.isEmpty()).toBe(true)
  })

  it('deque works at both ends and the stack is LIFO with a capacity', () => {
    const d = new CircularDeque<string>(4)
    d.pushBack('b')
    d.pushFront('a')
    d.pushBack('c')
    expect(d.toArray()).toEqual(['a', 'b', 'c'])
    expect(d.popBack()).toBe('c')
    expect(d.popFront()).toBe('a')
    const s = new BoundedStack<number>(2)
    expect(s.push(1) && s.push(2)).toBe(true)
    expect(s.push(3)).toBe(false)
    expect([s.pop(), s.pop(), s.pop()]).toEqual([2, 1, undefined])
  })

  it('bracket matcher finds balanced and broken expressions', () => {
    expect(checkBrackets('{[(a+b)*c]-(d/e)}')).toEqual({ ok: true, index: -1, action: 'balanced' })
    expect(checkBrackets('')).toMatchObject({ ok: true })
    expect(checkBrackets('([)]')).toEqual({ ok: false, index: 2, action: 'mismatch' })
    expect(checkBrackets('(a))')).toEqual({ ok: false, index: 3, action: 'extra-close' })
    expect(checkBrackets('((a)')).toEqual({ ok: false, index: 0, action: 'unclosed' })
  })
})

describe('tower-of-hanoi', () => {
  it('solves n disks in 2^n − 1 legal moves ending on the target peg', () => {
    for (let n = 1; n <= 10; n++) {
      const moves = solveHanoi(n, 0, 2)
      expect(moves.length).toBe(2 ** n - 1)
      const pegs = startPegs(n, 0)
      for (const [from, to] of moves) expect(applyMove(pegs, from, to)).toBe(true)
      expect(pegs[2]).toEqual(startPegs(n, 0)[0])
      expect(pegs[0].length + pegs[1].length).toBe(0)
    }
  })

  it('rejects illegal moves and solves optimally from a scrambled position', () => {
    const pegs = startPegs(3)
    applyMove(pegs, 0, 2)
    expect(isLegal(pegs, 0, 2)).toBe(false)
    expect(applyMove(pegs, 0, 2)).toBe(false)
    expect(isLegal(pegs, 1, 0)).toBe(false)
    const pos = positions(pegs)
    const rest = [...solveFrom(pos, 2)]
    expect(rest.length).toBe(movesNeeded(pos, 2))
    for (const m of rest) expect(applyMove(pegs, m.from, m.to)).toBe(true)
    expect(pegs[2]).toEqual([2, 1, 0])
    expect(Math.max(...[...solveFrom([0, 0, 0, 0])].map((m) => m.frames.length))).toBe(4)
  })
})

describe('n-queens', () => {
  it('backtracking finds 2, 10, 4, 40 and 92 solutions for N = 4…8', () => {
    const counts = [4, 5, 6, 7, 8].map((n) => {
      const { state, gen } = queensSearch(n)
      for (const ev of gen) if (ev.kind === 'solution') expect(new Set(ev.cols).size).toBe(n)
      expect(state.done).toBe(true)
      return state.found
    })
    expect(counts).toEqual([2, 10, 4, 40, 92])
    expect([4, 5, 6, 7, 8].map(countSolutions)).toEqual(counts)
  })

  it('every solution is attack-free and the first 8-queens solution is the classic one', () => {
    const { state, gen } = queensSearch(8, 100)
    for (const ev of gen) void ev
    for (const sol of state.solutions)
      for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) expect(Math.abs(sol[a] - sol[b])).not.toBe(b - a)
    expect(state.solutions[0]).toEqual([0, 4, 7, 5, 2, 6, 1, 3])
  })
})

describe('sudoku-solver', () => {
  it('solves every preset into a valid grid that keeps the givens', () => {
    for (const s of Object.values(PRESETS)) {
      const puzzle = parseGrid(s)
      const r = solveSudoku(puzzle)
      expect(r.grid).not.toBeNull()
      expect(isSolved(r.grid!)).toBe(true)
      puzzle.forEach((d, i) => d && expect(r.grid![i]).toBe(d))
    }
  })

  it('the step-by-step search reaches the same solution', () => {
    const puzzle = parseGrid(PRESETS.medium)
    const { state, gen } = sudokuSearch(puzzle)
    for (const ev of gen) void ev
    expect(state.solved).toBe(true)
    expect(state.grid).toEqual(solveSudoku(puzzle).grid)
    expect(state.backtracks).toBeGreaterThan(0)
  })

  it('detects unsolvable input', () => {
    const clash = parseGrid('55' + '0'.repeat(79))
    expect(conflicts(clash)).toEqual(new Set([0, 1]))
    expect(solveSudoku(clash).grid).toBeNull()
    // No clash anywhere, but the top-left cell has no digit left: 1-8 in its row and 9 in its column.
    const stuck = parseGrid('012345678' + '900000000' + '0'.repeat(63))
    expect(conflicts(stuck).size).toBe(0)
    expect(solveSudoku(stuck).grid).toBeNull()
    const { state, gen } = sudokuSearch(stuck)
    for (const ev of gen) void ev
    expect(state).toMatchObject({ done: true, solved: false })
  })
})
