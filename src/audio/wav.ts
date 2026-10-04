/** Minimal AudioBuffer shape so encoding logic is testable without a browser. */
export interface BufferLike {
  numberOfChannels: number
  length: number
  sampleRate: number
  duration: number
  getChannelData(channel: number): Float32Array
}

export function isBufferLike(b: unknown): b is BufferLike {
  const o = b as BufferLike
  return (
    !!o &&
    typeof o.numberOfChannels === 'number' &&
    typeof o.length === 'number' &&
    typeof o.sampleRate === 'number' &&
    typeof o.getChannelData === 'function'
  )
}

/**
 * Encode an AudioBuffer as 16-bit PCM RIFF/WAVE. Float samples are clipped
 * to [-1, 1]; anything outside is clamped rather than wrapped.
 */
export function encodeWav(buffer: BufferLike): ArrayBuffer {
  const channels = Math.min(2, buffer.numberOfChannels)
  const frames = buffer.length
  const dataSize = frames * channels * 2
  const out = new ArrayBuffer(44 + dataSize)
  const view = new DataView(out)

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const chans: Float32Array[] = []
  for (let c = 0; c < channels; c++) chans.push(buffer.getChannelData(c))

  let offset = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i] ?? 0))
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      offset += 2
    }
  }
  return out
}

/** Trim a buffer-like to [startSec, endSec), clamped to the buffer bounds. */
export function sliceBuffer(buffer: BufferLike, startSec: number, endSec: number): BufferLike {
  const sr = buffer.sampleRate
  const start = Math.max(0, Math.min(buffer.length, Math.round(startSec * sr)))
  const end = Math.max(start, Math.min(buffer.length, Math.round(endSec * sr)))
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c).slice(start, end))
  return {
    numberOfChannels: buffer.numberOfChannels,
    length: end - start,
    sampleRate: sr,
    duration: (end - start) / sr,
    getChannelData: (i: number) => channels[i],
  }
}

/** Concatenate buffers, resampling any that differ from the first sample rate. */
export function concatBuffers(buffers: BufferLike[], resample: (b: BufferLike, rate: number) => BufferLike): BufferLike {
  if (buffers.length === 0) throw new Error('Nothing to join.')
  const rate = buffers[0].sampleRate
  const channels = buffers[0].numberOfChannels
  const norm = buffers.map((b) => (b.numberOfChannels === channels ? resample(b, rate) : resample(toMono(b), rate)))
  const length = norm.reduce((n, b) => n + b.length, 0)
  const data: Float32Array[] = Array.from({ length: channels }, () => new Float32Array(length))
  let at = 0
  for (const b of norm) {
    for (let c = 0; c < channels; c++) data[c].set(b.getChannelData(c), at)
    at += b.length
  }
  return { numberOfChannels: channels, length, sampleRate: rate, duration: length / rate, getChannelData: (i: number) => data[i] }
}

/** Down/up-mix to mono by averaging channels. */
export function toMono(buffer: BufferLike): BufferLike {
  if (buffer.numberOfChannels === 1) return buffer
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c))
  const out = new Float32Array(buffer.length)
  for (let i = 0; i < out.length; i++) {
    let sum = 0
    for (const ch of chans) sum += ch[i]
    out[i] = sum / chans.length
  }
  return { numberOfChannels: 1, length: buffer.length, sampleRate: buffer.sampleRate, duration: buffer.length / buffer.sampleRate, getChannelData: () => out }
}

/** Peak absolute sample value across all channels. */
export function peakLevel(buffer: BufferLike): number {
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    for (const v of buffer.getChannelData(c)) {
      const a = Math.abs(v)
      if (a > peak) peak = a
    }
  }
  return peak
}

/** Apply a constant gain, clipping to [-1, 1]. */
export function gainBuffer(buffer: BufferLike, gain: number): BufferLike {
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const out = new Float32Array(src.length)
    for (let i = 0; i < src.length; i++) out[i] = Math.max(-1, Math.min(1, src[i] * gain))
    channels.push(out)
  }
  return {
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length,
    sampleRate: buffer.sampleRate,
    duration: buffer.duration,
    getChannelData: (i: number) => channels[i],
  }
}
