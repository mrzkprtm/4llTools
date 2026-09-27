/** Shift scheduling: hours, coverage (with overnight shifts), auto-fill and CSV. */

export interface Shift {
  id: string
  name: string
  /** Start hour 0–23. */
  start: number
  /** End hour 0–24; at or before start means the shift ends the next day. */
  end: number
  color: string
  /** How many people this shift needs. */
  need: number
}

export interface Staff {
  id: number
  name: string
  maxHours: number
}

/** Assignment: `${staffId}:${day}` → shift id. Day 0 = Monday. */
export type Grid = Record<string, string>

export const cellKey = (staff: number, day: number) => `${staff}:${day}`
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Length in hours; 23→07 is 8 hours. A shift with start = end lasts 24 hours. */
export function shiftHours(s: Pick<Shift, 'start' | 'end'>): number {
  const d = (((s.end - s.start) % 24) + 24) % 24
  return d === 0 ? 24 : d
}

/** Hours each staff member works this week. */
export function hoursPerStaff(grid: Grid, shifts: readonly Shift[]): Map<number, number> {
  const byId = new Map(shifts.map((s) => [s.id, s]))
  const out = new Map<number, number>()
  for (const [k, sid] of Object.entries(grid)) {
    const s = byId.get(sid)
    if (!s) continue
    const staff = Number(k.split(':')[0])
    out.set(staff, (out.get(staff) ?? 0) + shiftHours(s))
  }
  return out
}

/** People on duty for each day (0–6) and hour (0–23). Overnight hours spill into the next day; Sunday night wraps to Monday. */
export function coverage(grid: Grid, shifts: readonly Shift[]): number[][] {
  const byId = new Map(shifts.map((s) => [s.id, s]))
  const cov = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  for (const [k, sid] of Object.entries(grid)) {
    const s = byId.get(sid)
    if (!s) continue
    const day = Number(k.split(':')[1])
    const len = shiftHours(s)
    for (let i = 0; i < len; i++) {
      const abs = s.start + i
      cov[(day + Math.floor(abs / 24)) % 7][abs % 24]++
    }
  }
  return cov
}

/** Staff needed at each hour of a day: the largest need of any shift covering that hour. */
export function required(shifts: readonly Shift[]): number[] {
  const req = new Array<number>(24).fill(0)
  for (const s of shifts) for (let i = 0; i < shiftHours(s); i++) req[(s.start + i) % 24] = Math.max(req[(s.start + i) % 24], s.need)
  return req
}

/** How many people each shift has on each day: [day][shiftIndex]. */
export function shiftCounts(grid: Grid, shifts: readonly Shift[]): number[][] {
  const idx = new Map(shifts.map((s, i) => [s.id, i]))
  const out = Array.from({ length: 7 }, () => new Array<number>(shifts.length).fill(0))
  for (const [k, sid] of Object.entries(grid)) {
    const i = idx.get(sid)
    if (i !== undefined) out[Number(k.split(':')[1])][i]++
  }
  return out
}

/** True if giving `staff` shift `s` on `day` would start less than 8 hours after their previous shift ended. */
function tooSoon(grid: Grid, byId: Map<string, Shift>, staff: number, day: number, s: Shift): boolean {
  const prev = byId.get(grid[cellKey(staff, (day + 6) % 7)] ?? '')
  if (!prev) return false
  const prevEnd = prev.start + shiftHours(prev) - 24 // relative to today's midnight
  return s.start - prevEnd < 8
}

/**
 * Fills empty cells so every shift reaches its need, picking whoever has the
 * fewest hours and still has room under their weekly maximum and a rest gap.
 * Existing assignments are kept.
 */
export function autoFill(grid: Grid, staff: readonly Staff[], shifts: readonly Shift[]): Grid {
  const out: Grid = { ...grid }
  const byId = new Map(shifts.map((s) => [s.id, s]))
  const hours = hoursPerStaff(out, shifts)
  for (let day = 0; day < 7; day++) {
    for (const s of shifts) {
      let have = Object.entries(out).filter(([k, v]) => v === s.id && Number(k.split(':')[1]) === day).length
      while (have < s.need) {
        const len = shiftHours(s)
        const pick = staff
          .filter((p) => out[cellKey(p.id, day)] === undefined && (hours.get(p.id) ?? 0) + len <= p.maxHours && !tooSoon(out, byId, p.id, day, s))
          .sort((a, b) => (hours.get(a.id) ?? 0) - (hours.get(b.id) ?? 0) || a.id - b.id)[0]
        if (!pick) break
        out[cellKey(pick.id, day)] = s.id
        hours.set(pick.id, (hours.get(pick.id) ?? 0) + len)
        have++
      }
    }
  }
  return out
}

const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`

/** A CSV with one row per staff member and one column per day, plus total hours. */
export function toCsv(grid: Grid, staff: readonly Staff[], shifts: readonly Shift[]): string {
  const byId = new Map(shifts.map((s) => [s.id, s]))
  const hours = hoursPerStaff(grid, shifts)
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const rows = [['Staff', ...DAYS, 'Hours', 'Max'].join(',')]
  for (const p of staff) {
    const cells = DAYS.map((_, d) => {
      const s = byId.get(grid[cellKey(p.id, d)] ?? '')
      return s ? q(`${s.name} ${pad(s.start)}-${pad(s.end)}`) : ''
    })
    rows.push([q(p.name), ...cells, String(hours.get(p.id) ?? 0), String(p.maxHours)].join(','))
  }
  return rows.join('\n')
}
