/** Step sequencer math: swing timing, a lookahead scheduler and pattern encoding. */

export const STEPS = 16
export const DRUMS = [
  { id: 'kick', name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'clap', name: 'Clap' },
  { id: 'chat', name: 'Closed hat' },
  { id: 'ohat', name: 'Open hat' },
  { id: 'tom', name: 'Tom' },
  { id: 'rim', name: 'Rim' },
  { id: 'cow', name: 'Cowbell' },
] as const
export type DrumId = (typeof DRUMS)[number]['id']
export type Pattern = boolean[][]

export const sixteenth = (bpm: number) => 60 / bpm / 4

/**
 * Swing delays every off-beat 16th. `swing` is the share of an 8th note the
 * first 16th of each pair takes, from 50 (straight) to 75 (hard shuffle);
 * 66.7 is a triplet feel.
 */
export function swingOffset(step: number, bpm: number, swing: number): number {
  if (step % 2 === 0) return 0
  return (Math.min(75, Math.max(50, swing)) / 100 - 0.5) * 2 * sixteenth(bpm)
}

export interface Cursor {
  /** Straight-grid time of the next step. */
  next: number
  step: number
}

/** Steps due before `until`, with swing applied, and the advanced cursor. */
export function dueSteps(c: Cursor, until: number, bpm: number, swing: number) {
  const out: { step: number; time: number }[] = []
  let { next, step } = c
  while (next < until && out.length < 64) {
    out.push({ step, time: next + swingOffset(step, bpm, swing) })
    next += sixteenth(bpm)
    step = (step + 1) % STEPS
  }
  return { steps: out, cursor: { next, step } }
}

export const emptyPattern = (): Pattern => DRUMS.map(() => Array<boolean>(STEPS).fill(false))

export const fromRows = (rows: string[]): Pattern => DRUMS.map((_, i) => [...(rows[i] ?? '').padEnd(STEPS, '.')].slice(0, STEPS).map((ch) => ch === 'x'))

export interface Song {
  pattern: Pattern
  bpm: number
  swing: number
}

/** Compact, URL-safe text: "v1-<bpm>-<swing>-<4 hex digits per row>". */
export function encode({ pattern, bpm, swing }: Song): string {
  const rows = pattern.map((row) => row.reduce((n, on, i) => (on ? n | (1 << i) : n), 0).toString(16).padStart(4, '0')).join('')
  return `v1-${Math.round(bpm)}-${Math.round(swing)}-${rows}`
}

export function decode(text: string): Song | null {
  const m = text.trim().replace(/^#/, '').match(/^v1-(\d{2,3})-(\d{2})-([0-9a-f]{32})$/i)
  if (!m) return null
  const bpm = Number(m[1])
  const swing = Number(m[2])
  if (bpm < 40 || bpm > 240 || swing < 50 || swing > 75) return null
  const pattern = DRUMS.map((_, r) => {
    const n = parseInt(m[3].slice(r * 4, r * 4 + 4), 16)
    return Array.from({ length: STEPS }, (_, i) => ((n >> i) & 1) === 1)
  })
  return { pattern, bpm, swing }
}

export const PRESETS: { name: string; bpm: number; swing: number; rows: string[] }[] = [
  { name: 'Rock', bpm: 112, swing: 50, rows: ['x.......x.x.....', '....x.......x...', '', 'x.x.x.x.x.x.x.x.', '..............x.', '............xx..', '', ''] },
  { name: 'House', bpm: 124, swing: 54, rows: ['x...x...x...x...', '', '....x.......x...', 'xx.xxx.xxx.xxx.x', '..x...x...x...x.', '', '.......x.......x', ''] },
  { name: 'Koplo', bpm: 140, swing: 50, rows: ['x......x..x.....', '', '', 'x.xxx.xxx.xxx.xx', '', 'x..x..x.x..x..x.', '....x.......x..x', '..x...x...x...x.'] },
  { name: 'Hip-hop', bpm: 90, swing: 62, rows: ['x.........x.x...', '....x.......x...', '....x...........', 'x.x.x.x.x.x.x.x.', '..............x.', '', '.......x........', ''] },
  { name: 'Reggaeton', bpm: 96, swing: 50, rows: ['x...x...x...x...', '...x..x....x..x.', '', 'x.x.x.x.x.x.x.x.', '', '', '...x..x....x..x.', ''] },
]

/** A musical random pattern: density per drum, kick on 1, backbeat likely. */
export function randomPattern(rand: () => number = Math.random): Pattern {
  const density = [0.28, 0.08, 0.1, 0.55, 0.1, 0.1, 0.12, 0.08]
  const p = DRUMS.map((_, r) => Array.from({ length: STEPS }, (_, i) => rand() < density[r] * (i % 4 === 0 ? 1.6 : 1)))
  p[0][0] = true
  if (rand() < 0.8) p[1][4] = p[1][12] = true
  return p
}
