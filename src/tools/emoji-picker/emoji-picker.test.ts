import { describe, expect, it } from 'vitest'
import groups from 'unicode-emoji-json/data-by-group.json'
import { codepoints, expandQuery, flatten, pushRecent, searchEmojis, shortcode, withSkinTone, type RawGroup } from './emoji'

const items = flatten(groups as RawGroup[])

describe('emoji search', () => {
  it('loads the full list', () => {
    expect(items.length).toBeGreaterThan(1800)
    expect(items[0].emoji).toBe('😀')
  })

  it('ranks whole-word name matches first', () => {
    expect(searchEmojis(items, 'fire')[0].emoji).toBe('🔥')
    expect(searchEmojis(items, 'thumbs up')[0].emoji).toBe('👍')
  })

  it('understands Indonesian words', () => {
    expect(expandQuery('Api')[0]).toContain('fire')
    expect(searchEmojis(items, 'api')[0].emoji).toBe('🔥')
    expect(searchEmojis(items, 'hati').map((e) => e.emoji)).toContain('❤️')
    expect(searchEmojis(items, 'tertawa').map((e) => e.emoji)).toContain('😂')
    expect(searchEmojis(items, 'senyum').length).toBeGreaterThan(3)
  })

  it('returns nothing for blank or unknown queries', () => {
    expect(searchEmojis(items, '  ')).toEqual([])
    expect(searchEmojis(items, 'qwxzv')).toEqual([])
  })
})

describe('emoji helpers', () => {
  it('applies skin tones', () => {
    expect(withSkinTone('👍', '\u{1F3FD}')).toBe('👍🏽')
    expect(withSkinTone('✌️', '\u{1F3FF}')).toBe('✌🏿')
    expect(withSkinTone('🧑‍💻', '\u{1F3FB}')).toBe('🧑🏻‍💻')
    expect(withSkinTone('👍', '')).toBe('👍')
  })

  it('shows codepoints and shortcodes', () => {
    expect(codepoints('👍🏽')).toBe('U+1F44D U+1F3FD')
    expect(codepoints('❤️')).toBe('U+2764 U+FE0F')
    expect(shortcode('thumbs_up')).toBe(':thumbs_up:')
  })

  it('keeps a short recent list', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
    expect(pushRecent(['a', 'b'], 'c', 2)).toEqual(['c', 'a'])
  })
})
