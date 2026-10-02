/** Readability formulas and Hemingway-style hints for English text. */

const EXCEPTIONS: Record<string, number> = {
  the: 1, every: 2, everything: 3, everyone: 3, business: 2, different: 3, family: 3, evening: 2, science: 2, create: 2,
  created: 3, creates: 2, area: 3, idea: 3, being: 2, poem: 2, quiet: 2, people: 2, simile: 3, recipe: 3, coyote: 3,
  naive: 2, cafe: 2, apple: 2, maybe: 2, someone: 2, sometimes: 2, something: 2, somewhere: 2, whereas: 2, lived: 1,
  loved: 1, used: 1, asked: 1, fire: 1, hour: 1, our: 1, real: 1, really: 2, ion: 2, lion: 2, via: 2, diet: 2,
}

/**
 * Estimates syllables in an English word. Starts with vowel groups, then
 * adjusts for silent "e", "-ed" and "-es" endings and "-le" after a consonant.
 * Heuristic, so expect the odd miss; common exceptions are listed.
 */
export function syllables(input: string): number {
  const word = input.toLowerCase().replace(/[^a-z]/g, '')
  if (!word) return 0
  if (EXCEPTIONS[word] !== undefined) return EXCEPTIONS[word]
  if (word.length <= 3) return 1
  const core = word.replace(/^y/, '') // a leading y is a consonant ("yes", "young")
  let count = (core.match(/[aeiouy]+/g) ?? []).length
  // Silent final e ("make", "state"), but not "-le" after a consonant ("table").
  if (/[^aeiouy]e$/.test(word) && !/[^aeiouy]le$/.test(word)) count--
  // "-ed" is silent unless after t/d ("jumped" vs "wanted").
  if (/[^aeiouytd]ed$/.test(word)) count--
  // "-es" is silent unless after s, x, z, ch, sh, g or c ("makes" vs "boxes", "pages").
  if (/[^aeiouysxzhgc]es$/.test(word)) count--
  // Vowel pairs that are usually two syllables ("piano", "video", "radio", "usual"), but not "-tion", "-cial", "qua".
  count += (word.match(/(?<![tcsg])ia|(?<![tcsx])io(?!u)|(?<![qg])ua|eo|ie[rt]$|iu/g) ?? []).length
  return Math.max(1, count)
}

export interface Sentence {
  text: string
  start: number
  end: number
  words: number
}

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'no', 'inc', 'ltd', 'co', 'fig', 'approx'])

/** Splits text into sentences with offsets. Line breaks end a sentence; common abbreviations and decimals don't. */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = []
  let start = 0
  const push = (end: number) => {
    const raw = text.slice(start, end)
    const lead = raw.length - raw.trimStart().length
    const body = raw.trim()
    if (body) {
      const words = wordList(body).length
      if (words) out.push({ text: body, start: start + lead, end: start + lead + body.length, words })
    }
    start = end
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\n') {
      push(i + 1)
      continue
    }
    if (ch !== '.' && ch !== '!' && ch !== '?') continue
    let j = i
    while (j + 1 < text.length && /[.!?"'’”)\]]/.test(text[j + 1])) j++
    const next = text[j + 1]
    if (next !== undefined && !/\s/.test(next)) continue // "3.14", "example.com"
    if (ch === '.') {
      const before = text.slice(start, i).match(/([\p{L}.]+)$/u)?.[1]?.toLowerCase()
      if (before && (ABBREVIATIONS.has(before) || /^\p{L}$/u.test(before))) continue // "Dr.", "J. Smith"
    }
    push(j + 1)
    i = j
  }
  push(text.length)
  return out
}

export function wordList(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []
}

export interface Report {
  words: number
  sentences: number
  syllables: number
  letters: number
  complexWords: number
  polysyllables: number
  fleschEase: number
  fleschKincaid: number
  gunningFog: number
  smog: number
  colemanLiau: number
  ari: number
  readingMinutes: number
  speakingMinutes: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function analyze(text: string): Report | null {
  const words = wordList(text)
  const sentences = Math.max(1, splitSentences(text).length)
  if (!words.length) return null
  let syl = 0
  let letters = 0
  let complex = 0
  let poly = 0
  for (const w of words) {
    const s = syllables(w)
    syl += s
    letters += (w.match(/[\p{L}\p{N}]/gu) ?? []).length
    if (s >= 3) {
      poly++
      // Gunning Fog leaves out proper nouns, hyphenated words and -ed/-es/-ing inflections that reach 3 syllables.
      if (!/^\p{Lu}/u.test(w) && !w.includes('-') && !(syllables(w.replace(/(ed|es|ing)$/i, '')) < 3)) complex++
    }
  }
  const W = words.length
  const wps = W / sentences
  const spw = syl / W
  const L = (letters / W) * 100
  const S = (sentences / W) * 100
  return {
    words: W,
    sentences,
    syllables: syl,
    letters,
    complexWords: complex,
    polysyllables: poly,
    fleschEase: round1(206.835 - 1.015 * wps - 84.6 * spw),
    fleschKincaid: round1(0.39 * wps + 11.8 * spw - 15.59),
    gunningFog: round1(0.4 * (wps + 100 * (complex / W))),
    smog: round1(1.043 * Math.sqrt(poly * (30 / sentences)) + 3.1291),
    colemanLiau: round1(0.0588 * L - 0.296 * S - 15.8),
    ari: round1(4.71 * (letters / W) + 0.5 * wps - 21.43),
    readingMinutes: W / 238,
    speakingMinutes: W / 150,
  }
}

/** Plain-language label for a Flesch Reading Ease score. */
export function easeLabel(score: number): { label: string; audience: string } {
  if (score >= 90) return { label: 'Very easy', audience: 'Age 11 and up' }
  if (score >= 80) return { label: 'Easy', audience: 'Age 12–13' }
  if (score >= 70) return { label: 'Fairly easy', audience: 'Age 13–14' }
  if (score >= 60) return { label: 'Plain English', audience: 'Age 14–16' }
  if (score >= 50) return { label: 'Fairly difficult', audience: 'Age 16–18' }
  if (score >= 30) return { label: 'Difficult', audience: 'University level' }
  return { label: 'Very difficult', audience: 'Graduate level' }
}

export type HintKind = 'passive' | 'adverb'
export interface Hint {
  kind: HintKind
  start: number
  end: number
}

const IRREGULAR =
  'awoken|been|born|beaten|become|begun|bent|bet|bitten|bled|blown|broken|brought|built|burnt|bought|caught|chosen|come|cost|cut|dealt|done|drawn|driven|drunk|eaten|fallen|fed|felt|fought|found|forbidden|forgotten|forgiven|frozen|given|gone|grown|hung|heard|hidden|hit|held|hurt|kept|known|laid|led|left|lent|let|lost|made|meant|met|paid|put|quit|read|ridden|rung|risen|run|said|seen|sold|sent|set|shaken|shot|shown|shut|sung|sunk|sat|slept|spoken|spent|spun|split|spread|stolen|stuck|struck|sworn|swept|swum|taken|taught|torn|told|thought|thrown|understood|woken|worn|won|written'

const PASSIVE_RE = new RegExp(`\\b(?:am|is|are|was|were|be|been|being|is\\s+being|are\\s+being|was\\s+being|were\\s+being|has\\s+been|have\\s+been|had\\s+been|will\\s+be|get|gets|got|gotten)\\s+(?:\\w+ly\\s+)?(?:\\w+ed|${IRREGULAR})\\b`, 'gi')

/** Words ending in -ly that are not adverbs (or are too common to flag). */
const NOT_ADVERBS = new Set(
  'only family reply apply supply imply comply rely ally belly bully fly july italy holy ugly lovely friendly likely early daily weekly monthly yearly hourly silly jelly lily rally sully tally anomaly assembly butterfly dragonfly monopoly melancholy costly lonely lively elderly orderly curly chilly hilly smelly deadly ghastly homely kindly manly worldly scholarly timely unlikely unruly wily'.split(
    ' ',
  ),
)

/** Finds passive-voice phrases and -ly adverbs, like the Hemingway app. */
export function findHints(text: string): Hint[] {
  const hints: Hint[] = []
  for (const m of text.matchAll(PASSIVE_RE)) hints.push({ kind: 'passive', start: m.index!, end: m.index! + m[0].length })
  for (const m of text.matchAll(/\b[A-Za-z]{3,}ly\b/g)) {
    if (NOT_ADVERBS.has(m[0].toLowerCase())) continue
    const s = m.index!
    const e = s + m[0].length
    if (hints.some((h) => h.kind === 'passive' && s >= h.start && e <= h.end)) continue
    hints.push({ kind: 'adverb', start: s, end: e })
  }
  return hints.sort((a, b) => a.start - b.start)
}

export const LONG_SENTENCE = 25
export const VERY_LONG_SENTENCE = 35

export function sentenceLevel(words: number): 'ok' | 'long' | 'very-long' {
  return words > VERY_LONG_SENTENCE ? 'very-long' : words > LONG_SENTENCE ? 'long' : 'ok'
}
