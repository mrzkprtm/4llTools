/** A fixed-capacity stack (last in, first out). */
export class BoundedStack<T> {
  items: T[] = []
  constructor(public capacity: number) {}

  get size() {
    return this.items.length
  }

  /** Returns false (and changes nothing) when the stack is already full. */
  push(v: T): boolean {
    if (this.items.length >= this.capacity) return false
    this.items.push(v)
    return true
  }

  pop(): T | undefined {
    return this.items.pop()
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1]
  }
}

/**
 * A double-ended queue stored in a circular buffer: `head` is the slot of the
 * front item and the back grows towards `tail` (the next free slot), wrapping
 * round the end of the array. Used as a plain FIFO queue with pushBack/popFront.
 */
export class CircularDeque<T> {
  buf: (T | undefined)[]
  head = 0
  size = 0

  constructor(public capacity: number) {
    this.buf = new Array<T | undefined>(capacity).fill(undefined)
  }

  /** The slot the next pushBack writes to. */
  get tail() {
    return (this.head + this.size) % this.capacity
  }

  isFull() {
    return this.size === this.capacity
  }

  isEmpty() {
    return this.size === 0
  }

  /** Physical buffer slot of the i-th item counted from the front. */
  slot(i: number) {
    return (this.head + i) % this.capacity
  }

  at(i: number): T | undefined {
    return i >= 0 && i < this.size ? this.buf[this.slot(i)] : undefined
  }

  pushBack(v: T): boolean {
    if (this.isFull()) return false
    this.buf[this.tail] = v
    this.size++
    return true
  }

  pushFront(v: T): boolean {
    if (this.isFull()) return false
    this.head = (this.head - 1 + this.capacity) % this.capacity
    this.buf[this.head] = v
    this.size++
    return true
  }

  popFront(): T | undefined {
    if (this.isEmpty()) return undefined
    const v = this.buf[this.head]
    this.buf[this.head] = undefined
    this.head = (this.head + 1) % this.capacity
    this.size--
    return v
  }

  popBack(): T | undefined {
    if (this.isEmpty()) return undefined
    const s = this.slot(this.size - 1)
    const v = this.buf[s]
    this.buf[s] = undefined
    this.size--
    return v
  }

  peekFront(): T | undefined {
    return this.at(0)
  }

  peekBack(): T | undefined {
    return this.at(this.size - 1)
  }

  toArray(): T[] {
    return Array.from({ length: this.size }, (_, i) => this.at(i) as T)
  }
}

export const OPENERS = '([{'
export const CLOSERS = ')]}'
const PAIR: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

export type BracketAction = 'push' | 'pop' | 'skip' | 'mismatch' | 'extra-close' | 'unclosed' | 'balanced'

export interface BracketStep {
  /** Index of the character being read (the expression length for the final verdict). */
  i: number
  action: BracketAction
  /** Stack of [bracket, index] after this step. */
  stack: [string, number][]
  /** For pop / mismatch: index of the opening bracket it was compared with. */
  partner?: number
  message: string
}

/**
 * Checks bracket balance one character at a time with a stack, yielding a step for
 * every character and one final verdict. Stops at the first error.
 */
export function* bracketSteps(expr: string): Generator<BracketStep> {
  const stack: [string, number][] = []
  const snap = () => stack.map((e) => [...e] as [string, number])
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (OPENERS.includes(ch)) {
      stack.push([ch, i])
      yield { i, action: 'push', stack: snap(), message: `'${ch}' opens: push it` }
    } else if (CLOSERS.includes(ch)) {
      const top = stack.pop()
      if (!top) {
        yield { i, action: 'extra-close', stack: snap(), message: `'${ch}' has nothing to close: unbalanced` }
        return
      }
      if (top[0] !== PAIR[ch]) {
        yield { i, action: 'mismatch', stack: snap(), partner: top[1], message: `'${ch}' does not match '${top[0]}': unbalanced` }
        return
      }
      yield { i, action: 'pop', stack: snap(), partner: top[1], message: `'${ch}' matches '${top[0]}': pop it` }
    } else {
      yield { i, action: 'skip', stack: snap(), message: `'${ch}' is not a bracket` }
    }
  }
  if (stack.length) yield { i: expr.length, action: 'unclosed', stack: snap(), message: `${stack.length} bracket${stack.length > 1 ? 's' : ''} never closed: unbalanced` }
  else yield { i: expr.length, action: 'balanced', stack: [], message: 'Stack is empty at the end: balanced' }
}

/** Runs the bracket checker to the end. `index` is where it failed (-1 when balanced). */
export function checkBrackets(expr: string): { ok: boolean; index: number; action: BracketAction } {
  let last: BracketStep | undefined
  for (const s of bracketSteps(expr)) last = s
  if (!last) return { ok: true, index: -1, action: 'balanced' }
  const ok = last.action === 'balanced'
  return { ok, index: ok ? -1 : last.action === 'unclosed' ? last.stack[last.stack.length - 1][1] : last.i, action: last.action }
}

/** Deepest nesting of opening brackets, ignoring whether they match. */
export function maxDepth(expr: string): number {
  let d = 0
  let best = 0
  for (const ch of expr) {
    if (OPENERS.includes(ch)) best = Math.max(best, ++d)
    else if (CLOSERS.includes(ch)) d = Math.max(0, d - 1)
  }
  return best
}
