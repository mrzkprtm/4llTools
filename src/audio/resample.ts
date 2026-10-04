import type { BufferLike } from './wav'

/**
 * Linear-interpolation resample. Fast and good enough for voice/music
 * preview work; keeps the interface pure for testing.
 */
export function resampleLinear(buffer: BufferLike, targetRate: number): BufferLike {
  if (buffer.sampleRate === targetRate) return buffer
  const ratio = targetRate / buffer.sampleRate
  const outLength = Math.max(1, Math.round(buffer.length * ratio))
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const out = new Float32Array(outLength)
    for (let i = 0; i < outLength; i++) {
      const pos = i / ratio
      const i0 = Math.floor(pos)
      const i1 = Math.min(src.length - 1, i0 + 1)
      const frac = pos - i0
      out[i] = src[i0] * (1 - frac) + src[i1] * frac
    }
    channels.push(out)
  }
  return {
    numberOfChannels: buffer.numberOfChannels,
    length: outLength,
    sampleRate: targetRate,
    duration: outLength / targetRate,
    getChannelData: (i: number) => channels[i],
  }
}

/** A periodic Hann window used to fade overlapping frames. */
function hann(length: number): Float32Array {
  const w = new Float32Array(length)
  for (let i = 0; i < length; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / length))
  return w
}

/**
 * Change playback speed without shifting pitch, using overlap-add time
 * stretching. Speeding up shortens the buffer, slowing down lengthens it, and
 * the sample rate is kept so the result plays at the new tempo.
 */
export function speedBuffer(buffer: BufferLike, speed: number): BufferLike {
  const s = Math.min(4, Math.max(0.25, speed))
  if (s === 1 || buffer.length === 0) return buffer

  const frame = Math.max(2, Math.min(1024, buffer.length))
  const synthesisHop = Math.max(1, Math.floor(frame / 2))
  const analysisHop = Math.max(1, Math.round(synthesisHop * s))
  const outLength = Math.max(1, Math.round(buffer.length / s))
  const window = hann(frame)

  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const out = new Float32Array(outLength)
    const norm = new Float32Array(outLength)
    for (let k = 0; ; k++) {
      const inPos = k * analysisHop
      const outPos = k * synthesisHop
      if (inPos >= buffer.length || outPos >= outLength) break
      for (let i = 0; i < frame && outPos + i < outLength; i++) {
        const idx = inPos + i
        const sample = idx < buffer.length ? src[idx] : 0
        out[outPos + i] += sample * window[i]
        norm[outPos + i] += window[i]
      }
    }
    for (let i = 0; i < outLength; i++) out[i] = norm[i] > 1e-6 ? out[i] / norm[i] : 0
    channels.push(out)
  }

  return {
    numberOfChannels: buffer.numberOfChannels,
    length: outLength,
    sampleRate: buffer.sampleRate,
    duration: outLength / buffer.sampleRate,
    getChannelData: (i: number) => channels[i],
  }
}
