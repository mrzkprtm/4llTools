import { describe, expect, it } from 'vitest'
import { resampleLinear, speedBuffer } from './resample'
import {
  concatBuffers,
  encodeWav,
  gainBuffer,
  isBufferLike,
  peakLevel,
  sliceBuffer,
  toMono,
  type BufferLike,
} from './wav'
import { makeBuffer } from './testing'

function readWavHeader(view: DataView) {
  const str = (o: number, n: number) =>
    Array.from({ length: n }, (_, i) => String.fromCharCode(view.getUint8(o + i))).join('')
  return {
    riff: str(0, 4),
    wave: str(8, 4),
    fmt: str(12, 4),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bits: view.getUint16(34, true),
    dataSize: view.getUint32(40, true),
  }
}

describe('encodeWav', () => {
  it('writes a valid PCM header', () => {
    const buf = makeBuffer([[0, 0.5, -0.5, 1, -1]], 8000)
    const out = encodeWav(buf)
    const h = readWavHeader(new DataView(out))
    expect(h.riff).toBe('RIFF')
    expect(h.wave).toBe('WAVE')
    expect(h.fmt).toBe('fmt ')
    expect(h.channels).toBe(1)
    expect(h.sampleRate).toBe(8000)
    expect(h.bits).toBe(16)
    expect(h.dataSize).toBe(5 * 2)
    expect(out.byteLength).toBe(44 + 10)
  })

  it('interleaves stereo samples', () => {
    const buf = makeBuffer([[1, 1], [-1, -1]], 8000)
    const view = new DataView(encodeWav(buf))
    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
    expect(view.getInt16(48, true)).toBe(0x7fff)
  })

  it('clamps out-of-range floats instead of wrapping', () => {
    const buf = makeBuffer([[2, -3]])
    const view = new DataView(encodeWav(buf))
    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
  })
})

describe('sliceBuffer', () => {
  it('cuts to the requested second range', () => {
    const buf = makeBuffer([Array.from({ length: 8000 }, (_, i) => i / 8000)], 8000)
    const cut = sliceBuffer(buf, 0.5, 1.0)
    expect(cut.length).toBe(4000)
    expect(cut.sampleRate).toBe(8000)
    expect(cut.getChannelData(0)[0]).toBeCloseTo(0.5)
  })

  it('clamps out-of-range bounds', () => {
    const buf = makeBuffer([[1, 2, 3]], 8000)
    expect(sliceBuffer(buf, -1, 99).length).toBe(3)
    expect(sliceBuffer(buf, 2, 1).length).toBe(0)
  })
})

describe('concatBuffers', () => {
  const noResample = (b: BufferLike) => b

  it('joins buffers end to end', () => {
    const a = makeBuffer([[1, 2]], 8000)
    const b = makeBuffer([[3, 4, 5]], 8000)
    const out = concatBuffers([a, b], noResample)
    expect(out.length).toBe(5)
    expect(Array.from(out.getChannelData(0))).toEqual([1, 2, 3, 4, 5])
  })

  it('rejects an empty list', () => {
    expect(() => concatBuffers([], noResample)).toThrow()
  })
})

describe('toMono and peakLevel', () => {
  it('averages channels', () => {
    const out = toMono(makeBuffer([[1, -1], [0.5, 0.5]]))
    expect(out.numberOfChannels).toBe(1)
    expect(out.getChannelData(0)[0]).toBeCloseTo(0.75)
    expect(out.getChannelData(0)[1]).toBeCloseTo(-0.25)
  })

  it('finds the loudest absolute sample', () => {
    expect(peakLevel(makeBuffer([[0.1, -0.9, 0.3]]))).toBeCloseTo(0.9)
    expect(peakLevel(makeBuffer([[0, 0]]))).toBe(0)
  })
})

describe('gainBuffer', () => {
  it('scales and clips', () => {
    const out = gainBuffer(makeBuffer([[0.5, -0.5, 0.8]]), 2)
    expect(out.getChannelData(0)[0]).toBe(1)
    expect(out.getChannelData(0)[1]).toBe(-1)
    expect(out.getChannelData(0)[2]).toBe(1)
  })
})

describe('resampleLinear and speedBuffer', () => {
  it('resamples to the target rate', () => {
    const out = resampleLinear(makeBuffer([[0, 1, 0, -1]], 8000), 16000)
    expect(out.sampleRate).toBe(16000)
    expect(out.length).toBe(8)
    expect(out.getChannelData(0)[0]).toBe(0)
    expect(out.getChannelData(0)[1]).toBeCloseTo(0.5)
  })

  it('returns the same buffer when rates match', () => {
    const buf = makeBuffer([[1]], 8000)
    expect(resampleLinear(buf, 8000)).toBe(buf)
  })

  it('speedBuffer shortens the buffer at higher speeds', () => {
    const buf = makeBuffer([Array.from({ length: 8000 }, () => 0.1)], 8000)
    const fast = speedBuffer(buf, 2)
    expect(fast.length).toBe(4000)
    expect(fast.sampleRate).toBe(8000)
    expect(speedBuffer(buf, 1)).toBe(buf)
  })
})

describe('isBufferLike', () => {
  it('accepts real buffers and rejects junk', () => {
    expect(isBufferLike(makeBuffer([[1]]))).toBe(true)
    expect(isBufferLike(null)).toBe(false)
    expect(isBufferLike({ length: 3 })).toBe(false)
  })
})
