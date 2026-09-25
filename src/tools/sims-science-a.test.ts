import { describe, expect, it } from 'vitest'
import { rk4, rng } from '../sim/math'
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
