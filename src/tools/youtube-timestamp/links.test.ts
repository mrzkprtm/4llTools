import { describe, expect, it } from 'vitest'
import { fmtStamp, parseChapters, parseStamp, stampLink, toMarkdown, toYoutubeText } from './links'

describe('parseStamp', () => {
  it('reads clock and plain-second forms', () => {
    expect(parseStamp('90')).toBe(90)
    expect(parseStamp('1:23')).toBe(83)
    expect(parseStamp('1:02:03')).toBe(3723)
    expect(parseStamp('0:05')).toBe(5)
  })

  it('reads written units', () => {
    expect(parseStamp('1h 2m 3s')).toBe(3723)
    expect(parseStamp('2 minutes')).toBe(120)
    expect(parseStamp('1.5h')).toBe(5400)
  })

  it('rejects garbage and impossible clocks', () => {
    expect(parseStamp('abc')).toBeNull()
    expect(parseStamp('1:99')).toBeNull()
    expect(parseStamp('')).toBeNull()
  })
})

describe('parseChapters', () => {
  it('parses, sorts and skips bad lines', () => {
    expect(parseChapters('2:30 Middle\n0:00 Intro\nnot a chapter\n1:00 End')).toEqual([
      { time: 0, label: 'Intro' },
      { time: 60, label: 'End' },
      { time: 150, label: 'Middle' },
    ])
  })
})

describe('formatting', () => {
  it('formats stamps', () => {
    expect(fmtStamp(65)).toBe('1:05')
    expect(fmtStamp(3723)).toBe('1:02:03')
    expect(fmtStamp(0)).toBe('0:00')
  })

  it('builds links and exports', () => {
    const chapters = parseChapters('0:00 Intro\n1:30 Demo')
    expect(stampLink('dQw4w9WgXcQ', 90)).toBe('https://youtu.be/dQw4w9WgXcQ?t=90')
    expect(toYoutubeText(chapters)).toBe('0:00 Intro\n1:30 Demo')
    expect(toMarkdown('dQw4w9WgXcQ', chapters)).toBe(
      '- [0:00 Intro](https://youtu.be/dQw4w9WgXcQ?t=0)\n- [1:30 Demo](https://youtu.be/dQw4w9WgXcQ?t=90)',
    )
  })
})
