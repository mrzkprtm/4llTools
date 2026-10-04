import { describe, expect, it } from 'vitest'
import { parseVideoId, SIZES, thumbUrl } from './yt'

describe('youtube thumbnail', () => {
  it('accepts a bare video ID', () => {
    expect(parseVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses watch, share and shorts links', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ?t=43')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseVideoId('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('rejects non-YouTube and malformed input', () => {
    expect(parseVideoId('https://vimeo.com/12345')).toBeNull()
    expect(parseVideoId('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(parseVideoId('not a url at all!!')).toBeNull()
  })

  it('builds size URLs largest first', () => {
    expect(SIZES[0].key).toBe('maxresdefault')
    expect(thumbUrl('abc', 'hqdefault')).toBe('https://i.ytimg.com/vi/abc/hqdefault.jpg')
  })
})
