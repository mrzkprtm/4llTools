import type { Country } from './countries'

export type Mode = 'flag' | 'capital' | 'reverse'

/** Emoji flag from an ISO 3166-1 alpha-2 code, built from regional indicator letters. */
export function flagEmoji(code: string): string {
  const cc = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface Question {
  answer: Country
  /** Four choices (fewer only if the list is tiny), answer included, in random order. */
  options: Country[]
}

/** The text shown on an option button for a mode. */
export const optionLabel = (c: Country, mode: Mode) => (mode === 'capital' ? c.capital : c.name)

/**
 * A multiple-choice question. Distractors come from the answer's own region
 * (so the flags and names look alike), topped up from elsewhere when needed.
 * Options never share a label with the answer.
 */
export function makeQuestion(answer: Country, all: readonly Country[], mode: Mode, random: () => number = Math.random, count = 4): Question {
  const seen = new Set([optionLabel(answer, mode)])
  const pick: Country[] = []
  const take = (list: Country[]) => {
    for (const c of list) {
      if (pick.length >= count - 1) break
      const label = optionLabel(c, mode)
      if (c.code === answer.code || seen.has(label)) continue
      seen.add(label)
      pick.push(c)
    }
  }
  take(shuffle(all.filter((c) => c.region === answer.region), random))
  take(shuffle(all.filter((c) => c.region !== answer.region), random))
  return { answer, options: shuffle([answer, ...pick], random) }
}

/** A round: `count` different countries from the pool (all of them if count is 0). */
export const makeRound = (pool: readonly Country[], count: number, random: () => number = Math.random) => shuffle(pool, random).slice(0, count > 0 ? count : pool.length)
