import { describe, expect, it } from 'vitest'
import { rk4 } from '../sim/math'
import { doubleDeriv, doubleEnergy } from './double-pendulum/double'
import { KB, mb2d, temperatureOf } from './ideal-gas/gas'
import { circularSpeed, leapfrog, mergeTouching, totalEnergy } from './orbit-simulator/orbit'
import { exactPeriod, pendulumDeriv, smallAnglePeriod } from './pendulum-lab/pendulum'
import { idealFlight, simulateFlight } from './projectile-motion/projectile'
import { dampingRegime, naturalFrequency, steadyAmplitude } from './spring-mass/spring'
import { harmonicFrequency, noteName, nodes } from './standing-waves/strings'
import { intensityAt, pathDifference } from './wave-interference/waves'

describe('projectile motion', () => {
  it('gives the textbook range at 45°', () => {
    const f = idealFlight({ v: 20, angle: 45, g: 9.81, h0: 0 })
    expect(f.range).toBeCloseTo(400 / 9.81, 6)
    expect(f.peak).toBeCloseTo(100 / 9.81, 6)
  })

  it('matches the closed form numerically without drag, and falls short with drag', () => {
    const launch = { v: 30, angle: 35, g: 9.81, h0: 5 }
    const exact = idealFlight(launch)
    const sim = simulateFlight(launch, 0)
    expect(sim.range).toBeCloseTo(exact.range, 1)
    expect(sim.time).toBeCloseTo(exact.time, 2)
    expect(simulateFlight(launch, 0.02).range).toBeLessThan(exact.range * 0.9)
  })
})

describe('pendulum', () => {
  it('uses 2π√(L/g) for small swings and a longer period for big ones', () => {
    expect(smallAnglePeriod(1, 9.81)).toBeCloseTo(2.006, 3)
    expect(exactPeriod(1, 9.81, 0.01)).toBeCloseTo(smallAnglePeriod(1, 9.81), 4)
    // Known ratio T/T0 ≈ 1.1803 at 90°.
    expect(exactPeriod(1, 9.81, Math.PI / 2) / smallAnglePeriod(1, 9.81)).toBeCloseTo(1.1803, 3)
  })

  it('swings back to its release angle after one exact period', () => {
    const T = exactPeriod(2, 9.81, 1)
    let y = [1, 0]
    const n = 4000
    for (let i = 0; i < n; i++) y = rk4(pendulumDeriv(9.81, 2, 0), 0, y, T / n)
    expect(y[0]).toBeCloseTo(1, 4)
  })
})

describe('double pendulum', () => {
  it('conserves energy with RK4', () => {
    const p = { m1: 1, m2: 1, L1: 1, L2: 1, g: 9.81 }
    let y = [2, 0, 1, 0]
    const e0 = doubleEnergy(p, y)
    for (let i = 0; i < 2000; i++) y = rk4(doubleDeriv(p), 0, y, 0.001)
    expect(Math.abs((doubleEnergy(p, y) - e0) / e0)).toBeLessThan(1e-5)
  })
})

describe('spring and mass', () => {
  it('classifies damping', () => {
    expect(naturalFrequency(4, 1)).toBe(2)
    expect(dampingRegime(4, 1, 0)).toBe('undamped')
    expect(dampingRegime(4, 1, 1)).toBe('underdamped')
    expect(dampingRegime(4, 1, 4)).toBe('critically damped')
    expect(dampingRegime(4, 1, 10)).toBe('overdamped')
  })

  it('peaks in amplitude at resonance', () => {
    const at = (wd: number) => steadyAmplitude({ k: 4, m: 1, c: 0.2, F: 1, wd })
    expect(at(2)).toBeGreaterThan(at(1.5))
    expect(at(2)).toBeGreaterThan(at(2.5))
  })
})

describe('ideal gas', () => {
  it('uses a normalised 2D Maxwell–Boltzmann distribution', () => {
    let area = 0
    for (let v = 0; v < 3000; v += 0.5) area += mb2d(v, 300, 1) * 0.5
    expect(area).toBeCloseTo(1, 3)
  })

  it('reads temperature from kinetic energy', () => {
    const v = Math.sqrt(KB * 300) // ½·m·v² per axis pair = kT
    expect(temperatureOf([v, 0], [0, v], [1, 1], 2)).toBeCloseTo(150)
  })
})

describe('wave interference', () => {
  it('adds up where path lengths match and cancels half a wave off', () => {
    const a = { x: 0, y: 0, phase: 0 }
    const b = { x: 20, y: 0, phase: 0 }
    expect(pathDifference(a, b, 10, 50, 10).kind).toBe('constructive')
    expect(pathDifference(a, b, 12.5, 0, 10).kind).toBe('destructive')
    // Opposite phases cancel exactly on the centre line.
    const c = { ...b, phase: Math.PI }
    expect(pathDifference(a, c, 10, 50, 10).kind).toBe('destructive')
    expect(intensityAt([a, c], 10, 50, 10)).toBeLessThan(1e-12)
  })
})

describe('standing waves', () => {
  it('uses fₙ = n/2L · √(T/μ)', () => {
    expect(harmonicFrequency(1, 0.5, 100, 0.01)).toBeCloseTo(100)
    expect(harmonicFrequency(3, 0.5, 100, 0.01)).toBeCloseTo(300)
    expect(nodes(2)).toEqual([0, 0.5, 1])
    expect(noteName(440)).toBe('A4')
  })
})

describe('orbits', () => {
  it('keeps a circular orbit circular with leapfrog', () => {
    const M = 1e6
    const r = 100
    const v = circularSpeed(1, M, r)
    const bodies = [{ x: 0, y: 0, vx: 0, vy: 0, m: M }, { x: r, y: 0, vx: 0, vy: v, m: 1e-6 }]
    const e0 = totalEnergy(bodies, 1, 0)
    for (let i = 0; i < 5000; i++) leapfrog(bodies, 0.002, 1, 0)
    expect(Math.hypot(bodies[1].x, bodies[1].y)).toBeCloseTo(r, 0)
    expect(totalEnergy(bodies, 1, 0)).toBeCloseTo(e0, 0)
  })

  it('merges touching bodies without losing momentum', () => {
    const merged = mergeTouching([{ x: 0, y: 0, vx: 1, vy: 0, m: 3 }, { x: 1, y: 0, vx: -1, vy: 0, m: 1 }], () => 5)
    expect(merged).toHaveLength(1)
    expect(merged[0].m).toBe(4)
    expect(merged[0].vx * merged[0].m).toBeCloseTo(2)
  })
})
