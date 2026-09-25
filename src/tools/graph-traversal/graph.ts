/** A small editable graph plus breadth-first and depth-first search as step generators. */

export interface GNode {
  id: number
  x: number
  y: number
}

export interface GEdge {
  a: number
  b: number
}

export interface Graph {
  nodes: GNode[]
  edges: GEdge[]
  directed: boolean
}

export type TravStep =
  | { kind: 'discover'; node: number; from: number | null; frontier: number[] }
  | { kind: 'visit'; node: number; from: number | null; order: number; level: number; frontier: number[] }
  | { kind: 'skip'; node: number; frontier: number[] }

/** Neighbours of every node, in increasing id order. Undirected edges work both ways. */
export function adjacency(g: Graph): Map<number, number[]> {
  const adj = new Map<number, number[]>(g.nodes.map((n) => [n.id, []]))
  for (const e of g.edges) {
    adj.get(e.a)?.push(e.b)
    if (!g.directed) adj.get(e.b)?.push(e.a)
  }
  for (const list of adj.values()) list.sort((x, y) => x - y)
  return adj
}

export function* bfs(g: Graph, start: number): Generator<TravStep> {
  const adj = adjacency(g)
  const level = new Map([[start, 0]])
  const parent = new Map<number, number | null>([[start, null]])
  const queue = [start]
  yield { kind: 'discover', node: start, from: null, frontier: [...queue] }
  let order = 0
  while (queue.length) {
    const v = queue.shift()!
    yield { kind: 'visit', node: v, from: parent.get(v)!, order: order++, level: level.get(v)!, frontier: [...queue] }
    for (const w of adj.get(v) ?? []) {
      if (level.has(w)) continue
      level.set(w, level.get(v)! + 1)
      parent.set(w, v)
      queue.push(w)
      yield { kind: 'discover', node: w, from: v, frontier: [...queue] }
    }
  }
}

/** Iterative DFS: pop a node, visit it if new, push its neighbours so the smallest id comes off first. */
export function* dfs(g: Graph, start: number): Generator<TravStep> {
  const adj = adjacency(g)
  const depth = new Map<number, number>()
  const parent = new Map<number, number | null>([[start, null]])
  const stack = [start]
  yield { kind: 'discover', node: start, from: null, frontier: [...stack] }
  let order = 0
  while (stack.length) {
    const v = stack.pop()!
    if (depth.has(v)) {
      yield { kind: 'skip', node: v, frontier: [...stack] }
      continue
    }
    const from = parent.get(v) ?? null
    depth.set(v, from === null ? 0 : depth.get(from)! + 1)
    yield { kind: 'visit', node: v, from, order: order++, level: depth.get(v)!, frontier: [...stack] }
    const next = adj.get(v) ?? []
    for (let k = next.length - 1; k >= 0; k--) {
      const w = next[k]
      if (depth.has(w)) continue
      parent.set(w, v)
      stack.push(w)
      yield { kind: 'discover', node: w, from: v, frontier: [...stack] }
    }
  }
}

/** Visit order and levels from running a traversal to the end. */
export function traverse(g: Graph, start: number, algo: 'bfs' | 'dfs'): { order: number[]; level: Map<number, number>; tree: [number, number][] } {
  const order: number[] = []
  const level = new Map<number, number>()
  const tree: [number, number][] = []
  for (const s of (algo === 'bfs' ? bfs : dfs)(g, start))
    if (s.kind === 'visit') {
      order.push(s.node)
      level.set(s.node, s.level)
      if (s.from !== null) tree.push([s.from, s.node])
    }
  return { order, level, tree }
}

/** Node names: A–Z, then A1, B1, … */
export const nodeName = (id: number) => String.fromCharCode(65 + (id % 26)) + (id >= 26 ? String(Math.floor(id / 26)) : '')

export type Preset = 'tree' | 'grid' | 'random' | 'cycle'

export function preset(kind: Preset, w: number, h: number, random: () => number): Graph {
  const nodes: GNode[] = []
  const edges: GEdge[] = []
  const add = (x: number, y: number) => nodes.push({ id: nodes.length, x, y })
  if (kind === 'tree') {
    // A complete binary tree with 15 nodes.
    for (let i = 0; i < 15; i++) {
      const d = Math.floor(Math.log2(i + 1))
      const k = i - (2 ** d - 1)
      add(40 + ((w - 80) * (k + 0.5)) / 2 ** d, 50 + d * ((h - 100) / 3))
      if (i) edges.push({ a: (i - 1) >> 1, b: i })
    }
  } else if (kind === 'grid') {
    const cols = 6
    const rows = 4
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        add(90 + (c * (w - 180)) / (cols - 1), 60 + (r * (h - 120)) / (rows - 1))
        const i = r * cols + c
        if (c) edges.push({ a: i - 1, b: i })
        if (r) edges.push({ a: i - cols, b: i })
      }
  } else if (kind === 'cycle') {
    const n = 10
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      add(w / 2 + Math.cos(a) * (h / 2 - 50), h / 2 + Math.sin(a) * (h / 2 - 50))
      if (i) edges.push({ a: i - 1, b: i })
    }
    edges.push({ a: n - 1, b: 0 })
    edges.push({ a: 0, b: 5 })
  } else {
    // Random points kept apart, joined to their nearest earlier neighbour (so it is connected) plus a few extras.
    let tries = 0
    while (nodes.length < 13 && tries++ < 2000) {
      const x = 50 + random() * (w - 100)
      const y = 45 + random() * (h - 90)
      if (nodes.every((n) => Math.hypot(n.x - x, n.y - y) > 95)) add(x, y)
    }
    const has = (a: number, b: number) => edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
    for (let i = 1; i < nodes.length; i++) {
      const near = nodes.slice(0, i).sort((p, q) => Math.hypot(p.x - nodes[i].x, p.y - nodes[i].y) - Math.hypot(q.x - nodes[i].x, q.y - nodes[i].y))
      edges.push({ a: near[0].id, b: i })
      if (near[1] && random() < 0.45 && !has(near[1].id, i)) edges.push({ a: near[1].id, b: i })
    }
  }
  return { nodes, edges, directed: false }
}
