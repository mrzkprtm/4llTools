/** Circle of fifths theory: key signatures, correctly spelled scales and diatonic chords. */

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const NATURAL = [0, 2, 4, 5, 7, 9, 11]
export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
export const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/** Major keys clockwise from C, as fifths from C (−: flats, +: sharps). Position 6 is F♯ (G♭ is −6). */
export const CIRCLE = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1]

const pcOf = (n: number) => ((n % 12) + 12) % 12

/** Tonic of the major key with this many fifths, e.g. 3 → "A", −2 → "B♭". */
export function majorTonic(fifths: number): string {
  // Walk fifths from C by letter: each fifth is 4 letters up.
  const letter = LETTERS[(((fifths * 4) % 7) + 7) % 7]
  const pc = pcOf(fifths * 7)
  return letter + accidental(pc - NATURAL[LETTERS.indexOf(letter)])
}

function accidental(diff: number): string {
  const d = ((diff % 12) + 18) % 12 - 6
  return d > 0 ? '♯'.repeat(d) : d < 0 ? '♭'.repeat(-d) : ''
}

export interface KeySignature {
  count: number
  type: 'sharp' | 'flat' | 'none'
  /** Letters that carry the accidental, in the order they are written. */
  letters: string[]
}

export function keySignature(fifths: number): KeySignature {
  if (fifths === 0) return { count: 0, type: 'none', letters: [] }
  const n = Math.abs(fifths)
  return fifths > 0 ? { count: n, type: 'sharp', letters: SHARP_ORDER.slice(0, n) } : { count: n, type: 'flat', letters: FLAT_ORDER.slice(0, n) }
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]

/** Seven scale notes spelled with one letter each, starting from `tonic` (like "E♭"). */
export function spellScale(tonic: string, steps: number[]): string[] {
  const L = LETTERS.indexOf(tonic[0] as (typeof LETTERS)[number])
  const acc = [...tonic.slice(1)].reduce((a, ch) => a + (ch === '♯' || ch === '#' ? 1 : ch === '♭' || ch === 'b' ? -1 : 0), 0)
  const tonicPc = NATURAL[L] + acc
  return steps.map((s, k) => {
    const li = (L + k) % 7
    return LETTERS[li] + accidental(tonicPc + s - NATURAL[li])
  })
}

export const relativeMinor = (fifths: number) => spellScale(majorTonic(fifths), MAJOR_STEPS)[5]

export interface Diatonic {
  roman: string
  name: string
  /** Pitch classes of the triad, root first. */
  pcs: number[]
}

const MAJOR_QUAL = ['', 'm', 'm', '', '', 'm', '°']
const MAJOR_ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const MINOR_QUAL = ['m', '°', '', 'm', 'm', '', '']
const MINOR_ROMAN = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']

/** Scale notes and the seven diatonic triads of the major key (or its relative minor). */
export function diatonic(fifths: number, minor = false): { scale: string[]; chords: Diatonic[] } {
  const major = majorTonic(fifths)
  const tonic = minor ? relativeMinor(fifths) : major
  const steps = minor ? MINOR_STEPS : MAJOR_STEPS
  const scale = spellScale(tonic, steps)
  const rootPc = pcOf(fifths * 7 + (minor ? 9 : 0))
  const chords = scale.map((note, i) => {
    const pcs = [0, 2, 4].map((k) => pcOf(rootPc + steps[(i + k) % 7]))
    return { roman: (minor ? MINOR_ROMAN : MAJOR_ROMAN)[i], name: note + (minor ? MINOR_QUAL : MAJOR_QUAL)[i], pcs }
  })
  return { scale, chords }
}

/** Neighbors on the wheel: the IV (one step counter-clockwise) and V (one step clockwise). */
export const neighbors = (fifths: number) => ({ iv: majorTonic(fifths - 1), v: majorTonic(fifths + 1) })

/** Shortest-way rotation target so the wheel never spins the long way round. */
export function nearestAngle(current: number, target: number): number {
  const d = ((((target - current) % 360) + 540) % 360) - 180
  return current + d
}
