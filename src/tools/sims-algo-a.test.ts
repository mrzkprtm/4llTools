import { describe, expect, it } from 'vitest'
import { rng } from '../sim/math'
import { SORTS, makeData, type SortEvent } from './sorting-visualizer/sorts'
import { gridShape, raceOrder } from './sorting-race/race'
import { GENERATORS, deadEnds, edgeCount, generate, reachable, solve as solveMaze, type GenAlgo } from './maze-generator/maze'
import { binarySearch, halvingGuesses, linearSearch, run as runSearch, sortedData, worstCase } from './binary-search/search'
import { apply, emptyTree, inorder as bstInorder, insert as bstInsert, isBalanced, isValid, levelorder, postorder, preorder, rebuildAvl, remove as bstRemove, search as bstSearch, treeHeight } from './bst-visualizer/bst'
import { heapSort as heapSortSteps, heapify, isHeap, pop as heapPop, push as heapPush, run as runHeap } from './heap-visualizer/heap'
import { preset as graphPreset, traverse, type Graph } from './graph-traversal/graph'
import { UnionFind, buildEdges, mst, scatterPoints } from './minimum-spanning-tree/mst'
import { build as buildTable, hashString, insert as tableInsert, keysOf, makeTable, nextPrime, remove as tableRemove, run as runTable, search as tableSearch, type Strategy } from './hash-table/hash'
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

describe('bst-visualizer', () => {
  it('keeps BST ordering through random inserts and deletes (plain and AVL)', () => {
    for (const avl of [false, true]) {
      const random = rng(avl ? 2 : 1)
      const t = emptyTree()
      const model = new Set<number>()
      for (let i = 0; i < 600; i++) {
        const k = Math.floor(random() * 120)
        if (random() < 0.6) {
          apply(bstInsert(t, k, avl))
          model.add(k)
        } else {
          apply(bstRemove(t, k, avl))
          model.delete(k)
        }
        expect(isValid(t)).toBe(true)
        if (avl) expect(isBalanced(t)).toBe(true)
      }
      expect(bstInorder(t).map((n) => n.key)).toEqual([...model].sort((a, b) => a - b))
      expect(t.size).toBe(model.size)
    }
  })

  it('AVL keeps height logarithmic on sorted inserts; a plain BST becomes a list', () => {
    const plain = emptyTree()
    const avl = emptyTree()
    for (let k = 1; k <= 63; k++) {
      apply(bstInsert(plain, k, false))
      apply(bstInsert(avl, k, true))
    }
    expect(treeHeight(plain)).toBe(62)
    expect(treeHeight(avl)).toBe(5)
    const steps = apply(bstInsert(emptyTree(), 1, true))
    expect(steps.map((s) => s.kind)).toEqual(['insert'])
    const t = emptyTree()
    apply(bstInsert(t, 3, true))
    apply(bstInsert(t, 2, true))
    const rot = apply(bstInsert(t, 1, true)).filter((s) => s.kind === 'rotate')
    expect(rot).toHaveLength(1)
    expect(t.root!.key).toBe(2)
    const rebuilt = rebuildAvl(plain)
    expect(isBalanced(rebuilt) && isValid(rebuilt)).toBe(true)
    expect(bstInorder(rebuilt).map((n) => n.id)).toEqual(bstInorder(plain).map((n) => n.id))
  })

  it('traversals and search paths on a known tree', () => {
    const t = emptyTree()
    for (const k of [50, 30, 70, 20, 40, 60, 80]) apply(bstInsert(t, k, false))
    const keys = (ns: { key: number }[]) => ns.map((n) => n.key)
    expect(keys(bstInorder(t))).toEqual([20, 30, 40, 50, 60, 70, 80])
    expect(keys(preorder(t))).toEqual([50, 30, 20, 40, 70, 60, 80])
    expect(keys(postorder(t))).toEqual([20, 40, 30, 60, 80, 70, 50])
    expect(keys(levelorder(t))).toEqual([50, 30, 70, 20, 40, 60, 80])
    const path = apply(bstSearch(t, 60)).filter((s) => s.kind === 'visit')
    expect(path.map((s) => (s.kind === 'visit' ? s.node.key : 0))).toEqual([50, 70, 60])
    expect(apply(bstSearch(t, 65)).pop()!.kind).toBe('missing')
    // Deleting a node with two children copies in its successor.
    apply(bstRemove(t, 50, false))
    expect(t.root!.key).toBe(60)
    expect(isValid(t)).toBe(true)
  })
})

describe('heap-visualizer', () => {
  it('keeps the heap property through pushes and pops, popping in sorted order', () => {
    for (const kind of ['min', 'max'] as const) {
      const random = rng(kind === 'min' ? 4 : 8)
      const a: number[] = []
      const values: number[] = []
      for (let i = 0; i < 60; i++) {
        const v = Math.floor(random() * 100)
        values.push(v)
        const { swaps } = runHeap(heapPush(a, v, kind))
        expect(swaps).toBeLessThanOrEqual(Math.floor(Math.log2(a.length)))
        expect(isHeap(a, kind)).toBe(true)
      }
      const out: number[] = []
      while (a.length) {
        const top = a[0]
        runHeap(heapPop(a, kind))
        out.push(top)
        expect(isHeap(a, kind)).toBe(true)
      }
      expect(out).toEqual(values.sort((x, y) => (kind === 'min' ? x - y : y - x)))
    }
  })

  it('heapify builds a valid heap and heap sort sorts', () => {
    const random = rng(12)
    for (const n of [0, 1, 2, 15, 31, 100]) {
      const a = Array.from({ length: n }, () => Math.floor(random() * 50))
      const b = a.slice()
      runHeap(heapify(a, 'max'))
      expect(isHeap(a, 'max')).toBe(true)
      const asc = b.slice()
      runHeap(heapSortSteps(asc, 'max'))
      expect(asc).toEqual(b.slice().sort((x, y) => x - y))
      const desc = b.slice()
      runHeap(heapSortSteps(desc, 'min'))
      expect(desc).toEqual(b.slice().sort((x, y) => y - x))
    }
  })
})

describe('graph-traversal', () => {
  // 0 - 1 - 3
  // |   |
  // 2 - 4   5 - 6 (5 and 6 unreachable from 0)
  const known = (directed = false): Graph => ({
    nodes: [0, 1, 2, 3, 4, 5, 6].map((id) => ({ id, x: 0, y: 0 })),
    edges: [
      { a: 0, b: 1 },
      { a: 0, b: 2 },
      { a: 1, b: 3 },
      { a: 1, b: 4 },
      { a: 2, b: 4 },
      { a: 5, b: 6 },
    ],
    directed,
  })

  it('BFS visits level by level with the right levels and tree edges', () => {
    const r = traverse(known(), 0, 'bfs')
    expect(r.order).toEqual([0, 1, 2, 3, 4])
    expect([...r.level.entries()]).toEqual([[0, 0], [1, 1], [2, 1], [3, 2], [4, 2]])
    expect(r.tree).toEqual([[0, 1], [0, 2], [1, 3], [1, 4]])
  })

  it('DFS dives along the smallest neighbour first', () => {
    const r = traverse(known(), 0, 'dfs')
    expect(r.order).toEqual([0, 1, 3, 4, 2])
    expect(r.tree).toEqual([[0, 1], [1, 3], [1, 4], [4, 2]])
    expect(r.level.get(2)).toBe(3)
    // Directed: edges only go a → b, so from 4 nothing is reachable.
    expect(traverse(known(true), 4, 'bfs').order).toEqual([4])
    expect(traverse(known(true), 0, 'dfs').order).toEqual([0, 1, 3, 4, 2])
  })

  it('presets are connected', () => {
    for (const p of ['tree', 'grid', 'random', 'cycle'] as const) {
      const g = graphPreset(p, 800, 480, rng(6))
      expect(traverse(g, 0, 'bfs').order.length).toBe(g.nodes.length)
    }
  })
})

describe('minimum-spanning-tree', () => {
  it("Kruskal's and Prim's give the same total weight on seeded graphs", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const random = rng(seed)
      const pts = scatterPoints(8 + seed * 2, 560, 500, random, 50)
      const edges = buildEdges(pts, 1 + (seed % 4), () => 1 + Math.floor(random() * 20))
      const n = pts.length
      const k = mst(n, edges, 'kruskal')
      expect(k.count).toBe(n - 1)
      for (const start of [0, n - 1]) expect(mst(n, edges, 'prim', start)).toEqual(k)
    }
  })

  it('k-nearest edges are always connected', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const pts = scatterPoints(30, 560, 500, rng(seed * 7), 60)
      const edges = buildEdges(pts, 1, () => 1)
      const uf = new UnionFind(pts.length)
      for (const e of edges) uf.union(e.a, e.b)
      expect(uf.size[uf.find(0)]).toBe(pts.length)
    }
  })
})

describe('minimum-spanning-tree (small exact case)', () => {
  it('matches a hand-checked MST', () => {
    // Square 0-1-2-3 with diagonals; cheapest tree uses edges 0-1 (1), 1-2 (2), 2-3 (3).
    const edges = [
      { a: 0, b: 1, w: 1 },
      { a: 1, b: 2, w: 2 },
      { a: 2, b: 3, w: 3 },
      { a: 3, b: 0, w: 4 },
      { a: 0, b: 2, w: 5 },
      { a: 1, b: 3, w: 6 },
    ]
    expect(mst(4, edges, 'kruskal')).toEqual({ weight: 6, count: 3 })
    expect(mst(4, edges, 'prim', 3)).toEqual({ weight: 6, count: 3 })
  })
})

describe('hash-table', () => {
  const strategies: Strategy[] = ['chaining', 'linear', 'quadratic', 'double']
  const words = Array.from({ length: 40 }, (_, i) => `key${i * 7}`)

  it('hash functions match known values', () => {
    expect(hashString('abc', 'sum')).toBe(294)
    expect(hashString('lemon', 'sum')).toBe(hashString('melon', 'sum'))
    expect(hashString('', 'djb2')).toBe(5381)
    expect(hashString('a', 'djb2')).toBe(177670)
    expect(hashString('', 'fnv')).toBe(0x811c9dc5)
    expect(hashString('a', 'fnv')).toBe(0xe40c292c)
  })

  it('insert, search and delete work for every strategy and hash function', () => {
    for (const strategy of strategies)
      for (const fn of ['sum', 'djb2', 'fnv'] as const) {
        const t = makeTable(11, fn, strategy)
        for (const w of words) expect(runTable(tableInsert(t, w, 0.75))).toBe(true)
        expect(runTable(tableInsert(t, words[3], 0.75))).toBe(false)
        expect(t.size).toBe(words.length)
        expect(t.size / t.m).toBeLessThanOrEqual(0.75)
        for (const w of words) expect(runTable(tableSearch(t, w))).not.toBeNull()
        expect(runTable(tableSearch(t, 'nope'))).toBeNull()
        // Delete every other key; the rest must still be found past any tombstones.
        words.forEach((w, i) => i % 2 === 0 && expect(runTable(tableRemove(t, w))).toBe(true))
        expect(runTable(tableRemove(t, words[0]))).toBe(false)
        words.forEach((w, i) => expect(runTable(tableSearch(t, w)) !== null, `${strategy} ${fn} ${w}`).toBe(i % 2 === 1))
        expect(t.size).toBe(words.length / 2)
        if (strategy !== 'chaining') expect(t.tombs).toBeGreaterThan(0)
        // Re-inserting reuses tombstones.
        for (const w of words) runTable(tableInsert(t, w, 0.75))
        expect(keysOf(t).sort()).toEqual([...words].sort())
      }
  })

  it('resizing keeps every key and grows to a prime at least twice as big', () => {
    for (const strategy of strategies) {
      const t = makeTable(5, 'djb2', strategy)
      const sizes = [t.m]
      for (const w of words) {
        runTable(tableInsert(t, w, 0.6))
        if (t.m !== sizes[sizes.length - 1]) sizes.push(t.m)
      }
      expect(sizes.length).toBeGreaterThan(2)
      for (let k = 1; k < sizes.length; k++) expect(sizes[k]).toBe(nextPrime(sizes[k - 1] * 2))
      expect(keysOf(t).sort()).toEqual([...words].sort())
    }
    // Open addressing with no resize threshold still finds room when the table is full.
    const full = buildTable(words.slice(0, 12), 7, 'fnv', 'quadratic')
    expect(full.m).toBeGreaterThanOrEqual(12)
    expect(keysOf(full).length).toBe(12)
  })
})
