import { describe, expect, it } from 'vitest'
import { captureSupport, clock, extFor, fileName, pickMimeType, sizeLabel } from './recorder'

describe('screen recorder helpers', () => {
  it('prefers VP9 WebM, then falls back to MP4 on Safari', () => {
    expect(pickMimeType(() => true)).toBe('video/webm;codecs=vp9,opus')
    expect(pickMimeType((t) => t.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1,mp4a')
    expect(pickMimeType((t) => t === 'video/webm;codecs=vp8')).toBe('video/webm;codecs=vp8')
    expect(pickMimeType((t) => t.includes('opus') || t === 'video/webm', false)).toBe('video/webm')
    expect(pickMimeType(() => { throw new Error('x') })).toBe('')
  })

  it('names files with the right extension', () => {
    expect(extFor('video/mp4;codecs=avc1')).toBe('mp4')
    expect(extFor('video/webm;codecs=vp9')).toBe('webm')
    expect(extFor('')).toBe('webm')
    expect(fileName('video/mp4', new Date(2025, 0, 2, 3, 4, 5))).toBe('screen-recording-20250102-030405.mp4')
  })

  it('explains when capture is not possible', () => {
    expect(captureSupport({ mediaDevices: {}, userAgent: 'iPhone' }, true).reason).toMatch(/Phones/)
    expect(captureSupport({ mediaDevices: { getDisplayMedia: () => 0 } }, false).ok).toBe(false)
    expect(captureSupport({ mediaDevices: { getDisplayMedia: () => 0 } }, true).ok).toBe(true)
    expect(captureSupport(undefined, true, false).reason).toMatch(/https/)
  })

  it('formats time and size', () => {
    expect(clock(65_400)).toBe('01:05')
    expect(clock(3_725_000)).toBe('1:02:05')
    expect(sizeLabel(1536)).toBe('1.5 KB')
    expect(sizeLabel(5 * 1024 ** 2)).toBe('5.0 MB')
  })
})
