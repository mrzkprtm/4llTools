/** Pure scoring for the weighted decision matrix. */

export interface Option {
  id: string
  name: string
}

export interface Criterion {
  id: string
  name: string
  /** Relative importance, 0–10. */
  weight: number
}

/** Scores 1–5 keyed by `${optionId}:${criterionId}`; missing cells count as 3. */
export type Scores = Record<string, number>

export const cell = (o: string, c: string) => `${o}:${c}`

/** Weights as shares that add up to 1 (equal shares when every weight is 0). */
export function normalizeWeights(criteria: Criterion[]): number[] {
  const w = criteria.map((c) => Math.max(0, c.weight))
  const sum = w.reduce((a, b) => a + b, 0)
  if (!criteria.length) return []
  return sum > 0 ? w.map((x) => x / sum) : w.map(() => 1 / criteria.length)
}

export interface Result {
  id: string
  name: string
  /** Weighted average score, 1–5. */
  score: number
  /** 0–1 of the maximum possible. */
  pct: number
  rank: number
}

/** Weighted scores for every option, sorted best first. Ties share a rank and keep input order. */
export function rank(options: Option[], criteria: Criterion[], scores: Scores): Result[] {
  const shares = normalizeWeights(criteria)
  const res = options.map((o, i) => {
    const score = criteria.reduce((s, c, j) => s + shares[j] * clampScore(scores[cell(o.id, c.id)] ?? 3), 0)
    return { id: o.id, name: o.name, score: criteria.length ? score : 0, pct: criteria.length ? score / 5 : 0, rank: 0, i }
  })
  res.sort((a, b) => b.score - a.score || a.i - b.i)
  res.forEach((r, k) => (r.rank = k > 0 && Math.abs(r.score - res[k - 1].score) < 1e-9 ? res[k - 1].rank : k + 1))
  return res.map((r) => ({ id: r.id, name: r.name, score: r.score, pct: r.pct, rank: r.rank }))
}

function clampScore(v: number): number {
  return Math.min(5, Math.max(1, Math.round(v)))
}
