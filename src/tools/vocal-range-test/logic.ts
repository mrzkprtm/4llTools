/** Vocal range logic: stable-note detection and voice type classification. MIDI numbers throughout. */

export interface VoiceType {
  id: string
  name: string
  low: number
  high: number
}

/** Typical comfortable choral ranges. */
export const VOICE_TYPES: VoiceType[] = [
  { id: 'bass', name: 'Bass', low: 40, high: 64 }, // E2–E4
  { id: 'baritone', name: 'Baritone', low: 45, high: 69 }, // A2–A4
  { id: 'tenor', name: 'Tenor', low: 48, high: 72 }, // C3–C5
  { id: 'alto', name: 'Alto', low: 53, high: 77 }, // F3–F5
  { id: 'mezzo', name: 'Mezzo-soprano', low: 57, high: 81 }, // A3–A5
  { id: 'soprano', name: 'Soprano', low: 60, high: 84 }, // C4–C6
]

/**
 * Voice types ranked by how well they fit a sung range. The low end and the
 * middle of the range matter most, since untrained singers rarely reach the top.
 */
export function classifyVoice(low: number, high: number): { type: VoiceType; score: number }[] {
  const mid = (low + high) / 2
  return VOICE_TYPES.map((t) => {
    const tMid = (t.low + t.high) / 2
    const score = Math.abs(low - t.low) * 1 + Math.abs(mid - tMid) * 0.8 + Math.max(0, high - t.high - 3) * 0.5
    return { type: t, score }
  }).sort((a, b) => a.score - b.score)
}

export interface StableState {
  start: number
  sum: number
  n: number
}

/**
 * Feeds one reading (time in ms, fractional MIDI or null for silence). Returns
 * the new run state and the note held so far when the run has lasted `holdMs`
 * within ±`tolerance` semitones of its mean.
 */
export function feedStable(state: StableState | null, t: number, midi: number | null, holdMs = 300, tolerance = 0.6): { state: StableState | null; stable: number | null } {
  if (midi === null || !Number.isFinite(midi)) return { state: null, stable: null }
  let s = state
  if (!s || Math.abs(midi - s.sum / s.n) > tolerance) s = { start: t, sum: 0, n: 0 }
  s = { start: s.start, sum: s.sum + midi, n: s.n + 1 }
  const stable = t - s.start >= holdMs ? Math.round(s.sum / s.n) : null
  return { state: s, stable }
}

/** All stable notes in a recorded track of readings. */
export function stableNotes(track: { t: number; midi: number | null }[], holdMs = 300): number[] {
  let state: StableState | null = null
  const out = new Set<number>()
  for (const r of track) {
    const res = feedStable(state, r.t, r.midi, holdMs)
    state = res.state
    if (res.stable !== null) out.add(res.stable)
  }
  return [...out].sort((a, b) => a - b)
}

export function describeRange(low: number, high: number): { semitones: number; octaves: string } {
  const semitones = Math.max(0, high - low)
  const oct = Math.floor(semitones / 12)
  const rest = semitones % 12
  const octaves = `${oct ? `${oct} octave${oct > 1 ? 's' : ''}` : ''}${oct && rest ? ' + ' : ''}${rest || !oct ? `${rest} semitone${rest === 1 ? '' : 's'}` : ''}`
  return { semitones, octaves }
}
