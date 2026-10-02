/** Ear-training quiz data: interval names, chord and scale qualities and a question generator. */

export interface Item {
  id: string
  short: string
  name: string
  steps: number[]
}

const I = (id: string, name: string, n: number): Item => ({ id, short: id, name, steps: [0, n] })

export const INTERVALS: Item[] = [
  I('m2', 'Minor 2nd', 1), I('M2', 'Major 2nd', 2), I('m3', 'Minor 3rd', 3), I('M3', 'Major 3rd', 4),
  I('P4', 'Perfect 4th', 5), I('TT', 'Tritone', 6), I('P5', 'Perfect 5th', 7), I('m6', 'Minor 6th', 8),
  I('M6', 'Major 6th', 9), I('m7', 'Minor 7th', 10), I('M7', 'Major 7th', 11), I('P8', 'Octave', 12),
]

export const CHORDS: Item[] = [
  { id: 'maj', short: 'Major', name: 'Major triad', steps: [0, 4, 7] },
  { id: 'min', short: 'Minor', name: 'Minor triad', steps: [0, 3, 7] },
  { id: 'dim', short: 'Dim', name: 'Diminished triad', steps: [0, 3, 6] },
  { id: 'aug', short: 'Aug', name: 'Augmented triad', steps: [0, 4, 8] },
  { id: 'maj7', short: 'Maj7', name: 'Major 7th', steps: [0, 4, 7, 11] },
  { id: 'dom7', short: '7', name: 'Dominant 7th', steps: [0, 4, 7, 10] },
  { id: 'm7', short: 'm7', name: 'Minor 7th', steps: [0, 3, 7, 10] },
  { id: 'm7b5', short: 'm7♭5', name: 'Half-diminished', steps: [0, 3, 6, 10] },
]

export const SCALES: Item[] = [
  { id: 'major', short: 'Major', name: 'Major (Ionian)', steps: [0, 2, 4, 5, 7, 9, 11, 12] },
  { id: 'minor', short: 'Minor', name: 'Natural minor', steps: [0, 2, 3, 5, 7, 8, 10, 12] },
  { id: 'harm', short: 'Harmonic', name: 'Harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11, 12] },
  { id: 'dorian', short: 'Dorian', name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10, 12] },
  { id: 'mixo', short: 'Mixolydian', name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10, 12] },
  { id: 'penta', short: 'Pentatonic', name: 'Major pentatonic', steps: [0, 2, 4, 7, 9, 12] },
]

export type Mode = 'interval' | 'chord' | 'scale'
export type Direction = 'up' | 'down' | 'harmonic' | 'mixed'

export const ITEMS: Record<Mode, Item[]> = { interval: INTERVALS, chord: CHORDS, scale: SCALES }

export const LEVELS: Record<Mode, { name: string; ids: string[] }[]> = {
  interval: [
    { name: 'Easy', ids: ['M3', 'P5', 'P8'] },
    { name: 'Medium', ids: ['m3', 'M3', 'P4', 'P5', 'M6', 'P8'] },
    { name: 'All', ids: INTERVALS.map((i) => i.id) },
  ],
  chord: [
    { name: 'Easy', ids: ['maj', 'min'] },
    { name: 'Medium', ids: ['maj', 'min', 'dim', 'aug'] },
    { name: 'All', ids: CHORDS.map((c) => c.id) },
  ],
  scale: [
    { name: 'Easy', ids: ['major', 'minor'] },
    { name: 'Medium', ids: ['major', 'minor', 'harm', 'penta'] },
    { name: 'All', ids: SCALES.map((s) => s.id) },
  ],
}

/** Interval name for a distance in semitones (compound intervals fold into an octave). */
export function intervalName(semitones: number): string {
  const n = Math.abs(semitones)
  if (n === 0) return 'Unison'
  if (n % 12 === 0) return n === 12 ? 'Octave' : `${n / 12} octaves`
  return INTERVALS[(n % 12) - 1].name
}

export interface Question {
  item: Item
  /** Notes to play, in order (all at once when harmonic). */
  notes: number[]
  harmonic: boolean
  direction: 'up' | 'down' | 'harmonic'
}

/**
 * A random question from the chosen items. Avoids repeating the previous
 * answer when there is a choice, and keeps notes within C3–C6.
 */
export function makeQuestion(mode: Mode, ids: string[], dir: Direction, rand: () => number = Math.random, previous?: string): Question {
  const pool = ITEMS[mode].filter((i) => ids.includes(i.id))
  const choices = pool.length > 1 && previous ? pool.filter((p) => p.id !== previous) : pool
  const item = choices[Math.floor(rand() * choices.length)] ?? ITEMS[mode][0]
  const span = Math.max(...item.steps)
  const low = 48
  const high = 84 - span
  const root = low + Math.floor(rand() * (high - low + 1))
  let direction: Question['direction'] = 'up'
  if (mode === 'chord') direction = 'harmonic'
  else if (mode === 'interval') direction = dir === 'mixed' ? (['up', 'down', 'harmonic'] as const)[Math.floor(rand() * 3)] : dir
  let notes = item.steps.map((s) => root + s)
  if (direction === 'down') notes = [...notes].reverse()
  return { item, notes, harmonic: direction === 'harmonic', direction }
}

export type Stats = Record<string, { right: number; total: number }>

export function record(stats: Stats, id: string, correct: boolean): Stats {
  const s = stats[id] ?? { right: 0, total: 0 }
  return { ...stats, [id]: { right: s.right + (correct ? 1 : 0), total: s.total + 1 } }
}

export function accuracy(stats: Stats): number {
  let r = 0
  let t = 0
  for (const s of Object.values(stats)) {
    r += s.right
    t += s.total
  }
  return t ? r / t : 0
}
