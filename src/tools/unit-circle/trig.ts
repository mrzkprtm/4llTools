/** Exact trig values and labels for the special angles of the unit circle. */

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a))

/** Angle in degrees wrapped into [0, 360). */
export function wrapDeg(d: number): number {
  return ((d % 360) + 360) % 360
}

/** The angle as a fraction of π for multiples of 15°, e.g. 30 → "π/6", 135 → "3π/4", 360 → "2π"; otherwise null. */
export function specialAngleLabel(deg: number): string | null {
  const r = Math.round(deg)
  if (Math.abs(deg - r) > 1e-9 || r % 15 !== 0) return null
  if (r === 0) return '0'
  const neg = r < 0
  const n = Math.abs(r) / 15
  const g = gcd(n, 12)
  const num = n / g
  const den = 12 / g
  return `${neg ? '−' : ''}${num === 1 ? '' : num}π${den === 1 ? '' : `/${den}`}`
}

/** True for the angles with textbook exact values: multiples of 30° or 45°. */
export function isSpecial(deg: number): boolean {
  const r = Math.round(deg)
  return Math.abs(deg - r) < 1e-9 && (r % 30 === 0 || r % 45 === 0)
}

const SIN_FIRST: Record<number, string> = { 0: '0', 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1' }
const TAN_FIRST: Record<number, string> = { 0: '0', 30: '√3/3', 45: '1', 60: '√3', 90: 'undefined' }

/** Exact sin, cos and tan as text for special angles (multiples of 30° or 45°), or null. */
export function exactTrig(deg: number): { sin: string; cos: string; tan: string } | null {
  if (!isSpecial(deg)) return null
  const d = wrapDeg(Math.round(deg))
  // Reference angle in the first quadrant, and the signs in each quadrant.
  const ref = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d
  const sinNeg = d > 180
  const cosNeg = d > 90 && d < 270
  const sign = (s: string, neg: boolean) => (neg && s !== '0' ? `−${s}` : s)
  const tanRaw = TAN_FIRST[ref]
  return {
    sin: sign(SIN_FIRST[ref], sinNeg),
    cos: sign(SIN_FIRST[90 - ref], cosNeg),
    tan: tanRaw === 'undefined' ? tanRaw : sign(tanRaw, sinNeg !== cosNeg),
  }
}

/** Which quadrant the angle is in (1–4), or the axis it sits on. */
export function quadrant(deg: number): string {
  const d = wrapDeg(deg)
  const near = (v: number) => Math.abs(d - v) < 1e-9
  if (near(0)) return '+x axis'
  if (near(90)) return '+y axis'
  if (near(180)) return '−x axis'
  if (near(270)) return '−y axis'
  return ['I', 'II', 'III', 'IV'][Math.floor(d / 90)]
}

/** Snaps to the nearest special angle when within `tolerance` degrees. */
export function snapToSpecial(deg: number, tolerance = 5): number {
  const candidates = [Math.round(deg / 30) * 30, Math.round(deg / 45) * 45]
  let best = deg
  let bestD = tolerance
  for (const c of candidates)
    if (Math.abs(c - deg) <= bestD) {
      best = c
      bestD = Math.abs(c - deg)
    }
  return best
}
