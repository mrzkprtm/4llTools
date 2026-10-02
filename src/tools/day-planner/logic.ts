/** Pure time-block helpers for the day planner. Times are minutes after midnight. */

export const DAY_START = 6 * 60
export const DAY_END = 24 * 60
export const STEP = 15

export interface Block {
  id: string
  start: number
  end: number
  title: string
  color: string
}

export function snap(min: number, step = STEP): number {
  return Math.round(min / step) * step
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Moves a block by `delta` minutes, snapped and kept inside the day. */
export function moveBlock(b: Block, delta: number): Block {
  const dur = b.end - b.start
  const start = clamp(snap(b.start + delta), DAY_START, DAY_END - dur)
  return { ...b, start, end: start + dur }
}

/** Sets a block's end, snapped, at least one step long and inside the day. */
export function resizeBlock(b: Block, end: number): Block {
  return { ...b, end: clamp(snap(end), b.start + STEP, DAY_END) }
}

/** The span a drag from `anchor` to `current` creates (anchor floored to the grid). */
export function spanFromDrag(anchor: number, current: number): { start: number; end: number } {
  const a = clamp(Math.floor(anchor / STEP) * STEP, DAY_START, DAY_END - STEP)
  const c = clamp(snap(current), DAY_START, DAY_END)
  return c > a ? { start: a, end: Math.max(a + STEP, c) } : { start: Math.min(c, a), end: a + STEP }
}

export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

/** Ids of blocks that overlap at least one other block. */
export function overlapping(blocks: Block[]): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++)
      if (overlaps(blocks[i], blocks[j])) {
        out.add(blocks[i].id)
        out.add(blocks[j].id)
      }
  return out
}

/** Minutes covered by at least one block (overlaps count once). */
export function plannedMinutes(blocks: { start: number; end: number }[]): number {
  const s = [...blocks].sort((a, b) => a.start - b.start)
  let total = 0
  let curS = -1
  let curE = -1
  for (const b of s) {
    if (b.start > curE) {
      total += curE - curS
      curS = b.start
      curE = b.end
    } else curE = Math.max(curE, b.end)
  }
  return total + (curE - curS)
}

/** Side-by-side lanes so overlapping blocks stay visible: lane index and lane count per block. */
export function lanes(blocks: Block[]): Map<string, { lane: number; of: number }> {
  const s = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end)
  const out = new Map<string, { lane: number; of: number }>()
  let group: { id: string; lane: number }[] = []
  let ends: number[] = []
  let groupEnd = -1
  const flush = () => {
    for (const g of group) out.set(g.id, { lane: g.lane, of: ends.length })
    group = []
    ends = []
  }
  for (const b of s) {
    if (b.start >= groupEnd) {
      flush()
      groupEnd = b.end
    } else groupEnd = Math.max(groupEnd, b.end)
    let lane = ends.findIndex((e) => e <= b.start)
    if (lane < 0) lane = ends.length
    ends[lane] = b.end
    group.push({ id: b.id, lane })
  }
  flush()
  return out
}

/** The first free slot of `dur` minutes at or after `from`, or null if the day is full. */
export function freeSlot(blocks: Block[], dur: number, from: number): number | null {
  for (let t = clamp(snap(from), DAY_START, DAY_END); t + dur <= DAY_END; t += STEP) if (!blocks.some((b) => overlaps(b, { start: t, end: t + dur }))) return t
  return null
}

export function hhmm(min: number): string {
  const h = Math.floor(min / 60)
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
