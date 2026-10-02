/** Color temperature to RGB (Tanner Helland's approximation of the black-body curve). */

export type RGB = [number, number, number]

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)))

/** Approximate sRGB color of a light source at `kelvin` (valid for about 1000–40000 K). */
export function kelvinToRgb(kelvin: number): RGB {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return [clamp255(r), clamp255(g), clamp255(b)]
}

/** Scales a color by brightness 0–1. */
export function dim([r, g, b]: RGB, brightness: number): RGB {
  const k = Math.max(0, Math.min(1, brightness))
  return [clamp255(r * k), clamp255(g * k), clamp255(b * k)]
}

export const toHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

export function fromHex(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [255, 255, 255]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const PRESETS = [
  { name: 'Candle', k: 1900 },
  { name: 'Warm', k: 2700 },
  { name: 'Neutral', k: 4000 },
  { name: 'Daylight', k: 6500 },
  { name: 'Cool', k: 8000 },
] as const
