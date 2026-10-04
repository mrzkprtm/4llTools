import { describe, expect, it } from 'vitest'
import { estimateMp3Size, mp3Name, qualityHint } from './extract'

describe('mp3Name', () => {
  it('swaps the extension for .mp3', () => {
    expect(mp3Name('holiday-trip.mp4')).toBe('holiday-trip.mp3')
    expect(mp3Name('clip.webm')).toBe('clip.mp3')
  })

  it('handles names without an extension', () => {
    expect(mp3Name('recording')).toBe('recording.mp3')
    expect(mp3Name('.hidden')).toBe('.hidden.mp3')
  })
})

describe('estimateMp3Size', () => {
  it('scales with duration and bitrate', () => {
    expect(estimateMp3Size(60, 128)).toBeGreaterThan(60 * 128 * 125 - 1)
    expect(estimateMp3Size(60, 128)).toBeLessThan(60 * 128 * 125 + 8192)
    expect(estimateMp3Size(60, 192)).toBeGreaterThan(estimateMp3Size(60, 96))
  })

  it('never goes negative', () => {
    expect(estimateMp3Size(-5, 128)).toBe(4096)
  })
})

describe('qualityHint', () => {
  it('describes each tier', () => {
    expect(qualityHint(96)).toContain('voice')
    expect(qualityHint(128)).toContain('Balanced')
    expect(qualityHint(192)).toContain('High')
  })
})
