import { rng } from '../../sim/math'

export type Rules = Record<string, string>

export interface Rewritten {
  str: string
  /** Iterations actually applied (fewer than asked when the length cap was hit). */
  done: number
  /** Length after each iteration, starting with the axiom. */
  lengths: number[]
  capped: boolean
}

/** Applies the rules to every symbol in parallel, `iterations` times, stopping before the string passes `cap`. */
export function rewrite(axiom: string, rules: Rules, iterations: number, cap = 400_000): Rewritten {
  let s = axiom
  const lengths = [s.length]
  // Each symbol's length after one step, so we can refuse a step that would blow past the cap.
  for (let i = 0; i < iterations; i++) {
    let next = 0
    for (let k = 0; k < s.length; k++) next += rules[s[k]]?.length ?? 1
    if (next > cap) return { str: s, done: i, lengths, capped: true }
    const parts: string[] = []
    for (let k = 0; k < s.length; k++) parts.push(rules[s[k]] ?? s[k])
    s = parts.join('')
    lengths.push(s.length)
  }
  return { str: s, done: iterations, lengths, capped: false }
}

/** Parses "X=F[+X]" or "X → F[+X]" lines into rules (one symbol on the left). */
export function parseRules(text: string): Rules {
  const rules: Rules = {}
  for (const raw of text.split(/\n|;/)) {
    const m = raw.match(/^\s*(\S)\s*(?:=|->|→|:)\s*(.*?)\s*$/)
    if (m) rules[m[1]] = m[2].replace(/\s+/g, '')
  }
  return rules
}

export interface TurtleOptions {
  angle: number
  /** Starting heading in degrees (−90 points up on screen). */
  heading?: number
  /** Symbols that draw a line when moving forward. */
  draw?: string
  /** Random fraction of the angle added to each turn (0 = exact). */
  jitter?: number
  seed?: number
  /** Extra heading (degrees) added when a branch opens at stack depth d. */
  sway?: (depth: number) => number
}

export interface Path {
  /** x1, y1, x2, y2 per segment, in turtle units (step = 1). */
  seg: Float32Array
  /** Branch depth of each segment. */
  depth: Uint8Array
  count: number
  maxDepth: number
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

/**
 * Turtle graphics: draw symbols move forward drawing a unit line, f moves without drawing,
 * + / − turn by the angle, | turns around, [ saves the state and ] restores it.
 */
export function turtle(str: string, o: TurtleOptions): Path {
  const drawSet = new Set(o.draw ?? 'FG')
  let n = 0
  for (let i = 0; i < str.length; i++) if (drawSet.has(str[i])) n++
  const seg = new Float32Array(n * 4)
  const depth = new Uint8Array(n)
  const random = rng(o.seed ?? 1)
  const jit = o.jitter ?? 0
  const turn = () => ((o.angle * (1 + (jit ? (random() * 2 - 1) * jit : 0))) * Math.PI) / 180
  let x = 0
  let y = 0
  let a = ((o.heading ?? 0) * Math.PI) / 180
  const stack: number[] = []
  let d = 0
  let k = 0
  let maxDepth = 0
  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (drawSet.has(c) || c === 'f') {
      const nx = x + Math.cos(a)
      const ny = y + Math.sin(a)
      if (c !== 'f') {
        seg[k * 4] = x
        seg[k * 4 + 1] = y
        seg[k * 4 + 2] = nx
        seg[k * 4 + 3] = ny
        depth[k] = Math.min(255, d)
        k++
      }
      x = nx
      y = ny
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    } else if (c === '+') a -= turn()
    else if (c === '-' || c === '−') a += turn()
    else if (c === '|') a += Math.PI
    else if (c === '[') {
      stack.push(x, y, a)
      d++
      if (d > maxDepth) maxDepth = d
      if (o.sway) a += (o.sway(d) * Math.PI) / 180
    } else if (c === ']' && stack.length) {
      a = stack.pop()!
      y = stack.pop()!
      x = stack.pop()!
      d--
    }
  }
  return { seg, depth, count: k, maxDepth, bounds: { minX, minY, maxX, maxY } }
}

/** Scale and offset that fit the bounds into a w × h box with a margin, centred. */
export function fitTransform(b: Path['bounds'], w: number, h: number, margin: number) {
  const bw = Math.max(1e-9, b.maxX - b.minX)
  const bh = Math.max(1e-9, b.maxY - b.minY)
  const s = Math.min((w - 2 * margin) / bw, (h - 2 * margin) / bh)
  return { s, ox: (w - bw * s) / 2 - b.minX * s, oy: (h - bh * s) / 2 - b.minY * s }
}

export interface Preset {
  name: string
  axiom: string
  rules: string
  angle: number
  iterations: number
  heading: number
  draw: string
  plant: boolean
}

export const PRESETS: Record<string, Preset> = {
  plant: { name: 'Fractal plant', axiom: 'X', rules: 'X=F+[[X]-X]-F[-FX]+X\nF=FF', angle: 25, iterations: 6, heading: -90, draw: 'F', plant: true },
  fern: { name: 'Fern', axiom: 'X', rules: 'X=F[+X]F[-X]+X\nF=FF', angle: 20, iterations: 7, heading: -90, draw: 'F', plant: true },
  bush: { name: 'Bush', axiom: 'F', rules: 'F=FF-[-F+F+F]+[+F-F-F]', angle: 22.5, iterations: 4, heading: -90, draw: 'F', plant: true },
  tree: { name: 'Tree', axiom: 'X', rules: 'X=F[+X][-X]FX\nF=FF', angle: 25.7, iterations: 7, heading: -90, draw: 'F', plant: true },
  weed: { name: 'Weed', axiom: 'F', rules: 'F=F[+F]F[-F][F]', angle: 20, iterations: 5, heading: -90, draw: 'F', plant: true },
  koch: { name: 'Koch snowflake', axiom: 'F--F--F', rules: 'F=F+F--F+F', angle: 60, iterations: 4, heading: 0, draw: 'F', plant: false },
  arrow: { name: 'Sierpiński arrowhead', axiom: 'A', rules: 'A=B-A-B\nB=A+B+A', angle: 60, iterations: 7, heading: 0, draw: 'AB', plant: false },
  dragon: { name: 'Dragon curve', axiom: 'FX', rules: 'X=X+YF+\nY=-FX-Y', angle: 90, iterations: 12, heading: 0, draw: 'F', plant: false },
  hilbert: { name: 'Hilbert curve', axiom: 'A', rules: 'A=+BF-AFA-FB+\nB=-AF+BFB+FA-', angle: 90, iterations: 6, heading: 0, draw: 'F', plant: false },
  penrose: {
    name: 'Penrose tiling',
    axiom: '[N]++[N]++[N]++[N]++[N]',
    rules: 'M=OF++PF----NF[-OF----MF]++\nN=+OF--PF[---MF--NF]+\nO=-MF++NF[+++OF++PF]-\nP=--OF++++MF[+PF++++NF]--NF\nF=',
    angle: 36,
    iterations: 5,
    heading: 0,
    draw: 'F',
    plant: false,
  },
}
