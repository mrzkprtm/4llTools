import { gaussian } from '../../sim/math'

export type WalkMode = '1d' | 'lattice' | 'brownian'

/**
 * Moves every walker one step. `bias` in [-1, 1] tilts the walk to the right:
 * 1D steps right with probability (1 + bias) / 2, the lattice walk prefers the
 * right-hand neighbour, and Brownian steps get a drift of bias × step in x.
 */
export function stepAll(mode: WalkMode, xs: Float64Array, ys: Float64Array, step: number, bias: number, random: () => number) {
  const pr = 0.25 * (1 + bias)
  const pl = 0.25 * (1 - bias)
  const sd = step / Math.SQRT2
  for (let i = 0; i < xs.length; i++) {
    if (mode === '1d') xs[i] += random() < (1 + bias) / 2 ? step : -step
    else if (mode === 'lattice') {
      const u = random()
      if (u < pr) xs[i] += step
      else if (u < pr + pl) xs[i] -= step
      else if (u < pr + pl + 0.25) ys[i] += step
      else ys[i] -= step
    } else {
      xs[i] += gaussian(random) * sd + bias * step
      ys[i] += gaussian(random) * sd
    }
  }
}

/** Mean x drift of one step and the mean squared length of one step. */
export function stepMoments(mode: WalkMode, step: number, bias: number) {
  if (mode === '1d') return { mx: bias * step, m2: step * step }
  if (mode === 'lattice') return { mx: 0.5 * bias * step, m2: step * step }
  return { mx: bias * step, m2: step * step * (1 + bias * bias) }
}

/** Expected root-mean-square distance from the start after n steps: √n·step when there is no drift. */
export function theoryRms(n: number, mode: WalkMode, step: number, bias: number) {
  const { mx, m2 } = stepMoments(mode, step, bias)
  return Math.sqrt(n * (m2 - mx * mx) + n * n * mx * mx)
}

/** √(mean of x² + y²) over all walkers. */
export function rmsDistance(xs: ArrayLike<number>, ys: ArrayLike<number>) {
  let s = 0
  for (let i = 0; i < xs.length; i++) s += xs[i] * xs[i] + ys[i] * ys[i]
  return xs.length ? Math.sqrt(s / xs.length) : 0
}

/** Average position [x̄, ȳ] of the walkers. */
export function centroid(xs: ArrayLike<number>, ys: ArrayLike<number>): [number, number] {
  let sx = 0
  let sy = 0
  for (let i = 0; i < xs.length; i++) {
    sx += xs[i]
    sy += ys[i]
  }
  const n = xs.length || 1
  return [sx / n, sy / n]
}

/** Error function (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function erf(x: number) {
  const s = Math.sign(x)
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return s * y
}

export const normalCdf = (x: number, mu = 0, sigma = 1) => 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)))

/** Share of walkers within distance r of the start (|x| ≤ r in 1D). */
export function fractionWithin(mode: WalkMode, xs: ArrayLike<number>, ys: ArrayLike<number>, r: number) {
  let c = 0
  for (let i = 0; i < xs.length; i++) if ((mode === '1d' ? Math.abs(xs[i]) : Math.hypot(xs[i], ys[i])) <= r) c++
  return xs.length ? c / xs.length : 0
}

/**
 * The share the central limit theorem predicts within distance r after n steps
 * (normal in 1D, Rayleigh in 2D). Returns NaN for a drifting 2D walk.
 */
export function theoryWithin(mode: WalkMode, n: number, step: number, bias: number, r: number) {
  if (n === 0) return 1
  const { mx, m2 } = stepMoments(mode, step, bias)
  if (mode === '1d') {
    const sigma = Math.sqrt(n * (m2 - mx * mx))
    return normalCdf(r, n * mx, sigma) - normalCdf(-r, n * mx, sigma)
  }
  if (bias !== 0) return NaN
  return 1 - Math.exp((-r * r) / (n * m2))
}
