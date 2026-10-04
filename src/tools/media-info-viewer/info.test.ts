import { describe, expect, it } from 'vitest'
import { aspectRatio, gcd, guessKind, overallBitrateKbps } from './info'

describe('guessKind', () => {
  it('uses the MIME type first', () => {
    expect(guessKind('audio/mpeg', 'x.bin')).toBe('audio')
    expect(guessKind('video/mp4', 'x.bin')).toBe('video')
    expect(guessKind('image/png', 'x.bin')).toBe('image')
  })

  it('falls back to the extension', () => {
    expect(guessKind('', 'track.flac')).toBe('audio')
    expect(guessKind('', 'movie.mkv')).toBe('video')
    expect(guessKind('', 'photo.webp')).toBe('image')
  })

  it('returns other for unknown files', () => {
    expect(guessKind('application/pdf', 'doc.pdf')).toBe('other')
    expect(guessKind('', 'archive.zip')).toBe('other')
  })
})

describe('gcd / aspectRatio', () => {
  it('computes the greatest common divisor', () => {
    expect(gcd(1920, 1080)).toBe(120)
    expect(gcd(7, 3)).toBe(1)
  })

  it('reduces resolutions to ratios', () => {
    expect(aspectRatio(1920, 1080)).toBe('16:9')
    expect(aspectRatio(1080, 1920)).toBe('9:16')
    expect(aspectRatio(1000, 1000)).toBe('1:1')
  })

  it('returns a dash for zero sizes', () => {
    expect(aspectRatio(0, 1080)).toBe('—')
  })
})

describe('overallBitrateKbps', () => {
  it('converts size and duration to kbps', () => {
    expect(overallBitrateKbps(1_000_000, 10)).toBe(800)
  })

  it('is zero without a duration', () => {
    expect(overallBitrateKbps(1_000_000, 0)).toBe(0)
  })
})
