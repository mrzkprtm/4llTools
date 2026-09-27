export type Op = '+' | '-' | '×' | '÷'
export type OpChoice = Op | 'mix'
export type Level = 1 | 2 | 3

export interface Question {
  a: number
  b: number
  op: Op
  answer: number
}

const int = (lo: number, hi: number, random: () => number) => lo + Math.floor(random() * (hi - lo + 1))
const OPS: Op[] = ['+', '-', '×', '÷']

/**
 * A question at a level (1 = one-digit numbers, 2 = two-digit, 3 = three-digit).
 * Subtraction never goes below zero and division always comes out whole.
 */
export function makeQuestion(choice: OpChoice, level: Level, random: () => number = Math.random): Question {
  const op = choice === 'mix' ? OPS[int(0, 3, random)] : choice
  const lo = level === 1 ? 1 : 10 ** (level - 1)
  const hi = 10 ** level - 1
  if (op === '+') {
    const a = int(lo, hi, random)
    const b = int(lo, hi, random)
    return { a, b, op, answer: a + b }
  }
  if (op === '-') {
    let a = int(lo, hi, random)
    let b = int(lo, hi, random)
    if (b > a) [a, b] = [b, a]
    return { a, b, op, answer: a - b }
  }
  // Products and quotients stay mental-sized: level 1 is the times tables,
  // level 2 is two digits by one digit, level 3 is two digits by two digits.
  const [x, y] = level === 1 ? [int(2, 9, random), int(2, 9, random)] : level === 2 ? [int(11, 99, random), int(2, 9, random)] : [int(11, 99, random), int(11, 99, random)]
  if (op === '×') return { a: x, b: y, op, answer: x * y }
  return { a: x * y, b: y, op, answer: x }
}

/** A few questions in a row without the same one twice in a row. */
export function nextQuestion(choice: OpChoice, level: Level, prev: Question | null, random: () => number = Math.random): Question {
  for (let i = 0; i < 10; i++) {
    const q = makeQuestion(choice, level, random)
    if (!prev || q.a !== prev.a || q.b !== prev.b || q.op !== prev.op) return q
  }
  return makeQuestion(choice, level, random)
}

/**
 * Points for one answer: 10 per level, a speed bonus of up to 10 for answers
 * under 5 seconds, and a streak bonus of 1 per answer already in the streak (max 10).
 */
export function points(correct: boolean, ms: number, level: Level, streak: number): number {
  if (!correct) return 0
  const speed = Math.max(0, Math.round(10 - (ms / 5000) * 10))
  return level * 10 + speed + Math.min(10, streak)
}

export interface Attempt {
  q: Question
  given: number | null
  correct: boolean
  ms: number
}

export interface Summary {
  score: number
  correct: number
  total: number
  accuracy: number
  avgMs: number
  bestStreak: number
}

export function summarize(attempts: readonly Attempt[], level: Level): Summary {
  let score = 0
  let streak = 0
  let bestStreak = 0
  for (const a of attempts) {
    score += points(a.correct, a.ms, level, streak)
    streak = a.correct ? streak + 1 : 0
    bestStreak = Math.max(bestStreak, streak)
  }
  const correct = attempts.filter((a) => a.correct).length
  const total = attempts.length
  return { score, correct, total, accuracy: total ? correct / total : 0, avgMs: total ? attempts.reduce((s, a) => s + a.ms, 0) / total : 0, bestStreak }
}

export const bestKey = (op: OpChoice, level: Level, mode: string) => `${mode}:${op}:${level}`
