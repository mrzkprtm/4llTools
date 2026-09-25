import { describe, expect, it } from 'vitest'
import { charsetSize, describeMatch, entropyBits, guessesToBits, loadChecker, scoreLabel, scoreTone } from './strength'

describe('password strength helpers', () => {
  it('maps scores to labels and tones', () => {
    expect(scoreLabel(0)).toBe('Very weak')
    expect(scoreLabel(4)).toBe('Very strong')
    expect(scoreLabel(9)).toBe('Very strong')
    expect(scoreTone(1)).toBe('bad')
    expect(scoreTone(2)).toBe('mid')
    expect(scoreTone(3)).toBe('good')
  })

  it('sizes the character pool and estimates entropy', () => {
    expect(charsetSize('abc')).toBe(26)
    expect(charsetSize('aB3')).toBe(62)
    expect(charsetSize('aB3!')).toBe(95)
    expect(entropyBits('')).toBe(0)
    expect(entropyBits('abcd')).toBeCloseTo(4 * Math.log2(26))
    expect(guessesToBits(3)).toBeCloseTo(9.966, 2)
  })

  it('scores samples with zxcvbn and explains patterns', async () => {
    const check = await loadChecker()
    const weak = check(['pass', 'word'].join(''))
    expect(weak.score).toBe(0)
    expect(weak.feedback.warning).toBeTruthy()
    expect(describeMatch(weak.sequence[0])).toMatch(/common password/)
    const strong = check(['violet', 'kettle', 'harbor', 'mosaic'].join('-'))
    expect(strong.score).toBe(4)
    const kb = check('qwertyuiop')
    expect(kb.sequence.some((m) => /keyboard|common password/.test(describeMatch(m)))).toBe(true)
  })
})
