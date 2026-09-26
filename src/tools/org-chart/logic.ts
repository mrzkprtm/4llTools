/** Org chart data: tree layout, indented-text import and manager cycle checks. */

export interface Person {
  id: number
  name: string
  title: string
  color: string
  /** Id of this person's manager, or null for a top-level person. */
  manager: number | null
}

export interface Placed {
  id: number
  /** Center x in slot units (one leaf = one unit). */
  x: number
  depth: number
  /** Number of direct reports (including hidden ones). */
  reports: number
}

/** Children of each person, in list order. Managers that do not exist count as none. */
export function childrenOf(people: readonly Person[]): Map<number | null, Person[]> {
  const ids = new Set(people.map((p) => p.id))
  const m = new Map<number | null, Person[]>()
  for (const p of people) {
    const key = p.manager !== null && ids.has(p.manager) && p.manager !== p.id ? p.manager : null
    m.set(key, [...(m.get(key) ?? []), p])
  }
  return m
}

/**
 * A simple tidy tree: leaves take one slot each, left to right, and every
 * manager sits centered over their first and last visible report. Children of
 * collapsed people are skipped. Roots are laid out side by side.
 */
export function layout(people: readonly Person[], collapsed: ReadonlySet<number> = new Set()): { nodes: Placed[]; width: number; depth: number } {
  const kids = childrenOf(people)
  const nodes: Placed[] = []
  const seen = new Set<number>()
  let next = 0
  let maxDepth = 0
  const place = (p: Person, depth: number): number => {
    seen.add(p.id)
    maxDepth = Math.max(maxDepth, depth)
    const all = (kids.get(p.id) ?? []).filter((c) => !seen.has(c.id))
    const shown = collapsed.has(p.id) ? [] : all
    let x: number
    if (!shown.length) x = next++
    else {
      const xs = shown.map((c) => place(c, depth + 1))
      x = (xs[0] + xs[xs.length - 1]) / 2
    }
    nodes.push({ id: p.id, x, depth, reports: all.length })
    return x
  }
  for (const r of kids.get(null) ?? []) place(r, 0)
  // Anyone left over sits in a cycle; show them as roots so they are never lost.
  for (const p of people) if (!seen.has(p.id)) place(p, 0)
  const order = new Map(people.map((p, i) => [p.id, i]))
  nodes.sort((a, b) => order.get(a.id)! - order.get(b.id)!)
  return { nodes, width: next, depth: maxDepth + 1 }
}

/** True when giving `id` the manager `manager` would make someone their own boss. */
export function wouldCycle(people: readonly Person[], id: number, manager: number | null): boolean {
  const byId = new Map(people.map((p) => [p.id, p]))
  let cur = manager
  const guard = new Set<number>()
  while (cur !== null && byId.has(cur)) {
    if (cur === id) return true
    if (guard.has(cur)) return false
    guard.add(cur)
    cur = byId.get(cur)!.manager
  }
  return false
}

/** Splits "Name - Title", "Name, Title", "Name (Title)" or "Name | Title". */
export function splitNameTitle(s: string): [string, string] {
  const t = s.trim()
  const paren = t.match(/^(.*?)\s*\((.*)\)\s*$/)
  if (paren) return [paren[1].trim(), paren[2].trim()]
  const m = t.match(/^(.*?)\s+[-–—|]\s+(.*)$/) ?? t.match(/^(.*?)\s*[,|:]\s*(.*)$/)
  return m ? [m[1].trim(), m[2].trim()] : [t, '']
}

/**
 * Parses an indented list (spaces, tabs, or bullets like "-" or "*") into
 * people. Deeper lines report to the nearest line above with less indent.
 */
export function parseIndented(text: string, colors: readonly string[] = ['#e8590c']): Person[] {
  const out: Person[] = []
  const stack: { indent: number; id: number }[] = []
  let id = 1
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const lead = raw.match(/^[\t ]*/)![0].replace(/\t/g, '    ').length
    const body = raw.trim().replace(/^[-*•+]\s+/, '')
    while (stack.length && stack[stack.length - 1].indent >= lead) stack.pop()
    const manager = stack.length ? stack[stack.length - 1].id : null
    const [name, title] = splitNameTitle(body)
    out.push({ id, name, title, manager, color: colors[stack.length % colors.length] })
    stack.push({ indent: lead, id })
    id++
  }
  return out
}

/** The reverse of parseIndented, for editing the chart as text. */
export function toIndented(people: readonly Person[]): string {
  const kids = childrenOf(people)
  const lines: string[] = []
  const seen = new Set<number>()
  const walk = (p: Person, d: number) => {
    if (seen.has(p.id)) return
    seen.add(p.id)
    lines.push(`${'  '.repeat(d)}${p.name}${p.title ? ` - ${p.title}` : ''}`)
    for (const c of kids.get(p.id) ?? []) walk(c, d + 1)
  }
  for (const r of kids.get(null) ?? []) walk(r, 0)
  for (const p of people) walk(p, 0)
  return lines.join('\n')
}
