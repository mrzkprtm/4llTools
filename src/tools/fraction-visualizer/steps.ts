import { compare, expandTo, format, gcd, lcm, simplify, type Frac } from './logic'

export type Op = 'add' | 'sub' | 'mul' | 'cmp' | 'simp'

export const COLOR_A = '#1c7ed6'
export const COLOR_B = '#e8590c'
export const COLOR_R = '#2f9e44'

/** One model on screen: d pieces per whole, and which pieces are filled with which color. */
export interface ModelSpec {
  d: number
  wholes: number
  /** Consecutive runs of filled pieces: [count, color]. */
  runs: [number, string][]
  /** Pieces from this index on (up to `fadeTo`) fade out, for subtraction. */
  fadeFrom?: number
  fadeTo?: number
  caption: string
}

export interface Step {
  title: string
  text: string
  models: ModelSpec[]
  /** Show the multiplication area model instead of pies or bars. */
  area?: boolean
}

const wholesFor = (n: number, d: number) => Math.max(1, Math.ceil(Math.abs(n) / d))
const one = (f: Frac, color: string, caption: string): ModelSpec => ({ d: f.d, wholes: wholesFor(f.n, f.d), runs: [[Math.abs(f.n), color]], caption })

/** The step-by-step story for an operation on two non-negative fractions. */
export function buildSteps(op: Op, a: Frac, b: Frac): Step[] {
  const L = lcm(a.d, b.d)
  const a2 = expandTo(a, L)
  const b2 = expandTo(b, L)
  const fa = `${a.n}/${a.d}`
  const fb = `${b.n}/${b.d}`
  const steps: Step[] = []

  const simplifyStep = (raw: Frac, color: string) => {
    const s = simplify(raw)
    if (s.d !== raw.d && s.n !== 0) {
      const g = gcd(raw.n, raw.d)
      steps.push({ title: 'Simplify', text: `Divide top and bottom by ${g}: ${raw.n}/${raw.d} = ${format(s, false)}${s.n > s.d && s.d > 1 ? ` = ${format(s)}` : ''}`, models: [one(s, color, format(s))] })
    }
  }

  if (op === 'add' || op === 'sub') {
    const sign = op === 'add' ? '+' : '−'
    steps.push({
      title: 'Start',
      text: a.d === b.d ? 'The pieces are already the same size.' : `Pieces of size 1/${a.d} and 1/${b.d} don't match, so they can't be ${op === 'add' ? 'added' : 'taken away'} yet.`,
      models: [one(a, COLOR_A, fa), one(b, COLOR_B, fb)],
    })
    if (a.d !== b.d)
      steps.push({
        title: 'Common denominator',
        text: `Re-cut both into ${L} pieces (the LCD of ${a.d} and ${b.d}): ${fa} = ${a2.n}/${L}, ${fb} = ${b2.n}/${L}.`,
        models: [one(a2, COLOR_A, `${a2.n}/${L}`), one(b2, COLOR_B, `${b2.n}/${L}`)],
      })
    if (op === 'add') {
      const n = a2.n + b2.n
      steps.push({ title: 'Merge', text: `${a2.n}/${L} + ${b2.n}/${L} = ${n}/${L}`, models: [{ d: L, wholes: wholesFor(n, L), runs: [[a2.n, COLOR_A], [b2.n, COLOR_B]], caption: `${n}/${L}` }] })
      simplifyStep({ n, d: L }, COLOR_R)
    } else {
      const n = a2.n - b2.n
      if (n < 0) steps.push({ title: 'Take away', text: `${b2.n}/${L} is more than ${a2.n}/${L}, so the answer is negative: ${n}/${L}. The model shows the missing part.`, models: [{ d: L, wholes: wholesFor(b2.n, L), runs: [[a2.n, COLOR_A], [-n, COLOR_B]], caption: `${n}/${L}` }] })
      else steps.push({ title: 'Take away', text: `${a2.n}/${L} ${sign} ${b2.n}/${L} = ${n}/${L}`, models: [{ d: L, wholes: wholesFor(a2.n, L), runs: [[a2.n, COLOR_A]], fadeFrom: n, fadeTo: a2.n, caption: `${n}/${L}` }] })
      simplifyStep({ n: Math.abs(n), d: L }, COLOR_R)
    }
  } else if (op === 'mul') {
    const raw = { n: a.n * b.n, d: a.d * b.d }
    steps.push({ title: 'Start', text: `${fa} × ${fb} means "${fa} of ${fb}".`, models: [one(a, COLOR_A, fa), one(b, COLOR_B, fb)] })
    steps.push({
      title: 'Area model',
      text: a.n <= a.d && b.n <= b.d ? `Cut a square into ${a.d} columns and ${b.d} rows. The overlap is ${raw.n} of ${raw.d} small pieces.` : `Multiply tops and bottoms: (${a.n}×${b.n})/(${a.d}×${b.d}) = ${raw.n}/${raw.d}.`,
      models: [{ d: raw.d, wholes: wholesFor(raw.n, raw.d), runs: [[raw.n, COLOR_R]], caption: `${raw.n}/${raw.d}` }],
      area: a.n <= a.d && b.n <= b.d,
    })
    simplifyStep(raw, COLOR_R)
  } else if (op === 'cmp') {
    steps.push({ title: 'Start', text: 'Which is bigger? Pieces of different sizes are hard to compare.', models: [one(a, COLOR_A, fa), one(b, COLOR_B, fb)] })
    const c = compare(a, b)
    const sym = c < 0 ? '<' : c > 0 ? '>' : '='
    steps.push({
      title: 'Same size pieces',
      text: `With ${L} pieces each: ${a2.n}/${L} ${sym} ${b2.n}/${L}, so ${fa} ${sym} ${fb}.`,
      models: [one(a2, COLOR_A, `${a2.n}/${L}`), one(b2, COLOR_B, `${b2.n}/${L}`)],
    })
  } else {
    steps.push({ title: 'Start', text: `${fa} has ${a.n} pieces of size 1/${a.d}.`, models: [one(a, COLOR_A, fa)] })
    const s = simplify(a)
    if (s.d === a.d) steps.push({ title: 'Already simplest', text: `${a.n} and ${a.d} share no factor except 1, so ${fa} is already in simplest form.`, models: [one(a, COLOR_R, fa)] })
    else simplifyStep(a, COLOR_R)
  }
  return steps
}
