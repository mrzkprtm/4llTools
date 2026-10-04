import { describe, expect, it } from 'vitest'
import { describeResolution, extForVideoMime, pickVideoMimeType } from './recorder'

describe('pickVideoMimeType', () => {
  it('prefers VP9 WebM when available', () => {
    const picked = pickVideoMimeType(() => true)
    expect(picked).toBe('video/webm;codecs=vp9,opus')
  })

  it('falls back down the list', () => {
    const picked = pickVideoMimeType((mime) => mime === 'video/webm')
    expect(picked).toBe('video/webm')
  })

  it('returns empty when nothing is supported', () => {
    expect(pickVideoMimeType(() => false)).toBe('')
  })

  it('treats a throwing checker as unsupported', () => {
    expect(pickVideoMimeType(() => { throw new Error('nope') })).toBe('')
  })
})

describe('extForVideoMime', () => {
  it('maps mp4 and webm', () => {
    expect(extForVideoMime('video/mp4')).toBe('mp4')
    expect(extForVideoMime('video/webm;codecs=vp9,opus')).toBe('webm')
    expect(extForVideoMime('')).toBe('webm')
  })
})

describe('describeResolution', () => {
  it('formats width and height', () => {
    expect(describeResolution(1280, 720)).toBe('1280 × 720')
  })

  it('returns a dash for zero sizes', () => {
    expect(describeResolution(0, 720)).toBe('—')
  })
})
