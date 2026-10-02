/**
 * Perfect-maze generators and solvers as generators. A maze is a grid of cells with a
 * bitmask of open sides per cell (N=1, E=2, S=4, W=8).
 */

export const N = 1
export const E = 2
export const S = 4
export const Wb = 8

export interface Maze {
  cols: number
  rows: number
  open: Uint8Array
}

export interface GenStep {
  cell: number
  carved?: [number, number]
  stack?: readonly number[]
  frontier?: ReadonlySet<number>
  walk?: readonly number[]
}

export type GenAlgo = 'backtracker' | 'prim' | 'kruskal' | 'wilson' | 'binary' | 'sidewinder'
export type SolveAlgo = 'bfs' | 'dfs' | 'astar' | 'wall'

export function makeMaze(cols: number, rows: number): Maze {
  return { cols, rows, open: new Uint8Array(cols * rows) }
}

/** Neighbouring cells with the side bit that leads to them. */
export function around(m: Maze, c: number): [number, number][] {
  const x = c % m.cols
  const y = (c / m.cols) | 0
  const out: [number, number][] = []
  if (y > 0) out.push([c - m.cols, N])
  if (x < m.cols - 1) out.push([c + 1, E])
  if (y < m.rows - 1) out.push([c + m.cols, S])
  if (x > 0) out.push([c - 1, Wb])
  return out
}

const opposite = (d: number) => (d === N ? S : d === S ? N : d === E ? Wb : E)

/** Knocks down the wall between two adjacent cells. */
export function carve(m: Maze, a: number, b: number) {
  const d = b === a - m.cols ? N : b === a + m.cols ? S : b === a + 1 ? E : Wb
  m.open[a] |= d
  m.open[b] |= opposite(d)
}

/** Cells you can walk to from c. */
export function passages(m: Maze, c: number): number[] {
  return around(m, c)
    .filter(([, d]) => m.open[c] & d)
    .map(([n]) => n)
}

const pick = <T,>(a: readonly T[], random: () => number): T => a[Math.floor(random() * a.length)]

function shuffle<T>(a: T[], random: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function* backtracker(m: Maze, random: () => number): Generator<GenStep> {
  const seen = new Uint8Array(m.open.length)
  const stack = [Math.floor(random() * m.open.length)]
  seen[stack[0]] = 1
  yield { cell: stack[0], stack }
  while (stack.length) {
    const c = stack[stack.length - 1]
    const next = around(m, c).filter(([n]) => !seen[n])
    if (next.length) {
      const [n] = pick(next, random)
      carve(m, c, n)
      seen[n] = 1
      stack.push(n)
      yield { cell: n, carved: [c, n], stack }
    } else {
      stack.pop()
      yield { cell: stack[stack.length - 1] ?? c, stack }
    }
  }
}

export function* prim(m: Maze, random: () => number): Generator<GenStep> {
  const inMaze = new Uint8Array(m.open.length)
  const frontier = new Set<number>()
  const add = (c: number) => {
    inMaze[c] = 1
    for (const [n] of around(m, c)) if (!inMaze[n]) frontier.add(n)
  }
  const first = Math.floor(random() * m.open.length)
  add(first)
  yield { cell: first, frontier }
  while (frontier.size) {
    const f = pick([...frontier], random)
    frontier.delete(f)
    const [n] = pick(
      around(m, f).filter(([c]) => inMaze[c]),
      random,
    )
    carve(m, n, f)
    add(f)
    yield { cell: f, carved: [n, f], frontier }
  }
}

export function* kruskal(m: Maze, random: () => number): Generator<GenStep> {
  const parent = Int32Array.from({ length: m.open.length }, (_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]]
    return x
  }
  const edges: [number, number][] = []
  for (let c = 0; c < m.open.length; c++) {
    if (c % m.cols < m.cols - 1) edges.push([c, c + 1])
    if (c + m.cols < m.open.length) edges.push([c, c + m.cols])
  }
  shuffle(edges, random)
  let joined = 0
  for (const [a, b] of edges) {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) {
      yield { cell: a }
      continue
    }
    parent[ra] = rb
    carve(m, a, b)
    yield { cell: b, carved: [a, b] }
    if (++joined === m.open.length - 1) return
  }
}

/** Wilson's algorithm: loop-erased random walks, giving a uniformly random spanning tree. */
export function* wilson(m: Maze, random: () => number): Generator<GenStep> {
  const n = m.open.length
  const inMaze = new Uint8Array(n)
  inMaze[Math.floor(random() * n)] = 1
  const order = shuffle(
    Array.from({ length: n }, (_, i) => i),
    random,
  )
  const onWalk = new Int32Array(n).fill(-1)
  for (const startCell of order) {
    if (inMaze[startCell]) continue
    const walk = [startCell]
    onWalk[startCell] = 0
    let c = startCell
    while (!inMaze[c]) {
      const [next] = pick(around(m, c), random)
      if (onWalk[next] >= 0) {
        // Erase the loop we just closed.
        for (let k = onWalk[next] + 1; k < walk.length; k++) onWalk[walk[k]] = -1
        walk.length = onWalk[next] + 1
      } else if (!inMaze[next]) {
        onWalk[next] = walk.length
        walk.push(next)
      } else walk.push(next)
      c = next
      yield { cell: c, walk }
    }
    for (let k = 0; k + 1 < walk.length; k++) {
      carve(m, walk[k], walk[k + 1])
      inMaze[walk[k]] = 1
      onWalk[walk[k]] = -1
      yield { cell: walk[k + 1], carved: [walk[k], walk[k + 1]] }
    }
  }
}

/** Binary tree: every cell opens north or east. Leaves long corridors along two sides. */
export function* binaryTree(m: Maze, random: () => number): Generator<GenStep> {
  for (let c = 0; c < m.open.length; c++) {
    const opts: number[] = []
    if (c >= m.cols) opts.push(c - m.cols)
    if (c % m.cols < m.cols - 1) opts.push(c + 1)
    if (!opts.length) continue
    const n = pick(opts, random)
    carve(m, c, n)
    yield { cell: c, carved: [c, n] }
  }
}

/** Sidewinder: runs along each row, each run opening north once. */
export function* sidewinder(m: Maze, random: () => number): Generator<GenStep> {
  for (let y = 0; y < m.rows; y++) {
    let runStart = 0
    for (let x = 0; x < m.cols; x++) {
      const c = y * m.cols + x
      const closeRun = y === 0 ? false : x === m.cols - 1 || random() < 0.5
      if (!closeRun && x < m.cols - 1) {
        carve(m, c, c + 1)
        yield { cell: c, carved: [c, c + 1] }
      } else if (y > 0) {
        const k = y * m.cols + runStart + Math.floor(random() * (x - runStart + 1))
        carve(m, k, k - m.cols)
        yield { cell: k, carved: [k, k - m.cols] }
        runStart = x + 1
      }
    }
  }
}

export const GENERATORS: Record<GenAlgo, (m: Maze, random: () => number) => Generator<GenStep>> = {
  backtracker,
  prim,
  kruskal,
  wilson,
  binary: binaryTree,
  sidewinder,
}

/** Builds a whole maze at once. */
export function generate(cols: number, rows: number, algo: GenAlgo, random: () => number): Maze {
  const m = makeMaze(cols, rows)
  const it = GENERATORS[algo](m, random)
  while (!it.next().done);
  return m
}

export interface SolveStep {
  cell: number
  dist: number
}

/** Finds the route from `start` to `end`. Yields each visited cell and returns the route. */
export function* solver(m: Maze, start: number, end: number, algo: SolveAlgo): Generator<SolveStep, number[], undefined> {
  const n = m.open.length
  const parent = new Int32Array(n).fill(-1)
  const dist = new Int32Array(n).fill(-1)
  const route = () => {
    const out: number[] = []
    for (let c = end; c !== -1; c = parent[c]) out.push(c)
    return out.reverse()
  }
  if (algo === 'wall') {
    // Right-hand rule: keep your right hand on the wall. Loops are erased from the trail.
    const dirs = [N, E, S, Wb]
    const step = (c: number, d: number) => (d === N ? c - m.cols : d === S ? c + m.cols : d === E ? c + 1 : c - 1)
    let c = start
    let facing = 1 // east
    const trail = [start]
    const at = new Int32Array(n).fill(-1)
    at[start] = 0
    let moves = 0
    yield { cell: c, dist: 0 }
    while (c !== end && moves < n * 4) {
      for (const turn of [1, 0, 3, 2]) {
        const d = (facing + turn) % 4
        if (m.open[c] & dirs[d]) {
          facing = d
          c = step(c, dirs[d])
          break
        }
      }
      moves++
      if (at[c] >= 0) {
        for (let k = at[c] + 1; k < trail.length; k++) at[trail[k]] = -1
        trail.length = at[c] + 1
      } else {
        at[c] = trail.length
        trail.push(c)
      }
      yield { cell: c, dist: moves }
    }
    return c === end ? trail.slice() : []
  }
  const h = (c: number) => Math.abs((c % m.cols) - (end % m.cols)) + Math.abs(((c / m.cols) | 0) - ((end / m.cols) | 0))
  const open: number[] = [start]
  dist[start] = 0
  while (open.length) {
    let k = open.length - 1 // DFS: take the newest
    if (algo === 'bfs') k = 0
    if (algo === 'astar') for (let i = 0; i < open.length; i++) if (dist[open[i]] + h(open[i]) < dist[open[k]] + h(open[k])) k = i
    const c = open.splice(k, 1)[0]
    yield { cell: c, dist: dist[c] }
    if (c === end) return route()
    for (const nb of passages(m, c)) {
      if (dist[nb] !== -1) continue
      dist[nb] = dist[c] + 1
      parent[nb] = c
      open.push(nb)
    }
  }
  return []
}

export function solve(m: Maze, start: number, end: number, algo: SolveAlgo): number[] {
  const it = solver(m, start, end, algo)
  for (;;) {
    const r = it.next()
    if (r.done) return r.value
  }
}

/** Cells with exactly one opening. */
export function deadEnds(m: Maze): number {
  let d = 0
  for (const v of m.open) if (v === N || v === E || v === S || v === Wb) d++
  return d
}

/** Number of open passages (each counted once). */
export function edgeCount(m: Maze): number {
  let bits = 0
  for (const v of m.open) bits += (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1) + ((v >> 3) & 1)
  return bits / 2
}

/** How many cells can be reached from cell 0. */
export function reachable(m: Maze): number {
  const seen = new Uint8Array(m.open.length)
  const stack = [0]
  seen[0] = 1
  let count = 0
  while (stack.length) {
    const c = stack.pop()!
    count++
    for (const nb of passages(m, c))
      if (!seen[nb]) {
        seen[nb] = 1
        stack.push(nb)
      }
  }
  return count
}
