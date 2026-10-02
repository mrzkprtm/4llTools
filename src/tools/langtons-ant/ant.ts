/** Langton's ant and its multi-colour generalisations (turmites) on a wrap-around grid. */

/** Directions clockwise from up; y grows downwards. */
export const DX = [0, 1, 0, -1]
export const DY = [-1, 0, 1, 0]

export interface Ant {
  x: number
  y: number
  dir: number
  /** Unwrapped position, for measuring how far the ant has travelled. */
  ux: number
  uy: number
}

/**
 * Parses a rule such as "RL" or "LLRR": letter i says how to turn on a cell of
 * colour i (R right, L left, N no turn, U u-turn). Returns quarter turns, or null.
 */
export function parseTurmite(rule: string): number[] | null {
  const s = rule.replace(/\s/g, '').toUpperCase()
  if (s.length < 2 || s.length > 16 || !/^[LRNU]+$/.test(s)) return null
  return [...s].map((c) => ({ R: 1, L: 3, N: 0, U: 2 })[c] as number)
}

export function makeAnt(x: number, y: number, dir = 0): Ant {
  return { x, y, dir, ux: x, uy: y }
}

/**
 * One step: turn according to the colour underneath, advance that cell to the
 * next colour, then move forward one cell. Returns the index of the cell it left.
 */
export function antStep(grid: Uint8Array, w: number, h: number, ant: Ant, turns: readonly number[]): number {
  const i = ant.y * w + ant.x
  const c = grid[i]
  ant.dir = (ant.dir + turns[c]) & 3
  grid[i] = c + 1 === turns.length ? 0 : c + 1
  ant.x += DX[ant.dir]
  ant.y += DY[ant.dir]
  ant.ux += DX[ant.dir]
  ant.uy += DY[ant.dir]
  if (ant.x < 0) ant.x += w
  else if (ant.x >= w) ant.x -= w
  if (ant.y < 0) ant.y += h
  else if (ant.y >= h) ant.y -= h
  return i
}

/** The classic ant's highway repeats every 104 steps, moving 2 cells diagonally. */
export const HIGHWAY_PERIOD = 104

/**
 * Watches an ant's unwrapped positions sampled every HIGHWAY_PERIOD steps and
 * reports true once the last `repeats` periods each moved by the same diagonal (±2, ±2).
 */
export function highwayDetector(repeats = 3) {
  const samples: [number, number][] = []
  return (ant: Ant): boolean => {
    samples.push([ant.ux, ant.uy])
    if (samples.length > repeats + 1) samples.shift()
    if (samples.length <= repeats) return false
    const [dx, dy] = [samples[1][0] - samples[0][0], samples[1][1] - samples[0][1]]
    if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) return false
    for (let k = 2; k < samples.length; k++) if (samples[k][0] - samples[k - 1][0] !== dx || samples[k][1] - samples[k - 1][1] !== dy) return false
    return true
  }
}
