import { describe, expect, it } from 'vitest'
import { fmtBitrate, fmtBytes, fmtTime } from './fmt'

describe('fmtTime', () => {
  it('formats mm:ss under an hour', () => {
    expect(fmtTime(0)).toBe('0:00')
    expect(fmtTime(65)).toBe('1:05')
    expect(fmtTime(599.9)).toBe('9:59')
  })

  it('formats h:mm:ss at an hour or more', () => {
    expect(fmtTime(3600)).toBe('1:00:00')
    expect(fmtTime(3723)).toBe('1:02:03')
  })

  it('clamps negatives and floors fractions', () => {
    expect(fmtTime(-5)).toBe('0:00')
    expect(fmtTime(1.9)).toBe('0:01')
  })
})

describe('fmtBytes', () => {
  it('scales through units', () => {
    expect(fmtBytes(0)).toBe('0 B')
    expect(fmtBytes(512)).toBe('512 B')
    expect(fmtBytes(2048)).toBe('2.0 KB')
    expect(fmtBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(fmtBytes(1536 * 1024 * 1024)).toBe('1.5 GB')
  })

  it('rejects invalid input', () => {
    expect(fmtBytes(-1)).toBe('0 B')
    expect(fmtBytes(NaN)).toBe('0 B')
  })
})

describe('fmtBitrate', () => {
  it('formats kbps and Mbps', () => {
    expect(fmtBitrate(128000)).toBe('128 kbps')
    expect(fmtBitrate(1400000)).toBe('1.4 Mbps')
  })

  it('returns a dash for non-positive values', () => {
    expect(fmtBitrate(0)).toBe('—')
    expect(fmtBitrate(NaN)).toBe('—')
  })
})
