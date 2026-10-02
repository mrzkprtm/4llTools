/** Kruskal's and Prim's minimum spanning tree algorithms as step generators. */

export interface Pt {
  x: number
  y: number
}

export interface WEdge {
  a: number
  b: number
  w: number
}

export type MstStep = { kind: 'consider'; e: number } | { kind: 'accept'; e: number } | { kind: 'reject'; e: number }

export class UnionFind {
  parent: Int32Array
  size: Int32Array
  constructor(n: number) {
    this.parent = Int32Array.from({ length: n }, (_, i) => i)
    this.size = new Int32Array(n).fill(1)
  }
  find(x: number): number {
    while (this.parent[x] !== x) x = this.parent[x] = this.parent[this.parent[x]]
    return x
  }
  /** Joins two sets; false when they were already one. */
  union(a: number, b: number): boolean {
    let ra = this.find(a)
    let rb = this.find(b)
    if (ra === rb) return false
    if (this.size[ra] < this.size[rb]) [ra, rb] = [rb, ra]
    this.parent[rb] = ra
    this.size[ra] += this.size[rb]
    return true
  }
}

/** Edge indices by increasing weight (ties keep their original order). */
export function sortedOrder(edges: WEdge[]): number[] {
  return edges.map((_, i) => i).sort((i, j) => edges[i].w - edges[j].w || i - j)
}

export function* kruskal(n: number, edges: WEdge[]): Generator<MstStep> {
  const uf = new UnionFind(n)
  let accepted = 0
  for (const e of sortedOrder(edges)) {
    if (accepted >= n - 1) return
    yield { kind: 'consider', e }
    if (uf.union(edges[e].a, edges[e].b)) {
      accepted++
      yield { kind: 'accept', e }
    } else yield { kind: 'reject', e }
  }
}

/** Lazy Prim: grow one tree from `start`, always taking the cheapest edge that leaves it. */
export function* prim(n: number, edges: WEdge[], start = 0): Generator<MstStep> {
  const inTree = new Uint8Array(n)
  const at: number[][] = Array.from({ length: n }, () => [])
  edges.forEach((e, i) => {
    at[e.a].push(i)
    at[e.b].push(i)
  })
  const pq: number[] = []
  const add = (v: number) => {
    inTree[v] = 1
    for (const i of at[v]) if (!inTree[edges[i].a] || !inTree[edges[i].b]) pq.push(i)
  }
  if (n === 0) return
  add(start)
  let accepted = 0
  while (pq.length && accepted < n - 1) {
    let k = 0
    for (let j = 1; j < pq.length; j++) if (edges[pq[j]].w < edges[pq[k]].w || (edges[pq[j]].w === edges[pq[k]].w && pq[j] < pq[k])) k = j
    const e = pq.splice(k, 1)[0]
    yield { kind: 'consider', e }
    const { a, b } = edges[e]
    if (inTree[a] && inTree[b]) {
      yield { kind: 'reject', e }
      continue
    }
    accepted++
    yield { kind: 'accept', e }
    add(inTree[a] ? b : a)
  }
}

/** Total weight of the tree an algorithm builds (and how many edges it used). */
export function mst(n: number, edges: WEdge[], algo: 'kruskal' | 'prim', start = 0): { weight: number; count: number } {
  let weight = 0
  let count = 0
  for (const s of algo === 'kruskal' ? kruskal(n, edges) : prim(n, edges, start))
    if (s.kind === 'accept') {
      weight += edges[s.e].w
      count++
    }
  return { weight, count }
}

/** Random points at least `gap` apart inside the box. */
export function scatterPoints(n: number, w: number, h: number, random: () => number, gap = 60, margin = 30): Pt[] {
  const out: Pt[] = []
  for (let tries = 0; out.length < n && tries < 5000; tries++) {
    const p = { x: margin + random() * (w - 2 * margin), y: margin + random() * (h - 2 * margin) }
    if (out.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > (tries < 3000 ? gap : gap / 2))) out.push(p)
  }
  return out
}

/**
 * Joins each point to its k nearest neighbours, then links any separate pieces by their
 * closest pair so the graph is connected. `weight` gives each new edge its weight.
 */
export function buildEdges(pts: Pt[], k: number, weight: (a: number, b: number) => number): WEdge[] {
  const n = pts.length
  const d = (i: number, j: number) => Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
  const seen = new Set<string>()
  const edges: WEdge[] = []
  const link = (i: number, j: number) => {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`
    if (i === j || seen.has(key)) return
    seen.add(key)
    edges.push({ a: Math.min(i, j), b: Math.max(i, j), w: weight(Math.min(i, j), Math.max(i, j)) })
  }
  for (let i = 0; i < n; i++) {
    const near = Array.from({ length: n }, (_, j) => j)
      .filter((j) => j !== i)
      .sort((p, q) => d(i, p) - d(i, q))
    for (const j of near.slice(0, k)) link(i, j)
  }
  const uf = new UnionFind(n)
  for (const e of edges) uf.union(e.a, e.b)
  for (;;) {
    let best: [number, number] | null = null
    let bd = Infinity
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if ((uf.find(i) === uf.find(0)) !== (uf.find(j) === uf.find(0)))
          if (d(i, j) < bd) {
            bd = d(i, j)
            best = [i, j]
          }
    if (!best) break
    link(best[0], best[1])
    uf.union(best[0], best[1])
  }
  return edges
}
