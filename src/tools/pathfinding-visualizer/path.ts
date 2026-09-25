/**
 * Grid search algorithms as generators. The grid stores a move cost per cell:
 * 0 = wall, 1 = open, 5 = weighted (mud). Entering a cell costs its value.
 */

export type Algo = 'astar' | 'dijkstra' | 'bfs' | 'dfs' | 'greedy'
export type Heuristic = 'manhattan' | 'euclidean'

export interface Grid {
  cols: number
  rows: number
  cost: Uint8Array
}

export type PathEvent = { visit: number; dist: number } | { frontier: number }

export interface PathResult {
  path: number[]
  cost: number
  visited: number
}

export const WALL = 0
export const OPEN = 1
export const WEIGHT = 5

export function makeGrid(cols: number, rows: number): Grid {
  return { cols, rows, cost: new Uint8Array(cols * rows).fill(OPEN) }
}

/** Open neighbours in the order up, right, down, left. */
export function neighbours(g: Grid, i: number): number[] {
  const x = i % g.cols
  const y = (i / g.cols) | 0
  const out: number[] = []
  if (y > 0 && g.cost[i - g.cols]) out.push(i - g.cols)
  if (x < g.cols - 1 && g.cost[i + 1]) out.push(i + 1)
  if (y < g.rows - 1 && g.cost[i + g.cols]) out.push(i + g.cols)
  if (x > 0 && g.cost[i - 1]) out.push(i - 1)
  return out
}

export function heuristic(g: Grid, a: number, b: number, kind: Heuristic): number {
  const dx = Math.abs((a % g.cols) - (b % g.cols))
  const dy = Math.abs(((a / g.cols) | 0) - ((b / g.cols) | 0))
  return kind === 'manhattan' ? dx + dy : Math.hypot(dx, dy)
}

/** Cost of walking a path: every entered cell adds its weight. */
export function pathCost(g: Grid, path: number[]): number {
  let c = 0
  for (let k = 1; k < path.length; k++) c += g.cost[path[k]]
  return c
}

/** A small binary min-heap of [priority, tiebreak, value]. */
class MinHeap {
  private items: [number, number, number][] = []
  get size() {
    return this.items.length
  }
  push(p: number, t: number, v: number) {
    const a = this.items
    a.push([p, t, v])
    let i = a.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!this.less(a[i], a[parent])) break
      ;[a[i], a[parent]] = [a[parent], a[i]]
      i = parent
    }
  }
  pop(): number {
    const a = this.items
    const top = a[0][2]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && this.less(a[l], a[m])) m = l
        if (r < a.length && this.less(a[r], a[m])) m = r
        if (m === i) break
        ;[a[i], a[m]] = [a[m], a[i]]
        i = m
      }
    }
    return top
  }
  private less(x: [number, number, number], y: [number, number, number]) {
    return x[0] < y[0] - 1e-9 || (Math.abs(x[0] - y[0]) <= 1e-9 && x[1] < y[1])
  }
}

function trace(parent: Int32Array, end: number): number[] {
  const path: number[] = []
  for (let c = end; c !== -1; c = parent[c]) path.push(c)
  return path.reverse()
}

export function* search(g: Grid, start: number, end: number, algo: Algo, kind: Heuristic = 'manhattan'): Generator<PathEvent, PathResult, undefined> {
  const n = g.cols * g.rows
  const parent = new Int32Array(n).fill(-1)
  const dist = new Float64Array(n).fill(Infinity)
  const closed = new Uint8Array(n)
  let visited = 0
  const done = (): PathResult => {
    if (!closed[end]) return { path: [], cost: Infinity, visited }
    const path = trace(parent, end)
    return { path, cost: pathCost(g, path), visited }
  }
  dist[start] = 0

  if (algo === 'bfs' || algo === 'dfs') {
    // BFS ignores weights (every step counts as one); DFS just dives.
    const list = [start]
    const seen = new Uint8Array(n)
    seen[start] = 1
    while (list.length) {
      const c = algo === 'bfs' ? list.shift()! : list.pop()!
      if (closed[c]) continue
      closed[c] = 1
      visited++
      yield { visit: c, dist: dist[c] }
      if (c === end) return done()
      const next = neighbours(g, c)
      if (algo === 'dfs') next.reverse()
      for (const m of next) {
        if (closed[m] || (algo === 'bfs' && seen[m])) continue
        seen[m] = 1
        parent[m] = c
        dist[m] = dist[c] + 1
        list.push(m)
        yield { frontier: m }
      }
    }
    return done()
  }

  const h = (i: number) => (algo === 'dijkstra' ? 0 : heuristic(g, i, end, kind))
  const heap = new MinHeap()
  heap.push(h(start), h(start), start)
  while (heap.size) {
    const c = heap.pop()
    if (closed[c]) continue
    closed[c] = 1
    visited++
    yield { visit: c, dist: dist[c] }
    if (c === end) return done()
    for (const m of neighbours(g, c)) {
      if (closed[m]) continue
      const d = dist[c] + g.cost[m]
      if (algo === 'greedy' ? parent[m] !== -1 || m === start : d >= dist[m]) continue
      dist[m] = d
      parent[m] = c
      const hm = h(m)
      heap.push(algo === 'greedy' ? hm : d + hm, hm, m)
      yield { frontier: m }
    }
  }
  return done()
}

/** Runs a search to the end without animation. */
export function solve(g: Grid, start: number, end: number, algo: Algo, kind: Heuristic = 'manhattan'): PathResult {
  const it = search(g, start, end, algo, kind)
  for (;;) {
    const r = it.next()
    if (r.done) return r.value
  }
}

/** Recursive division: walls on even rows/columns, gaps on odd ones, with a solid border. */
export function divisionMaze(cols: number, rows: number, random: () => number): Uint8Array {
  const cost = new Uint8Array(cols * rows).fill(OPEN)
  for (let x = 0; x < cols; x++) {
    cost[x] = WALL
    cost[(rows - 1) * cols + x] = WALL
  }
  for (let y = 0; y < rows; y++) {
    cost[y * cols] = WALL
    cost[y * cols + cols - 1] = WALL
  }
  const pick = (lo: number, hi: number, parity: number) => {
    const opts: number[] = []
    for (let v = lo; v <= hi; v++) if (v % 2 === parity) opts.push(v)
    return opts.length ? opts[Math.floor(random() * opts.length)] : -1
  }
  const divide = (x0: number, y0: number, x1: number, y1: number) => {
    const w = x1 - x0 + 1
    const h = y1 - y0 + 1
    const horizontal = w < h ? true : h < w ? false : random() < 0.5
    if (horizontal) {
      const y = pick(y0 + 1, y1 - 1, 0)
      const gap = pick(x0, x1, 1)
      if (y < 0 || gap < 0) return
      for (let x = x0; x <= x1; x++) if (x !== gap) cost[y * cols + x] = WALL
      divide(x0, y0, x1, y - 1)
      divide(x0, y + 1, x1, y1)
    } else {
      const x = pick(x0 + 1, x1 - 1, 0)
      const gap = pick(y0, y1, 1)
      if (x < 0 || gap < 0) return
      for (let y = y0; y <= y1; y++) if (y !== gap) cost[y * cols + x] = WALL
      divide(x0, y0, x - 1, y1)
      divide(x + 1, y0, x1, y1)
    }
  }
  divide(1, 1, cols - 2, rows - 2)
  return cost
}

/** Random walls and weights. */
export function scatter(cols: number, rows: number, random: () => number, walls = 0.26, weights = 0): Uint8Array {
  const cost = new Uint8Array(cols * rows)
  for (let i = 0; i < cost.length; i++) {
    const r = random()
    cost[i] = r < walls ? WALL : r < walls + weights ? WEIGHT : OPEN
  }
  return cost
}
