import { describe, expect, it } from 'vitest'
import { rng } from '../sim/math'
import { SORTS, makeData, type SortEvent } from './sorting-visualizer/sorts'
import { gridShape, raceOrder } from './sorting-race/race'
import { GENERATORS, deadEnds, edgeCount, generate, reachable, solve as solveMaze, type GenAlgo } from './maze-generator/maze'
import { binarySearch, halvingGuesses, linearSearch, run as runSearch, sortedData, worstCase } from './binary-search/search'
import { WALL, WEIGHT, makeGrid, pathCost, scatter, solve, divisionMaze, neighbours } from './pathfinding-visualizer/path'

function drain<T>(g: Generator<unknown, T, undefined>): T {
  for (;;) {
    const r = g.next()
    if (r.done) return r.value
  }
}

describe('sorting-visualizer', () => {
  it('every generator sorts random arrays (with duplicates) correctly', () => {
    const random = rng(42)
    for (const s of SORTS)
      for (const n of [0, 1, 2, 7, 50, 137]) {
        for (const pattern of ['random', 'few', 'reversed', 'nearly'] as const) {
          const a = makeData(n, pattern, random)
          const expected = a.slice().sort((x, y) => x - y)
          drain(s.fn(a))
          expect(a, `${s.id} n=${n} ${pattern}`).toEqual(expected)
        }
      }
  })

  it('only marks a slot sorted once it holds its final value', () => {
    const random = rng(7)
    for (const s of SORTS) {
      const a = makeData(80, 'random', random)
      const expected = a.slice().sort((x, y) => x - y)
      for (const e of s.fn(a) as Generator<SortEvent>) if ('sorted' in e) expect(a[e.sorted], s.id).toBe(expected[e.sorted])
    }
  })
})

describe('sorting-race', () => {
  it('merge sort beats bubble sort on 200 random items', () => {
    const data = makeData(200, 'random', rng(3))
    const order = raceOrder(['bubble', 'merge', 'quick', 'insertion'], data)
    const place = (id: string) => order.findIndex((r) => r.id === id)
    expect(place('merge')).toBeLessThan(place('bubble'))
    expect(place('quick')).toBeLessThan(place('insertion'))
    expect(order[order.length - 1].id).toBe('bubble')
  })

  it('insertion sort beats quicksort on nearly sorted data', () => {
    const order = raceOrder(['insertion', 'quick'], makeData(200, 'nearly', rng(5)))
    expect(order[0].id).toBe('insertion')
  })

  it('lays out 4 to 9 panels in a grid', () => {
    expect(gridShape(4)).toEqual({ cols: 2, rows: 2 })
    expect(gridShape(6)).toEqual({ cols: 3, rows: 2 })
    expect(gridShape(9)).toEqual({ cols: 3, rows: 3 })
  })
})

describe('pathfinding-visualizer', () => {
  it('A* and Dijkstra find paths of equal (optimal) cost on seeded weighted grids', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const g = { cols: 30, rows: 20, cost: scatter(30, 20, rng(seed), 0.22, 0.15) }
      const start = 0
      const end = g.cols * g.rows - 1
      g.cost[start] = 1
      g.cost[end] = 1
      const d = solve(g, start, end, 'dijkstra')
      const a = solve(g, start, end, 'astar', 'manhattan')
      const e = solve(g, start, end, 'astar', 'euclidean')
      expect(a.cost).toBe(d.cost)
      expect(e.cost).toBe(d.cost)
      if (d.path.length) {
        expect(pathCost(g, a.path)).toBe(a.cost)
        expect(a.visited).toBeLessThanOrEqual(d.visited)
        // Every step moves to a 4-neighbour and never crosses a wall.
        for (let k = 1; k < a.path.length; k++) expect(neighbours(g, a.path[k - 1])).toContain(a.path[k])
      }
    }
  })

  it('BFS finds a shortest path on an unweighted grid; DFS and greedy never beat it', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const g = { cols: 25, rows: 15, cost: scatter(25, 15, rng(seed * 31), 0.25, 0) }
      g.cost[0] = 1
      g.cost[g.cost.length - 1] = 1
      const end = g.cost.length - 1
      const b = solve(g, 0, end, 'bfs')
      const d = solve(g, 0, end, 'dijkstra')
      expect(b.cost).toBe(d.cost)
      if (b.path.length) {
        expect(b.path.length - 1).toBe(d.cost)
        expect(solve(g, 0, end, 'dfs').cost).toBeGreaterThanOrEqual(b.cost)
        expect(solve(g, 0, end, 'greedy').cost).toBeGreaterThanOrEqual(b.cost)
      }
    }
  })

  it('weights make Dijkstra walk around mud; walls block completely', () => {
    const g = makeGrid(5, 3)
    // A column of mud in the middle row only: going around costs 2 extra steps, crossing costs 4 extra.
    g.cost[7] = WEIGHT
    expect(solve(g, 5, 9, 'dijkstra').cost).toBe(6)
    expect(solve(g, 5, 9, 'bfs').path.length - 1).toBe(4)
    for (const i of [2, 7, 12]) g.cost[i] = WALL
    expect(solve(g, 5, 9, 'astar').path).toEqual([])
    expect(solve(g, 5, 9, 'astar').cost).toBe(Infinity)
  })

  it('recursive division keeps every open cell reachable', () => {
    const cost = divisionMaze(40, 24, rng(9))
    const g = { cols: 40, rows: 24, cost }
    const open = [...cost.keys()].filter((i) => cost[i] !== WALL)
    const from = open[0]
    for (const to of open.filter((_, k) => k % 17 === 0)) expect(solve(g, from, to, 'bfs').path.length).toBeGreaterThan(0)
  })
})

describe('maze-generator', () => {
  it('every generator builds a perfect maze (a spanning tree of the grid)', () => {
    for (const algo of Object.keys(GENERATORS) as GenAlgo[])
      for (const [cols, rows] of [[1, 1], [2, 3], [12, 7], [25, 14]]) {
        const m = generate(cols, rows, algo, rng(cols * 100 + rows))
        const cells = cols * rows
        expect(reachable(m), `${algo} ${cols}x${rows}`).toBe(cells)
        expect(edgeCount(m), `${algo} ${cols}x${rows}`).toBe(cells - 1)
        // Passages are two-way: an east opening matches the neighbour's west opening.
        for (let c = 0; c < cells; c++) if (m.open[c] & 2) expect(m.open[c + 1] & 8).toBe(8)
      }
  })

  it('all solvers find the one route through a perfect maze', () => {
    for (const algo of ['backtracker', 'prim', 'wilson'] as GenAlgo[]) {
      const m = generate(20, 12, algo, rng(11))
      const end = m.open.length - 1
      const bfs = solveMaze(m, 0, end, 'bfs')
      expect(bfs[0]).toBe(0)
      expect(bfs[bfs.length - 1]).toBe(end)
      expect(solveMaze(m, 0, end, 'dfs')).toEqual(bfs)
      expect(solveMaze(m, 0, end, 'astar')).toEqual(bfs)
      expect(solveMaze(m, 0, end, 'wall')).toEqual(bfs)
      expect(deadEnds(m)).toBeGreaterThan(0)
    }
  })
})

describe('binary-search', () => {
  it('finds every present value and reports missing ones, within ceil(log2(n+1)) comparisons', () => {
    for (const n of [1, 2, 3, 8, 31, 32, 100, 128]) {
      const a = sortedData(n, rng(n))
      for (let i = 0; i < n; i++) {
        const r = runSearch(binarySearch(a, a[i]))
        expect(r.index).toBe(i)
        expect(r.comparisons).toBeLessThanOrEqual(worstCase(n))
        expect(runSearch(linearSearch(a, a[i]))).toEqual({ index: i, comparisons: i + 1 })
      }
      for (const missing of [0, a[0] - 1, a[n - 1] + 1, ...a.map((v) => v + 0.5)]) {
        const r = runSearch(binarySearch(a, missing))
        expect(r.index).toBe(-1)
        expect(r.comparisons).toBeLessThanOrEqual(worstCase(n))
      }
      expect(runSearch(linearSearch(a, -5))).toEqual({ index: -1, comparisons: n })
    }
    expect(worstCase(128)).toBe(8)
    expect(worstCase(127)).toBe(7)
  })

  it('the halving strategy guesses any number from 1 to 100 in at most 7 tries', () => {
    for (let s = 1; s <= 100; s++) {
      const g = halvingGuesses(s)
      expect(g[g.length - 1]).toBe(s)
      expect(g.length).toBeLessThanOrEqual(7)
    }
  })
})
