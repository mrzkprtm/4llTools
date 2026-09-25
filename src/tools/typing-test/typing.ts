export type CharState = 'correct' | 'incorrect' | 'pending'

/** Builds `count` words from `list` with a random source returning [0, 1). */
export function makeWords(list: readonly string[], count: number, random: () => number = Math.random): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    let w = list[Math.floor(random() * list.length)]
    if (w === out[out.length - 1]) w = list[(list.indexOf(w) + 1) % list.length]
    out.push(w)
  }
  return out
}

export function charStates(target: string, typed: string): CharState[] {
  return [...target].map((ch, i) => (i >= typed.length ? 'pending' : typed[i] === ch ? 'correct' : 'incorrect'))
}

export interface Score {
  /** Words per minute counting only correctly typed characters (5 chars = 1 word). */
  wpm: number
  /** Words per minute counting every typed character. */
  raw: number
  /** Share of keystrokes that were right when typed, 0–100. */
  accuracy: number
  correct: number
  incorrect: number
}

/**
 * `keystrokes` and `mistakes` count every character keypress (including ones
 * later deleted), so accuracy reflects corrections too.
 */
export function score(target: string, typed: string, ms: number, keystrokes: number, mistakes: number): Score {
  const minutes = ms / 60000
  let correct = 0
  for (let i = 0; i < typed.length && i < target.length; i++) if (typed[i] === target[i]) correct++
  const incorrect = Math.min(typed.length, target.length) - correct
  const wpm = minutes > 0 ? correct / 5 / minutes : 0
  const raw = minutes > 0 ? typed.length / 5 / minutes : 0
  const accuracy = keystrokes > 0 ? (Math.max(0, keystrokes - mistakes) / keystrokes) * 100 : 100
  return { wpm, raw, accuracy, correct, incorrect }
}

/** 100 when every per-second speed sample is the same, lower the more they vary. */
export function consistency(samples: number[]): number {
  if (samples.length < 2) return 100
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length
  if (mean <= 0) return 0
  const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length)
  return Math.max(0, Math.min(100, 100 * (1 - sd / mean)))
}

/** Speed per second from cumulative typed-character counts taken once a second. */
export function perSecondWpm(cumulative: number[]): number[] {
  return cumulative.map((c, i) => ((c - (cumulative[i - 1] ?? 0)) / 5) * 60)
}
