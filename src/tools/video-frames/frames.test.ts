import { describe, expect, it } from 'vitest'
import { clampEvery, frameCount, frameName, frameTimes } from './frames'

describe('clampEvery', () => {
  it('clamps the interval to 0.1–60 s', () => {
    expect(clampEvery(0.01)).toBe(0.1)
    expect(clampEvery(120)).toBe(60)
    expect(clampEvery(2)).toBe(2)
    expect(clampEvery(NaN)).toBe(1)
  })
})

describe('frameCount', () => {
  it('counts frames including t=0', () => {
    expect(frameCount(10, 1)).toBe(11)
    expect(frameCount(10, 3)).toBe(4)
  })

  it('returns at least one frame and zero for bad input', () => {
    expect(frameCount(0.05, 1)).toBe(1)
    expect(frameCount(0, 1)).toBe(0)
    expect(frameCount(10, 0)).toBe(0)
  })
})

describe('frameTimes', () => {
  it('spreads times across the duration', () => {
    expect(frameTimes(10, 5)).toEqual([0, 5, 10 - 0.001])
  })

  it('caps the number of frames', () => {
    const times = frameTimes(600, 1, 60)
    expect(times).toHaveLength(60)
    expect(times[59]).toBeLessThan(600)
  })
})

describe('frameName', () => {
  it('zero-pads the frame index', () => {
    expect(frameName('clip.mp4', 0, 'png')).toBe('clip-frame-0001.png')
    expect(frameName('clip.mp4', 41, 'jpg')).toBe('clip-frame-0042.jpg')
  })

  it('handles extensionless names', () => {
    expect(frameName('take', 2, 'png')).toBe('take-frame-0003.png')
  })
})
