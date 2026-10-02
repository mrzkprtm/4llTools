/** Guitar chord data: chord tones, open voicings, movable barre shapes and a chord-sheet transposer. */

export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const
/** Standard tuning, low E to high E, as MIDI notes. */
export const TUNING = [40, 45, 50, 55, 59, 64]

export const QUALITIES = {
  '': { name: 'Major', steps: [0, 4, 7] },
  m: { name: 'Minor', steps: [0, 3, 7] },
  '7': { name: '7', steps: [0, 4, 7, 10] },
  maj7: { name: 'maj7', steps: [0, 4, 7, 11] },
  m7: { name: 'm7', steps: [0, 3, 7, 10] },
  sus2: { name: 'sus2', steps: [0, 2, 7] },
  sus4: { name: 'sus4', steps: [0, 5, 7] },
  add9: { name: 'add9', steps: [0, 4, 7, 2] },
  '6': { name: '6', steps: [0, 4, 7, 9] },
  dim: { name: 'dim', steps: [0, 3, 6] },
  aug: { name: 'aug', steps: [0, 4, 8] },
  m7b5: { name: 'm7♭5', steps: [0, 3, 6, 10] },
} as const
export type Quality = keyof typeof QUALITIES

const pcOf = (n: number) => ((n % 12) + 12) % 12

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
export function parseRoot(s: string): number | null {
  const m = s.match(/^([A-G])([#b♯♭]?)$/)
  if (!m) return null
  return pcOf(NOTE_INDEX[m[1]] + (m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0))
}

export const chordName = (root: number, q: Quality) => `${ROOTS[pcOf(root)]}${q}`

/** Chord tones as note names. */
export function chordNotes(root: number, q: Quality): string[] {
  return QUALITIES[q].steps.map((s) => ROOTS[pcOf(root + s)])
}

export interface Voicing {
  /** Fret per string, low E first; −1 = muted, 0 = open. */
  frets: number[]
  /** Finger per string (0 = none). */
  fingers: number[]
  /** A finger-1 barre across strings, if any. */
  barre?: { fret: number; from: number; to: number }
  kind: string
}

const parseFrets = (s: string) => [...s].map((c) => (c === 'x' ? -1 : parseInt(c, 36)))

/** Common open-position chords: frets and fingers, low E → high E. */
const OPEN: Record<string, [string, string][]> = {
  C: [['x32010', '032010']], C7: [['x32310', '032410']], Cmaj7: [['x32000', '032000']], Cadd9: [['x32033', '021034']],
  Csus2: [['x30013', '030014']], Csus4: [['x33011', '034011']],
  D: [['xx0232', '000132']], Dm: [['xx0231', '000231']], D7: [['xx0212', '000213']], Dmaj7: [['xx0222', '000111']],
  Dm7: [['xx0211', '000211']], Dsus2: [['xx0230', '000130']], Dsus4: [['xx0233', '000134']], D6: [['xx0202', '000102']],
  E: [['022100', '023100']], Em: [['022000', '023000']], E7: [['020100', '020100']], Em7: [['022030', '023040']],
  Emaj7: [['021100', '031200']], Esus4: [['022200', '023400']], Esus2: [['024400', '013400']],
  Fmaj7: [['xx3210', '003210']],
  G: [['320003', '210003'], ['320033', '210034']], G7: [['320001', '320001']], Gmaj7: [['320002', '320001']],
  Gsus4: [['330013', '230014']], G6: [['320000', '210000']],
  A: [['x02220', '001230']], Am: [['x02210', '002310']], A7: [['x02020', '002030']], Amaj7: [['x02120', '002130']],
  Am7: [['x02010', '002010']], Asus2: [['x02200', '001200']], Asus4: [['x02230', '001240']], A6: [['x02222', '001111']],
  B7: [['x21202', '021304']],
}

/** Movable shapes: fret offsets from the root fret (null = muted). */
const E_SHAPES: Partial<Record<Quality, (number | null)[]>> = {
  '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, null, 1, 1, 0, null], sus4: [0, 2, 2, 2, 0, 0], aug: [0, 3, 2, 1, 1, null],
}
const A_SHAPES: Partial<Record<Quality, (number | null)[]>> = {
  '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0], m7: [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0], sus2: [null, 0, 2, 2, 0, 0], sus4: [null, 0, 2, 2, 3, 0], add9: [null, 0, 2, 4, 2, 0],
  '6': [null, 0, 2, 2, 2, 2], dim: [null, 0, 1, 2, 1, null], m7b5: [null, 0, 1, 0, 1, null],
}

/** Places a movable shape with its root on string 6 (E shape) or 5 (A shape). */
export function barreShape(root: number, q: Quality, kind: 'E' | 'A', minFret = 1): Voicing | null {
  const shape = (kind === 'E' ? E_SHAPES : A_SHAPES)[q]
  if (!shape) return null
  const rootString = kind === 'E' ? 0 : 1
  let r = pcOf(root - TUNING[rootString])
  if (r < minFret) r += 12
  if (r > 12) return null
  const frets = shape.map((o) => (o === null ? -1 : r + o))
  const fingers = frets.map(() => 0)
  const atRoot = shape.map((o, i) => (o === 0 ? i : -1)).filter((i) => i >= 0)
  let barre: Voicing['barre']
  if (r > 0) {
    atRoot.forEach((i) => (fingers[i] = 1))
    if (atRoot.length > 1) barre = { fret: r, from: atRoot[0], to: atRoot[atRoot.length - 1] }
  }
  const rest = frets.map((f, i) => ({ f, i })).filter(({ f, i }) => f > 0 && fingers[i] === 0).sort((a, b) => a.f - b.f || a.i - b.i)
  let next = r > 0 ? 2 : 1
  for (const { i } of rest) fingers[i] = Math.min(4, next++)
  return { frets, fingers, barre, kind: `${kind} shape, fret ${r}` }
}

/** Pitch classes a voicing sounds (with an optional capo). */
export function voicingPcs(frets: number[], capo = 0): Set<number> {
  return new Set(frets.flatMap((f, i) => (f < 0 ? [] : [pcOf(TUNING[i] + f + capo)])))
}

/** A voicing is valid when it sounds only chord tones, includes the root and the lowest note is the root. */
export function isValid(v: Voicing, root: number, q: Quality): boolean {
  const want = new Set(QUALITIES[q].steps.map((s) => pcOf(root + s)))
  const got = voicingPcs(v.frets)
  for (const p of got) if (!want.has(p)) return false
  const low = v.frets.findIndex((f) => f >= 0)
  return got.has(pcOf(root)) && low >= 0 && pcOf(TUNING[low] + v.frets[low]) === pcOf(root)
}

/** Every voicing we know for a chord: open shapes first, then E and A barre shapes up the neck. */
export function voicings(root: number, q: Quality): Voicing[] {
  const out: Voicing[] = []
  for (const [f, fg] of OPEN[chordName(root, q)] ?? []) {
    const frets = parseFrets(f)
    out.push({ frets, fingers: parseFrets(fg).map((x) => Math.max(0, x)), kind: 'Open' })
  }
  for (const kind of ['E', 'A'] as const) {
    const v = barreShape(root, q, kind, out.length ? 1 : 0)
    if (v) out.push(v)
  }
  const seen = new Set<string>()
  return out.filter((v) => {
    const key = v.frets.join(',')
    if (seen.has(key) || !isValid(v, root, q)) return false
    seen.add(key)
    return true
  })
}

/** MIDI notes a voicing sounds, low to high. */
export const voicingMidi = (frets: number[], capo = 0) => frets.flatMap((f, i) => (f < 0 ? [] : [TUNING[i] + f + capo]))

const CHORD_RE = /^([A-G])([#b♯♭]?)((?:maj|min|m|M|dim|aug|sus|add|[0-9]|b|#|\+|°|ø|\(|\))*)(?:\/([A-G])([#b♯♭]?))?$/

/** Transposes one chord symbol by `n` semitones, or returns null if it isn't one. */
export function transposeChord(sym: string, n: number): string | null {
  const m = sym.match(CHORD_RE)
  if (!m) return null
  const shift = (letter: string, acc: string) => ROOTS[pcOf(parseRoot(letter + (acc || ''))! + n)]
  return shift(m[1], m[2]) + m[3] + (m[4] ? '/' + shift(m[4], m[5]) : '')
}

/**
 * Transposes every chord symbol in a chord sheet, keeping spacing. Lines that
 * are mostly words (lyrics) are left alone, so "A" in a lyric stays put.
 */
export function transposeText(text: string, n: number): string {
  return text
    .split('\n')
    .map((line) => {
      const words = line.split(/[\s|,]+/).filter(Boolean)
      const chords = words.filter((w) => CHORD_RE.test(w)).length
      if (!words.length || chords / words.length < 0.5) return line
      return line
        .split(/(\s+|[|,])/)
        .map((tok) => transposeChord(tok, n) ?? tok)
        .join('')
    })
    .join('\n')
}
