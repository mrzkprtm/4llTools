import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { Tool, ToolMeta } from './types'

// Every folder in src/tools that has a meta.ts and a Tool.tsx becomes a tool.
// The folder name is the URL slug, so adding a tool never touches this file.
const metas = import.meta.glob<ToolMeta>('./*/meta.ts', { eager: true, import: 'meta' })
const components = import.meta.glob<{ default: ComponentType }>('./*/Tool.tsx')

const slugOf = (path: string) => path.split('/')[1]

export const tools: Tool[] = Object.entries(metas)
  .map(([path, meta]) => ({ ...meta, slug: slugOf(path) }))
  .sort((a, b) => a.name.localeCompare(b.name))

const loaded = new Map<string, LazyExoticComponent<ComponentType>>()

export function getTool(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug)
}

export function getToolComponent(slug: string): LazyExoticComponent<ComponentType> | undefined {
  const loader = components[`./${slug}/Tool.tsx`]
  if (!loader) return undefined
  if (!loaded.has(slug)) loaded.set(slug, lazy(loader))
  return loaded.get(slug)
}

export function searchTools(list: Tool[], query: string): Tool[] {
  const q = query.trim().toLowerCase()
  if (!q) return list
  return list.filter((t) =>
    [t.name, t.description, t.category, ...(t.keywords ?? [])].some((s) => s.toLowerCase().includes(q)),
  )
}
