/** Pure timing logic for the presentation speaker timer. All times are in seconds. */

export interface Section {
  name: string
  /** Length in minutes. */
  minutes: number
}

export interface TimerConfig {
  /** Total talk length in seconds. */
  total: number
  /** Turn yellow when this many seconds are left. */
  yellow: number
  /** Turn red when this many seconds are left. */
  red: number
}

export type Phase = 'green' | 'yellow' | 'red' | 'over'

/** Color phase at `elapsed` seconds into the talk. */
export function phaseAt(elapsed: number, cfg: TimerConfig): Phase {
  const left = cfg.total - elapsed
  if (left < 0) return 'over'
  if (left <= cfg.red) return 'red'
  if (left <= cfg.yellow) return 'yellow'
  return 'green'
}

export interface Segment {
  name: string
  start: number
  end: number
}

/** Section start/end times in seconds, in order. */
export function segments(sections: readonly Section[]): Segment[] {
  let t = 0
  return sections.map((s) => {
    const start = t
    t += Math.max(0, s.minutes) * 60
    return { name: s.name, start, end: t }
  })
}

/** Index of the section running at `elapsed`, or -1 when there are none or it is past the last one. */
export function sectionAt(elapsed: number, sections: readonly Section[]): number {
  const segs = segments(sections)
  for (let i = 0; i < segs.length; i++) if (elapsed >= segs[i].start && elapsed < segs[i].end) return i
  return -1
}

/** 12:05, 1:02:03, or +0:42 in overtime. */
export function clock(secondsLeft: number): string {
  const over = secondsLeft < 0
  const s = over ? Math.floor(-secondsLeft) : Math.ceil(secondsLeft)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const body = h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
  return over ? `+${body}` : body
}
