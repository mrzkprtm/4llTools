/** Level math and a simplified ascending (Hughson–Westlake style) threshold search. */

export const FREQS = [250, 500, 1000, 2000, 4000, 8000, 12000, 16000] as const
/** Test order: start at 1 kHz as audiologists do, go up, then the lows. */
export const ORDER = [1000, 2000, 4000, 8000, 12000, 16000, 500, 250] as const

export const START_DB = -60
export const MIN_DB = -90
export const MAX_DB = 0
export const STEP_UP = 5
export const STEP_DOWN = 15

export const dbToGain = (db: number) => Math.pow(10, db / 20)
export const gainToDb = (g: number) => (g > 0 ? 20 * Math.log10(g) : -Infinity)

export interface Stair {
  /** Level (dB relative to the calibrated comfortable 1 kHz tone) of the next tone. */
  level: number
  /** Levels at which the listener said they heard it. */
  heard: number[]
  tones: number
  done: boolean
  /** Estimated threshold in dB, or null when not heard even at the loudest level. */
  threshold: number | null
}

export const newStair = (start = START_DB): Stair => ({ level: start, heard: [], tones: 0, done: false, threshold: null })

/**
 * Updates the staircase after one tone. Heard → note the level and drop 15 dB;
 * not heard → go up 5 dB. Two responses within 5 dB of each other (or three in
 * total) settle the threshold; no response at the maximum level means not heard.
 */
export function stairStep(s: Stair, heard: boolean): Stair {
  if (s.done) return s
  const tones = s.tones + 1
  if (!heard) {
    const level = s.level + STEP_UP
    if (level > MAX_DB) return { ...s, tones, level: MAX_DB, done: true, threshold: s.heard.length ? Math.min(...s.heard) : null }
    return { ...s, tones, level }
  }
  const list = [...s.heard, s.level]
  const n = list.length
  let threshold: number | null = null
  if (n >= 2 && Math.abs(list[n - 1] - list[n - 2]) <= STEP_UP) threshold = Math.max(list[n - 1], list[n - 2])
  else if (n >= 3) threshold = [...list].sort((a, b) => a - b)[1]
  if (threshold !== null) return { ...s, tones, heard: list, done: true, threshold }
  return { ...s, tones, heard: list, level: Math.max(MIN_DB, s.level - STEP_DOWN) }
}

/** Frequency at time t (s) of an exponential sweep from f0 to f1 over `dur` seconds. */
export function sweepFreq(f0: number, f1: number, dur: number, t: number): number {
  const k = Math.max(0, Math.min(1, t / dur))
  return f0 * Math.pow(f1 / f0, k)
}

/** Rough age band typically still hearing a frequency (a playful guide, not a diagnosis). */
export function sweepAgeHint(hz: number): string {
  if (hz >= 17000) return 'typical for teens and people in their early 20s'
  if (hz >= 15000) return 'typical for people under about 30'
  if (hz >= 13000) return 'typical for people under about 40'
  if (hz >= 11000) return 'typical for people around 40–50'
  return 'common from middle age on, or limited by your headphones'
}

export const fmtHz = (f: number) => (f >= 1000 ? `${+(f / 1000).toFixed(f % 1000 ? 1 : 0)}k` : String(f))
