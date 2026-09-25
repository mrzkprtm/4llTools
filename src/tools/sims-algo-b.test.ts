import { describe, expect, it } from 'vitest'
import { rng } from '../sim/math'
import { BoundedStack, CircularDeque, checkBrackets } from './stack-queue/structures'
import { applyMove, isLegal, movesNeeded, positions, solveFrom, solveHanoi, startPegs } from './tower-of-hanoi/hanoi'
import { countSolutions, queensSearch } from './n-queens/queens'
import { PRESETS, conflicts, isSolved, parseGrid, solveSudoku, sudokuSearch } from './sudoku-solver/sudoku'
import { PATTERNS, lifeStep, parseRule, patternCells, ruleToString, stamp } from './game-of-life/life'
import { ecaStep, guessClass, ruleFromTable, ruleTable, singleCell } from './cellular-automaton/eca'
import { HIGHWAY_PERIOD, antStep, highwayDetector, makeAnt, parseTurmite } from './langtons-ant/ant'
import { convexHull, type Pt } from './convex-hull/hull'

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

describe('game-of-life', () => {
  const conway = parseRule('B3/S23')!
  const live = (cells: Uint16Array, w: number) => [...cells.keys()].filter((i) => cells[i]).map((i) => [i % w, Math.floor(i / w)] as [number, number])
  const run = (cells: Uint16Array, w: number, h: number, gens: number) => {
    let a: Uint16Array = cells
    let b: Uint16Array = new Uint16Array(cells.length)
    for (let g = 0; g < gens; g++) {
      lifeStep(a, b, w, h, conway)
      ;[a, b] = [b, a]
    }
    return a
  }

  it('a blinker oscillates with period 2', () => {
    const c = new Uint16Array(25)
    stamp(c, 5, 5, patternCells(PATTERNS.blinker), 1, 2)
    expect(live(run(c, 5, 5, 1), 5)).toEqual([[2, 1], [2, 2], [2, 3]])
    expect(live(run(c, 5, 5, 2), 5)).toEqual(live(c, 5))
  })

  it('a glider moves one cell diagonally every 4 generations, wrapping round the torus', () => {
    const c = new Uint16Array(100)
    stamp(c, 10, 10, patternCells(PATTERNS.glider), 2, 2)
    const shifted = live(c, 10).map(([x, y]) => [x + 1, y + 1])
    expect(live(run(c, 10, 10, 4), 10)).toEqual(shifted)
    // After 40 generations it has travelled 10 cells and wrapped back to the start.
    expect(live(run(c, 10, 10, 40), 10)).toEqual(live(c, 10))
  })

  it('parses rule strings', () => {
    const hl = parseRule('b36/s23')!
    expect(hl.birth.flatMap((v, i) => (v ? [i] : []))).toEqual([3, 6])
    expect(hl.survive.flatMap((v, i) => (v ? [i] : []))).toEqual([2, 3])
    expect(ruleToString(parseRule('B2/S')!)).toBe('B2/S')
    expect(ruleToString(parseRule('23/3')!)).toBe('B3/S23')
    expect(ruleToString(parseRule('S34678/B3678')!)).toBe('B3678/S34678')
    expect(parseRule('B9/S2')).toBeNull()
    expect(parseRule('hello')).toBeNull()
  })
})

describe('cellular-automaton', () => {
  it('decodes rule tables', () => {
    // Rule 30 = 00011110: neighbourhoods 100, 011, 010 and 001 give 1.
    expect(ruleTable(30)).toEqual([0, 1, 1, 1, 1, 0, 0, 0])
    expect(ruleTable(110)).toEqual([0, 1, 1, 1, 0, 1, 1, 0])
    for (const r of [0, 30, 90, 110, 184, 255]) expect(ruleFromTable(ruleTable(r))).toBe(r)
  })

  it('rule 90 from a single cell draws Pascal’s triangle mod 2 (Sierpiński)', () => {
    const n = 129
    const mid = 64
    let row: Uint8Array = singleCell(n)
    let next: Uint8Array = new Uint8Array(n)
    for (let t = 0; t < 64; t++) {
      for (let i = 0; i < n; i++) {
        const k = i - mid
        const m = (t + k) / 2
        // Lucas: C(t, m) is odd exactly when m's bits are a subset of t's.
        const expected = Math.abs(k) <= t && Number.isInteger(m) && (m & t) === m ? 1 : 0
        expect(row[i]).toBe(expected)
      }
      ecaStep(row, next, 90, false)
      ;[row, next] = [next, row]
    }
  })

  it('guesses Wolfram classes for well-known rules', () => {
    expect([0, 255].map((r) => guessClass(r, rng(1)))).toEqual([1, 1])
    expect([4, 170].map((r) => guessClass(r, rng(1)))).toEqual([2, 2])
    expect([30, 90, 150].map((r) => guessClass(r, rng(1)))).toEqual([3, 3, 3])
    expect(guessClass(110, rng(1))).toBe(4)
  })
})

describe('langtons-ant', () => {
  it('the first steps of the RL ant trace the known little loop', () => {
    const w = 11
    const grid = new Uint8Array(w * w)
    const ant = makeAnt(5, 5)
    const turns = parseTurmite('RL')!
    const path: [number, number][] = []
    for (let i = 0; i < 6; i++) {
      antStep(grid, w, w, ant, turns)
      path.push([ant.x - 5, ant.y - 5])
    }
    // Right, down, left, up (back home, now black), then turn left off the black cell, then right again.
    expect(path).toEqual([[1, 0], [1, 1], [0, 1], [0, 0], [-1, 0], [-1, -1]])
    expect(grid.reduce((s, v) => s + v, 0)).toBe(4)
  })

  it('the classic ant builds its highway after about 10 000 steps', () => {
    const w = 400
    const grid = new Uint8Array(w * w)
    const ant = makeAnt(200, 200)
    const turns = parseTurmite('RL')!
    const detect = highwayDetector()
    let found = 0
    for (let s = 1; s <= 13000 && !found; s++) {
      antStep(grid, w, w, ant, turns)
      if (s % HIGHWAY_PERIOD === 0 && detect(ant)) found = s
    }
    expect(found).toBeGreaterThan(9900)
    expect(found).toBeLessThan(10700)
  })

  it('parses turmite rules', () => {
    expect(parseTurmite('rl')).toEqual([1, 3])
    expect(parseTurmite('LLRR')).toEqual([3, 3, 1, 1])
    expect(parseTurmite('RNU')).toEqual([1, 0, 2])
    expect(parseTurmite('R')).toBeNull()
    expect(parseTurmite('RXL')).toBeNull()
  })
})

describe('convex-hull', () => {
  const algos = ['jarvis', 'graham', 'monotone', 'quickhull'] as const
  const sorted = (a: number[]) => [...a].sort((x, y) => x - y)

  it('all four algorithms find the same hull on seeded random points', () => {
    for (const seed of [1, 2, 3, 42]) {
      const r = rng(seed)
      const pts: Pt[] = Array.from({ length: 150 }, () => ({ x: Math.round(r() * 1000), y: Math.round(r() * 1000) }))
      const hulls = algos.map((a) => sorted(convexHull(pts, a)))
      for (const h of hulls) expect(h).toEqual(hulls[0])
      // Counter-clockwise: every consecutive triple turns left, and every point is inside or on the hull.
      const h = convexHull(pts, 'graham')
      for (let i = 0; i < h.length; i++) {
        const [a, b] = [pts[h[i]], pts[h[(i + 1) % h.length]]]
        for (const p of pts) expect((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('leaves out collinear points on edges and handles a straight line', () => {
    const square: Pt[] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1], [1, 1]].map(([x, y]) => ({ x, y }))
    for (const a of algos) expect(sorted(convexHull(square, a))).toEqual([0, 2, 4, 6])
    const diag: Pt[] = [0, 3, 1, 2].map((v) => ({ x: v, y: v }))
    for (const a of algos) expect(sorted(convexHull(diag, a))).toEqual([0, 1])
  })
})
