/** Pure timing math for the metronome: tempo names, accents and a lookahead scheduler. */

export const MIN_BPM = 30
export const MAX_BPM = 300

export const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))

const MARKINGS: [number, string][] = [
  [40, 'Grave'],
  [60, 'Largo'],
  [66, 'Larghetto'],
  [76, 'Adagio'],
  [108, 'Andante'],
  [120, 'Moderato'],
  [156, 'Allegro'],
  [176, 'Vivace'],
  [200, 'Presto'],
  [Infinity, 'Prestissimo'],
]

/** The Italian tempo marking for a BPM (upper bounds are exclusive). */
export function tempoName(bpm: number): string {
  for (const [upTo, name] of MARKINGS) if (bpm < upTo) return name
  return 'Prestissimo'
}

export interface Meter {
  id: string
  beats: number
  /** Beat groups; the first beat of each group gets a secondary accent. */
  groups: number[]
}

export const METERS: Meter[] = [
  { id: '2/4', beats: 2, groups: [2] },
  { id: '3/4', beats: 3, groups: [3] },
  { id: '4/4', beats: 4, groups: [4] },
  { id: '6/8', beats: 6, groups: [3, 3] },
  { id: '7/8', beats: 7, groups: [2, 2, 3] },
]

export type Subdivision = 1 | 2 | 3 | 4
export const SUBDIVISIONS: [Subdivision, string][] = [
  [1, 'None'],
  [2, '8ths'],
  [3, 'Triplets'],
  [4, '16ths'],
]

export type Level = 'bar' | 'group' | 'beat' | 'sub'

/** Accent level of beat `beat` (0-based) in a bar split into `groups`. */
export function accentOf(beat: number, groups: number[], accentFirst: boolean): Exclude<Level, 'sub'> {
  if (beat === 0) return accentFirst ? 'bar' : 'beat'
  let start = 0
  for (const g of groups) {
    if (beat === start) return 'group'
    start += g
  }
  return 'beat'
}

export interface Tick {
  time: number
  /** Beat index within the bar. */
  beat: number
  /** Subdivision index within the beat (0 = the beat itself). */
  sub: number
  level: Level
}

export interface Cursor {
  /** Audio-clock time of the next tick. */
  next: number
  /** Running index of the next tick, counted in subdivisions from the start. */
  index: number
}

export interface Settings {
  bpm: number
  beats: number
  groups: number[]
  subdivision: Subdivision
  accentFirst: boolean
}

/** Seconds between two ticks (beats split into subdivisions). */
export const tickLength = (bpm: number, subdivision: number) => 60 / bpm / subdivision

/**
 * Returns every tick that falls before `until` (now + lookahead) and the
 * advanced cursor. Times are computed by adding the tick length to the previous
 * time so a tempo change takes effect from the next tick without a jump.
 */
export function schedule(cursor: Cursor, until: number, s: Settings): { ticks: Tick[]; cursor: Cursor } {
  const ticks: Tick[] = []
  let { next, index } = cursor
  const step = tickLength(s.bpm, s.subdivision)
  while (next < until) {
    const sub = index % s.subdivision
    const beat = Math.floor(index / s.subdivision) % s.beats
    ticks.push({ time: next, beat, sub, level: sub ? 'sub' : accentOf(beat, s.groups, s.accentFirst) })
    next += step
    index++
    // Stay inside a sane loop if a caller passes a huge window.
    if (ticks.length > 1000) break
  }
  return { ticks, cursor: { next, index } }
}

/** Tempo from tap times in ms: mean of the last intervals, ignoring stale taps. */
export function tapBpm(times: number[], maxGap = 2000): number | null {
  const recent: number[] = []
  for (let i = times.length - 1; i > 0 && recent.length < 6; i--) {
    const d = times[i] - times[i - 1]
    if (d > maxGap || d <= 0) break
    recent.push(d)
  }
  if (!recent.length) return null
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length
  return clampBpm(60000 / avg)
}
