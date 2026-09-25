import type { MatchExtended, ZxcvbnResult } from '@zxcvbn-ts/core'

export const SCORE_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const

export function scoreLabel(score: number): string {
  return SCORE_LABELS[Math.max(0, Math.min(4, Math.round(score)))]
}

/** A tone for the meter: red for 0–1, amber for 2, green for 3–4. */
export function scoreTone(score: number): 'bad' | 'mid' | 'good' {
  return score <= 1 ? 'bad' : score === 2 ? 'mid' : 'good'
}

/** Size of the character pool the password draws from (the brute-force "alphabet"). */
export function charsetSize(pw: string): number {
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[ -/:-@[-`{-~]/.test(pw)) pool += 33
  if (/[^\x20-\x7e]/.test(pw)) pool += 100
  return pool
}

/**
 * Naive brute-force entropy: length × log2(pool). It assumes every character was
 * picked at random, so it overrates passwords made of words and patterns.
 */
export function entropyBits(pw: string): number {
  const n = [...pw].length
  const pool = charsetSize(pw)
  return n && pool ? n * Math.log2(pool) : 0
}

/** zxcvbn's estimate as bits: log2(guesses). */
export function guessesToBits(guessesLog10: number): number {
  return guessesLog10 * Math.log2(10)
}

export const SCENARIOS = [
  { key: 'onlineThrottlingXPerHour', label: 'Online, rate-limited', note: '100 guesses per hour, like a login form with lockouts' },
  { key: 'onlineNoThrottlingXPerSecond', label: 'Online, no limit', note: '10 guesses per second against an unprotected login' },
  { key: 'offlineSlowHashingXPerSecond', label: 'Offline, slow hash', note: '10,000 guesses per second against a stolen bcrypt/Argon2 hash' },
  { key: 'offlineFastHashingXPerSecond', label: 'Offline, fast hash', note: '10 billion guesses per second against a stolen MD5/SHA-1 hash on GPUs' },
] as const

/** Plain-language description of one pattern zxcvbn found. */
export function describeMatch(m: MatchExtended): string {
  const x = m as MatchExtended & Record<string, unknown>
  switch (m.pattern) {
    case 'dictionary': {
      const dict = String(x.dictionaryName ?? '')
      const src = dict.startsWith('passwords') ? 'a common password' : dict.includes('firstnames') || dict.includes('lastnames') ? 'a common name' : dict === 'userInputs' ? 'your own info' : 'a dictionary word'
      const extras = [x.reversed ? 'reversed' : '', x.l33t ? 'with l33t swaps' : ''].filter(Boolean).join(', ')
      return `${src}${x.matchedWord && x.matchedWord !== m.token.toLowerCase() ? ` (“${x.matchedWord}”)` : ''}${extras ? `, ${extras}` : ''}`
    }
    case 'spatial':
      return `keyboard pattern (${x.graph ?? 'keyboard'})`
    case 'repeat':
      return 'repeated characters'
    case 'sequence':
      return 'sequence like abc or 123'
    case 'regex':
      return x.regexName === 'recentYear' ? 'a recent year' : 'predictable pattern'
    case 'date':
      return 'a date'
    case 'separator':
      return 'separator'
    case 'bruteforce':
      return 'random-looking characters'
    default:
      return String(m.pattern)
  }
}

export type Checker = (pw: string, userInputs?: string[]) => ZxcvbnResult

/** Loads zxcvbn with the common and English dictionaries (about 1 MB, so only on demand). */
export async function loadChecker(): Promise<Checker> {
  const [{ ZxcvbnFactory }, common, en] = await Promise.all([import('@zxcvbn-ts/core'), import('@zxcvbn-ts/language-common'), import('@zxcvbn-ts/language-en')])
  const z = new ZxcvbnFactory({
    translations: en.translations,
    graphs: common.adjacencyGraphs,
    dictionary: { ...common.dictionary, ...en.dictionary },
    useLevenshteinDistance: true,
  })
  return (pw, userInputs) => z.check(pw, userInputs)
}
