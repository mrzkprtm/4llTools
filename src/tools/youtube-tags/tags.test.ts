import { describe, expect, it } from 'vitest'
import { decodeEntities, extractChannel, extractTags, extractTitle, splitTags, toHashtags, toPlain } from './tags'

describe('decodeEntities', () => {
  it('decodes numeric, hex and named entities', () => {
    expect(decodeEntities('Fish &amp; Chips &#39;39&#x27;')).toBe("Fish & Chips '39'")
    expect(decodeEntities('a &unknown; b')).toBe('a &unknown; b')
  })
})

describe('splitTags', () => {
  it('trims, drops empties and dedupes case-insensitively', () => {
    expect(splitTags(' a, b ,a,,B,')).toEqual(['a', 'b'])
  })
})

describe('extractTags', () => {
  it('reads the meta keywords tag', () => {
    const html = '<html><head><meta name="keywords" content="guitar, lesson, guitar"></head></html>'
    expect(extractTags(html)).toEqual(['guitar', 'lesson'])
  })

  it('falls back to the player JSON keywords array', () => {
    const html = '"videoDetails":{"keywords":["lo fi","beats to \\u0026 study to"]'
    expect(extractTags(html)).toEqual(['lo fi', 'beats to & study to'])
  })

  it('returns an empty list when nothing is published', () => {
    expect(extractTags('<html><body>Nothing here</body></html>')).toEqual([])
  })
})

describe('title and channel', () => {
  it('reads og:title and strips the YouTube suffix', () => {
    const html = '<meta property="og:title" content="My &quot;Video&quot;"><title>My "Video" - YouTube</title>'
    expect(extractTitle(html)).toBe('My "Video"')
  })

  it('reads the owner channel name', () => {
    expect(extractChannel('"ownerChannelName":"Test \\u0026 Co"')).toBe('Test & Co')
    expect(extractChannel('<link itemprop="name" content="Plain">')).toBe('Plain')
    expect(extractChannel('nothing')).toBeNull()
  })
})

describe('exports', () => {
  it('formats comma and hashtag forms', () => {
    const tags = ['guitar lesson', 'music']
    expect(toPlain(tags)).toBe('guitar lesson, music')
    expect(toHashtags(tags)).toBe('#guitarlesson #music')
  })
})
