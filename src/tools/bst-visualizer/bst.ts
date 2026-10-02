/**
 * A binary search tree with optional AVL balancing. Operations are generators that
 * yield one step at a time (each comparison, the insert, every rotation) so the
 * tool can animate them; `apply` runs one to the end instantly.
 */

export interface Node {
  id: number
  key: number
  left: Node | null
  right: Node | null
  parent: Node | null
  /** Levels in this subtree: a leaf has height 1. */
  height: number
}

export interface Tree {
  root: Node | null
  size: number
  nextId: number
}

export type Rotation = 'LL' | 'RR' | 'LR' | 'RL'

export type Step =
  | { kind: 'visit'; node: Node; key: number }
  | { kind: 'found'; node: Node }
  | { kind: 'missing'; key: number }
  | { kind: 'duplicate'; node: Node }
  | { kind: 'insert'; node: Node }
  | { kind: 'copy'; from: Node; to: Node; old: number }
  | { kind: 'remove'; node: Node }
  | { kind: 'rotate'; node: Node; dir: 'left' | 'right'; case: Rotation }
  | { kind: 'trav'; node: Node }

export const emptyTree = (): Tree => ({ root: null, size: 0, nextId: 1 })

const h = (n: Node | null) => (n ? n.height : 0)
export const balanceOf = (n: Node) => h(n.left) - h(n.right)
const update = (n: Node) => {
  n.height = 1 + Math.max(h(n.left), h(n.right))
}

function replaceChild(t: Tree, parent: Node | null, old: Node, next: Node | null) {
  if (!parent) t.root = next
  else if (parent.left === old) parent.left = next
  else parent.right = next
  if (next) next.parent = parent
}

function rotateRight(t: Tree, y: Node): Node {
  const x = y.left!
  y.left = x.right
  if (x.right) x.right.parent = y
  replaceChild(t, y.parent, y, x)
  x.right = y
  y.parent = x
  update(y)
  update(x)
  return x
}

function rotateLeft(t: Tree, x: Node): Node {
  const y = x.right!
  x.right = y.left
  if (y.left) y.left.parent = x
  replaceChild(t, x.parent, x, y)
  y.left = x
  x.parent = y
  update(x)
  update(y)
  return y
}

/** Walks from `start` up to the root, fixing heights and (for AVL) rotating where needed. */
function* rebalance(t: Tree, start: Node | null, avl: boolean): Generator<Step> {
  for (let n = start; n; n = n.parent) {
    update(n)
    if (!avl) continue
    const b = balanceOf(n)
    if (b > 1) {
      const lr = balanceOf(n.left!) < 0
      if (lr) {
        const pivot = n.left!
        rotateLeft(t, pivot)
        yield { kind: 'rotate', node: pivot, dir: 'left', case: 'LR' }
      }
      n = rotateRight(t, n)
      yield { kind: 'rotate', node: n.right!, dir: 'right', case: lr ? 'LR' : 'LL' }
    } else if (b < -1) {
      const rl = balanceOf(n.right!) > 0
      if (rl) {
        const pivot = n.right!
        rotateRight(t, pivot)
        yield { kind: 'rotate', node: pivot, dir: 'right', case: 'RL' }
      }
      n = rotateLeft(t, n)
      yield { kind: 'rotate', node: n.left!, dir: 'left', case: rl ? 'RL' : 'RR' }
    }
  }
}

export function* search(t: Tree, key: number): Generator<Step> {
  let n = t.root
  while (n) {
    yield { kind: 'visit', node: n, key }
    if (key === n.key) {
      yield { kind: 'found', node: n }
      return
    }
    n = key < n.key ? n.left : n.right
  }
  yield { kind: 'missing', key }
}

export function* insert(t: Tree, key: number, avl: boolean): Generator<Step> {
  let parent: Node | null = null
  let n = t.root
  while (n) {
    yield { kind: 'visit', node: n, key }
    if (key === n.key) {
      yield { kind: 'duplicate', node: n }
      return
    }
    parent = n
    n = key < n.key ? n.left : n.right
  }
  const node: Node = { id: t.nextId++, key, left: null, right: null, parent, height: 1 }
  if (!parent) t.root = node
  else if (key < parent.key) parent.left = node
  else parent.right = node
  t.size++
  yield { kind: 'insert', node }
  yield* rebalance(t, parent, avl)
}

export function* remove(t: Tree, key: number, avl: boolean): Generator<Step> {
  let n = t.root
  while (n && n.key !== key) {
    yield { kind: 'visit', node: n, key }
    n = key < n.key ? n.left : n.right
  }
  if (!n) {
    yield { kind: 'missing', key }
    return
  }
  yield { kind: 'found', node: n }
  if (n.left && n.right) {
    // Two children: copy in the in-order successor (leftmost of the right subtree), then remove that node.
    let s = n.right
    yield { kind: 'visit', node: s, key }
    while (s.left) {
      s = s.left
      yield { kind: 'visit', node: s, key }
    }
    const old = n.key
    n.key = s.key
    yield { kind: 'copy', from: s, to: n, old }
    n = s
  }
  const child = n.left ?? n.right
  const parent = n.parent
  replaceChild(t, parent, n, child)
  t.size--
  yield { kind: 'remove', node: n }
  yield* rebalance(t, parent, avl)
}

/** Runs an operation instantly and returns its steps. */
export function apply(g: Generator<Step>): Step[] {
  const out: Step[] = []
  for (let r = g.next(); !r.done; r = g.next()) out.push(r.value)
  return out
}

export function inorder(t: Tree): Node[] {
  const out: Node[] = []
  const rec = (n: Node | null) => {
    if (!n) return
    rec(n.left)
    out.push(n)
    rec(n.right)
  }
  rec(t.root)
  return out
}

export function preorder(t: Tree): Node[] {
  const out: Node[] = []
  const rec = (n: Node | null) => {
    if (!n) return
    out.push(n)
    rec(n.left)
    rec(n.right)
  }
  rec(t.root)
  return out
}

export function postorder(t: Tree): Node[] {
  const out: Node[] = []
  const rec = (n: Node | null) => {
    if (!n) return
    rec(n.left)
    rec(n.right)
    out.push(n)
  }
  rec(t.root)
  return out
}

export function levelorder(t: Tree): Node[] {
  const out: Node[] = []
  const q = t.root ? [t.root] : []
  for (let i = 0; i < q.length; i++) {
    out.push(q[i])
    if (q[i].left) q.push(q[i].left!)
    if (q[i].right) q.push(q[i].right!)
  }
  return out
}

/** Height in edges of the longest root-to-leaf path (−1 for an empty tree). */
export function treeHeight(t: Tree): number {
  const rec = (n: Node | null): number => (n ? 1 + Math.max(rec(n.left), rec(n.right)) : 0)
  return rec(t.root) - 1
}

/** True when every node's subtrees differ in height by at most one. */
export function isBalanced(t: Tree): boolean {
  let ok = true
  const rec = (n: Node | null): number => {
    if (!n) return 0
    const l = rec(n.left)
    const r = rec(n.right)
    if (Math.abs(l - r) > 1) ok = false
    return 1 + Math.max(l, r)
  }
  rec(t.root)
  return ok
}

/** Checks ordering, parent links and stored heights. */
export function isValid(t: Tree): boolean {
  let ok = true
  const rec = (n: Node | null, lo: number, hi: number, parent: Node | null): number => {
    if (!n) return 0
    if (n.key <= lo || n.key >= hi || n.parent !== parent) ok = false
    const height = 1 + Math.max(rec(n.left, lo, n.key, n), rec(n.right, n.key, hi, n))
    if (height !== n.height) ok = false
    return height
  }
  rec(t.root, -Infinity, Infinity, null)
  return ok
}

/** Rebuilds the tree as an AVL tree with the same keys, keeping each key's node id. */
export function rebuildAvl(t: Tree): Tree {
  const ids = new Map(inorder(t).map((n) => [n.key, n.id]))
  const out: Tree = { root: null, size: 0, nextId: t.nextId }
  for (const n of levelorder(t)) apply(insert(out, n.key, true))
  for (const n of inorder(out)) n.id = ids.get(n.key)!
  out.nextId = t.nextId
  return out
}
