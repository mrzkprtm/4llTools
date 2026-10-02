/**
 * Sorting algorithms written as generators. Each one sorts the array in place and
 * yields an event after every elementary operation, so a caller can run it a few
 * steps per animation frame:
 *   { compare: [i, j] }  two slots are compared
 *   { swap: [i, j] }     two slots were just swapped
 *   { set: [i, v] }      slot i was just overwritten with v (merge, radix, counting)
 *   { read: i }          slot i was read without comparing (radix, counting)
 *   { sorted: i }        slot i now holds its final value
 */

export type SortEvent = { compare: [number, number] } | { swap: [number, number] } | { set: [number, number] } | { read: number } | { sorted: number }
export type SortGen = Generator<SortEvent, void, undefined>

function sw(a: number[], i: number, j: number) {
  const t = a[i]
  a[i] = a[j]
  a[j] = t
}

export function* bubbleSort(a: number[]): SortGen {
  const n = a.length
  for (let end = n - 1; end > 0; end--) {
    let swapped = false
    for (let i = 0; i < end; i++) {
      yield { compare: [i, i + 1] }
      if (a[i] > a[i + 1]) {
        sw(a, i, i + 1)
        swapped = true
        yield { swap: [i, i + 1] }
      }
    }
    yield { sorted: end }
    if (!swapped) {
      for (let k = end - 1; k >= 0; k--) yield { sorted: k }
      return
    }
  }
  if (n) yield { sorted: 0 }
}

export function* cocktailSort(a: number[]): SortGen {
  let lo = 0
  let hi = a.length - 1
  while (lo < hi) {
    let last = lo
    for (let i = lo; i < hi; i++) {
      yield { compare: [i, i + 1] }
      if (a[i] > a[i + 1]) {
        sw(a, i, i + 1)
        last = i
        yield { swap: [i, i + 1] }
      }
    }
    for (let k = hi; k > last; k--) yield { sorted: k }
    hi = last
    let first = hi
    for (let i = hi; i > lo; i--) {
      yield { compare: [i - 1, i] }
      if (a[i - 1] > a[i]) {
        sw(a, i - 1, i)
        first = i
        yield { swap: [i - 1, i] }
      }
    }
    for (let k = lo; k < first; k++) yield { sorted: k }
    lo = first
  }
  for (let k = lo; k <= hi; k++) yield { sorted: k }
}

export function* selectionSort(a: number[]): SortGen {
  const n = a.length
  for (let i = 0; i < n - 1; i++) {
    let min = i
    for (let j = i + 1; j < n; j++) {
      yield { compare: [min, j] }
      if (a[j] < a[min]) min = j
    }
    if (min !== i) {
      sw(a, i, min)
      yield { swap: [i, min] }
    }
    yield { sorted: i }
  }
  if (n) yield { sorted: n - 1 }
}

export function* insertionSort(a: number[]): SortGen {
  for (let i = 1; i < a.length; i++) {
    for (let j = i; j > 0; j--) {
      yield { compare: [j - 1, j] }
      if (a[j - 1] <= a[j]) break
      sw(a, j - 1, j)
      yield { swap: [j - 1, j] }
    }
  }
}

export function* gnomeSort(a: number[]): SortGen {
  let i = 0
  while (i < a.length) {
    if (i === 0) {
      i++
      continue
    }
    yield { compare: [i - 1, i] }
    if (a[i - 1] <= a[i]) i++
    else {
      sw(a, i - 1, i)
      yield { swap: [i - 1, i] }
      i--
    }
  }
}

export function* combSort(a: number[]): SortGen {
  let gap = a.length
  let done = false
  while (!done) {
    gap = Math.floor(gap / 1.3)
    if (gap <= 1) {
      gap = 1
      done = true
    }
    for (let i = 0; i + gap < a.length; i++) {
      yield { compare: [i, i + gap] }
      if (a[i] > a[i + gap]) {
        sw(a, i, i + gap)
        done = false
        yield { swap: [i, i + gap] }
      }
    }
  }
}

export function* shellSort(a: number[]): SortGen {
  // Knuth's gaps 1, 4, 13, 40, 121, …
  let gap = 1
  while (gap * 3 + 1 < a.length) gap = gap * 3 + 1
  for (; gap >= 1; gap = (gap - 1) / 3) {
    for (let i = gap; i < a.length; i++) {
      for (let j = i; j >= gap; j -= gap) {
        yield { compare: [j - gap, j] }
        if (a[j - gap] <= a[j]) break
        sw(a, j - gap, j)
        yield { swap: [j - gap, j] }
      }
    }
  }
}

export function* mergeSort(a: number[]): SortGen {
  const aux = a.slice()
  function* rec(lo: number, hi: number): SortGen {
    if (hi <= lo) return
    const mid = (lo + hi) >> 1
    yield* rec(lo, mid)
    yield* rec(mid + 1, hi)
    yield { compare: [mid, mid + 1] }
    if (a[mid] <= a[mid + 1]) return // already in order
    for (let k = lo; k <= hi; k++) aux[k] = a[k]
    let i = lo
    let j = mid + 1
    for (let k = lo; k <= hi; k++) {
      let v: number
      if (i > mid) v = aux[j++]
      else if (j > hi) v = aux[i++]
      else {
        yield { compare: [i, j] }
        v = aux[j] < aux[i] ? aux[j++] : aux[i++]
      }
      a[k] = v
      yield { set: [k, v] }
    }
  }
  yield* rec(0, a.length - 1)
}

export function* quickSort(a: number[]): SortGen {
  // Lomuto partition with the middle element as pivot.
  function* rec(lo: number, hi: number): SortGen {
    if (lo > hi) return
    if (lo === hi) {
      yield { sorted: lo }
      return
    }
    const mid = (lo + hi) >> 1
    if (mid !== hi) {
      sw(a, mid, hi)
      yield { swap: [mid, hi] }
    }
    const p = a[hi]
    let i = lo
    for (let j = lo; j < hi; j++) {
      yield { compare: [j, hi] }
      if (a[j] < p) {
        if (i !== j) {
          sw(a, i, j)
          yield { swap: [i, j] }
        }
        i++
      }
    }
    if (i !== hi) {
      sw(a, i, hi)
      yield { swap: [i, hi] }
    }
    yield { sorted: i }
    yield* rec(lo, i - 1)
    yield* rec(i + 1, hi)
  }
  yield* rec(0, a.length - 1)
}

export function* heapSort(a: number[]): SortGen {
  const n = a.length
  function* sift(i: number, size: number): SortGen {
    for (;;) {
      const l = 2 * i + 1
      if (l >= size) return
      let c = l
      if (l + 1 < size) {
        yield { compare: [l, l + 1] }
        if (a[l + 1] > a[l]) c = l + 1
      }
      yield { compare: [i, c] }
      if (a[c] <= a[i]) return
      sw(a, i, c)
      yield { swap: [i, c] }
      i = c
    }
  }
  for (let i = (n >> 1) - 1; i >= 0; i--) yield* sift(i, n)
  for (let end = n - 1; end > 0; end--) {
    sw(a, 0, end)
    yield { swap: [0, end] }
    yield { sorted: end }
    yield* sift(0, end)
  }
  if (n) yield { sorted: 0 }
}

/** Least-significant-digit radix sort in base 10 (non-negative integers). */
export function* radixSort(a: number[]): SortGen {
  let max = 0
  for (let i = 0; i < a.length; i++) {
    yield { read: i }
    max = Math.max(max, a[i])
  }
  const out = new Array<number>(a.length)
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    const count = new Array<number>(10).fill(0)
    for (let i = 0; i < a.length; i++) {
      yield { read: i }
      count[Math.floor(a[i] / exp) % 10]++
    }
    for (let d = 1; d < 10; d++) count[d] += count[d - 1]
    for (let i = a.length - 1; i >= 0; i--) out[--count[Math.floor(a[i] / exp) % 10]] = a[i]
    for (let i = 0; i < a.length; i++) {
      a[i] = out[i]
      yield { set: [i, out[i]] }
    }
  }
}

/** Counting sort for small non-negative integers. */
export function* countingSort(a: number[]): SortGen {
  let max = 0
  for (let i = 0; i < a.length; i++) {
    yield { read: i }
    max = Math.max(max, a[i])
  }
  const count = new Array<number>(max + 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    yield { read: i }
    count[a[i]]++
  }
  let k = 0
  for (let v = 0; v <= max; v++)
    for (let c = 0; c < count[v]; c++) {
      a[k] = v
      yield { set: [k, v] }
      yield { sorted: k }
      k++
    }
}

export type SortId = 'bubble' | 'cocktail' | 'selection' | 'insertion' | 'gnome' | 'comb' | 'shell' | 'merge' | 'quick' | 'heap' | 'radix' | 'counting'

export interface SortInfo {
  id: SortId
  name: string
  short: string
  fn: (a: number[]) => SortGen
  best: string
  avg: string
  worst: string
  space: string
}

export const SORTS: SortInfo[] = [
  { id: 'bubble', name: 'Bubble sort', short: 'Bubble', fn: bubbleSort, best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  { id: 'cocktail', name: 'Cocktail shaker', short: 'Cocktail', fn: cocktailSort, best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  { id: 'selection', name: 'Selection sort', short: 'Selection', fn: selectionSort, best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  { id: 'insertion', name: 'Insertion sort', short: 'Insertion', fn: insertionSort, best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  { id: 'gnome', name: 'Gnome sort', short: 'Gnome', fn: gnomeSort, best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  { id: 'comb', name: 'Comb sort', short: 'Comb', fn: combSort, best: 'O(n log n)', avg: 'O(n²/2ᵖ)', worst: 'O(n²)', space: 'O(1)' },
  { id: 'shell', name: 'Shell sort', short: 'Shell', fn: shellSort, best: 'O(n log n)', avg: '≈O(n^1.25)', worst: 'O(n^1.5)', space: 'O(1)' },
  { id: 'merge', name: 'Merge sort', short: 'Merge', fn: mergeSort, best: 'O(n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)' },
  { id: 'quick', name: 'Quicksort', short: 'Quick', fn: quickSort, best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)' },
  { id: 'heap', name: 'Heap sort', short: 'Heap', fn: heapSort, best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)' },
  { id: 'radix', name: 'Radix sort (LSD)', short: 'Radix', fn: radixSort, best: 'O(d·n)', avg: 'O(d·n)', worst: 'O(d·n)', space: 'O(n + 10)' },
  { id: 'counting', name: 'Counting sort', short: 'Counting', fn: countingSort, best: 'O(n + k)', avg: 'O(n + k)', worst: 'O(n + k)', space: 'O(k)' },
]

export const sortInfo = (id: SortId) => SORTS.find((s) => s.id === id) ?? SORTS[0]

export type Pattern = 'random' | 'nearly' | 'reversed' | 'few'

/** Values 1…n arranged in the given pattern. */
export function makeData(n: number, pattern: Pattern, random: () => number = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i + 1)
  if (pattern === 'reversed') return a.reverse()
  if (pattern === 'few') return a.map(() => Math.ceil(n / 4) * (1 + Math.floor(random() * 4)))
  if (pattern === 'nearly') {
    if (n < 2) return a
    for (let k = 0; k < Math.max(1, Math.round(n / 16)); k++) {
      const i = Math.floor(random() * n)
      const j = Math.min(n - 1, i + 1 + Math.floor(random() * 4))
      sw(a, i, j)
    }
    return a
  }
  for (let i = n - 1; i > 0; i--) sw(a, i, Math.floor(random() * (i + 1)))
  return a
}

/** A sort in progress: the live array, its generator and running tallies. */
export interface SortRun {
  a: number[]
  gen: SortGen
  done: boolean
  steps: number
  compares: number
  swaps: number
  writes: number
  sorted: Uint8Array
  /** Highlight intensities (0–1) for compared and moved slots, decayed by the caller. */
  hotCompare: Float32Array
  hotMove: Float32Array
  /** Index touched by the most recent event (for sound). */
  last: number
}

export function createRun(id: SortId, data: number[]): SortRun {
  const a = data.slice()
  const n = a.length
  return { a, gen: sortInfo(id).fn(a), done: false, steps: 0, compares: 0, swaps: 0, writes: 0, sorted: new Uint8Array(n), hotCompare: new Float32Array(n), hotMove: new Float32Array(n), last: -1 }
}

/** Runs up to `budget` work steps (compares, swaps, writes, reads). `sorted` markers are free. */
export function advance(run: SortRun, budget: number): void {
  while (budget > 0 && !run.done) {
    const r = run.gen.next()
    if (r.done) {
      run.done = true
      break
    }
    const e = r.value
    if ('sorted' in e) {
      run.sorted[e.sorted] = 1
      continue
    }
    run.steps++
    budget--
    if ('compare' in e) {
      run.compares++
      run.hotCompare[e.compare[0]] = 1
      run.hotCompare[e.compare[1]] = 1
      run.last = e.compare[1]
    } else if ('swap' in e) {
      run.swaps++
      run.writes += 2
      run.hotMove[e.swap[0]] = 1
      run.hotMove[e.swap[1]] = 1
      run.last = e.swap[0]
    } else if ('set' in e) {
      run.writes++
      run.hotMove[e.set[0]] = 1
      run.last = e.set[0]
    } else {
      run.hotCompare[e.read] = 0.6
      run.last = e.read
    }
  }
}

/** Total work steps a sort needs to finish on this data. */
export function stepsToFinish(id: SortId, data: number[]): number {
  const run = createRun(id, data)
  while (!run.done) advance(run, 1e6)
  return run.steps
}
