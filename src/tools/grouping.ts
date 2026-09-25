import type { Tool } from './types'

/** Groups tools by category, with categories and tools in alphabetical order. */
export function groupByCategory(list: Tool[]): [string, Tool[]][] {
  const groups = new Map<string, Tool[]>()
  for (const t of list) groups.set(t.category, [...(groups.get(t.category) ?? []), t])
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

/** CSS-friendly key for a category, used to pick its colour ("Scan & Code" → "scan-code"). */
export function categoryKey(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
