import { describe, expect, it } from 'vitest'
import { rng } from '../sim/math'
import { decayProbability, stepDecay, theoretical } from './half-life/decay'
import { configString, element, isStable, shellCounts } from './atom-builder/atom'
import { angleAt, apply, mul, rotation, type Vec3 } from './molecule-viewer/geometry'
import { MOLECULES, hillFormula } from './molecule-viewer/molecules'
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

describe('atom-builder', () => {
  it('writes electron configurations in aufbau order', () => {
    expect(configString(26)).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d6')
    expect(configString(26, true)).toBe('[Ar] 4s2 3d6')
    expect(configString(8)).toBe('1s2 2s2 2p4')
    expect(configString(18, true)).toBe('[Ne] 3s2 3p6')
    // Chromium and copper promote a 4s electron.
    expect(configString(24, true)).toBe('[Ar] 4s1 3d5')
    expect(configString(29, true)).toBe('[Ar] 4s1 3d10')
    expect(configString(0)).toBe('—')
  })

  it('fills Bohr shells by principal quantum number', () => {
    expect(shellCounts(11)).toEqual([2, 8, 1])
    expect(shellCounts(20)).toEqual([2, 8, 8, 2])
    expect(shellCounts(26)).toEqual([2, 8, 14, 2])
    expect(shellCounts(36)).toEqual([2, 8, 18, 8])
  })

  it('looks up elements and stable isotopes', () => {
    expect(element(6)?.name).toBe('Carbon')
    expect(element(36)?.symbol).toBe('Kr')
    expect(element(0)).toBeNull()
    expect(isStable(6, 6)).toBe(true)
    expect(isStable(6, 8)).toBe(false)
    expect(isStable(26, 30)).toBe(true)
  })
})

describe('molecule-viewer', () => {
  it('builds proper rotation matrices', () => {
    const r = rotation([0, 0, 1], Math.PI / 2)
    const v = apply(r, [1, 0, 0])
    expect(v[0]).toBeCloseTo(0, 12)
    expect(v[1]).toBeCloseTo(1, 12)
    // Orthonormal: R·Rᵀ = I, and rotations compose.
    const q = rotation([1, 2, 3], 0.7)
    const qt = [q[0], q[3], q[6], q[1], q[4], q[7], q[2], q[5], q[8]] as typeof q
    mul(q, qt).forEach((x, i) => expect(x).toBeCloseTo(i % 4 === 0 ? 1 : 0, 12))
    const twice = mul(rotation([0, 1, 0], 0.3), rotation([0, 1, 0], 0.4))
    rotation([0, 1, 0], 0.7).forEach((x, i) => expect(twice[i]).toBeCloseTo(x, 12))
  })

  it('measures textbook bond angles from the models', () => {
    const mol = (id: string) => MOLECULES.find((m) => m.id === id)!
    const ref = (id: string) => {
      const m = mol(id)
      const [a, b, c] = m.angle.map((i) => m.atoms[i].p) as [Vec3, Vec3, Vec3]
      return angleAt(a, b, c)
    }
    expect(ref('h2o')).toBeCloseTo(104.5, 1)
    expect(ref('ch4')).toBeCloseTo(109.47, 1)
    expect(ref('nh3')).toBeCloseTo(106.7, 1)
    expect(ref('co2')).toBeCloseTo(180, 6)
    expect(ref('sf6')).toBeCloseTo(90, 6)
    expect(ref('c6h6')).toBeCloseTo(120, 6)
  })

  it('has the right atoms and bonds for the bigger molecules', () => {
    const mol = (id: string) => MOLECULES.find((m) => m.id === id)!
    expect(hillFormula(mol('glucose').atoms)).toBe('C6H12O6')
    expect(hillFormula(mol('caffeine').atoms)).toBe('C8H10N4O2')
    expect(hillFormula(mol('ethanol').atoms)).toBe('C2H6O')
    // Bonds = atoms − 1 + rings when nothing spurious is detected.
    expect(mol('glucose').bonds.length).toBe(24)
    expect(mol('caffeine').bonds.length).toBe(25)
    expect(mol('c6h6').bonds.filter((b) => b[2] === 2).length).toBe(3)
  })
})
