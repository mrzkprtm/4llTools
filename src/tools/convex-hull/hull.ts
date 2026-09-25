/**
 * Convex hull algorithms as step-by-step generators. Coordinates are maths-style
 * (y up), so cross > 0 means a left (counter-clockwise) turn. Hulls come out
 * counter-clockwise without collinear points.
 */

export interface Pt {
  x: number
  y: number
}

export type HullAlgo = 'jarvis' | 'graham' | 'monotone' | 'quickhull'

export interface HullStep {
  /** The hull built so far, or the stack, as point indices. */
  hull: number[]
  /** Edge being considered (from, to). */
  edge?: [number, number]
  /** A turn test a → b → c with its cross product. */
  test?: { a: number; b: number; c: number; cross: number }
  /** Points in play (the set quickhull is splitting, or the order Graham sorted). */
  focus?: number[]
  /** Triangle quickhull is carving away. */
  tri?: [number, number, number]
  /** Graham: order of points after the angular sort. */
  order?: number[]
  note: string
  done?: boolean
}

export const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
const d2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

/** Gift wrapping: from the leftmost point, repeatedly pick the point with every other point to its left. */
export function* jarvis(P: readonly Pt[]): Generator<HullStep> {
  const n = P.length
  if (n < 3) return yield { hull: P.map((_, i) => i), note: 'Fewer than 3 points', done: true }
  let start = 0
  for (let i = 1; i < n; i++) if (P[i].x < P[start].x || (P[i].x === P[start].x && P[i].y < P[start].y)) start = i
  const hull: number[] = []
  let p = start
  do {
    hull.push(p)
    let q = (p + 1) % n
    yield { hull: [...hull], edge: [p, q], note: `From ${p}, first guess ${q}` }
    for (let r = 0; r < n; r++) {
      if (r === p || r === q) continue
      const c = cross(P[p], P[q], P[r])
      const better = c < 0 || (c === 0 && d2(P[p], P[r]) > d2(P[p], P[q]))
      yield { hull: [...hull], edge: [p, q], test: { a: p, b: q, c: r, cross: c }, note: better ? `${r} is right of ${p}→${q}: wrap tighter` : `${r} is left of ${p}→${q}: keep ${q}` }
      if (better) q = r
    }
    p = q
    if (hull.length > n) break
  } while (p !== start)
  yield { hull, note: `Back at ${start}: done`, done: true }
}

/** Graham scan: sort by angle around the lowest point, then keep only left turns on a stack. */
export function* graham(P: readonly Pt[]): Generator<HullStep> {
  const n = P.length
  if (n < 3) return yield { hull: P.map((_, i) => i), note: 'Fewer than 3 points', done: true }
  let pivot = 0
  for (let i = 1; i < n; i++) if (P[i].y < P[pivot].y || (P[i].y === P[pivot].y && P[i].x < P[pivot].x)) pivot = i
  const rest = P.map((_, i) => i).filter((i) => i !== pivot)
  rest.sort((a, b) => {
    const c = cross(P[pivot], P[a], P[b])
    return c !== 0 ? -c : d2(P[pivot], P[a]) - d2(P[pivot], P[b])
  })
  const order = [pivot, ...rest]
  yield { hull: [pivot], order, focus: order, note: `Sorted by angle around the lowest point ${pivot}` }
  const st = [pivot]
  for (const i of rest) {
    while (st.length >= 2) {
      const c = cross(P[st[st.length - 2]], P[st[st.length - 1]], P[i])
      const pop = c <= 0
      yield { hull: [...st], order, test: { a: st[st.length - 2], b: st[st.length - 1], c: i, cross: c }, note: pop ? `Not a left turn: pop ${st[st.length - 1]}` : `Left turn: keep ${st[st.length - 1]}` }
      if (!pop) break
      st.pop()
    }
    st.push(i)
    yield { hull: [...st], order, note: `Push ${i}` }
  }
  yield { hull: st, note: 'Stack holds the hull: done', done: true }
}

/** Andrew's monotone chain: sort by x, build the lower hull left to right and the upper hull right to left. */
export function* monotone(P: readonly Pt[]): Generator<HullStep> {
  const n = P.length
  if (n < 3) return yield { hull: P.map((_, i) => i), note: 'Fewer than 3 points', done: true }
  const idx = P.map((_, i) => i).sort((a, b) => P[a].x - P[b].x || P[a].y - P[b].y)
  yield { hull: [], order: idx, focus: idx, note: 'Sorted left to right' }
  const chain = function* (seq: number[], name: string, prefix: number[]): Generator<HullStep, number[]> {
    const st: number[] = []
    for (const i of seq) {
      while (st.length >= 2) {
        const c = cross(P[st[st.length - 2]], P[st[st.length - 1]], P[i])
        const pop = c <= 0
        yield { hull: [...prefix, ...st], order: idx, test: { a: st[st.length - 2], b: st[st.length - 1], c: i, cross: c }, note: `${name}: ${pop ? `not a left turn, pop ${st[st.length - 1]}` : 'left turn, keep going'}` }
        if (!pop) break
        st.pop()
      }
      st.push(i)
      yield { hull: [...prefix, ...st], order: idx, note: `${name}: push ${i}` }
    }
    return st
  }
  const lower = yield* chain(idx, 'Lower hull', [])
  const upper = yield* chain([...idx].reverse(), 'Upper hull', lower.slice(0, -1))
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)]
  yield { hull: hull.length ? hull : [idx[0]], note: 'Lower + upper: done', done: true }
}

/** Quickhull: split by the line through the extreme points, then recurse on the farthest point of each side. */
export function* quickhull(P: readonly Pt[]): Generator<HullStep> {
  const n = P.length
  if (n < 3) return yield { hull: P.map((_, i) => i), note: 'Fewer than 3 points', done: true }
  let a = 0
  let b = 0
  for (let i = 1; i < n; i++) {
    if (P[i].x < P[a].x || (P[i].x === P[a].x && P[i].y < P[a].y)) a = i
    if (P[i].x > P[b].x || (P[i].x === P[b].x && P[i].y > P[b].y)) b = i
  }
  const all = P.map((_, i) => i)
  const rightOf = (p: number, q: number, set: number[]) => set.filter((i) => cross(P[p], P[q], P[i]) < 0)
  // Hull vertices found so far, kept in order between fixed neighbours.
  let hull = [a, b]
  function* side(p: number, q: number, set: number[]): Generator<HullStep> {
    if (!set.length) return
    let c = set[0]
    let best = -Infinity
    for (const i of set) {
      const dd = -cross(P[p], P[q], P[i])
      if (dd > best || (dd === best && d2(P[p], P[i]) < d2(P[p], P[c]))) {
        best = dd
        c = i
      }
    }
    const k = hull.indexOf(p)
    hull = [...hull.slice(0, k + 1), c, ...hull.slice(k + 1)]
    yield { hull: [...hull], edge: [p, q], focus: set, tri: [p, c, q], note: `Farthest from ${p}–${q} is ${c}: points inside the triangle are dropped` }
    yield* side(p, c, rightOf(p, c, set))
    yield* side(c, q, rightOf(c, q, set))
  }
  yield { hull: [a, b], edge: [a, b], focus: all, note: `Split along ${a}–${b}` }
  yield* side(a, b, rightOf(a, b, all))
  yield* side(b, a, rightOf(b, a, all))
  yield { hull, note: 'No points left outside: done', done: true }
}

export const ALGORITHMS: Record<HullAlgo, (P: readonly Pt[]) => Generator<HullStep>> = { jarvis, graham, monotone, quickhull }

/** Runs an algorithm to the end and returns the hull's point indices. */
export function convexHull(P: readonly Pt[], algo: HullAlgo): number[] {
  let last: HullStep | undefined
  for (const s of ALGORITHMS[algo](P)) last = s
  return last?.hull ?? []
}
