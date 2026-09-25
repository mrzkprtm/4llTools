/**
 * Binary heap operations as generators over a plain array (children of i at 2i+1 and 2i+2).
 * Every comparison and swap is yielded so the tool can animate the tree and the array together.
 */

export type HeapKind = 'min' | 'max'

export type HeapStep =
  | { kind: 'compare'; i: number; j: number }
  | { kind: 'swap'; i: number; j: number }
  | { kind: 'append'; i: number; v: number }
  | { kind: 'remove'; v: number }
  | { kind: 'focus'; i: number }
  | { kind: 'sorted'; i: number }

/** True when x belongs above y. */
export const above = (kind: HeapKind, x: number, y: number) => (kind === 'min' ? x < y : x > y)

function sw(a: number[], i: number, j: number) {
  const t = a[i]
  a[i] = a[j]
  a[j] = t
}

export function* siftUp(a: number[], i: number, kind: HeapKind): Generator<HeapStep> {
  while (i > 0) {
    const p = (i - 1) >> 1
    yield { kind: 'compare', i, j: p }
    if (!above(kind, a[i], a[p])) return
    sw(a, i, p)
    yield { kind: 'swap', i, j: p }
    i = p
  }
}

export function* siftDown(a: number[], i: number, size: number, kind: HeapKind): Generator<HeapStep> {
  for (;;) {
    const l = 2 * i + 1
    if (l >= size) return
    let c = l
    if (l + 1 < size) {
      yield { kind: 'compare', i: l, j: l + 1 }
      if (above(kind, a[l + 1], a[l])) c = l + 1
    }
    yield { kind: 'compare', i: c, j: i }
    if (!above(kind, a[c], a[i])) return
    sw(a, i, c)
    yield { kind: 'swap', i, j: c }
    i = c
  }
}

export function* push(a: number[], v: number, kind: HeapKind): Generator<HeapStep> {
  a.push(v)
  yield { kind: 'append', i: a.length - 1, v }
  yield* siftUp(a, a.length - 1, kind)
}

/** Removes the top: swap it with the last item, drop it, then sift the new root down. */
export function* pop(a: number[], kind: HeapKind): Generator<HeapStep> {
  if (!a.length) return
  const last = a.length - 1
  if (last > 0) {
    sw(a, 0, last)
    yield { kind: 'swap', i: 0, j: last }
  }
  const v = a.pop()!
  yield { kind: 'remove', v }
  yield* siftDown(a, 0, a.length, kind)
}

/** Floyd's bottom-up heap construction: sift down every parent, last one first. O(n). */
export function* heapify(a: number[], kind: HeapKind): Generator<HeapStep> {
  for (let i = (a.length >> 1) - 1; i >= 0; i--) {
    yield { kind: 'focus', i }
    yield* siftDown(a, i, a.length, kind)
  }
}

/** Heap sort in place: a max-heap gives ascending order, a min-heap descending. */
export function* heapSort(a: number[], kind: HeapKind): Generator<HeapStep> {
  yield* heapify(a, kind)
  for (let end = a.length - 1; end > 0; end--) {
    sw(a, 0, end)
    yield { kind: 'swap', i: 0, j: end }
    yield { kind: 'sorted', i: end }
    yield* siftDown(a, 0, end, kind)
  }
  if (a.length) yield { kind: 'sorted', i: 0 }
}

export function isHeap(a: readonly number[], kind: HeapKind, size = a.length): boolean {
  for (let i = 1; i < size; i++) if (above(kind, a[i], a[(i - 1) >> 1])) return false
  return true
}

/** Runs an operation to the end, returning its comparison and swap counts. */
export function run(g: Generator<HeapStep>): { compares: number; swaps: number } {
  let compares = 0
  let swaps = 0
  for (let r = g.next(); !r.done; r = g.next()) {
    if (r.value.kind === 'compare') compares++
    if (r.value.kind === 'swap') swaps++
  }
  return { compares, swaps }
}

/** Levels below the root in a complete tree of n items. */
export const heapHeight = (n: number) => (n > 0 ? Math.floor(Math.log2(n)) : 0)
