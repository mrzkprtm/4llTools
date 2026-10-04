import { describe, expect, it } from 'vitest'
import { clampGap, moveItem, outputName, totalDuration, type JoinItem } from './join'

const items = (durations: number[]): JoinItem[] =>
  durations.map((duration, i) => ({ id: i, name: `t${i}.mp3`, duration }))

describe('totalDuration', () => {
  it('sums clip durations', () => {
    expect(totalDuration(items([1.5, 2, 0.5]))).toBe(4)
  })

  it('is zero for an empty list', () => {
    expect(totalDuration([])).toBe(0)
  })
})

describe('clampGap', () => {
  it('clamps the gap between 0 and 5 seconds', () => {
    expect(clampGap(-1)).toBe(0)
    expect(clampGap(2.5)).toBe(2.5)
    expect(clampGap(99)).toBe(5)
    expect(clampGap(NaN)).toBe(0)
  })
})

describe('outputName', () => {
  it('builds a name from the first clip', () => {
    expect(outputName('intro.mp3', 3, 'mp3')).toBe('intro-joined-3-tracks.mp3')
  })

  it('handles files without an extension', () => {
    expect(outputName('voice', 2, 'wav')).toBe('voice-joined-2-tracks.wav')
  })
})

describe('moveItem', () => {
  it('moves an item down the list', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
  })

  it('moves an item up the list', () => {
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2])
  })

  it('returns the list unchanged for out-of-range targets', () => {
    expect(moveItem([1, 2, 3], 0, 5)).toEqual([1, 2, 3])
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
  })
})
