export const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ .,!?'"

/** Upper-cases the phrase and drops characters the GA cannot produce. */
export function sanitize(s: string): string {
  return [...s.toUpperCase()].filter((c) => CHARSET.includes(c)).join('').slice(0, 40)
}

const randomChar = (random: () => number) => CHARSET[Math.floor(random() * CHARSET.length)]

export function randomString(len: number, random: () => number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += randomChar(random)
  return s
}

/** Share of positions that already hold the right character (0–1). */
export function fitness(s: string, target: string): number {
  if (!target.length) return 1
  let m = 0
  for (let i = 0; i < target.length; i++) if (s[i] === target[i]) m++
  return m / target.length
}

/** Each character is replaced by a random one with probability `rate`. */
export function mutate(s: string, rate: number, random: () => number): string {
  if (rate <= 0) return s
  let out = ''
  for (let i = 0; i < s.length; i++) out += random() < rate ? randomChar(random) : s[i]
  return out
}

/** Single-point crossover: the head of one parent joined to the tail of the other. */
export function crossover(a: string, b: string, random: () => number): string {
  const cut = Math.floor(random() * (a.length + 1))
  return a.slice(0, cut) + b.slice(cut)
}

export type Selection = 'roulette' | 'tournament'

export interface GAParams {
  target: string
  mutation: number
  crossover: boolean
  selection: Selection
  elitism: number
}

export interface Population {
  members: string[]
  scores: number[]
  generation: number
  evaluations: number
}

function score(members: string[], target: string): number[] {
  return members.map((m) => fitness(m, target))
}

/** Sorts members best first. */
function rank(p: Population) {
  const order = p.members.map((_, i) => i).sort((a, b) => p.scores[b] - p.scores[a])
  p.members = order.map((i) => p.members[i])
  p.scores = order.map((i) => p.scores[i])
}

export function createPopulation(size: number, target: string, random: () => number): Population {
  const members = Array.from({ length: size }, () => randomString(target.length, random))
  const p = { members, scores: score(members, target), generation: 0, evaluations: size }
  rank(p)
  return p
}

/** Picks one parent index. Roulette weights by fitness; a tournament takes the best of 3 random picks. */
export function pick(scores: number[], method: Selection, random: () => number): number {
  if (method === 'tournament') {
    let best = Math.floor(random() * scores.length)
    for (let k = 0; k < 2; k++) {
      const i = Math.floor(random() * scores.length)
      if (scores[i] > scores[best]) best = i
    }
    return best
  }
  let total = 0
  for (const s of scores) total += s
  if (total <= 0) return Math.floor(random() * scores.length)
  let r = random() * total
  for (let i = 0; i < scores.length; i++) {
    r -= scores[i]
    if (r <= 0) return i
  }
  return scores.length - 1
}

/** Builds the next generation: elites are copied, the rest are bred from selected parents. */
export function nextGeneration(p: Population, g: GAParams, random: () => number): Population {
  const n = p.members.length
  const kids: string[] = p.members.slice(0, Math.min(g.elitism, n))
  while (kids.length < n) {
    const a = p.members[pick(p.scores, g.selection, random)]
    const child = g.crossover ? crossover(a, p.members[pick(p.scores, g.selection, random)], random) : a
    kids.push(mutate(child, g.mutation, random))
  }
  const out = { members: kids, scores: score(kids, g.target), generation: p.generation + 1, evaluations: p.evaluations + n }
  rank(out)
  return out
}
