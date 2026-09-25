import { describe, expect, it } from 'vitest'
import { rng } from '../sim/math'
import { decayProbability, stepDecay, theoretical } from './half-life/decay'
import { barriers, collisionEnergy, equilibriumK, predictedK, reacts } from './reaction-equilibrium/equilibrium'
import { concentration, fitsPore, passesMembrane, poreCentres, waterActivity } from './diffusion-membrane/membrane'

describe('half-life', () => {
  it('gives a 50% decay chance over one half-life, compounding over steps', () => {
    expect(decayProbability(5730, 5730)).toBeCloseTo(0.5, 12)
    expect(decayProbability(0, 10)).toBe(0)
    // Ten steps of a tenth of a half-life leave the same survival as one full step.
    const p = decayProbability(0.1, 1)
    expect((1 - p) ** 10).toBeCloseTo(0.5, 12)
  })

  it('follows N0 · 2^(−t/T) and the random process matches it', () => {
    expect(theoretical(1000, 0, 8)).toBe(1000)
    expect(theoretical(1000, 16, 8)).toBeCloseTo(250, 10)
    const n = 20000
    const state = new Uint8Array(n)
    const random = rng(7)
    for (let i = 0; i < 20; i++) stepDecay(state, n, decayProbability(0.1, 1), random)
    const left = state.reduce((a, v) => a + (v === 0 ? 1 : 0), 0)
    expect(Math.abs(left - theoretical(n, 2, 1))).toBeLessThan(200)
  })
})

describe('diffusion-membrane', () => {
  it('lets particles through only when they fit and line up with a pore', () => {
    const centres = poreCentres(4, 0, 400)
    expect(centres).toEqual([50, 150, 250, 350])
    expect(fitsPore(5, 10)).toBe(true)
    expect(fitsPore(12, 10)).toBe(false)
    expect(passesMembrane(5, 152, 10, centres)).toBe(true)
    expect(passesMembrane(5, 100, 10, centres)).toBe(false)
    expect(passesMembrane(12, 150, 10, centres)).toBe(false)
    expect(passesMembrane(12, 150, 16, centres)).toBe(true)
  })

  it('computes concentrations and water activity', () => {
    expect(concentration(30, 10)).toBe(3)
    expect(concentration(5, 0)).toBe(0)
    expect(waterActivity(100, 0)).toBe(1)
    expect(waterActivity(100, 25, 4)).toBe(0.5)
  })
})

describe('reaction-equilibrium', () => {
  it('only counts the head-on part of a collision against the barrier', () => {
    // Head-on: closing speed 2 along the normal, reduced mass ½ → energy ½·½·4 = 1.
    expect(collisionEnergy(1, 1, 1, 0, -1, 0, 1, 0)).toBeCloseTo(1, 12)
    // Glancing: motion perpendicular to the line of centres carries no reactive energy.
    expect(collisionEnergy(1, 1, 0, 5, 0, -5, 1, 0)).toBe(0)
    // Moving apart never reacts.
    expect(collisionEnergy(1, 1, -1, 0, 1, 0, 1, 0)).toBe(0)
    expect(reacts(1, 1)).toBe(true)
    expect(reacts(0.99, 1)).toBe(false)
    expect(barriers(5, -3)).toEqual({ forward: 5, reverse: 8 })
    expect(barriers(2, 4)).toEqual({ forward: 4, reverse: 0 })
  })

  it('computes K from concentrations and from detailed balance', () => {
    expect(equilibriumK(20, 20, 40, 40)).toBe(4)
    expect(equilibriumK(0, 10, 5, 5)).toBe(Infinity)
    expect(predictedK(0, 300)).toBe(1)
    expect(predictedK(-3, 300)).toBeGreaterThan(1)
    expect(predictedK(-3, 600)).toBeLessThan(predictedK(-3, 300))
  })
})
