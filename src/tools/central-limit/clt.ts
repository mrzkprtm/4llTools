/** Source distributions on [0, 10] and the sampling distribution of their means. */

export const LO = 0
export const HI = 10
/** Bins used to draw a source and to hold a custom, hand-drawn shape. */
export const BINS = 40

export type Kind = 'uniform' | 'exponential' | 'dice' | 'bimodal' | 'custom'

export interface Source {
  sample: (random: () => number) => number
  mean: number
  sd: number
  /** Relative density in each of BINS bins across [LO, HI], scaled so the tallest is 1. */
  shape: number[]
  /** True for distributions with a few exact values (dice). */
  discrete: boolean
}

const W = (HI - LO) / BINS
const centre = (i: number) => LO + (i + 0.5) * W

function normalise(shape: number[]): number[] {
  const m = Math.max(...shape)
  return shape.map((v) => (m > 0 ? v / m : 0))
}

/** Builds a source from a density on [LO, HI] by fine numerical integration, with a given sampler. */
function fromDensity(pdf: (x: number) => number, sample: (random: () => number) => number): Source {
  const steps = 20000
  let z = 0
  let m1 = 0
  let m2 = 0
  const shape = new Array<number>(BINS).fill(0)
  for (let i = 0; i < steps; i++) {
    const x = LO + ((i + 0.5) / steps) * (HI - LO)
    const f = pdf(x)
    z += f
    m1 += f * x
    m2 += f * x * x
    shape[Math.min(BINS - 1, Math.floor(((x - LO) / (HI - LO)) * BINS))] += f
  }
  const mean = m1 / z
  return { sample, mean, sd: Math.sqrt(Math.max(0, m2 / z - mean * mean)), shape: normalise(shape), discrete: false }
}

const gauss = (random: () => number) => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())

/** A source whose density is a histogram of `weights` over BINS equal bins (uniform inside each bin). */
export function histogramSource(weights: number[]): Source {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0)
  const w = total > 0 ? weights.map((v) => Math.max(0, v) / total) : weights.map(() => 1 / weights.length)
  const cdf: number[] = []
  w.reduce((acc, v, i) => (cdf[i] = acc + v), 0)
  let mean = 0
  let m2 = 0
  w.forEach((p, i) => {
    mean += p * centre(i)
    m2 += p * (centre(i) ** 2 + (W * W) / 12)
  })
  return {
    sample: (random) => {
      const r = random()
      let i = cdf.findIndex((c) => r < c)
      if (i < 0) i = BINS - 1
      return LO + (i + random()) * W
    },
    mean,
    sd: Math.sqrt(Math.max(0, m2 - mean * mean)),
    shape: normalise(w),
    discrete: false,
  }
}

export function makeSource(kind: Kind, custom: number[] = []): Source {
  switch (kind) {
    case 'uniform':
      return fromDensity(() => 1, (random) => LO + random() * (HI - LO))
    case 'exponential': {
      // Exponential with mean 2, cut off at 10 (inverse CDF of the truncated distribution).
      const cut = 1 - Math.exp(-HI / 2)
      return fromDensity((x) => Math.exp(-x / 2), (random) => -2 * Math.log(1 - random() * cut))
    }
    case 'bimodal': {
      const pdf = (x: number) => Math.exp(-0.5 * ((x - 2.5) / 0.8) ** 2) + Math.exp(-0.5 * ((x - 7.5) / 0.8) ** 2)
      return fromDensity(pdf, (random) => {
        for (;;) {
          const x = (random() < 0.5 ? 2.5 : 7.5) + 0.8 * gauss(random)
          if (x >= LO && x <= HI) return x
        }
      })
    }
    case 'dice': {
      const shape = new Array<number>(BINS).fill(0)
      for (let v = 1; v <= 6; v++) shape[Math.floor(((v - LO) / (HI - LO)) * BINS)] = 1
      return { sample: (random) => 1 + Math.floor(random() * 6), mean: 3.5, sd: Math.sqrt(35 / 12), shape, discrete: true }
    }
    case 'custom':
      return histogramSource(custom.length === BINS ? custom : new Array(BINS).fill(1))
  }
}

export function sampleMean(source: Source, n: number, random: () => number): { values: number[]; mean: number } {
  const values = Array.from({ length: n }, () => source.sample(random))
  return { values, mean: values.reduce((a, b) => a + b, 0) / n }
}

/** Running mean and standard deviation (Welford), so millions of sample means need no storage. */
export class RunningStats {
  n = 0
  mean = 0
  private m2 = 0
  push(x: number) {
    this.n++
    const d = x - this.mean
    this.mean += d / this.n
    this.m2 += d * (x - this.mean)
  }
  get sd(): number {
    return this.n > 1 ? Math.sqrt(this.m2 / (this.n - 1)) : 0
  }
}
