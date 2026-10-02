import { describe, expect, it } from 'vitest'
import { GROUPS, STYLES, lengths } from './fancy'

const style = (id: string) => {
  const s = STYLES.find((x) => x.id === id)
  if (!s) throw new Error(id)
  return s.convert
}

describe('fancy text', () => {
  it('maps bold letters and digits', () => {
    expect(style('bold')('Ab1')).toBe('𝐀𝐛𝟏')
    expect(style('mono')('z9')).toBe('𝚣𝟿')
  })

  it('uses the letterlike exceptions where the math block has holes', () => {
    expect(style('italic')('h')).toBe('ℎ')
    expect(style('script')('BEe')).toBe('ℬℰℯ')
    expect(style('fraktur')('CH')).toBe('ℭℌ')
    expect(style('double')('RZ1')).toBe('ℝℤ𝟙')
  })

  it('keeps punctuation, spaces and emoji', () => {
    expect(style('bold')('Hi, 🙂!')).toBe('𝐇𝐢, 🙂!')
  })

  it('handles enclosed styles', () => {
    expect(style('circled')('aZ0 5')).toBe('ⓐⓏ⓪ ⑤')
    expect(style('neg-squared')('ab')).toBe('🅰🅱')
  })

  it('flips and reverses text upside down', () => {
    expect(style('upside-down')('abc!')).toBe('¡ɔqɐ')
  })

  it('adds combining marks per character but not to line breaks', () => {
    const out = style('strike')('ab\nc')
    expect(out).toBe('a̶b̶\nc̶')
  })

  it('converts to full-width and small caps', () => {
    expect(style('full-width')('Hi 1')).toBe('Ｈｉ　１')
    expect(style('small-caps')('Hey')).toBe('ʜᴇʏ')
  })

  it('has unique ids, all groups present and counts lengths', () => {
    expect(new Set(STYLES.map((s) => s.id)).size).toBe(STYLES.length)
    expect(GROUPS[0]).toBe('All')
    expect(lengths('𝐀b')).toEqual({ units: 3, chars: 2 })
  })
})
