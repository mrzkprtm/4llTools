/**
 * A small, safe expression parser for vector fields. It understands numbers,
 * x, y, t, pi, e, + − * / ^, brackets, implicit multiplication ("2x", "3(x+1)")
 * and the functions below. It builds a tree of closures and never uses eval.
 */

export type Fn = (x: number, y: number, t: number) => number

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  sqrt: Math.sqrt,
  abs: Math.abs,
  log: Math.log,
  ln: Math.log,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sign: Math.sign,
}

type Token = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string }

function tokenize(src: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) i++
    else if (/[0-9.]/.test(c)) {
      const m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i)
      if (!m) throw new Error(`Bad number near "${src.slice(i, i + 6)}"`)
      out.push({ k: 'num', v: Number(m[0]) })
      i += m[0].length
    } else if (/[a-z]/i.test(c)) {
      const m = src.slice(i).match(/^[a-z]+/i)!
      const id = m[0].toLowerCase()
      // "xy" means x·y.
      if (/^[xyt]+$/.test(id)) for (const ch of id) out.push({ k: 'id', v: ch })
      else out.push({ k: 'id', v: id })
      i += m[0].length
    } else if ('+-*/^()'.includes(c)) {
      out.push({ k: 'op', v: c })
      i++
    } else if (c === '−') {
      out.push({ k: 'op', v: '-' })
      i++
    } else if (c === '×' || c === '·') {
      out.push({ k: 'op', v: '*' })
      i++
    } else throw new Error(`Unexpected "${c}"`)
  }
  return out
}

/** Compiles an expression in x, y and t into a fast function. Throws with a readable message on bad input. */
export function compile(src: string): Fn {
  const tokens = tokenize(src)
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (v: string) => peek()?.k === 'op' && peek().v === v

  function expr(): Fn {
    let left = term()
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++].v
      const a = left
      const b = term()
      left = op === '+' ? (x, y, t) => a(x, y, t) + b(x, y, t) : (x, y, t) => a(x, y, t) - b(x, y, t)
    }
    return left
  }
  function term(): Fn {
    let left = unary()
    for (;;) {
      const tk = peek()
      if (isOp('*') || isOp('/')) {
        const op = tokens[pos++].v
        const a = left
        const b = unary()
        left = op === '*' ? (x, y, t) => a(x, y, t) * b(x, y, t) : (x, y, t) => a(x, y, t) / b(x, y, t)
      } else if (tk && (tk.k === 'num' || tk.k === 'id' || (tk.k === 'op' && tk.v === '('))) {
        // Implicit multiplication: 2x, 3(x + 1), x y.
        const a = left
        const b = power()
        left = (x, y, t) => a(x, y, t) * b(x, y, t)
      } else return left
    }
  }
  function unary(): Fn {
    if (isOp('-')) {
      pos++
      const a = unary()
      return (x, y, t) => -a(x, y, t)
    }
    if (isOp('+')) {
      pos++
      return unary()
    }
    return power()
  }
  function power(): Fn {
    const base = atom()
    if (isOp('^')) {
      pos++
      const e = unary()
      return (x, y, t) => Math.pow(base(x, y, t), e(x, y, t))
    }
    return base
  }
  function atom(): Fn {
    const tk = tokens[pos++]
    if (!tk) throw new Error('Expression ends too early')
    if (tk.k === 'num') {
      const v = tk.v
      return () => v
    }
    if (tk.k === 'op') {
      if (tk.v !== '(') throw new Error(`Unexpected "${tk.v}"`)
      const inner = expr()
      if (!isOp(')')) throw new Error('Missing ")"')
      pos++
      return inner
    }
    const name = tk.v
    if (name === 'x') return (x) => x
    if (name === 'y') return (_x, y) => y
    if (name === 't') return (_x, _y, t) => t
    if (name === 'pi') return () => Math.PI
    if (name === 'e') return () => Math.E
    const f = Object.hasOwn(FUNCS, name) ? FUNCS[name] : undefined
    if (!f) throw new Error(`Unknown name "${name}"`)
    if (!isOp('(')) throw new Error(`${name} needs brackets, like ${name}(x)`)
    pos++
    const arg = expr()
    if (!isOp(')')) throw new Error('Missing ")"')
    pos++
    return (x, y, t) => f(arg(x, y, t))
  }

  if (!tokens.length) throw new Error('Empty expression')
  const fn = expr()
  if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos].v}"`)
  return fn
}

export interface Field {
  P: Fn
  Q: Fn
}

/** One classic RK4 step of the flow (dx/dt, dy/dt) = (P, Q), written without allocations. Returns [x, y] in `out`. */
export function rk4Field({ P, Q }: Field, x: number, y: number, t: number, dt: number, out: [number, number]) {
  const k1x = P(x, y, t)
  const k1y = Q(x, y, t)
  const h = dt / 2
  const k2x = P(x + h * k1x, y + h * k1y, t + h)
  const k2y = Q(x + h * k1x, y + h * k1y, t + h)
  const k3x = P(x + h * k2x, y + h * k2y, t + h)
  const k3y = Q(x + h * k2x, y + h * k2y, t + h)
  const k4x = P(x + dt * k3x, y + dt * k3y, t + dt)
  const k4y = Q(x + dt * k3x, y + dt * k3y, t + dt)
  out[0] = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x)
  out[1] = y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y)
  return out
}

/** ∂P/∂x + ∂Q/∂y by central differences. */
export function divergence({ P, Q }: Field, x: number, y: number, t = 0, h = 1e-4) {
  return (P(x + h, y, t) - P(x - h, y, t)) / (2 * h) + (Q(x, y + h, t) - Q(x, y - h, t)) / (2 * h)
}

/** The scalar curl ∂Q/∂x − ∂P/∂y by central differences (positive = anticlockwise swirl). */
export function curl({ P, Q }: Field, x: number, y: number, t = 0, h = 1e-4) {
  return (Q(x + h, y, t) - Q(x - h, y, t)) / (2 * h) - (P(x, y + h, t) - P(x, y - h, t)) / (2 * h)
}

export const PRESETS = [
  { id: 'rotation', name: 'Rotation', p: '-y', q: 'x', range: 3 },
  { id: 'saddle', name: 'Saddle', p: 'x', q: '-y', range: 3 },
  { id: 'source', name: 'Source', p: 'x', q: 'y', range: 3 },
  { id: 'sink', name: 'Sink', p: '-x', q: '-y', range: 3 },
  { id: 'spiral', name: 'Spiral sink', p: '-0.25x - y', q: 'x - 0.25y', range: 3 },
  { id: 'pendulum', name: 'Pendulum phase portrait', p: 'y', q: '-sin(x)', range: 7 },
  { id: 'vdp', name: 'Van der Pol oscillator', p: 'y', q: '(1 - x^2) y - x', range: 4 },
  { id: 'waves', name: 'Time-varying swirl', p: 'sin(y + t)', q: 'cos(x - t)', range: 6 },
  { id: 'dipole', name: 'Two vortices', p: '-(y)/((x-1)^2+y^2+0.1) + y/((x+1)^2+y^2+0.1)', q: '(x-1)/((x-1)^2+y^2+0.1) - (x+1)/((x+1)^2+y^2+0.1)', range: 3 },
] as const
