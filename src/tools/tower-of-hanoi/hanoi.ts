/** Tower of Hanoi. Disks are numbered 0 (smallest) to n − 1; pegs are 0, 1, 2. */

export const PEG_NAMES = ['A', 'B', 'C']

export interface HanoiMove {
  disk: number
  from: number
  to: number
  /** The recursive calls that are open when this move happens, outermost first. */
  frames: string[]
}

/** Pegs as stacks of disk numbers, bottom first, with every disk on `peg`. */
export function startPegs(n: number, peg = 0): number[][] {
  const pegs: number[][] = [[], [], []]
  for (let d = n - 1; d >= 0; d--) pegs[peg].push(d)
  return pegs
}

/** Which peg each disk sits on. */
export function positions(pegs: number[][]): number[] {
  const pos: number[] = []
  pegs.forEach((p, i) => p.forEach((d) => (pos[d] = i)))
  return pos
}

export function isLegal(pegs: number[][], from: number, to: number): boolean {
  const src = pegs[from]
  if (from === to || !src.length) return false
  const dst = pegs[to]
  return !dst.length || dst[dst.length - 1] > src[src.length - 1]
}

/** Moves the top disk; returns false and leaves the pegs alone when the move is illegal. */
export function applyMove(pegs: number[][], from: number, to: number): boolean {
  if (!isLegal(pegs, from, to)) return false
  pegs[to].push(pegs[from].pop()!)
  return true
}

/**
 * The recursive solution, generalised to start from any legal position: to put the
 * k smallest disks on peg t, look at the largest of them. If it is already on t,
 * just solve the k − 1 above it; otherwise park the k − 1 smaller disks on the
 * spare peg, move the big one, then bring the k − 1 back on top. From the usual
 * start this is the textbook hanoi(n, A, C, B) and takes 2ⁿ − 1 moves.
 */
export function* solveFrom(pos: number[], target = 2): Generator<HanoiMove> {
  const p = [...pos]
  const frames: string[] = []
  function* tower(k: number, t: number): Generator<HanoiMove> {
    if (k === 0) return
    const d = k - 1
    const at = p[d]
    frames.push(`hanoi(${k}, ${at === t ? '' : PEG_NAMES[at]}→${PEG_NAMES[t]})`)
    if (at === t) yield* tower(k - 1, t)
    else {
      yield* tower(k - 1, 3 - at - t)
      p[d] = t
      yield { disk: d, from: at, to: t, frames: [...frames] }
      yield* tower(k - 1, t)
    }
    frames.pop()
  }
  yield* tower(p.length, target)
}

/** Fewest moves from this position to all disks on `target`. */
export function movesNeeded(pos: number[], target = 2, k = pos.length): number {
  if (k === 0) return 0
  const d = k - 1
  if (pos[d] === target) return movesNeeded(pos, target, k - 1)
  return movesNeeded(pos, 3 - pos[d] - target, k - 1) + 1 + (2 ** (k - 1) - 1)
}

/** The full classic solution as [from, to] pairs. */
export function solveHanoi(n: number, from = 0, to = 2): [number, number][] {
  return [...solveFrom(new Array<number>(n).fill(from), to)].map((m) => [m.from, m.to])
}
