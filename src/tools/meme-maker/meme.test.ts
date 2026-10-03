import { describe, expect, it } from 'vitest'
import { BACKGROUNDS, fitMemeFont, memeCanvasSize, memeLines } from './meme'

describe('memeLines', () => {
  it('splits lines, trims and drops empties', () => {
    expect(memeLines(' one \n\n two ')).toEqual(['one', 'two'])
  })

  it('caps the number of lines', () => {
    expect(memeLines('a\nb\nc\nd\ne')).toEqual(['a', 'b', 'c'])
  })
})

describe('fitMemeFont', () => {
  const charW = (size: number) => (s: string) => s.length * size

  it('returns the start size when everything fits', () => {
    expect(fitMemeFont(charW, ['hi'], 1000, 64, 18)).toBe(64)
  })

  it('shrinks toward the floor when the line is wide', () => {
    expect(fitMemeFont(charW, ['abcdefghij'], 100, 64, 18)).toBe(18)
    expect(fitMemeFont(charW, ['a'.repeat(500)], 100, 64, 18)).toBe(18)
  })

  it('handles empty captions', () => {
    expect(fitMemeFont(charW, [], 100, 64, 18)).toBe(64)
  })
})

describe('memeCanvasSize', () => {
  it('defaults to a square when no image is loaded', () => {
    expect(memeCanvasSize(null)).toEqual({ w: 800, h: 800 })
  })

  it('caps huge images at 1600px wide and keeps aspect', () => {
    const img = { naturalWidth: 4000, naturalHeight: 3000 } as HTMLImageElement
    expect(memeCanvasSize(img)).toEqual({ w: 1600, h: 1200 })
  })
})

describe('backgrounds', () => {
  it('are valid hex colours', () => {
    for (const c of BACKGROUNDS) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
