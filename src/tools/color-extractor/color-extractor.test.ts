import { describe, expect, it } from 'vitest'
import { exportPalette, extractPalette, inkFor, sampleSize, toHex, toHsl } from './palette'

/** Builds RGBA data from [r,g,b,a?] × count runs. */
function pixels(runs: [number[], number][]): Uint8ClampedArray {
  const out: number[] = []
  for (const [c, n] of runs) for (let i = 0; i < n; i++) out.push(c[0], c[1], c[2], c[3] ?? 255)
  return new Uint8ClampedArray(out)
}

describe('color extractor palette', () => {
  it('finds two flat colors with their shares', () => {
    const p = extractPalette(pixels([[[255, 0, 0], 75], [[0, 0, 255], 25]]), 5)
    expect(p.map((s) => s.hex)).toEqual(['#ff0000', '#0000ff'])
    expect(p[0].share).toBeCloseTo(0.75)
    expect(p[1].share).toBeCloseTo(0.25)
  })

  it('ignores transparent pixels', () => {
    const p = extractPalette(pixels([[[0, 255, 0], 10], [[255, 255, 255, 0], 90]]), 4)
    expect(p).toHaveLength(1)
    expect(p[0].hex).toBe('#00ff00')
    expect(p[0].share).toBe(1)
  })

  it('averages noisy clusters and orders by population', () => {
    const runs: [number[], number][] = []
    for (let i = 0; i < 60; i++) runs.push([[250 - (i % 5), 200 + (i % 3), 10], 1])
    for (let i = 0; i < 40; i++) runs.push([[20, 40 + (i % 4), 120 + (i % 6)], 1])
    const p = extractPalette(pixels(runs), 2)
    expect(p).toHaveLength(2)
    expect(p[0].r).toBeGreaterThan(240)
    expect(p[1].b).toBeGreaterThan(115)
    expect(p[0].share + p[1].share).toBeCloseTo(1)
  })

  it('returns no more colors than exist and nothing for empty input', () => {
    expect(extractPalette(pixels([[[10, 10, 10], 50]]), 8)).toHaveLength(1)
    expect(extractPalette(new Uint8ClampedArray(), 5)).toEqual([])
  })

  it('splits four quadrant colors', () => {
    const p = extractPalette(pixels([[[255, 0, 0], 25], [[0, 255, 0], 25], [[0, 0, 255], 25], [[255, 255, 0], 25]]), 4)
    expect(p.map((s) => s.hex).sort()).toEqual(['#0000ff', '#00ff00', '#ff0000', '#ffff00'])
  })
})

describe('color helpers', () => {
  it('converts and picks readable ink', () => {
    expect(toHex(255, 128, 0)).toBe('#ff8000')
    expect(toHsl(255, 0, 0)).toEqual([0, 100, 50])
    expect(inkFor(255, 255, 255)).toBe('#000000')
    expect(inkFor(10, 10, 40)).toBe('#ffffff')
  })

  it('exports css variables and json', () => {
    const sw = [{ hex: '#112233', share: 0.6 }, { hex: '#445566', share: 0.4 }]
    expect(exportPalette(sw, 'css')).toBe(':root {\n  --color-1: #112233;\n  --color-2: #445566;\n}')
    expect(JSON.parse(exportPalette(sw, 'json'))).toEqual([{ hex: '#112233', percent: 60 }, { hex: '#445566', percent: 40 }])
    expect(sampleSize(1600, 800)).toEqual({ w: 160, h: 80 })
  })
})
