import { Mp3Encoder } from 'lamejs'
import { resampleLinear } from './resample'
import { toMono, type BufferLike } from './wav'

const MP3_RATE = 44100

export const MP3_KBPS_CHOICES = [96, 128, 192] as const

export function clampKbps(kbps: number): number {
  if (!Number.isFinite(kbps)) return 128
  return Math.min(320, Math.max(32, Math.round(kbps)))
}

function toInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    out[i] = (v < 0 ? v * 0x8000 : v * 0x7fff) | 0
  }
  return out
}

/** Encode to constant-bitrate MP3 (stereo or mono). lamejs only supports 44.1 kHz input. */
export function encodeMp3(buffer: BufferLike, kbps = 128): Blob {
  const mono = toMono(buffer)
  const pcm = resampleLinear(mono, MP3_RATE)
  const samples = toInt16(pcm.getChannelData(0))
  const encoder = new Mp3Encoder(1, MP3_RATE, clampKbps(kbps))
  const parts: BlobPart[] = []
  const block = 1152
  for (let i = 0; i < samples.length; i += block) {
    const chunk = encoder.encodeBuffer(samples.subarray(i, i + block))
    if (chunk.length) parts.push(chunk.slice())
  }
  const tail = encoder.flush()
  if (tail.length) parts.push(tail.slice())
  return new Blob(parts, { type: 'audio/mpeg' })
}

export { MP3_RATE }
