export type Optic = 'converging' | 'diverging' | 'concave' | 'convex'

export const isMirror = (o: Optic) => o === 'concave' || o === 'convex'

/** Real-is-positive focal length: converging lenses and concave mirrors are positive. */
export const signedFocal = (o: Optic, f: number) => (o === 'converging' || o === 'concave' ? Math.abs(f) : -Math.abs(f))

export interface Image {
  /** Image distance (positive = real image: behind a lens, in front of a mirror). */
  di: number
  /** Lateral magnification (negative = inverted). */
  m: number
  /** True when the object sits at the focal point and the rays leave parallel. */
  atInfinity: boolean
}

/** Thin lens / mirror equation 1/f = 1/do + 1/di with m = −di/do. */
export function thinLens(f: number, dObj: number): Image {
  const den = dObj - f
  if (Math.abs(den) < 1e-9 * Math.max(1, Math.abs(f))) return { di: Infinity, m: Infinity, atInfinity: true }
  const di = (f * dObj) / den
  return { di, m: -di / dObj, atInfinity: false }
}

export interface Ray {
  name: string
  /** Slope of the incoming ray (height gained per unit of distance towards the optic). */
  slopeIn: number
  /** Height at which it meets the optic. */
  yl: number
  /** Slope after the optic, in the unfolded (lens-like) picture. */
  slopeOut: number
}

/**
 * The principal rays from the tip of an object of height h at distance dObj, for signed focal length f.
 * A thin optic bends a ray meeting it at height y by −y/f, which covers all four cases once a mirror
 * is unfolded into a lens.
 */
export function principalRays(f: number, dObj: number, h: number): Ray[] {
  const out: Ray[] = [
    { name: 'parallel', slopeIn: 0, yl: h, slopeOut: -h / f },
    { name: 'centre', slopeIn: -h / dObj, yl: 0, slopeOut: -h / dObj },
  ]
  if (Math.abs(dObj - f) > 1e-6) {
    const s = -h / (dObj - f)
    out.push({ name: 'focal', slopeIn: s, yl: h + s * dObj, slopeOut: 0 })
  }
  return out
}
