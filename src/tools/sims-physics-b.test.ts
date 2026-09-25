import { describe, expect, it } from 'vitest'
import { deg, rad } from '../sim/math'
import { approachSpeed, dopplerObserved, machAngle } from './doppler-effect/doppler'
import { principalRays, signedFocal, thinLens } from './lens-ray-tracer/optics'
import { brewsterAngle, criticalAngle, fresnelReflectance, refractAngle } from './snells-law/snell'
import { fieldAt, potentialAt, traceLine } from './electric-field/field'

describe('doppler effect', () => {
  it('raises the pitch ahead and lowers it behind', () => {
    expect(dopplerObserved(100, 340, 0)).toBe(100)
    expect(dopplerObserved(100, 340, 170)).toBeCloseTo(200)
    expect(dopplerObserved(100, 340, -170)).toBeCloseTo(66.667, 2)
    expect(dopplerObserved(100, 340, 0, 34)).toBeCloseTo(110)
    expect(dopplerObserved(100, 340, 340)).toBe(Infinity)
  })

  it('opens a Mach cone only past Mach 1', () => {
    expect(machAngle(0.9)).toBeNull()
    expect(deg(machAngle(2)!)).toBeCloseTo(30)
    expect(deg(machAngle(1)!)).toBeCloseTo(90)
  })

  it('projects the velocity onto the line of sight', () => {
    expect(approachSpeed(0, 0, 10, 0, 100, 0)).toBeCloseTo(10)
    expect(approachSpeed(0, 0, 10, 0, -100, 0)).toBeCloseTo(-10)
    expect(approachSpeed(0, 0, 10, 0, 0, 100)).toBeCloseTo(0)
  })
})

describe('thin lens', () => {
  it('images an object at 2F onto 2F, inverted and the same size', () => {
    const { di, m } = thinLens(10, 20)
    expect(di).toBeCloseTo(20)
    expect(m).toBeCloseTo(-1)
  })

  it('gives virtual upright images inside F and for diverging optics', () => {
    expect(thinLens(10, 5)).toMatchObject({ di: -10, m: 2, atInfinity: false })
    const d = thinLens(signedFocal('diverging', 10), 10)
    expect(d.di).toBeCloseTo(-5)
    expect(d.m).toBeCloseTo(0.5)
    expect(thinLens(10, 10).atInfinity).toBe(true)
  })

  it('sends all principal rays through the image point', () => {
    for (const [f, dObj] of [[10, 25], [10, 6], [-8, 14]]) {
      const h = 3
      const { di, m } = thinLens(f, dObj)
      const rays = principalRays(f, dObj, h)
      expect(rays).toHaveLength(3)
      for (const r of rays) expect(r.yl + r.slopeOut * di).toBeCloseTo(m * h, 6)
    }
  })
})

describe("snell's law", () => {
  it('bends light towards the normal in a denser medium', () => {
    const t = refractAngle(1, 1.5, rad(30))!
    expect(Math.sin(t) * 1.5).toBeCloseTo(Math.sin(rad(30)))
    expect(t).toBeLessThan(rad(30))
  })

  it('reflects everything past the critical angle', () => {
    expect(deg(criticalAngle(1.5, 1)!)).toBeCloseTo(41.81, 1)
    expect(criticalAngle(1, 1.5)).toBeNull()
    expect(refractAngle(1.5, 1, rad(45))).toBeNull()
    expect(fresnelReflectance(1.5, 1, rad(45))).toBe(1)
  })

  it('matches the textbook Fresnel numbers', () => {
    // Normal incidence air→glass: ((1.5−1)/(1.5+1))² = 4%.
    expect(fresnelReflectance(1, 1.5, 0)).toBeCloseTo(0.04, 4)
    // At Brewster's angle p-light is not reflected, so R = Rs / 2 = sin²(θi − θt) / 2.
    const b = brewsterAngle(1, 1.5)
    const t = refractAngle(1, 1.5, b)!
    expect(b + t).toBeCloseTo(Math.PI / 2)
    expect(fresnelReflectance(1, 1.5, b)).toBeCloseTo(Math.sin(b - t) ** 2 / 2, 6)
    expect(fresnelReflectance(1, 1.5, rad(89.9))).toBeGreaterThan(0.95)
  })
})

describe('electric field', () => {
  it('follows Coulomb for a single charge', () => {
    const [ex, ey] = fieldAt([{ x: 0, y: 0, q: 2 }], 10, 0)
    expect(ex).toBeCloseTo(2 / 100)
    expect(ey).toBeCloseTo(0)
    expect(potentialAt([{ x: 0, y: 0, q: 2 }], 0, 10)).toBeCloseTo(0.2)
  })

  it('points from + to − between a dipole, where the potential is zero', () => {
    const dipole = [{ x: -50, y: 0, q: 1 }, { x: 50, y: 0, q: -1 }]
    const [ex, ey] = fieldAt(dipole, 0, 0)
    expect(ex).toBeGreaterThan(0)
    expect(ey).toBeCloseTo(0)
    expect(potentialAt(dipole, 0, 37)).toBeCloseTo(0)
  })

  it('traces a field line from the positive charge into the negative one', () => {
    const dipole = [{ x: 300, y: 250, q: 1 }, { x: 500, y: 250, q: -1 }]
    const line = traceLine(dipole, 306, 248, { maxSteps: 2000 })
    expect(line.end).toBe('charge')
    expect(line.hit).toBe(1)
  })
})
