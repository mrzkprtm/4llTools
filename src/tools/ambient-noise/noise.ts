/** Noise generators and envelopes for the ambient mixer. Pure and testable. */

export type Rand = () => number

export function whiteNoise(n: number, rand: Rand = Math.random): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = rand() * 2 - 1
  return out
}

/** Pink (1/f) noise with Paul Kellet's refined filter, scaled into −1…1. */
export function pinkNoise(n: number, rand: Rand = Math.random): Float32Array {
  const out = new Float32Array(n)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  return normalize(out)
}

/** Brown (1/f²) noise: a leaky random walk. */
export function brownNoise(n: number, rand: Rand = Math.random): Float32Array {
  const out = new Float32Array(n)
  let last = 0
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (rand() * 2 - 1)) / 1.02
    out[i] = last
  }
  return normalize(out)
}

/** Scale so the peak is 0.95 and remove any DC offset. */
export function normalize(buf: Float32Array): Float32Array {
  let mean = 0
  for (let i = 0; i < buf.length; i++) mean += buf[i]
  mean /= buf.length || 1
  let peak = 0
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - mean))
  const k = peak ? 0.95 / peak : 0
  for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] - mean) * k
  return buf
}

/**
 * High-frequency share of the signal: energy of the first difference over the
 * energy of the signal. White noise ≈ 2, pink is lower and brown is near 0.
 */
export function brightness(buf: Float32Array): number {
  let e = 0
  let d = 0
  for (let i = 1; i < buf.length; i++) {
    e += buf[i] * buf[i]
    const x = buf[i] - buf[i - 1]
    d += x * x
  }
  return e ? d / e : 0
}

/** Ocean swell: a slow, uneven rise and fall in 0…1 with a period near `period` seconds. */
export function swell(t: number, period = 9): number {
  const p = (t / period) % 1
  // Fast build, long wash back.
  const s = p < 0.35 ? Math.sin((p / 0.35) * (Math.PI / 2)) : Math.cos(((p - 0.35) / 0.65) * (Math.PI / 2))
  const wobble = 0.85 + 0.15 * Math.sin(t * 0.37)
  return Math.max(0, Math.min(1, s * s * wobble))
}

/** Sleep timer gain: 1 until the fade starts, then an eased fall to 0 at `total`. */
export function sleepGain(elapsed: number, total: number, fade = 30): number {
  if (total <= 0) return 1
  const f = Math.min(fade, total)
  if (elapsed <= total - f) return 1
  if (elapsed >= total) return 0
  const x = (total - elapsed) / f
  return x * x
}

export const LAYERS = [
  { id: 'rain', name: 'Rain', color: '#1c7ed6' },
  { id: 'ocean', name: 'Ocean waves', color: '#0ca678' },
  { id: 'fan', name: 'Fan', color: '#5c7cfa' },
  { id: 'cafe', name: 'Café', color: '#f59f00' },
  { id: 'white', name: 'White noise', color: '#868e96' },
  { id: 'pink', name: 'Pink noise', color: '#e64980' },
  { id: 'brown', name: 'Brown noise', color: '#a0522d' },
] as const

export type LayerId = (typeof LAYERS)[number]['id']
export type Mix = Record<LayerId, number>

export const PRESETS: { name: string; mix: Partial<Mix> }[] = [
  { name: 'Rainy night', mix: { rain: 70, brown: 30 } },
  { name: 'Coffee shop', mix: { cafe: 70, rain: 20 } },
  { name: 'Beach', mix: { ocean: 80, pink: 10 } },
  { name: 'Sleep fan', mix: { fan: 70, brown: 25 } },
  { name: 'Deep focus', mix: { brown: 70, pink: 20 } },
]

export const emptyMix = (): Mix => ({ rain: 0, ocean: 0, fan: 0, cafe: 0, white: 0, pink: 0, brown: 0 })
