/** Drossel–Schwabl forest fire cellular automaton with wind, plus a site-percolation helper. */

export const EMPTY = 0
export const TREE = 1
export const FIRE = 2
export const ASH = 3

export interface ForestParams {
  /** Chance per step that an empty cell grows a tree. */
  grow: number
  /** Chance per step that a tree is struck by lightning. */
  lightning: number
  /** Chance that fire jumps to a neighbouring tree in still air (1 − humidity). */
  spread: number
  /** Wind strength 0–1 and the direction it blows towards (unit vector, y down). */
  wind: number
  wx: number
  wy: number
  /** Chance per step that ash crumbles to bare ground. */
  ashDecay: number
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

/**
 * Chance that fire crosses from a burning cell to a tree, where `alignment` ∈ [−1, 1] is the cosine
 * between the wind and the direction of travel: downwind spreads faster, upwind slower.
 */
export function igniteChance(spread: number, wind: number, alignment: number): number {
  return Math.min(1, Math.max(0, spread * (1 + wind * alignment)))
}

export interface Grid {
  w: number
  h: number
  cell: Uint8Array
  /** Which fire a burning or burnt cell belongs to (0 = none). */
  fire: Int32Array
  age: Uint16Array
}

export function makeGrid(w: number, h: number): Grid {
  return { w, h, cell: new Uint8Array(w * h), fire: new Int32Array(w * h), age: new Uint16Array(w * h) }
}

/**
 * One synchronous update. Returns the new grid state in `out` plus the number of lightning strikes
 * this step and how many cells each fire gained (keyed by fire id).
 */
export function stepForest(g: Grid, out: Grid, p: ForestParams, nextFireId: () => number, random: () => number = Math.random): { strikes: number; burned: Map<number, number> } {
  const { w, h, cell, fire, age } = g
  const burned = new Map<number, number>()
  let strikes = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const s = cell[i]
      out.fire[i] = fire[i]
      out.age[i] = age[i]
      if (s === FIRE) {
        out.cell[i] = ASH
      } else if (s === ASH) {
        out.cell[i] = random() < p.ashDecay ? EMPTY : ASH
        if (out.cell[i] === EMPTY) out.fire[i] = 0
      } else if (s === EMPTY) {
        if (random() < p.grow) {
          out.cell[i] = TREE
          out.age[i] = 0
        } else out.cell[i] = EMPTY
      } else {
        // A tree: burning neighbours may set it alight; otherwise lightning might.
        let keep = 1
        let from = 0
        let near = false
        for (const [dx, dy] of DIRS) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const j = ny * w + nx
          if (cell[j] !== FIRE) continue
          const chance = igniteChance(p.spread, p.wind, -dx * p.wx - dy * p.wy)
          keep *= 1 - chance
          from = fire[j] || from
          near = true
        }
        if (near && random() >= keep) {
          out.cell[i] = FIRE
          out.fire[i] = from
          if (from) burned.set(from, (burned.get(from) ?? 0) + 1)
        } else if (random() < p.lightning) {
          const id = nextFireId()
          out.cell[i] = FIRE
          out.fire[i] = id
          burned.set(id, 1)
          strikes++
        } else {
          out.cell[i] = TREE
          if (age[i] < 65535) out.age[i] = age[i] + 1
        }
      }
    }
  return { strikes, burned }
}

/** Fills a w×h array with trees (1) at the given density. */
export function randomForest(w: number, h: number, density: number, random: () => number = Math.random): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = random() < density ? 1 : 0
  return out
}

/** True when a path of 4-connected trees joins the left edge to the right edge. */
export function percolates(trees: Uint8Array, w: number, h: number): boolean {
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  for (let y = 0; y < h; y++)
    if (trees[y * w]) {
      seen[y * w] = 1
      stack.push(y * w)
    }
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    if (x === w - 1) return true
    const y = (i - x) / w
    for (const [dx, dy] of DIRS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      if (trees[j] && !seen[j]) {
        seen[j] = 1
        stack.push(j)
      }
    }
  }
  return false
}

/** Fraction of random forests at this density that a fire can cross from left to right. */
export function crossingProbability(density: number, trials: number, w: number, h: number, random: () => number = Math.random): number {
  let hits = 0
  for (let t = 0; t < trials; t++) if (percolates(randomForest(w, h, density, random), w, h)) hits++
  return hits / trials
}
