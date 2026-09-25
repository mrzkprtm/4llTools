/** Spirograph curves: a gear of radius r rolling inside (hypotrochoid) or outside (epitrochoid) a ring of radius R. */

export interface Gear {
  /** Fixed ring radius. */
  R: number
  /** Rolling gear radius. */
  r: number
  /** Pen distance from the gear's centre. */
  d: number
  inside: boolean
}

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a))
  b = Math.abs(Math.round(b))
  while (b) [a, b] = [b, a % b]
  return a
}

/** Where the gear's centre is after it has travelled `theta` radians around the ring. */
export function gearCentre(theta: number, { R, r, inside }: Gear): [number, number] {
  const c = inside ? R - r : R + r
  return [c * Math.cos(theta), c * Math.sin(theta)]
}

/** The gear's own rotation angle (radians) after travelling `theta` around the ring without slipping. */
export function gearSpin(theta: number, { R, r, inside }: Gear): number {
  return inside ? (-(R - r) / r) * theta : ((R + r) / r) * theta
}

/** The pen position: hypotrochoid when inside, epitrochoid when outside. */
export function spiroPoint(theta: number, g: Gear): [number, number] {
  const { R, r, d, inside } = g
  if (inside) {
    const k = (R - r) / r
    return [(R - r) * Math.cos(theta) + d * Math.cos(k * theta), (R - r) * Math.sin(theta) - d * Math.sin(k * theta)]
  }
  const k = (R + r) / r
  return [(R + r) * Math.cos(theta) - d * Math.cos(k * theta), (R + r) * Math.sin(theta) - d * Math.sin(k * theta)]
}

/** Trips around the ring before the pattern closes (integer radii): r / gcd(R, r). */
export function closingTurns(R: number, r: number): number {
  return Math.round(r) / Math.max(1, gcd(R, r))
}

/** Number of petals (lobes) in the finished pattern: R / gcd(R, r). */
export function petals(R: number, r: number): number {
  return Math.round(R) / Math.max(1, gcd(R, r))
}

/** Furthest the pen, gear or ring gets from the centre, to fit the view. */
export function extent({ R, r, d, inside }: Gear): number {
  return inside ? Math.max(R + 14, R - r + d) : R + r + Math.max(r, d)
}
