import { describe, expect, it } from 'vitest'
import { OG_H, OG_W, PRESETS, fitFont } from './og'

describe('fitFont', () => {
  const charW = (size: number) => (s: string) => (s.length * size) / 2

  it('keeps the start size when the text fits', () => {
    const r = fitFont(charW, 'short title', 800, 96, 48)
    expect(r.size).toBe(96)
    expect(r.lines).toEqual(['short title'])
  })

  it('shrinks until every line fits the width', () => {
    const r = fitFont(charW, 'word '.repeat(80).trim(), 800, 96, 48)
    expect(r.size).toBeLessThan(96)
    for (const line of r.lines) expect(charW(r.size)(line)).toBeLessThanOrEqual(800)
  })

  it('never drops below the minimum', () => {
    const r = fitFont(charW, 'a'.repeat(4000), 800, 96, 48)
    expect(r.size).toBeGreaterThanOrEqual(48)
    expect(r.lines.length).toBeLessThanOrEqual(3)
  })
})

describe('presets and constants', () => {
  it('has unique names and valid hex colours', () => {
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length)
    for (const p of PRESETS) {
      expect(p.from).toMatch(/^#[0-9a-f]{6}$/i)
      if (p.to) expect(p.to).toMatch(/^#[0-9a-f]{6}$/i)
      expect(p.textColor).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('uses the standard Open Graph size', () => {
    expect(OG_W).toBe(1200)
    expect(OG_H).toBe(630)
  })
})
