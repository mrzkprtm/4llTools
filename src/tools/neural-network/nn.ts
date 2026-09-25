import { TAU, gaussian } from '../../sim/math'

/** A tiny fully connected network with one sigmoid output, trained with binary cross-entropy. */

export type Act = 'tanh' | 'relu' | 'sigmoid'

export interface Net {
  sizes: number[]
  /** w[l] has sizes[l+1] rows of sizes[l] weights (row-major). */
  w: Float64Array[]
  b: Float64Array[]
  act: Act
}

export interface Point {
  x: number
  y: number
  label: 0 | 1
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

function activate(act: Act, z: number): number {
  return act === 'tanh' ? Math.tanh(z) : act === 'relu' ? (z > 0 ? z : 0) : sigmoid(z)
}

/** Derivative of the activation written in terms of its output a. */
function slope(act: Act, a: number): number {
  return act === 'tanh' ? 1 - a * a : act === 'relu' ? (a > 0 ? 1 : 0) : a * (1 - a)
}

export function createNet(sizes: number[], act: Act, random: () => number): Net {
  const w: Float64Array[] = []
  const b: Float64Array[] = []
  for (let l = 0; l < sizes.length - 1; l++) {
    const fanIn = sizes[l]
    const scale = Math.sqrt((act === 'relu' ? 2 : 1) / fanIn)
    w.push(Float64Array.from({ length: sizes[l + 1] * fanIn }, () => gaussian(random) * scale))
    b.push(new Float64Array(sizes[l + 1]).fill(act === 'relu' ? 0.1 : 0))
  }
  return { sizes, w, b, act }
}

export function paramCount(net: Net): number {
  return net.w.reduce((s, w, l) => s + w.length + net.b[l].length, 0)
}

/** Activations of every layer, input first, for one point. */
export function forward(net: Net, x: number, y: number): Float64Array[] {
  const out: Float64Array[] = [Float64Array.of(x, y)]
  const L = net.w.length
  for (let l = 0; l < L; l++) {
    const inp = out[l]
    const n = net.sizes[l + 1]
    const m = net.sizes[l]
    const a = new Float64Array(n)
    const w = net.w[l]
    for (let j = 0; j < n; j++) {
      let z = net.b[l][j]
      for (let i = 0; i < m; i++) z += w[j * m + i] * inp[i]
      a[j] = l === L - 1 ? sigmoid(z) : activate(net.act, z)
    }
    out.push(a)
  }
  return out
}

export function predict(net: Net, x: number, y: number): number {
  const a = forward(net, x, y)
  return a[a.length - 1][0]
}

const EPS = 1e-12

/** Mean cross-entropy over the batch plus (λ/2)·Σw², with its gradient by backpropagation. */
export function gradients(net: Net, batch: Point[], lambda: number): { loss: number; gw: Float64Array[]; gb: Float64Array[] } {
  const L = net.w.length
  const gw = net.w.map((w) => new Float64Array(w.length))
  const gb = net.b.map((b) => new Float64Array(b.length))
  let loss = 0
  const B = batch.length || 1
  for (const pt of batch) {
    const acts = forward(net, pt.x, pt.y)
    const p = acts[L][0]
    loss += -(pt.label * Math.log(p + EPS) + (1 - pt.label) * Math.log(1 - p + EPS))
    // Sigmoid + cross-entropy: dL/dz at the output is simply p − y.
    let delta = Float64Array.of((p - pt.label) / B)
    for (let l = L - 1; l >= 0; l--) {
      const m = net.sizes[l]
      const n = net.sizes[l + 1]
      const inp = acts[l]
      const w = net.w[l]
      for (let j = 0; j < n; j++) {
        gb[l][j] += delta[j]
        for (let i = 0; i < m; i++) gw[l][j * m + i] += delta[j] * inp[i]
      }
      if (l > 0) {
        const prev = new Float64Array(m)
        for (let i = 0; i < m; i++) {
          let s = 0
          for (let j = 0; j < n; j++) s += w[j * m + i] * delta[j]
          prev[i] = s * slope(net.act, inp[i])
        }
        delta = prev
      }
    }
  }
  loss /= B
  if (lambda > 0)
    net.w.forEach((w, l) => {
      for (let k = 0; k < w.length; k++) {
        loss += (lambda / 2) * w[k] * w[k]
        gw[l][k] += lambda * w[k]
      }
    })
  return { loss, gw, gb }
}

/** One pass over the data in shuffled mini-batches. Returns the mean batch loss. */
export function trainEpoch(net: Net, data: Point[], lr: number, batchSize: number, lambda: number, random: () => number): number {
  if (!data.length) return 0
  const order = data.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  let total = 0
  let batches = 0
  const bs = Math.max(1, Math.min(batchSize, data.length))
  for (let s = 0; s < order.length; s += bs) {
    const batch = order.slice(s, s + bs).map((i) => data[i])
    const { loss, gw, gb } = gradients(net, batch, lambda)
    net.w.forEach((w, l) => {
      for (let k = 0; k < w.length; k++) w[k] -= lr * gw[l][k]
    })
    net.b.forEach((b, l) => {
      for (let k = 0; k < b.length; k++) b[k] -= lr * gb[l][k]
    })
    total += loss
    batches++
  }
  return total / batches
}

export function evaluate(net: Net, data: Point[]): { loss: number; accuracy: number } {
  if (!data.length) return { loss: 0, accuracy: 0 }
  let loss = 0
  let ok = 0
  for (const pt of data) {
    const p = predict(net, pt.x, pt.y)
    loss += -(pt.label * Math.log(p + EPS) + (1 - pt.label) * Math.log(1 - p + EPS))
    if ((p >= 0.5 ? 1 : 0) === pt.label) ok++
  }
  return { loss: loss / data.length, accuracy: ok / data.length }
}

export type Dataset = 'circle' | 'xor' | 'spiral' | 'gauss'

/** Two-class toy datasets inside [−1, 1]². */
export function makeData(kind: Dataset, n: number, noise: number, random: () => number): Point[] {
  const pts: Point[] = []
  const jitter = () => gaussian(random) * noise
  for (let i = 0; i < n; i++) {
    const label = (i % 2) as 0 | 1
    if (kind === 'circle') {
      const r = label ? random() * 0.42 : 0.62 + random() * 0.33
      const t = random() * TAU
      pts.push({ x: r * Math.cos(t) + jitter(), y: r * Math.sin(t) + jitter(), label })
    } else if (kind === 'xor') {
      let x = random() * 2 - 1
      let y = random() * 2 - 1
      x += Math.sign(x) * 0.06
      y += Math.sign(y) * 0.06
      pts.push({ x: x * 0.9 + jitter(), y: y * 0.9 + jitter(), label: x * y > 0 ? 1 : 0 })
    } else if (kind === 'spiral') {
      const k = Math.floor(i / 2) / (n / 2)
      const r = 0.08 + k * 0.85
      const t = k * 1.75 * TAU + (label ? Math.PI : 0)
      pts.push({ x: r * Math.sin(t) + jitter(), y: r * Math.cos(t) + jitter(), label })
    } else {
      const c = label ? 0.42 : -0.42
      pts.push({ x: c + gaussian(random) * (0.22 + noise), y: c + gaussian(random) * (0.22 + noise), label })
    }
  }
  return pts
}
