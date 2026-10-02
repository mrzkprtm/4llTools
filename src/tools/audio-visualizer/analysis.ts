export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

/** Centre frequency of FFT bin i: i · sampleRate / fftSize. */
export const binFrequency = (bin: number, sampleRate: number, fftSize: number) => (bin * sampleRate) / fftSize

/** The FFT bin nearest to a frequency. */
export const frequencyBin = (freq: number, sampleRate: number, fftSize: number) => Math.round((freq * fftSize) / sampleRate)

/** Nearest equal-tempered note (A4 = 440 Hz) and how many cents the frequency is off it. */
export function noteName(freq: number): { name: string; octave: number; cents: number; label: string } | null {
  if (!(freq > 0) || !Number.isFinite(freq)) return null
  const midi = 69 + 12 * Math.log2(freq / 440)
  const n = Math.round(midi)
  const cents = Math.round((midi - n) * 100)
  const name = NOTE_NAMES[((n % 12) + 12) % 12]
  const octave = Math.floor(n / 12) - 1
  return { name, octave, cents, label: `${name}${octave} ${cents >= 0 ? '+' : '−'}${Math.abs(cents)}¢` }
}

/** Frequency of MIDI note m. */
export const midiFrequency = (m: number) => 440 * 2 ** ((m - 69) / 12)

/**
 * The loudest frequency in a dB spectrum (as from getFloatFrequencyData), refined by fitting a
 * parabola through the peak bin and its neighbours. Returns 0 when everything is below `floor` dB.
 */
export function peakFrequency(db: ArrayLike<number>, sampleRate: number, fftSize: number, minHz = 30, floor = -85): number {
  const start = Math.max(1, Math.ceil((minHz * fftSize) / sampleRate))
  let best = -1
  let bv = -Infinity
  for (let i = start; i < db.length - 1; i++)
    if (db[i] > bv) {
      bv = db[i]
      best = i
    }
  if (best < 0 || bv < floor) return 0
  const a = db[best - 1]
  const b = db[best]
  const c = db[best + 1]
  const denom = a - 2 * b + c
  const shift = Number.isFinite(denom) && Math.abs(denom) > 1e-9 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) : 0
  return binFrequency(best + shift, sampleRate, fftSize)
}

/** Root-mean-square level of samples in [-1, 1], in dB relative to full scale. */
export function rmsDb(samples: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i]
  const rms = Math.sqrt(s / Math.max(1, samples.length))
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity
}

/** Edges of `bands` logarithmically spaced bands from fMin to fMax (bands + 1 values). */
export function logEdges(bands: number, fMin: number, fMax: number): number[] {
  return Array.from({ length: bands + 1 }, (_, i) => fMin * (fMax / fMin) ** (i / bands))
}

/**
 * Loudest dB value inside each band. Narrow low bands that fall between bins take the
 * nearest bin, so the bars never have holes.
 */
export function bandLevels(db: ArrayLike<number>, edges: number[], sampleRate: number, fftSize: number, out: Float32Array) {
  for (let b = 0; b < edges.length - 1; b++) {
    const lo = Math.max(1, Math.floor((edges[b] * fftSize) / sampleRate))
    const hi = Math.min(db.length - 1, Math.max(lo, Math.floor((edges[b + 1] * fftSize) / sampleRate)))
    let v = -Infinity
    for (let i = lo; i <= hi; i++) if (db[i] > v) v = db[i]
    out[b] = v
  }
  return out
}

/** Maps a dB value onto 0…1 between floor and ceiling. */
export const dbUnit = (db: number, floor: number, ceil: number) => (db <= floor || !Number.isFinite(db) ? 0 : db >= ceil ? 1 : (db - floor) / (ceil - floor))

/**
 * Index of the first rising zero crossing, used to trigger the oscilloscope so a steady
 * tone stands still on screen. Returns 0 when there is none in the first half.
 */
export function risingZero(samples: ArrayLike<number>): number {
  for (let i = 1; i < samples.length / 2; i++) if (samples[i - 1] < 0 && samples[i] >= 0) return i
  return 0
}
