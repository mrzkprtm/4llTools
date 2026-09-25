import { describe, expect, it } from 'vitest'
import { rk4, rng } from '../sim/math'
import { createNet, evaluate, gradients, makeData, predict, trainEpoch, type Net, type Point } from './neural-network/nn'
import { createPopulation, crossover, fitness as gaFitness, mutate as gaMutate, nextGeneration, sanitize } from './genetic-algorithm/ga'
import { BOUNDS, createWorld as createNS, endDay, energyCost, mutate } from './natural-selection/selection'
import { createField, diffuse, evaporate, sense, turnToward } from './ant-colony/ants'
import { createFlock, polarization, steer, stepFlock } from './flocking-boids/boids'
import { equilibrium, estimatePeriod, lotkaVolterra, lvInvariant, lvOrbit } from './predator-prey/predator'
import { INF, SUS, counts, createWorld, sirCurve, sirDeriv, stepWorld } from './epidemic-simulator/epidemic'

describe('epidemic-simulator', () => {
  it('SIR ODE conserves S + I + R = 1 and burns out', () => {
    const f = sirDeriv(0.4, 0.1)
    let y = [0.99, 0.01, 0]
    let peak = 0
    for (let k = 0; k < 3000; k++) {
      y = rk4(f, k * 0.1, y, 0.1)
      expect(y[0] + y[1] + y[2]).toBeCloseTo(1, 10)
      peak = Math.max(peak, y[1])
    }
    expect(peak).toBeGreaterThan(0.2)
    expect(y[1]).toBeLessThan(1e-3)
    // Final size equation for R0 = 4: s∞ = s0·exp(−R0·(1 − s∞)) gives about 2% never infected.
    expect(y[0]).toBeGreaterThan(0.01)
    expect(y[0]).toBeLessThan(0.04)
  })

  it('sirCurve samples every half day and stays on the simplex', () => {
    const c = sirCurve(0.3, 0.1, 0.8, 0.01, 100)
    expect(c.length).toBe(201)
    for (const [s, i, r] of c) expect(s + i + r).toBeCloseTo(1, 9)
    expect(c[0][2]).toBeCloseTo(0.19, 9)
  })

  it('agents do not infect anyone when the infection chance is zero', () => {
    const random = rng(3)
    const wd = createWorld(200, 400, 400, 0, 0, 3, 'none', random)
    for (let k = 0; k < 100; k++) stepWorld(wd, { radius: 10, pInfect: 0, recoverDays: 30, mortality: 0, extra: 'none' }, 0.05, random)
    expect(wd.everInfected).toBe(3)
    expect(counts(wd)[INF] + counts(wd)[SUS]).toBe(200)
  })
})

describe('predator-prey', () => {
  const p = { alpha: 1, beta: 0.1, gamma: 1.5, delta: 0.075 }

  it('keeps V = δx − γ ln x + βy − α ln y constant under RK4', () => {
    const f = lotkaVolterra(p)
    let s = [10, 5]
    const v0 = lvInvariant(s[0], s[1], p)
    let drift = 0
    for (let k = 0; k < 5000; k++) {
      s = rk4(f, k * 0.005, s, 0.005)
      drift = Math.max(drift, Math.abs(lvInvariant(s[0], s[1], p) - v0))
    }
    expect(drift).toBeLessThan(1e-7)
    // The populations really did move a long way round the loop.
    expect(s[0]).not.toBeCloseTo(10, 0)
  })

  it('small orbits have period 2π/√(αγ), large ones take longer', () => {
    const [ex, ey] = equilibrium(p)
    const small = lvOrbit(p, ex * 1.01, ey).period
    expect(small).toBeCloseTo((2 * Math.PI) / Math.sqrt(p.alpha * p.gamma), 2)
    expect(lvOrbit(p, 5, 3).period).toBeGreaterThan(small)
  })

  it('estimatePeriod recovers the period of a noisy sine', () => {
    const random = rng(5)
    const v = Array.from({ length: 1000 }, (_, i) => 50 + 20 * Math.sin((2 * Math.PI * i) / 87) + (random() - 0.5) * 4)
    expect(estimatePeriod(v, 1)).toBeCloseTo(87, 0)
  })
})

describe('flocking-boids', () => {
  it('alignment turns a boid toward its neighbours’ heading', () => {
    const f = createFlock(400, 400, 100, rng(1))
    f.n = 5
    // Boid 0 flies east; four neighbours close by fly north (−y).
    const pos = [[200, 200], [210, 200], [190, 200], [200, 210], [200, 190]]
    pos.forEach(([x, y], i) => {
      f.x[i] = x
      f.y[i] = y
      f.vx[i] = i === 0 ? 100 : 0
      f.vy[i] = i === 0 ? 0 : -100
    })
    const p = { separation: 0, alignment: 1, cohesion: 0, perception: 130, maxSpeed: 100 }
    const heading = () => Math.atan2(f.vy[0], f.vx[0])
    stepFlock(f, p, 0.05, 400, 400)
    expect(heading()).toBeLessThan(0)
    expect(heading()).toBeGreaterThan(-Math.PI / 2)
    // The group settles on a common heading: the order parameter rises from 0.82 toward 1.
    expect(polarization(f.vx, f.vy, 5)).toBeLessThan(0.9)
    for (let k = 0; k < 40; k++) stepFlock(f, p, 0.05, 400, 400)
    expect(polarization(f.vx, f.vy, 5)).toBeGreaterThan(0.98)
  })

  it('steer turns toward a direction without exceeding the force limit', () => {
    const [ax, ay] = steer(0, 1, 10, 0, 10, 5)
    expect(Math.hypot(ax, ay)).toBeCloseTo(5, 9)
    expect(ax).toBeLessThan(0)
    expect(ay).toBeGreaterThan(0)
  })

  it('polarization is 1 for a parallel flock and ~0 for opposite pairs', () => {
    expect(polarization([3, 1, 5], [0, 0, 0], 3)).toBeCloseTo(1, 9)
    expect(polarization([1, -1, 0, 0], [0, 0, 2, -2], 4)).toBeCloseTo(0, 9)
    expect(polarization([1, 0], [0, 1], 2)).toBeCloseTo(Math.SQRT1_2, 9)
  })
})

describe('ant-colony', () => {
  it('evaporation shrinks every cell by e^(−rate·dt)', () => {
    const g = new Float32Array([1, 2, 4, 0])
    evaporate(g, 0.5, 2)
    expect(g[0]).toBeCloseTo(Math.exp(-1), 6)
    expect(g[2]).toBeCloseTo(4 * Math.exp(-1), 5)
    expect(g[3]).toBe(0)
  })

  it('diffusion spreads a spike, conserves the total and respects walls', () => {
    const cols = 9
    const rows = 9
    const g = new Float32Array(cols * rows)
    const walls = new Uint8Array(cols * rows)
    for (let y = 0; y < rows; y++) walls[y * cols + 6] = 1
    g[4 * cols + 4] = 100
    for (let k = 0; k < 50; k++) diffuse(g, cols, rows, 0.5, walls)
    const total = g.reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(100, 3)
    expect(g[4 * cols + 4]).toBeLessThan(20)
    expect(g[4 * cols + 3]).toBeGreaterThan(0)
    // Nothing leaks through the wall column into the far side.
    expect(g[4 * cols + 7]).toBe(0)
  })

  it('sensors sum the 3×3 patch and ants turn toward the stronger side', () => {
    const f = createField(10, 10, 5)
    f.food[5 * 10 + 7] = 3
    f.food[5 * 10 + 8] = 1
    expect(sense(f.food, f, 7 * 5 + 2, 5 * 5 + 2)).toBeCloseTo(4, 6)
    expect(sense(f.food, f, 2, 2)).toBe(0)
    expect(sense(f.food, f, -3, 10)).toBe(-1)
    expect(turnToward(1, 0.5, 0.2)).toBe(-1)
    expect(turnToward(0, 0.5, 2)).toBe(1)
    expect(turnToward(1, 1, 1)).toBe(0)
  })
})

describe('natural-selection', () => {
  it('mutation keeps every gene inside its bounds, even at huge rates', () => {
    const random = rng(9)
    let g = { speed: 1, size: 1, sense: 1 }
    for (let k = 0; k < 2000; k++) {
      g = mutate(g, 2, random)
      for (const key of ['speed', 'size', 'sense'] as const) {
        expect(g[key]).toBeGreaterThanOrEqual(BOUNDS[key][0])
        expect(g[key]).toBeLessThanOrEqual(BOUNDS[key][1])
      }
    }
    expect(mutate({ speed: 1.3, size: 0.8, sense: 2 }, 0, random)).toEqual({ speed: 1.3, size: 0.8, sense: 2 })
  })

  it('energy cost is size³·speed² + sense', () => {
    expect(energyCost({ speed: 1, size: 1, sense: 1 })).toBe(2)
    expect(energyCost({ speed: 2, size: 1, sense: 1 })).toBe(5)
    expect(energyCost({ speed: 1, size: 2, sense: 0.5 })).toBe(8.5)
  })

  it('creatures that eat nothing die and those that eat twice reproduce', () => {
    const random = rng(2)
    const w = createNS(400, 3, 0, random)
    w.creatures[0].eaten = 0
    w.creatures[1].eaten = 1
    w.creatures[2].eaten = 2
    endDay(w, 0.1, random)
    expect(w.creatures.length).toBe(3)
    expect(w.day).toBe(2)
  })
})

describe('genetic-algorithm', () => {
  it('fitness is the share of matching positions', () => {
    expect(gaFitness('HELLO', 'HELLO')).toBe(1)
    expect(gaFitness('HELXO', 'HELLO')).toBeCloseTo(0.8, 9)
    expect(gaFitness('ABCDE', 'HELLO')).toBe(0)
    expect(sanitize('Hello, world! 42')).toBe('HELLO, WORLD! ')
  })

  it('mutation rate 0 leaves strings alone, rate 1 changes most letters', () => {
    const random = rng(4)
    expect(gaMutate('METHINKS', 0, random)).toBe('METHINKS')
    const s = 'A'.repeat(200)
    const m = gaMutate(s, 1, random)
    expect([...m].filter((c) => c !== 'A').length).toBeGreaterThan(180)
    expect(crossover('AAAA', 'BBBB', random)).toMatch(/^A*B*$/)
  })

  it('reaches a short target with a seeded rng, and elites never get worse', () => {
    const random = rng(42)
    const target = 'HELLO WORLD'
    let p = createPopulation(150, target, random)
    let prev = p.scores[0]
    while (p.scores[0] < 1 && p.generation < 1000) {
      p = nextGeneration(p, { target, mutation: 0.01, crossover: true, selection: 'tournament', elitism: 1 }, random)
      expect(p.scores[0]).toBeGreaterThanOrEqual(prev)
      prev = p.scores[0]
    }
    expect(p.members[0]).toBe(target)
    expect(p.generation).toBeLessThan(200)
  })
})

describe('neural-network', () => {
  const lossOf = (net: Net, batch: Point[], lambda: number) => gradients(net, batch, lambda).loss

  it('backprop gradients match numeric gradients', () => {
    for (const act of ['tanh', 'sigmoid', 'relu'] as const) {
      const random = rng(7)
      const net = createNet([2, 4, 3, 1], act, random)
      const batch = makeData('circle', 12, 0.05, random)
      const { gw, gb } = gradients(net, batch, 0.01)
      const h = 1e-6
      let worst = 0
      const check = (arr: Float64Array, k: number, analytic: number) => {
        const keep = arr[k]
        arr[k] = keep + h
        const up = lossOf(net, batch, 0.01)
        arr[k] = keep - h
        const down = lossOf(net, batch, 0.01)
        arr[k] = keep
        const numeric = (up - down) / (2 * h)
        worst = Math.max(worst, Math.abs(numeric - analytic) / Math.max(1e-4, Math.abs(numeric) + Math.abs(analytic)))
      }
      net.w.forEach((w, l) => w.forEach((_, k) => check(w, k, gw[l][k])))
      net.b.forEach((b, l) => b.forEach((_, k) => check(b, k, gb[l][k])))
      expect(worst).toBeLessThan(1e-4)
    }
  })

  it('learns XOR with a seeded initialisation', () => {
    const random = rng(1)
    const net = createNet([2, 4, 1], 'tanh', random)
    const xor: Point[] = [
      { x: -1, y: -1, label: 1 },
      { x: 1, y: 1, label: 1 },
      { x: -1, y: 1, label: 0 },
      { x: 1, y: -1, label: 0 },
    ]
    const before = evaluate(net, xor).loss
    for (let e = 0; e < 2000; e++) trainEpoch(net, xor, 0.3, 4, 0, random)
    const after = evaluate(net, xor)
    expect(after.accuracy).toBe(1)
    expect(after.loss).toBeLessThan(0.05)
    expect(after.loss).toBeLessThan(before)
    expect(predict(net, 0.9, 0.8)).toBeGreaterThan(0.5)
  })
})

describe('neural-network training', () => {
  it('a 2-4-4-1 tanh network separates the circle dataset within a few hundred epochs', () => {
    const random = rng(3)
    const data = makeData('circle', 200, 0.05, random)
    const net = createNet([2, 4, 4, 1], 'tanh', random)
    let e = 0
    while (evaluate(net, data).accuracy < 0.97 && e < 400) {
      trainEpoch(net, data, 0.1, 10, 0, random)
      e++
    }
    expect(evaluate(net, data).accuracy).toBeGreaterThanOrEqual(0.97)
  })
})
