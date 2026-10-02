/** Pitch detection (YIN) and note math shared by the tuner and the vocal range test. */

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const

export const midiToFreq = (midi: number, a4 = 440) => a4 * 2 ** ((midi - 69) / 12)
export const freqToMidi = (freq: number, a4 = 440) => 69 + 12 * Math.log2(freq / a4)

export function noteName(midi: number): string {
  const m = Math.round(midi)
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`
}

export interface NoteReading {
  midi: number
  name: string
  octave: number
  /** Deviation from the nearest equal-tempered note, −50…+50. */
  cents: number
  target: number
}

export function freqToNote(freq: number, a4 = 440): NoteReading {
  const exact = freqToMidi(freq, a4)
  const midi = Math.round(exact)
  return {
    midi,
    name: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: (exact - midi) * 100,
    target: midiToFreq(midi, a4),
  }
}

export const centsBetween = (freq: number, ref: number) => 1200 * Math.log2(freq / ref)

export function rms(buf: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  return Math.sqrt(s / (buf.length || 1))
}

export interface PitchOptions {
  minFreq?: number
  maxFreq?: number
  /** YIN threshold on the cumulative mean normalized difference. */
  threshold?: number
  /** Buffers quieter than this RMS are treated as silence. */
  gate?: number
}

/**
 * YIN pitch detection with parabolic interpolation. Returns the fundamental
 * frequency in Hz and a clarity score in 0…1, or null for silence and noise.
 */
export function detectPitch(buf: Float32Array, sampleRate: number, opts: PitchOptions = {}): { freq: number; clarity: number } | null {
  const { minFreq = 35, maxFreq = 1600, threshold = 0.15, gate = 0.008 } = opts
  if (rms(buf) < gate) return null
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq))
  const tauMax = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2))
  if (tauMax <= tauMin + 2) return null
  const win = buf.length - tauMax
  const d = new Float32Array(tauMax + 1)
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0
    for (let j = 0; j < win; j++) {
      const x = buf[j] - buf[j + tau]
      s += x * x
    }
    d[tau] = s
  }
  // Cumulative mean normalized difference.
  const cm = new Float32Array(tauMax + 1)
  cm[0] = 1
  let run = 0
  for (let tau = 1; tau <= tauMax; tau++) {
    run += d[tau]
    cm[tau] = run > 0 ? (d[tau] * tau) / run : 1
  }
  let tau = -1
  for (let t = tauMin; t < tauMax; t++) {
    if (cm[t] < threshold) {
      while (t + 1 < tauMax && cm[t + 1] < cm[t]) t++
      tau = t
      break
    }
  }
  if (tau < 0) {
    // No dip under the threshold: take the global minimum if it is reasonably clear.
    let best = tauMin
    for (let t = tauMin; t < tauMax; t++) if (cm[t] < cm[best]) best = t
    if (cm[best] > 0.35) return null
    tau = best
  }
  const a = cm[tau - 1]
  const b = cm[tau]
  const c = tau + 1 <= tauMax ? cm[tau + 1] : b
  const den = a - 2 * b + c
  const shift = den !== 0 ? (0.5 * (a - c)) / den : 0
  const period = tau + (Math.abs(shift) < 1 ? shift : 0)
  return { freq: sampleRate / period, clarity: Math.max(0, Math.min(1, 1 - b)) }
}

/** A sine (plus optional harmonics) for tests and demos. */
export function synth(freq: number, sampleRate: number, length: number, harmonics: number[] = [1]): Float32Array {
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    let v = 0
    harmonics.forEach((amp, h) => (v += amp * Math.sin((2 * Math.PI * freq * (h + 1) * i) / sampleRate)))
    out[i] = 0.5 * v
  }
  return out
}

export interface Instrument {
  id: string
  name: string
  strings: number[]
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'guitar', name: 'Guitar', strings: [40, 45, 50, 55, 59, 64] },
  { id: 'dropd', name: 'Drop D', strings: [38, 45, 50, 55, 59, 64] },
  { id: 'ukulele', name: 'Ukulele', strings: [67, 60, 64, 69] },
  { id: 'bass', name: 'Bass', strings: [28, 33, 38, 43] },
  { id: 'violin', name: 'Violin', strings: [55, 62, 69, 76] },
]

/** Index of the string whose target note is closest (in cents) to `freq`. */
export function nearestString(freq: number, strings: number[], a4 = 440): number {
  let best = 0
  let bestDist = Infinity
  strings.forEach((m, i) => {
    const dist = Math.abs(centsBetween(freq, midiToFreq(m, a4)))
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  })
  return best
}
