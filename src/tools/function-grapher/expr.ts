/**
 * A small, safe maths expression parser: tokenise → recursive descent → a tree of closures.
 * Never uses eval or Function. Supports + − * / ^, unary minus, parentheses, implicit
 * multiplication (2x, 3sin(x), (x+1)(x−1)), the variables x, t, a, b and the constants pi and e.
 */

export type Vars = { x: number; t: number; a: number; b: number }
export type Fn = (v: Vars) => number

export class ExprError extends Error {
  constructor(
    message: string,
    public pos: number,
  ) {
    super(message)
  }
}

type Token =
  | { kind: 'num'; value: number; pos: number }
  | { kind: 'name'; value: string; pos: number }
  | { kind: 'op'; value: string; pos: number }
  | { kind: 'end'; pos: number }

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
}
const ARITY: Record<string, number> = { min: 2, max: 2 }
const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: Math.PI * 2 }
const VARS = ['x', 't', 'a', 'b'] as const

export function tokenize(src: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i))
    if (num && /[\d.]/.test(c)) {
      out.push({ kind: 'num', value: Number(num[0]), pos: i })
      i += num[0].length
      continue
    }
    const name = /^([a-z_]+|π)/i.exec(src.slice(i))
    if (name) {
      splitName(name[0].toLowerCase(), i, out)
      i += name[0].length
      continue
    }
    const op = c === '×' || c === '·' ? '*' : c === '÷' ? '/' : c === '−' ? '-' : c
    if ('+-*/^(),'.includes(op)) {
      // Treat ** as ^.
      if (c === '*' && src[i + 1] === '*') {
        out.push({ kind: 'op', value: '^', pos: i })
        i += 2
        continue
      }
      out.push({ kind: 'op', value: op, pos: i })
      i++
      continue
    }
    throw new ExprError(`Unexpected “${c}”`, i)
  }
  out.push({ kind: 'end', pos: src.length })
  return insertImplicit(out)
}

/** Splits runs like "xt" or "pix" into known names, so implicit products read naturally. */
function splitName(word: string, pos: number, out: Token[]) {
  const known = [...Object.keys(FUNCS), ...Object.keys(CONSTS), ...VARS].sort((a, b) => b.length - a.length)
  let i = 0
  while (i < word.length) {
    const hit = known.find((k) => word.startsWith(k, i))
    if (!hit) throw new ExprError(`Unknown name “${word.slice(i)}”`, pos + i)
    out.push({ kind: 'name', value: hit, pos: pos + i })
    i += hit.length
  }
}

/** Adds the "*" in 2x, 2(x+1), (x)(y), x sin(x) and similar. */
function insertImplicit(tokens: Token[]): Token[] {
  const out: Token[] = []
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i]
    const prev = out[out.length - 1]
    const endsValue = prev && (prev.kind === 'num' || (prev.kind === 'name' && !(prev.value in FUNCS)) || (prev.kind === 'op' && prev.value === ')'))
    const startsValue = tk.kind === 'num' || tk.kind === 'name' || (tk.kind === 'op' && tk.value === '(')
    if (endsValue && startsValue) out.push({ kind: 'op', value: '*', pos: tk.pos })
    out.push(tk)
  }
  return out
}

/** Parses an expression into a fast evaluator, or throws an ExprError that says where it went wrong. */
export function compile(src: string): Fn {
  const tokens = tokenize(src)
  let i = 0
  const peek = () => tokens[i]
  const isOp = (v: string) => {
    const tk = tokens[i]
    return tk.kind === 'op' && tk.value === v
  }
  const expect = (v: string) => {
    if (!isOp(v)) throw new ExprError(peek().kind === 'end' ? `Missing “${v}”` : `Expected “${v}”`, peek().pos)
    i++
  }

  function expr(): Fn {
    let left = term()
    while (isOp('+') || isOp('-')) {
      const op = (tokens[i++] as { value: string }).value
      const l = left
      const r = term()
      left = op === '+' ? (v) => l(v) + r(v) : (v) => l(v) - r(v)
    }
    return left
  }

  function term(): Fn {
    let left = unary()
    while (isOp('*') || isOp('/')) {
      const op = (tokens[i++] as { value: string }).value
      const l = left
      const r = unary()
      left = op === '*' ? (v) => l(v) * r(v) : (v) => l(v) / r(v)
    }
    return left
  }

  function unary(): Fn {
    if (isOp('-')) {
      i++
      const inner = unary()
      return (v) => -inner(v)
    }
    if (isOp('+')) {
      i++
      return unary()
    }
    return power()
  }

  // Right-associative, binding tighter than unary minus on its left: -x^2 = -(x^2), 2^-1 = 0.5.
  function power(): Fn {
    const base = primary()
    if (!isOp('^')) return base
    i++
    const exp = unary()
    return (v) => Math.pow(base(v), exp(v))
  }

  function primary(): Fn {
    const tk = peek()
    if (tk.kind === 'num') {
      i++
      const n = tk.value
      return () => n
    }
    if (tk.kind === 'name') {
      i++
      const name = tk.value
      if (name in FUNCS) {
        if (!isOp('(')) throw new ExprError(`${name} needs brackets, like ${name}(x)`, peek().pos)
        i++
        const args = [expr()]
        while (isOp(',')) {
          i++
          args.push(expr())
        }
        expect(')')
        const want = ARITY[name] ?? 1
        if (args.length !== want) throw new ExprError(`${name} takes ${want} value${want === 1 ? '' : 's'}`, tk.pos)
        const f = FUNCS[name]
        if (args.length === 1) {
          const [a0] = args
          return (v) => f(a0(v))
        }
        const [a0, a1] = args
        return (v) => f(a0(v), a1(v))
      }
      if (name in CONSTS) {
        const c = CONSTS[name]
        return () => c
      }
      const key = name as keyof Vars
      return (v) => v[key]
    }
    if (tk.kind === 'op' && tk.value === '(') {
      i++
      const inner = expr()
      expect(')')
      return inner
    }
    if (tk.kind === 'end') throw new ExprError('Unexpected end: something is missing', tk.pos)
    throw new ExprError(`Unexpected “${tk.value}”`, tk.pos)
  }

  if (peek().kind === 'end') throw new ExprError('Empty expression', 0)
  const fn = expr()
  if (peek().kind !== 'end') {
    const tk = peek() as { value: string | number; pos: number }
    throw new ExprError(`Unexpected “${tk.value}”`, tk.pos)
  }
  return fn
}

/** Like compile, but returns the error instead of throwing. */
export function tryCompile(src: string): { fn: Fn; error: null } | { fn: null; error: string; pos: number } {
  try {
    return { fn: compile(src), error: null }
  } catch (e) {
    if (e instanceof ExprError) return { fn: null, error: e.message, pos: e.pos }
    throw e
  }
}

/** Convenience: evaluate an expression once. */
export function evaluate(src: string, vars: Partial<Vars> = {}): number {
  return compile(src)({ x: 0, t: 0, a: 1, b: 1, ...vars })
}
