/** Itinerary timing: gaps between stops and overlap detection. Pure and tested. */

export type ActType = 'sight' | 'food' | 'activity' | 'transport' | 'stay' | 'shopping'

export const TYPES: Record<ActType, { label: string; color: string }> = {
  sight: { label: 'Sightseeing', color: '#1c7ed6' },
  food: { label: 'Food', color: '#e8590c' },
  activity: { label: 'Activity', color: '#2f9e44' },
  transport: { label: 'Transport', color: '#868e96' },
  stay: { label: 'Stay', color: '#ae3ec9' },
  shopping: { label: 'Shopping', color: '#f59f00' },
}

export interface Activity {
  id: string
  name: string
  place: string
  type: ActType
  /** Day index, or null while it sits in the ideas list. */
  day: number | null
  /** Minutes after midnight. */
  start: number
  /** Minutes. */
  dur: number
}

export const DAY_START = 6 * 60
export const DAY_END = 24 * 60
export const SNAP = 15
export const MIN_DUR = 15

export const snap = (m: number) => Math.round(m / SNAP) * SNAP

/** Keeps a block inside the 06:00–24:00 window, snapped to 15 minutes. */
export function place(start: number, dur: number): { start: number; dur: number } {
  const d = Math.max(MIN_DUR, Math.min(DAY_END - DAY_START, snap(dur)))
  const s = Math.max(DAY_START, Math.min(DAY_END - d, snap(start)))
  return { start: s, dur: d }
}

export const endOf = (a: Pick<Activity, 'start' | 'dur'>) => a.start + a.dur

export function dayActs(acts: Activity[], day: number): Activity[] {
  return acts.filter((a) => a.day === day).sort((a, b) => a.start - b.start || a.dur - b.dur)
}

export interface Gap {
  from: string
  to: string
  /** Where the gap starts and ends, minutes after midnight. */
  start: number
  end: number
  minutes: number
}

/** Free time between consecutive stops of one day (only positive gaps). */
export function gaps(acts: Activity[], day: number): Gap[] {
  const list = dayActs(acts, day)
  const out: Gap[] = []
  let latest: Activity | null = null
  for (const a of list) {
    if (latest && a.start > endOf(latest)) out.push({ from: latest.id, to: a.id, start: endOf(latest), end: a.start, minutes: a.start - endOf(latest) })
    if (!latest || endOf(a) > endOf(latest)) latest = a
  }
  return out
}

/** Ids of scheduled activities that overlap another one on the same day. */
export function overlaps(acts: Activity[]): Set<string> {
  const out = new Set<string>()
  const days = new Set(acts.filter((a) => a.day !== null).map((a) => a.day as number))
  for (const d of days) {
    const list = dayActs(acts, d)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length && list[j].start < endOf(list[i]); j++) {
        out.add(list[i].id)
        out.add(list[j].id)
      }
  }
  return out
}

/** Earliest start from 08:00 on `day` where a block of `dur` minutes fits without overlapping. */
export function firstFree(acts: Activity[], day: number, dur: number, from = 8 * 60): number | null {
  let t = snap(from)
  for (const a of dayActs(acts, day)) {
    if (a.start >= t + dur) break
    t = Math.max(t, Math.ceil(endOf(a) / SNAP) * SNAP)
  }
  return t + dur <= DAY_END ? t : null
}

export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export const durLabel = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`)
