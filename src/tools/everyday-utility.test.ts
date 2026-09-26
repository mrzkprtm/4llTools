import { describe, expect, it } from 'vitest'
import * as dp from './dead-pixel-test/logic'

describe('dead-pixel-test', () => {
  it('steps through colors and wraps both ways', () => {
    const n = dp.SOLIDS.length
    expect(dp.step({ mode: 'solid', index: n - 1 }, 1)).toEqual({ mode: 'solid', index: 0 })
    expect(dp.step({ mode: 'solid', index: 0 }, -1)).toEqual({ mode: 'solid', index: n - 1 })
    expect(dp.step({ mode: 'black', index: 0 }, 1)).toEqual({ mode: 'black', index: 0 })
  })

  it('tours across modes and skips the flashing fixer', () => {
    const last = dp.PATTERNS.checker.length - 1
    expect(dp.tourStep({ mode: 'solid', index: dp.SOLIDS.length - 1 }, 1)).toEqual({ mode: 'gradient', index: 0 })
    expect(dp.tourStep({ mode: 'checker', index: last }, 1)).toEqual({ mode: 'solid', index: 0 })
    expect(dp.tourStep({ mode: 'solid', index: 0 }, -1)).toEqual({ mode: 'checker', index: last })
  })

  it('draws complementary checkerboards', () => {
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) expect(dp.pixelOn('checker', x, y)).toBe(!dp.pixelOn('checker-inv', x, y))
  })
})

import * as rr from './refresh-rate-test/logic'

describe('refresh-rate-test', () => {
  it('snaps a noisy 144 Hz run to 144 and ignores skipped frames', () => {
    const iv = Array.from({ length: 280 }, (_, i) => 1000 / 144 + (i % 2 ? 0.3 : -0.3))
    iv.push(13.9, 20.8, 13.9)
    const e = rr.estimateHz(iv)
    expect(e.hz).toBe(144)
    expect(e.snapped).toBe(true)
    expect(e.dropped).toBe(3)
  })

  it('does not snap an unusual rate', () => {
    const e = rr.estimateHz(Array(100).fill(1000 / 110))
    expect(e.snapped).toBe(false)
    expect(e.hz).toBe(110)
  })

  it('counts live fps over the last second', () => {
    const stamps = Array.from({ length: 61 }, (_, i) => i * (1000 / 60))
    expect(rr.liveFps(stamps, 1000)).toBeCloseTo(60, 0)
  })
})

import * as kb from './keyboard-tester/logic'

describe('keyboard-tester', () => {
  it('has a full 104-key ANSI layout with unique codes and no overlapping keys', () => {
    expect(kb.LAYOUT.length).toBe(104)
    expect(new Set(kb.LAYOUT.map((k) => k.code)).size).toBe(104)
    expect(kb.LAYOUT.filter((k) => !k.numpad).length).toBe(87)
    for (const a of kb.LAYOUT)
      for (const b of kb.LAYOUT) {
        if (a === b) continue
        const overlap = a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9
        expect(overlap, `${a.code} overlaps ${b.code}`).toBe(false)
      }
  })

  it('tracks held keys, rollover, tested keys and stuck keys', () => {
    const info = (code: string, repeat = false) => ({ key: code, code, keyCode: 0, location: 0, repeat })
    let s = kb.initKb()
    s = kb.kbReducer(s, { type: 'down', info: info('KeyA'), t: 0 })
    s = kb.kbReducer(s, { type: 'down', info: info('KeyS'), t: 10 })
    s = kb.kbReducer(s, { type: 'down', info: info('KeyA', true), t: 50 })
    expect(s.maxHeld).toBe(2)
    expect(s.presses).toBe(2)
    expect(kb.stuckKeys(s, 3005)).toEqual(['KeyA'])
    s = kb.kbReducer(s, { type: 'up', code: 'KeyA' })
    s = kb.kbReducer(s, { type: 'up', code: 'PrintScreen' })
    expect(Object.keys(s.down)).toEqual(['KeyS'])
    expect(kb.testedCount(s, kb.LAYOUT)).toBe(3)
  })
})

import * as gp from './gamepad-tester/logic'

describe('gamepad-tester', () => {
  it('measures resting drift and suggests a deadzone that covers it', () => {
    const d = gp.computeDrift([{ x: 0.03, y: 0 }, { x: 0.05, y: -0.12 }, { x: 0.04, y: -0.1 }])
    expect(d.max).toBeCloseTo(0.13, 5)
    expect(d.verdict).toBe('slight')
    expect(d.deadzone).toBe(0.15)
    expect(gp.computeDrift([{ x: 0.01, y: 0.01 }]).verdict).toBe('good')
  })

  it('applies a radial scaled deadzone', () => {
    expect(gp.applyDeadzone({ x: 0.1, y: 0 }, 0.15)).toEqual({ x: 0, y: 0 })
    const full = gp.applyDeadzone({ x: 0, y: -1 }, 0.2)
    expect(full.y).toBeCloseTo(-1, 6)
    expect(gp.applyDeadzone({ x: 0.6, y: 0 }, 0.2).x).toBeCloseTo(0.5, 6)
  })

  it('labels the standard mapping and falls back for others', () => {
    expect(gp.buttonLabel(0, 'standard')).toBe('A / Cross')
    expect(gp.buttonLabel(7, 'standard')).toBe('RT / R2')
    expect(gp.buttonLabel(7, '')).toBe('Button 7')
    expect(gp.axisLabel(3, 'standard')).toBe('Right stick Y')
  })
})

import * as mt from './mouse-tester/logic'

describe('mouse-tester', () => {
  it('computes clicks per second', () => {
    expect(mt.cps(42, 5000)).toBeCloseTo(8.4, 6)
    expect(mt.cps(3, 0)).toBe(0)
  })

  it('flags presses under 80 ms apart as switch bounce', () => {
    const b = mt.findBounces([0, 150, 190, 400, 470, 700])
    expect(b.map((x) => x.gap)).toEqual([40, 70])
  })

  it('estimates and snaps the polling rate', () => {
    const at1000 = Array.from({ length: 200 }, (_, i) => i * 1 + (i % 3) * 0.05)
    expect(mt.pollingRate(at1000).hz).toBe(1000)
    const at125 = Array.from({ length: 50 }, (_, i) => i * 8)
    expect(mt.pollingRate(at125).hz).toBe(125)
    expect(mt.wheelSteps(-120, 0)).toBe(-1)
    expect(mt.wheelSteps(3, 1)).toBe(1)
  })
})

import * as tt from './touch-tester/logic'

describe('touch-tester', () => {
  it('paints cells under a touch and reports coverage', () => {
    const g = tt.makeGrid(100, 50, 10)
    expect(g.cols * g.rows).toBe(50)
    expect(tt.paintDot(g, 15, 15, 4)).toBe(1)
    expect(tt.paintDot(g, 15, 15, 4)).toBe(0)
    expect(tt.paintDot(g, 20, 20, 1)).toBe(3)
    expect(tt.coverage(g)).toBeCloseTo(4 / 50, 6)
  })

  it('fills a fast swipe without gaps', () => {
    const g = tt.makeGrid(100, 10, 10)
    tt.paintLine(g, 5, 5, 95, 5, 3)
    expect(tt.coverage(g)).toBe(1)
  })
})

import * as sr from './screen-ruler/logic'

describe('screen-ruler', () => {
  it('calibrates from a card and converts px to mm and inches', () => {
    const k = sr.calibrate(323.5)
    expect(sr.pxToMm(323.5, k)).toBeCloseTo(85.6, 6)
    expect(sr.mmToPx(sr.CARD.h, k)).toBeCloseTo(323.5 * (53.98 / 85.6), 6)
    expect(sr.pxToMm(96, sr.guessPxPerMm(1, false))).toBeCloseTo(25.4, 6)
    expect(sr.mmToIn(50.8)).toBeCloseTo(2, 9)
  })

  it('measures the angle between two arms', () => {
    const v = { x: 0, y: 0 }
    expect(sr.angleAt(v, { x: 10, y: 0 }, { x: 0, y: -10 }).deg).toBeCloseTo(90, 6)
    expect(sr.angleAt(v, { x: 10, y: 0 }, { x: -10, y: 0.0001 }).deg).toBeCloseTo(180, 2)
    expect(sr.angleAt(v, { x: 1, y: 0 }, { x: 1, y: 1 }).deg).toBeCloseTo(45, 6)
  })
})

import * as sl from './screen-light/logic'

describe('screen-light', () => {
  it('maps color temperature to the expected RGB', () => {
    expect(sl.kelvinToRgb(6600)).toEqual([255, 255, 255])
    const warm = sl.kelvinToRgb(2700)
    expect(warm[0]).toBe(255)
    expect(warm[1]).toBeGreaterThan(160)
    expect(warm[1]).toBeLessThan(175)
    expect(warm[2]).toBeGreaterThan(80)
    expect(warm[2]).toBeLessThan(95)
    const cool = sl.kelvinToRgb(10000)
    expect(cool[2]).toBe(255)
    expect(cool[0]).toBeLessThan(210)
  })

  it('dims and round-trips hex colors', () => {
    expect(sl.toHex(sl.dim([255, 128, 0], 0.5))).toBe('#804000')
    expect(sl.fromHex('#ffd6e8')).toEqual([255, 214, 232])
  })
})

import * as ht from './hearing-test/logic'

describe('hearing-test', () => {
  it('converts between dB and gain', () => {
    expect(ht.dbToGain(0)).toBe(1)
    expect(ht.dbToGain(-20)).toBeCloseTo(0.1, 9)
    expect(ht.gainToDb(0.5)).toBeCloseTo(-6.0206, 3)
  })

  it('ascends 5 dB, drops 15 dB after a response, and settles on repeat responses', () => {
    let s = ht.newStair(-60)
    s = ht.stairStep(s, false) // -55
    s = ht.stairStep(s, false) // -50
    expect(s.level).toBe(-50)
    s = ht.stairStep(s, true) // heard at -50, drop to -65
    expect(s.level).toBe(-65)
    s = ht.stairStep(s, false) // -60
    s = ht.stairStep(s, false) // -55
    s = ht.stairStep(s, true) // heard at -55, within 5 dB of -50
    expect(s.done).toBe(true)
    expect(s.threshold).toBe(-50)
  })

  it('reports not heard at the maximum level, and sweeps exponentially', () => {
    let s = ht.newStair(-10)
    for (let i = 0; i < 3; i++) s = ht.stairStep(s, false)
    expect(s.done).toBe(true)
    expect(s.threshold).toBeNull()
    expect(ht.sweepFreq(8000, 16000, 10, 5)).toBeCloseTo(8000 * Math.SQRT2, 6)
  })
})
