import { rng } from '../../sim/math'

export interface Guest {
  id: number
  name: string
  group: string
}

export interface Table {
  id: number
  name: string
  shape: 'round' | 'rect'
  seats: number
  x: number
  y: number
}

export interface Rule {
  a: number
  b: number
  kind: 'together' | 'apart'
}

/** Seat key "tableId:seatIndex" → guest id. */
export type Seating = Record<string, number>

export const seatKey = (table: number, seat: number) => `${table}:${seat}`
export const tableOfKey = (key: string) => Number(key.split(':')[0])

/** Where each guest sits (table id), for seated guests only. */
export function tableOfGuest(seating: Seating): Map<number, number> {
  const m = new Map<number, number>()
  for (const [k, g] of Object.entries(seating)) m.set(g, tableOfKey(k))
  return m
}

/** Indices of rules that the seating breaks. A keep-together pair with someone unseated counts as broken. */
export function brokenRules(seating: Seating, rules: readonly Rule[]): number[] {
  const at = tableOfGuest(seating)
  const out: number[] = []
  rules.forEach((r, i) => {
    const ta = at.get(r.a)
    const tb = at.get(r.b)
    if (r.kind === 'together' ? ta === undefined || ta !== tb : ta !== undefined && ta === tb) out.push(i)
  })
  return out
}

/** Higher is better: rules dominate, then people sitting with their own group. */
export function score(seating: Seating, rules: readonly Rule[], guests: readonly Guest[]): number {
  const at = tableOfGuest(seating)
  let s = at.size * 30
  for (const r of rules) {
    const ta = at.get(r.a)
    const tb = at.get(r.b)
    if (r.kind === 'together') s += ta !== undefined && ta === tb ? 10 : -10
    else if (ta !== undefined && ta === tb) s -= 12
  }
  const groupOf = new Map(guests.map((g) => [g.id, g.group.trim().toLowerCase()]))
  const counts = new Map<string, number>()
  for (const [g, t] of at) {
    const grp = groupOf.get(g)
    if (!grp) continue
    const k = `${t}|${grp}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  for (const c of counts.values()) s += (c * (c - 1)) / 2
  return s
}

/**
 * Auto-arrange: a greedy first pass that seats keep-together clusters and
 * groups at the same table, then simulated annealing that swaps seats to fix
 * remaining conflicts. Deterministic for a given seed.
 */
export function optimize(guests: readonly Guest[], tables: readonly Table[], rules: readonly Rule[], seed = 1, iterations = 6000): Seating {
  const random = rng(seed)
  const ids = new Set(guests.map((g) => g.id))
  const rs = rules.filter((r) => ids.has(r.a) && ids.has(r.b) && r.a !== r.b)
  // Union-find over keep-together pairs.
  const parent = new Map(guests.map((g) => [g.id, g.id]))
  const find = (x: number): number => (parent.get(x) === x ? x : find(parent.get(x)!))
  for (const r of rs) if (r.kind === 'together') parent.set(find(r.a), find(r.b))
  const clusters = new Map<number, Guest[]>()
  for (const g of guests) clusters.set(find(g.id), [...(clusters.get(find(g.id)) ?? []), g])
  const list = [...clusters.values()].sort((a, b) => b.length - a.length || a[0].group.localeCompare(b[0].group))

  const free = new Map(tables.map((t) => [t.id, t.seats]))
  const members = new Map<number, Guest[]>(tables.map((t) => [t.id, []]))
  const apart = (a: number, b: number) => rs.some((r) => r.kind === 'apart' && ((r.a === a && r.b === b) || (r.a === b && r.b === a)))
  const place = (cl: Guest[]) => {
    let best = -1
    let bestScore = -Infinity
    for (const t of tables) {
      if (free.get(t.id)! < cl.length) continue
      const m = members.get(t.id)!
      let sc = 0
      for (const g of cl) for (const o of m) sc += apart(g.id, o.id) ? -100 : g.group && g.group === o.group ? 3 : 0
      sc += free.get(t.id)! * 0.01
      if (sc > bestScore) {
        bestScore = sc
        best = t.id
      }
    }
    if (best < 0) {
      if (cl.length > 1) {
        const half = Math.ceil(cl.length / 2)
        place(cl.slice(0, half))
        place(cl.slice(half))
      }
      return
    }
    members.get(best)!.push(...cl)
    free.set(best, free.get(best)! - cl.length)
  }
  for (const cl of list) place(cl)

  // Slots: every seat, filled from the greedy pass.
  const slots: { table: number; seat: number; guest: number | null }[] = []
  for (const t of tables) {
    const m = members.get(t.id)!
    for (let i = 0; i < t.seats; i++) slots.push({ table: t.id, seat: i, guest: m[i]?.id ?? null })
  }
  const toSeating = () => {
    const s: Seating = {}
    for (const sl of slots) if (sl.guest !== null) s[seatKey(sl.table, sl.seat)] = sl.guest
    return s
  }
  let cur = score(toSeating(), rs, guests)
  let best = { s: toSeating(), sc: cur }
  if (slots.length < 2) return best.s
  for (let it = 0; it < iterations; it++) {
    const i = Math.floor(random() * slots.length)
    const j = Math.floor(random() * slots.length)
    if (slots[i].table === slots[j].table || (slots[i].guest === null && slots[j].guest === null)) continue
    ;[slots[i].guest, slots[j].guest] = [slots[j].guest, slots[i].guest]
    const next = score(toSeating(), rs, guests)
    const temp = 3 * (1 - it / iterations) + 0.01
    if (next >= cur || random() < Math.exp((next - cur) / temp)) {
      cur = next
      if (cur > best.sc) best = { s: toSeating(), sc: cur }
    } else [slots[i].guest, slots[j].guest] = [slots[j].guest, slots[i].guest]
  }
  return best.s
}

/** Seat centers relative to the table center. */
export function seatPositions(t: Pick<Table, 'shape' | 'seats'>): { x: number; y: number }[] {
  if (t.shape === 'round') {
    const r = tableSize(t).r + 20
    return Array.from({ length: t.seats }, (_, i) => {
      const a = (i / t.seats) * Math.PI * 2 - Math.PI / 2
      return { x: Math.cos(a) * r, y: Math.sin(a) * r }
    })
  }
  const { w, h } = tableSize(t)
  const top = Math.ceil(t.seats / 2)
  const bottom = t.seats - top
  const row = (n: number, y: number) => Array.from({ length: n }, (_, i) => ({ x: -w / 2 + (w / n) * (i + 0.5), y }))
  return [...row(top, -h / 2 - 20), ...row(bottom, h / 2 + 20)]
}

export function tableSize(t: Pick<Table, 'shape' | 'seats'>): { r: number; w: number; h: number } {
  const r = 30 + t.seats * 2.6
  return { r, w: Math.max(80, Math.ceil(t.seats / 2) * 42), h: 50 }
}
