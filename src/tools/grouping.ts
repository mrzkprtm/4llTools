import type { Tool } from './types'

/** Groups tools by category, with categories and tools in alphabetical order. */
export function groupByCategory(list: Tool[]): [string, Tool[]][] {
  const groups = new Map<string, Tool[]>()
  for (const t of list) groups.set(t.category, [...(groups.get(t.category) ?? []), t])
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}
