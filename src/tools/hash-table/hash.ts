/**
 * A hash table with separate chaining or open addressing (linear, quadratic or double
 * hashing, with tombstones for deletes). Operations are generators that yield each
 * hash, probe and placement so the tool can animate them.
 */

export type HashFn = 'sum' | 'djb2' | 'fnv'
export type Strategy = 'chaining' | 'linear' | 'quadratic' | 'double'

export function hashString(key: string, fn: HashFn): number {
  if (fn === 'sum') {
    let h = 0
    for (let i = 0; i < key.length; i++) h += key.charCodeAt(i)
    return h
  }
  if (fn === 'djb2') {
    let h = 5381
    for (let i = 0; i < key.length; i++) h = (Math.imul(h, 33) + key.charCodeAt(i)) >>> 0
    return h
  }
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

export function isPrime(n: number): boolean {
  if (n < 2) return false
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false
  return true
}

export function nextPrime(n: number): number {
  while (!isPrime(n)) n++
  return n
}

export interface Table {
  m: number
  fn: HashFn
  strategy: Strategy
  slots: (string | null)[]
  tomb: boolean[]
  chains: string[][]
  size: number
  tombs: number
  collisions: number
  probes: number
  inserts: number
}

export type HashStep =
  | { kind: 'hash'; key: string; h: number; index: number; step: number }
  | { kind: 'probe'; index: number; i: number; state: 'empty' | 'tomb' | 'match' | 'occupied' }
  | { kind: 'chain'; index: number; pos: number; match: boolean }
  | { kind: 'place'; index: number; pos: number; key: string }
  | { kind: 'found'; index: number; pos: number }
  | { kind: 'missing'; key: string }
  | { kind: 'exists'; index: number; pos: number }
  | { kind: 'delete'; index: number; pos: number; key: string }
  | { kind: 'resize'; from: number; to: number }

export function makeTable(m: number, fn: HashFn, strategy: Strategy): Table {
  return { m, fn, strategy, slots: new Array(m).fill(null), tomb: new Array(m).fill(false), chains: Array.from({ length: m }, () => []), size: 0, tombs: 0, collisions: 0, probes: 0, inserts: 0 }
}

/** Double hashing step: 1 + (⌊h / m⌋ mod (m − 1)), never zero. */
export const stepOf = (h: number, m: number) => (m > 1 ? 1 + (Math.floor(h / m) % (m - 1)) : 1)

/** The i-th slot to try for hash h. */
export function probeAt(t: Table, h: number, i: number): number {
  const base = h % t.m
  if (t.strategy === 'quadratic') return (base + i * i) % t.m
  if (t.strategy === 'double') return (base + i * stepOf(h, t.m)) % t.m
  return (base + i) % t.m
}

export const loadFactor = (t: Table) => t.size / t.m

/** All stored keys, bucket by bucket. */
export function keysOf(t: Table): string[] {
  return t.strategy === 'chaining' ? t.chains.flat() : (t.slots.filter((s) => s !== null) as string[])
}

function* hashStep(t: Table, key: string): Generator<HashStep, number> {
  const h = hashString(key, t.fn)
  yield { kind: 'hash', key, h, index: h % t.m, step: stepOf(h, t.m) }
  return h
}

/** Rebuilds the table with m buckets, re-inserting every key (animated). */
export function* resize(t: Table, m: number): Generator<HashStep> {
  const keys = keysOf(t)
  yield { kind: 'resize', from: t.m, to: m }
  const fresh = makeTable(m, t.fn, t.strategy)
  // Rehashing is bookkeeping, not new inserts: keep the counters as they were.
  const { collisions, probes, inserts } = t
  Object.assign(t, { m, slots: fresh.slots, tomb: fresh.tomb, chains: fresh.chains, size: 0, tombs: 0 })
  for (const k of keys) yield* insert(t, k, Infinity)
  Object.assign(t, { collisions, probes, inserts })
}

/**
 * Inserts a key. If the load factor would pass `maxLoad`, the table first grows to the
 * next prime at least twice as big. Returns false when the key was already there.
 */
export function* insert(t: Table, key: string, maxLoad = 0.75): Generator<HashStep, boolean> {
  if ((t.size + 1) / t.m > maxLoad && t.m < 400) yield* resize(t, nextPrime(t.m * 2))
  const h = yield* hashStep(t, key)
  const index = h % t.m
  t.inserts++
  if (t.strategy === 'chaining') {
    const chain = t.chains[index]
    t.probes++
    for (let pos = 0; pos < chain.length; pos++) {
      const match = chain[pos] === key
      t.probes++
      yield { kind: 'chain', index, pos, match }
      if (match) {
        yield { kind: 'exists', index, pos }
        return false
      }
    }
    if (chain.length) t.collisions++
    chain.push(key)
    t.size++
    yield { kind: 'place', index, pos: chain.length - 1, key }
    return true
  }
  let firstTomb = -1
  for (let i = 0; i < t.m; i++) {
    const idx = probeAt(t, h, i)
    const slot = t.slots[idx]
    t.probes++
    if (slot === null && !t.tomb[idx]) {
      yield { kind: 'probe', index: idx, i, state: 'empty' }
      const at = firstTomb >= 0 ? firstTomb : idx
      if (t.tomb[at]) {
        t.tomb[at] = false
        t.tombs--
      }
      t.slots[at] = key
      t.size++
      yield { kind: 'place', index: at, pos: 0, key }
      return true
    }
    if (slot === null) {
      yield { kind: 'probe', index: idx, i, state: 'tomb' }
      if (firstTomb < 0) firstTomb = idx
      continue
    }
    if (slot === key) {
      yield { kind: 'probe', index: idx, i, state: 'match' }
      yield { kind: 'exists', index: idx, pos: 0 }
      return false
    }
    t.collisions++
    yield { kind: 'probe', index: idx, i, state: 'occupied' }
  }
  if (firstTomb >= 0) {
    t.tomb[firstTomb] = false
    t.tombs--
    t.slots[firstTomb] = key
    t.size++
    yield { kind: 'place', index: firstTomb, pos: 0, key }
    return true
  }
  // The probe sequence found no free slot (full table, or a sequence that skips slots): grow and retry.
  yield* resize(t, nextPrime(t.m * 2))
  return yield* insert(t, key, Infinity)
}

/** Finds a key: returns [bucket, position in chain] or null. */
export function* search(t: Table, key: string): Generator<HashStep, [number, number] | null> {
  const h = yield* hashStep(t, key)
  const index = h % t.m
  if (t.strategy === 'chaining') {
    const chain = t.chains[index]
    for (let pos = 0; pos < chain.length; pos++) {
      const match = chain[pos] === key
      yield { kind: 'chain', index, pos, match }
      if (match) {
        yield { kind: 'found', index, pos }
        return [index, pos]
      }
    }
    yield { kind: 'missing', key }
    return null
  }
  for (let i = 0; i < t.m; i++) {
    const idx = probeAt(t, h, i)
    const slot = t.slots[idx]
    if (slot === null && !t.tomb[idx]) {
      yield { kind: 'probe', index: idx, i, state: 'empty' }
      break
    }
    if (slot === key) {
      yield { kind: 'probe', index: idx, i, state: 'match' }
      yield { kind: 'found', index: idx, pos: 0 }
      return [idx, 0]
    }
    yield { kind: 'probe', index: idx, i, state: slot === null ? 'tomb' : 'occupied' }
  }
  yield { kind: 'missing', key }
  return null
}

/** Deletes a key. Open addressing leaves a tombstone so later probe sequences are not cut short. */
export function* remove(t: Table, key: string): Generator<HashStep, boolean> {
  const at = yield* search(t, key)
  if (!at) return false
  const [index, pos] = at
  if (t.strategy === 'chaining') t.chains[index].splice(pos, 1)
  else {
    t.slots[index] = null
    t.tomb[index] = true
    t.tombs++
  }
  t.size--
  yield { kind: 'delete', index, pos, key }
  return true
}

/** Runs an operation to the end and returns its result. */
export function run<R>(g: Generator<HashStep, R>): R {
  for (;;) {
    const r = g.next()
    if (r.done) return r.value
  }
}

/** Builds a table holding `keys` without animation. */
export function build(keys: string[], m: number, fn: HashFn, strategy: Strategy, maxLoad = Infinity): Table {
  const t = makeTable(m, fn, strategy)
  for (const k of keys) run(insert(t, k, maxLoad))
  return t
}

export const WORDS = [
  'apple', 'banana', 'cherry', 'grape', 'lemon', 'mango', 'melon', 'peach', 'pear', 'plum',
  'kiwi', 'lime', 'fig', 'date', 'guava', 'papaya', 'otter', 'tiger', 'zebra', 'panda',
  'koala', 'llama', 'moose', 'eagle', 'raven', 'shark', 'whale', 'gecko', 'bison', 'camel',
  'red', 'blue', 'green', 'amber', 'coral', 'ivory', 'olive', 'plaza', 'river', 'cloud',
  'stone', 'maple', 'cedar', 'pine', 'oak', 'birch', 'comet', 'orbit', 'pixel', 'robot',
  'tea', 'cake', 'bread', 'rice', 'soup', 'salt', 'honey', 'jam', 'nut', 'bean',
]
