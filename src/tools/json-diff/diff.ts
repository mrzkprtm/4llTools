/** Structural JSON diff with JSON Patch (RFC 6902) export. */

export type Change =
  | { op: 'add'; path: string[]; value: unknown }
  | { op: 'remove'; path: string[]; oldValue: unknown }
  | { op: 'replace'; path: string[]; oldValue: unknown; value: unknown }

export interface DiffOptions {
  /** Compare arrays as multisets: [1,2] equals [2,1]. */
  ignoreArrayOrder?: boolean
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

export function deepEqual(a: unknown, b: unknown, ignoreArrayOrder = false): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    if (!ignoreArrayOrder) return a.every((v, i) => deepEqual(v, b[i]))
    const used = new Array<boolean>(b.length).fill(false)
    return a.every((v) => {
      const j = b.findIndex((w, k) => !used[k] && deepEqual(v, w, true))
      if (j < 0) return false
      used[j] = true
      return true
    })
  }
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a)
    if (ka.length !== Object.keys(b).length) return false
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k], ignoreArrayOrder))
  }
  return false
}

export function diff(a: unknown, b: unknown, opts: DiffOptions = {}): Change[] {
  const out: Change[] = []
  walk(a, b, [], out, !!opts.ignoreArrayOrder)
  return out
}

function walk(a: unknown, b: unknown, path: string[], out: Change[], unordered: boolean) {
  if (deepEqual(a, b, unordered)) return
  if (isObj(a) && isObj(b)) {
    for (const k of Object.keys(a)) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) out.push({ op: 'remove', path: [...path, k], oldValue: a[k] })
      else walk(a[k], b[k], [...path, k], out, unordered)
    }
    for (const k of Object.keys(b)) if (!Object.prototype.hasOwnProperty.call(a, k)) out.push({ op: 'add', path: [...path, k], value: b[k] })
    return
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (unordered) {
      const used = new Array<boolean>(b.length).fill(false)
      const removed: number[] = []
      a.forEach((v, i) => {
        const j = b.findIndex((w, k) => !used[k] && deepEqual(v, w, true))
        if (j < 0) removed.push(i)
        else used[j] = true
      })
      // Removals from the end first so each index is still valid when applied as a patch.
      for (const i of removed.reverse()) out.push({ op: 'remove', path: [...path, String(i)], oldValue: a[i] })
      b.forEach((w, k) => {
        if (!used[k]) out.push({ op: 'add', path: [...path, '-'], value: w })
      })
      return
    }
    const common = Math.min(a.length, b.length)
    for (let i = 0; i < common; i++) walk(a[i], b[i], [...path, String(i)], out, unordered)
    for (let i = a.length - 1; i >= common; i--) out.push({ op: 'remove', path: [...path, String(i)], oldValue: a[i] })
    for (let i = common; i < b.length; i++) out.push({ op: 'add', path: [...path, String(i)], value: b[i] })
    return
  }
  out.push({ op: 'replace', path, oldValue: a, value: b })
}

/** RFC 6901 pointer: "/a~1b/0" for ["a/b", "0"]. */
export function toPointer(path: string[]): string {
  return path.map((p) => '/' + p.replace(/~/g, '~0').replace(/\//g, '~1')).join('')
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** Human-readable path: $.users[0]["first name"] */
export function toDisplayPath(path: string[], arrayIndexes: boolean[] = []): string {
  let s = '$'
  path.forEach((p, i) => {
    if (p === '-') s += '[+]'
    else if (arrayIndexes[i] ?? /^\d+$/.test(p)) s += `[${p}]`
    else if (IDENT.test(p)) s += `.${p}`
    else s += `[${JSON.stringify(p)}]`
  })
  return s
}

export type PatchOp = { op: 'add'; path: string; value: unknown } | { op: 'remove'; path: string } | { op: 'replace'; path: string; value: unknown }

export function toPatch(changes: Change[]): PatchOp[] {
  return changes.map((c) => {
    const path = toPointer(c.path)
    if (c.op === 'remove') return { op: 'remove', path }
    return { op: c.op, path, value: c.value }
  })
}

export function summarize(changes: Change[]) {
  const s = { add: 0, remove: 0, replace: 0 }
  for (const c of changes) s[c.op]++
  return s
}

/** Applies a JSON Patch (add/remove/replace only). Used to prove the patch round-trips. */
export function applyPatch(doc: unknown, patch: PatchOp[]): unknown {
  let root = structuredClone(doc)
  for (const op of patch) {
    const parts = op.path === '' ? [] : op.path.slice(1).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
    if (parts.length === 0) {
      if (op.op === 'remove') root = undefined
      else root = structuredClone(op.value)
      continue
    }
    let parent = root as Obj | unknown[]
    for (const p of parts.slice(0, -1)) parent = (parent as Obj)[p] as Obj | unknown[]
    const last = parts[parts.length - 1]
    if (Array.isArray(parent)) {
      const i = last === '-' ? parent.length : Number(last)
      if (op.op === 'add') parent.splice(i, 0, structuredClone(op.value))
      else if (op.op === 'remove') parent.splice(i, 1)
      else parent[i] = structuredClone(op.value)
    } else {
      if (op.op === 'remove') delete parent[last]
      else parent[last] = structuredClone(op.value)
    }
  }
  return root
}
