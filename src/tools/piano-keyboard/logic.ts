/** Piano note math: scales, chords, key layout and the computer-keyboard map. */

export const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
export const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const

export const pc = (midi: number) => ((midi % 12) + 12) % 12
export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(pc(midi))
export const noteName = (midi: number) => `${NAMES[pc(midi)]}${Math.floor(midi / 12) - 1}`
export const midiFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

export const SCALES = {
  major: { name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: 'Natural minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  harmonic: { name: 'Harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11] },
  majpent: { name: 'Major pentatonic', steps: [0, 2, 4, 7, 9] },
  minpent: { name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10] },
  blues: { name: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
  dorian: { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
} as const

export const CHORDS = {
  maj: { name: 'Major', steps: [0, 4, 7] },
  min: { name: 'Minor', steps: [0, 3, 7] },
  '7': { name: 'Dominant 7', steps: [0, 4, 7, 10] },
  maj7: { name: 'Major 7', steps: [0, 4, 7, 11] },
  m7: { name: 'Minor 7', steps: [0, 3, 7, 10] },
  dim: { name: 'Diminished', steps: [0, 3, 6] },
  aug: { name: 'Augmented', steps: [0, 4, 8] },
  sus2: { name: 'Sus2', steps: [0, 2, 7] },
  sus4: { name: 'Sus4', steps: [0, 5, 7] },
} as const

export type ScaleId = keyof typeof SCALES
export type ChordId = keyof typeof CHORDS

/** Pitch classes (0–11) of a scale or chord built on `root`. */
export function pitchClasses(root: number, steps: readonly number[]): Set<number> {
  return new Set(steps.map((s) => pc(root + s)))
}

/** Note names of a scale or chord, e.g. A minor → A B C D E F G. Uses flats for flat keys. */
export function spell(root: number, steps: readonly number[]): string[] {
  const minor = steps[1] === 3 || steps[2] === 3
  const flat = [5, 10, 3, 8, 1].includes(pc(root)) || (minor && [0, 2, 7].includes(pc(root)))
  const names = flat ? FLAT_NAMES : NAMES
  return steps.map((s) => names[pc(root + s)])
}

/** Chord tones as MIDI notes voiced upward from `rootMidi`. */
export const chordNotes = (rootMidi: number, steps: readonly number[]) => steps.map((s) => rootMidi + s)

/** Computer keys → semitones above the keyboard's base C (two rows like a DAW). */
export const KEYMAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17,
}

/** The MIDI note for a computer key, or null. */
export function keyToMidi(key: string, baseMidi: number): number | null {
  const off = KEYMAP[key.toLowerCase()]
  return off === undefined ? null : baseMidi + off
}

/** The label to print on a piano key for its computer key, if any. */
export function midiToKey(midi: number, baseMidi: number): string | undefined {
  const off = midi - baseMidi
  return Object.keys(KEYMAP).find((k) => KEYMAP[k] === off)?.toUpperCase()
}

export interface PianoKey {
  midi: number
  black: boolean
  /** Left edge in white-key units. */
  x: number
}

/** Keys from C of `startOctave` for `octaves` octaves plus a closing C. */
export function layout(startOctave: number, octaves: number): PianoKey[] {
  const start = (startOctave + 1) * 12
  const keys: PianoKey[] = []
  let white = 0
  for (let m = start; m <= start + octaves * 12; m++) {
    if (isBlack(m)) keys.push({ midi: m, black: true, x: white - 0.32 })
    else keys.push({ midi: m, black: false, x: white++ })
  }
  return keys
}
