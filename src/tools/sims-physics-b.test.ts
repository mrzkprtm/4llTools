import { describe, expect, it } from 'vitest'
import { deg, rad, rng } from '../sim/math'
import { approachSpeed, dopplerObserved, machAngle } from './doppler-effect/doppler'
import { principalRays, signedFocal, thinLens } from './lens-ray-tracer/optics'
import { brewsterAngle, criticalAngle, fresnelReflectance, refractAngle } from './snells-law/snell'
import { fieldAt, potentialAt, traceLine } from './electric-field/field'
import { borisStep, cyclotronPeriod, driftSpeed, larmorRadius } from './lorentz-force/lorentz'
import { Fluid } from './fluid-smoke/fluid'
import { Cloth } from './cloth-simulation/cloth'
import { energy, momentum, resolveContacts, stepPendulums, type Ball, type Rig } from './newtons-cradle/cradle'
import { inclineAcceleration, stepIncline } from './inclined-plane/incline'
import { rcStep, vcCharge, vcDischarge } from './rc-circuit/rc'
import { diffuseStep, stats, subSteps } from './heat-diffusion/heat'

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

describe('lorentz force', () => {
  it('keeps the speed exact and closes the circle after one period in a pure B field', () => {
    const m = 2
    const q = 1
    const B = 1.5
    const v = 120
    const T = cyclotronPeriod(m, q, B)
    const p = { x: 0, y: 0, vx: v, vy: 0 }
    const n = 2000
    let minY = 0
    for (let i = 0; i < n; i++) {
      borisStep(p, q / m, 0, 0, B, T / n)
      minY = Math.min(minY, p.y)
      expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(v, 9)
    }
    expect(Math.hypot(p.x, p.y)).toBeLessThan(0.5)
    // A positive charge moving right with B out of the screen curves downwards (clockwise).
    expect(-minY).toBeCloseTo(2 * larmorRadius(m, v, q, B), 0)
  })

  it('lets only v = E/B through a velocity selector', () => {
    const B = 1.5
    const v = 150
    const E = v * B
    expect(driftSpeed(E, B)).toBe(v)
    const straight = { x: 0, y: 0, vx: v, vy: 0 }
    const fast = { x: 0, y: 0, vx: v * 1.3, vy: 0 }
    for (let i = 0; i < 600; i++) {
      borisStep(straight, 1, 0, E, B, 1 / 600)
      borisStep(fast, 1, 0, E, B, 1 / 600)
    }
    expect(Math.abs(straight.y)).toBeLessThan(1e-6)
    expect(straight.x).toBeCloseTo(v)
    expect(fast.y).toBeLessThan(-5)
  })

  it('drifts at E/B in crossed fields', () => {
    const E = 90
    const B = 1.5
    const T = cyclotronPeriod(1, 1, B)
    const p = { x: 0, y: 0, vx: 0, vy: 0 }
    const n = 3000
    for (let i = 0; i < n * 3; i++) borisStep(p, 1, 0, E, B, T / n)
    expect(p.x / (3 * T)).toBeCloseTo(driftSpeed(E, B), 1)
  })
})

describe('fluid', () => {
  function swirlField(f: Fluid) {
    for (let j = 1; j <= f.ny; j++)
      for (let i = 1; i <= f.nx; i++) {
        const k = f.IX(i, j)
        const dx = i - f.nx / 2
        const dy = j - f.ny / 2
        const g = Math.exp(-(dx * dx + dy * dy) / 60)
        f.u[k] = dx * g
        f.v[k] = dy * g
      }
  }

  it('projection removes most of the divergence', () => {
    const f = new Fluid(64, 40)
    swirlField(f)
    const before = f.divergence()
    f.project(16)
    const after16 = f.divergence()
    f.project(80)
    expect(after16).toBeLessThan(before * 0.4)
    expect(f.divergence()).toBeLessThan(before * 0.1)
  })

  it('keeps the dye in a closed tank when nothing fades', () => {
    const f = new Fluid(64, 40)
    f.addDye(32, 20, 1, 0.5, 0.2, 6)
    f.addVelocity(28, 20, 30, 10, 5)
    const random = rng(4)
    const total = f.totalDye()
    for (let s = 0; s < 180; s++) {
      if (s % 20 === 0) f.addVelocity(10 + random() * 44, 5 + random() * 30, random() * 40 - 20, random() * 40 - 20, 4)
      f.step(1 / 60, { vorticity: 5 })
    }
    expect(f.totalDye()).toBeCloseTo(total, 6)
    // With fade the dye decays exponentially instead.
    f.step(1, { fade: 0.5 })
    expect(f.totalDye() / total).toBeCloseTo(0.5, 6)
  })
})

describe('cloth', () => {
  it('keeps pinned points where they were hung', () => {
    const c = new Cloth(12, 8, 10, 0, 0, 'corners')
    const pins = [0, 11].map((k) => [c.x[k], c.y[k]])
    for (let s = 0; s < 400; s++) c.step(1 / 120, { gravity: 980, iterations: 8, force: () => [300, 0] })
    ;[0, 11].forEach((k, i) => {
      expect(c.x[k]).toBe(pins[i][0])
      expect(c.y[k]).toBe(pins[i][1])
    })
    expect(c.y[c.n - 1]).toBeGreaterThan(50)
  })

  it('relaxes back to its rest lengths', () => {
    const c = new Cloth(12, 8, 10, 0, 0, 'row')
    const random = rng(9)
    for (let k = 12; k < c.n; k++) {
      c.x[k] += (random() - 0.5) * 6
      c.y[k] += (random() - 0.5) * 6
    }
    expect(c.maxStretch()).toBeGreaterThan(0.2)
    c.satisfy(300)
    expect(c.maxStretch()).toBeLessThan(0.01)
  })

  it('breaks links that are cut or overstretched', () => {
    const c = new Cloth(12, 8, 10, 0, 0, 'row')
    expect(c.cut(-5, 35, 200, 35, 6)).toBeGreaterThan(5)
    const t = new Cloth(4, 4, 10, 0, 0, 'row')
    t.x[15] += 200
    t.satisfy(1, 2)
    expect(Array.from(t.alive).some((a) => a === 0)).toBe(true)
  })
})

describe("newton's cradle", () => {
  const rig: Rig = { L: 0.3, r: 0.025, g: 9.81, m: 0.1 }
  const row = (n: number, moving: number[]): Ball[] => Array.from({ length: n }, (_, i) => ({ th: 0, w: moving.includes(i) ? 2 : 0 }))

  it('sends one ball out for one ball in', () => {
    const balls = row(5, [0])
    const { hits } = resolveContacts(balls, rig, 1)
    expect(hits).toBe(4)
    expect(balls.map((b) => b.w)).toEqual([0, 0, 0, 0, 2])
  })

  it('sends two out for two in, conserving momentum and energy', () => {
    const balls = row(5, [0, 1])
    const p = momentum(balls, rig)
    const e = energy(balls, rig)
    resolveContacts(balls, rig, 1)
    expect(balls.map((b) => b.w)).toEqual([0, 0, 0, 2, 2])
    expect(momentum(balls, rig)).toBeCloseTo(p, 12)
    expect(energy(balls, rig)).toBeCloseTo(e, 12)
  })

  it('keeps momentum but loses energy when collisions are inelastic', () => {
    const balls = row(5, [0])
    const p = momentum(balls, rig)
    const e = energy(balls, rig)
    resolveContacts(balls, rig, 0.9)
    expect(momentum(balls, rig)).toBeCloseTo(p, 12)
    expect(energy(balls, rig)).toBeLessThan(e)
    expect(balls.slice(1).every((b) => b.w > 0)).toBe(true)
  })

  it('swings a lone pendulum with the small-angle period', () => {
    const b = [{ th: 0.05, w: 0 }]
    let t = 0
    const dt = 1e-4
    while (b[0].th > 0) (stepPendulums(b, dt, rig), (t += dt))
    expect(4 * t).toBeCloseTo(2 * Math.PI * Math.sqrt(rig.L / rig.g), 2)
  })
})

describe('inclined plane', () => {
  const base = { m: 2, g: 9.81, mus: 0.5, muk: 0.3, F: 0, v: 0 }

  it('stays put while tan θ < μs, with static friction balancing gravity', () => {
    const r = inclineAcceleration({ ...base, angle: 20 })
    expect(r.holds).toBe(true)
    expect(r.a).toBe(0)
    expect(r.friction).toBeCloseTo(-2 * 9.81 * Math.sin(rad(20)))
    expect(r.normal).toBeCloseTo(2 * 9.81 * Math.cos(rad(20)))
  })

  it('slides at g(sin θ − μk cos θ) once static friction gives way', () => {
    const r = inclineAcceleration({ ...base, angle: 40 })
    expect(r.holds).toBe(false)
    expect(r.a).toBeCloseTo(9.81 * (Math.sin(rad(40)) - 0.3 * Math.cos(rad(40))))
    // A block already moving keeps kinetic friction even on a gentle slope, and slows down.
    const slow = inclineAcceleration({ ...base, angle: 10, v: 1 })
    expect(slow.a).toBeLessThan(0)
  })

  it('can be pushed up the slope and stops instead of reversing', () => {
    const up = inclineAcceleration({ ...base, angle: 10, F: 40 })
    expect(up.a).toBeLessThan(0)
    const r = stepIncline(1, 0.01, 0.1, { ...base, angle: 10 })
    expect(r.v).toBe(0)
  })
})

describe('rc circuit', () => {
  it('reaches 63.2% after one time constant', () => {
    const R = 10e3
    const C = 100e-6
    expect(vcCharge(R * C, 9, R, C) / 9).toBeCloseTo(0.632, 3)
    expect(vcDischarge(R * C, 9, R, C) / 9).toBeCloseTo(0.368, 3)
  })

  it('steps exactly, whatever the step size', () => {
    const R = 2e3
    const C = 470e-6
    let s = { vc: 0, i: 0 }
    for (let k = 0; k < 1000; k++) s = rcStep(s, 0.001, R, C, 12, true)
    expect(s.vc).toBeCloseTo(vcCharge(1, 12, R, C), 10)
    expect(s.i).toBeCloseTo((12 - s.vc) / R, 12)
    const d = rcStep(s, 0.5, R, C, 12, false)
    expect(d.vc).toBeCloseTo(vcDischarge(0.5, s.vc, R, C), 10)
    expect(d.i).toBeLessThan(0)
  })
})

describe('heat diffusion', () => {
  const w = 40
  const h = 25
  const random = rng(5)
  const start = (): Float64Array => Float64Array.from({ length: w * h }, () => random() * 100)

  it('conserves total heat with insulated edges', () => {
    let g = start()
    const total = stats(g).sum
    for (let s = 0; s < 300; s++) g = diffuseStep(g, w, h, 0.24, 'insulated')
    expect(stats(g).sum).toBeCloseTo(total, 6)
    // And it evens out without overshooting (maximum principle).
    expect(stats(g).max - stats(g).min).toBeLessThan(40)
    expect(stats(g).max).toBeLessThanOrEqual(100)
  })

  it('leaks heat through cold edges', () => {
    let g = start()
    const total = stats(g).sum
    for (let s = 0; s < 300; s++) g = diffuseStep(g, w, h, 0.24, 'cold')
    expect(stats(g).sum).toBeLessThan(total * 0.7)
  })

  it('splits a frame into stable sub-steps', () => {
    const { n, k } = subSteps(200, 1 / 60)
    expect(k).toBeLessThanOrEqual(0.24)
    expect(n * k).toBeCloseTo(200 / 60)
  })
})
