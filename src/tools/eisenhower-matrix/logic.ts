/** Pure helpers for the Eisenhower matrix. Tasks live in one list; order within a quadrant is list order. */

export type Quadrant = 'inbox' | 'do' | 'schedule' | 'delegate' | 'delete'

export interface Task {
  id: string
  text: string
  q: Quadrant
  done: boolean
}

export const QUADRANTS = [
  { id: 'do', title: 'Do', sub: 'Urgent & important', color: '#e03131' },
  { id: 'schedule', title: 'Schedule', sub: 'Important, not urgent', color: '#1c7ed6' },
  { id: 'delegate', title: 'Delegate', sub: 'Urgent, not important', color: '#f59f00' },
  { id: 'delete', title: 'Delete', sub: 'Neither', color: '#868e96' },
] as const

export function quadrantOf(urgent: boolean, important: boolean): Exclude<Quadrant, 'inbox'> {
  if (important) return urgent ? 'do' : 'schedule'
  return urgent ? 'delegate' : 'delete'
}

export function flagsOf(q: Quadrant): { urgent: boolean; important: boolean } | null {
  if (q === 'inbox') return null
  return { urgent: q === 'do' || q === 'delegate', important: q === 'do' || q === 'schedule' }
}

/**
 * Moves a task into quadrant `to` at position `index` among that quadrant's
 * other tasks (clamped). Returns a new list; unknown ids leave it unchanged.
 */
export function moveTask(tasks: Task[], id: string, to: Quadrant, index: number): Task[] {
  const task = tasks.find((t) => t.id === id)
  if (!task) return tasks
  const rest = tasks.filter((t) => t.id !== id)
  const inQ = rest.filter((t) => t.q === to)
  const i = Math.max(0, Math.min(inQ.length, Math.round(index)))
  const moved = { ...task, q: to }
  if (i < inQ.length) {
    const at = rest.indexOf(inQ[i])
    return [...rest.slice(0, at), moved, ...rest.slice(at)]
  }
  const last = inQ.length ? rest.indexOf(inQ[inQ.length - 1]) + 1 : rest.length
  return [...rest.slice(0, last), moved, ...rest.slice(last)]
}

export function counts(tasks: Task[]): Record<Quadrant, { open: number; done: number }> {
  const out = { inbox: { open: 0, done: 0 }, do: { open: 0, done: 0 }, schedule: { open: 0, done: 0 }, delegate: { open: 0, done: 0 }, delete: { open: 0, done: 0 } }
  for (const t of tasks) out[t.q][t.done ? 'done' : 'open']++
  return out
}
