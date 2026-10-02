/** Fractal Brownian motion terrain and a simple pinhole camera. */

export interface FbmOpts {
  octaves: number
  /** Amplitude multiplier from one octave to the next (0–1). */
  persistence: number
  /** Frequency multiplier from one octave to the next (usually about 2). */
  lacunarity: number
}

/**
 * Sums octaves of noise, each finer and fainter than the last, and divides by the total
 * amplitude so the result stays in the noise's own range of about [-1, 1].
 */
export function fbm(noise: (x: number, y: number, z?: number) => number, x: number, y: number, o: FbmOpts): number {
  let sum = 0
  let amp = 1
  let norm = 0
  let fx = x
  let fy = y
  const n = Math.max(1, Math.round(o.octaves))
  for (let k = 0; k < n; k++) {
    // Offsetting each octave hides the lattice alignment at the origin.
    sum += amp * noise(fx + k * 17.13, fy - k * 9.71)
    norm += amp
    amp *= o.persistence
    fx *= o.lacunarity
    fy *= o.lacunarity
  }
  return sum / norm
}

export interface Camera {
  x: number
  y: number
  z: number
  /** Focal length in screen pixels. */
  f: number
  /** Screen centre and horizon line. */
  cx: number
  horizon: number
}

/** Projects a world point (x right, y up, z forward) to the screen; returns null behind the camera. */
export function project(c: Camera, x: number, y: number, z: number): [number, number] | null {
  const d = z - c.z
  if (d <= 0.01) return null
  return [c.cx + ((x - c.x) * c.f) / d, c.horizon + ((c.y - y) * c.f) / d]
}

/** Terrain colour for a normalised height, with water below `sea` and snow above `snow`. */
export function landColor(h: number, sea: number, snow: number): [number, number, number] {
  if (h <= sea) {
    const deep = Math.min(1, (sea - h) * 3)
    return [40 - deep * 20, 120 - deep * 50, 170 - deep * 40]
  }
  const t = h - sea
  if (t < 0.035) return [214, 196, 148]
  if (h > snow) return [240, 243, 247]
  if (h > snow - 0.12) return [128, 116, 104]
  const g = Math.min(1, t / Math.max(0.05, snow - sea))
  return [96 - g * 30, 160 - g * 50, 72 - g * 20]
}
