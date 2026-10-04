import { describe, expect, it } from 'vitest'
import { describeBuffer, estimateBytes, extForFormat, labelForFormat } from './convert'
import { makeBuffer } from '../../audio/testing'

describe('describeBuffer', () => {
  it('summarizes duration, channels, rate and samples', () => {
    const b = makeBuffer([[0, 0.5, -0.5, 1], [0, 0, 0, 0]], 8000)
    expect(describeBuffer(b)).toEqual({ duration: 0.0005, channels: 2, sampleRate: 8000, samples: 4 })
  })

  it('falls back to length / sampleRate when duration is not finite', () => {
    const b = makeBuffer([[0, 0, 0, 0]], 4000)
    Object.defineProperty(b, 'duration', { value: NaN })
    expect(describeBuffer(b).duration).toBe(0.001)
  })
})

describe('format helpers', () => {
  it('maps formats to extensions and labels', () => {
    expect(extForFormat('mp3')).toBe('.mp3')
    expect(extForFormat('wav')).toBe('.wav')
    expect(labelForFormat('mp3')).toContain('MP3')
    expect(labelForFormat('wav')).toContain('WAV')
  })
})

describe('estimateBytes', () => {
  it('estimates MP3 at roughly 128 kbps plus overhead', () => {
    const facts = describeBuffer(makeBuffer([Array.from({ length: 44100 }, () => 0.1)], 44100))
    const est = estimateBytes(facts, 'mp3')
    expect(est).toBeGreaterThanOrEqual(16000)
    expect(est).toBeLessThanOrEqual(16000 + 8192)
  })

  it('estimates WAV from sample rate, channels and bit depth', () => {
    const facts = describeBuffer(makeBuffer([Array.from({ length: 44100 }, () => 0.1), Array.from({ length: 44100 }, () => 0.1)], 44100))
    const est = estimateBytes(facts, 'wav')
    expect(est).toBeGreaterThan(44100 * 2 * 2)
    expect(est).toBeLessThan(44100 * 2 * 2 + 100)
  })
})
