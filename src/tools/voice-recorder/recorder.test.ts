import { describe, expect, it } from 'vitest'
import { extForMime, pickMimeType } from './recorder'

describe('pickMimeType', () => {
  it('prefers opus in webm when available', () => {
    expect(pickMimeType(() => true)).toBe('audio/webm;codecs=opus')
  })

  it('falls back down the list', () => {
    expect(pickMimeType((t) => t === 'audio/ogg')).toBe('audio/ogg')
  })

  it('returns an empty string when nothing is supported', () => {
    expect(pickMimeType(() => false)).toBe('')
  })
})

describe('extForMime', () => {
  it('maps container types to file extensions', () => {
    expect(extForMime('audio/webm;codecs=opus')).toBe('webm')
    expect(extForMime('audio/ogg;codecs=opus')).toBe('ogg')
    expect(extForMime('audio/mp4')).toBe('m4a')
  })
})
