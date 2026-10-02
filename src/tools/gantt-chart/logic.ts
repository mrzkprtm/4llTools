/** Scheduling for the Gantt chart: finish→start dependencies, propagation and cycle checks. */

export interface Task {
  id: number
  name: string
  /** Start, in whole days after the project start. */
  start: number
  /** Length in days (at least 1). */
  duration: number
  /** 0–100. */
  progress: number
  color: string
  /** Ids of tasks that must finish before this one starts. */
  deps: number[]
}

export const end = (t: Pick<Task, 'start' | 'duration'>) => t.start + t.duration

/**
 * Returns the ids of one dependency cycle, or null if the graph is acyclic.
 * Missing predecessor ids are ignored.
 */
export function findCycle(tasks: readonly Task[]): number[] | null {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const state = new Map<number, 1 | 2>()
  const stack: number[] = []
  const visit = (id: number): number[] | null => {
    state.set(id, 1)
    stack.push(id)
    for (const d of byId.get(id)?.deps ?? []) {
      if (!byId.has(d)) continue
      const s = state.get(d)
      if (s === 1) return stack.slice(stack.indexOf(d))
      if (!s) {
        const c = visit(d)
        if (c) return c
      }
    }
    stack.pop()
    state.set(id, 2)
    return null
  }
  for (const t of tasks) if (!state.has(t.id)) {
    const c = visit(t.id)
    if (c) return c
  }
  return null
}

/** True when making `task` depend on `pred` would create a loop. */
export function wouldCycle(tasks: readonly Task[], task: number, pred: number): boolean {
  if (task === pred) return true
  const next = tasks.map((t) => (t.id === task ? { ...t, deps: [...t.deps.filter((d) => d !== pred), pred] } : t))
  return findCycle(next) !== null
}

/**
 * Pushes every task so it starts no earlier than all its predecessors finish.
 * Tasks are only ever moved later, never pulled earlier. Tasks caught in a
 * cycle are left where they are.
 */
export function schedule(tasks: readonly Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, { ...t, start: Math.max(0, Math.round(t.start)), duration: Math.max(1, Math.round(t.duration)) }]))
  const indeg = new Map<number, number>()
  const succ = new Map<number, number[]>()
  for (const t of byId.values()) {
    const deps = t.deps.filter((d) => byId.has(d))
    indeg.set(t.id, deps.length)
    for (const d of deps) succ.set(d, [...(succ.get(d) ?? []), t.id])
  }
  const queue = [...byId.values()].filter((t) => indeg.get(t.id) === 0).map((t) => t.id)
  while (queue.length) {
    const id = queue.shift()!
    const t = byId.get(id)!
    for (const s of succ.get(id) ?? []) {
      const st = byId.get(s)!
      if (st.start < end(t)) st.start = end(t)
      indeg.set(s, indeg.get(s)! - 1)
      if (indeg.get(s) === 0) queue.push(s)
    }
  }
  return tasks.map((t) => byId.get(t.id)!)
}

/** Whole days from ISO date `a` to ISO date `b`. */
export function daysBetween(a: string, b: string): number {
  const pa = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  const pb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
  return Math.round((pb - pa) / 86400000)
}

/** ISO date `days` after `iso`. */
export function addDays(iso: string, days: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + days))
  return d.toISOString().slice(0, 10)
}
