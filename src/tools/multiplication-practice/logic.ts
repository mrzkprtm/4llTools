/** A multiplication fact a × b. */
export interface Fact {
  a: number
  b: number
}

export const factKey = (f: Fact) => `${f.a}x${f.b}`

/** Every fact for the chosen tables (the first factor), times 1 to `upTo`. */
export function factsFor(tables: readonly number[], upTo = 12): Fact[] {
  const out: Fact[] = []
  for (const a of [...new Set(tables)].sort((x, y) => x - y)) for (let b = 1; b <= upTo; b++) out.push({ a, b })
  return out
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * A quiz of `count` questions from the chosen tables. No fact repeats until
 * every fact has been asked once, and the same fact never comes twice in a row.
 * Factor order is flipped at random so 3 × 7 and 7 × 3 both appear.
 */
export function makeQuiz(tables: readonly number[], count: number, random: () => number = Math.random, flip = true): Fact[] {
  return quizFrom(factsFor(tables), count, random, flip)
}

/** Same as makeQuiz, from an explicit list of facts (used to review missed facts). */
export function quizFrom(facts: readonly Fact[], count: number, random: () => number = Math.random, flip = false): Fact[] {
  if (!facts.length || count <= 0) return []
  const out: Fact[] = []
  while (out.length < count) {
    let round = shuffled(facts, random)
    const prev = out[out.length - 1]
    if (prev && round.length > 1 && factKey(round[0]) === factKey(prev)) round = [...round.slice(1), round[0]]
    out.push(...round.slice(0, count - out.length))
  }
  return flip ? out.map((f) => (random() < 0.5 ? { a: f.b, b: f.a } : f)) : out
}

export interface Score {
  score: number
  streak: number
  best: number
  correct: number
  wrong: number
}

export const EMPTY_SCORE: Score = { score: 0, streak: 0, best: 0, correct: 0, wrong: 0 }

/** Streak lengths that set off confetti. */
export const MILESTONE = 5

/**
 * Updates the score after one answer. A correct answer is worth 10 points plus
 * 2 per answer already in the streak (capped at +10). `milestone` is true when
 * the streak just reached a multiple of MILESTONE.
 */
export function scoreAnswer(s: Score, correct: boolean): Score & { gained: number; milestone: boolean } {
  if (!correct) return { ...s, streak: 0, wrong: s.wrong + 1, gained: 0, milestone: false }
  const gained = 10 + Math.min(10, s.streak * 2)
  const streak = s.streak + 1
  return { score: s.score + gained, streak, best: Math.max(s.best, streak), correct: s.correct + 1, wrong: s.wrong, gained, milestone: streak % MILESTONE === 0 }
}

/** Skip counting: a, 2a, 3a … b·a. */
export const skipCount = (a: number, b: number) => Array.from({ length: b }, (_, i) => a * (i + 1))
