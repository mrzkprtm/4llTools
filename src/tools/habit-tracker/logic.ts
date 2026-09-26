/** Pure date and streak helpers for the habit tracker. Dates are local ISO days (YYYY-MM-DD). */

export function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseIso(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

/**
 * Consecutive done days ending today. If today is not checked yet the streak is
 * still alive, so it counts back from yesterday.
 */
export function currentStreak(done: Iterable<string>, today: string): number {
  const set = new Set(done)
  let day = set.has(today) ? today : addDays(today, -1)
  let n = 0
  while (set.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

/** The longest run of consecutive days anywhere in the history. */
export function bestStreak(done: Iterable<string>): number {
  const days = [...new Set(done)].sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** Share of the last `days` days (including today) that were checked, 0–1. */
export function completionRate(done: Iterable<string>, today: string, days: number): number {
  const set = new Set(done)
  let hit = 0
  for (let i = 0; i < days; i++) if (set.has(addDays(today, -i))) hit++
  return days > 0 ? hit / days : 0
}

/**
 * Heatmap columns (weeks, Monday first) ending with the week that holds today.
 * Days after today are null.
 */
export function heatmapWeeks(today: string, weeks: number): (string | null)[][] {
  const dow = (parseIso(today).getDay() + 6) % 7
  const start = addDays(today, -dow - (weeks - 1) * 7)
  const cols: (string | null)[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: (string | null)[] = []
    for (let r = 0; r < 7; r++) {
      const d = addDays(start, w * 7 + r)
      col.push(d > today ? null : d)
    }
    cols.push(col)
  }
  return cols
}

/** Flame scale from a streak: grows quickly at first, then levels off. */
export function flameScale(streak: number): number {
  return 0.55 + Math.min(1, Math.log1p(streak) / Math.log1p(60)) * 0.9
}
