/** Point charges and their field, in units where Coulomb's constant is 1. */
export interface Charge {
  x: number
  y: number
  q: number
}

/** Electric field (Ex, Ey) at (x, y): the sum of q·r̂/r² over all charges. `soft` smooths the 1/r² spike. */
export function fieldAt(charges: readonly Charge[], x: number, y: number, soft = 0): [number, number] {
  let ex = 0
  let ey = 0
  for (const c of charges) {
    const dx = x - c.x
    const dy = y - c.y
    const r2 = dx * dx + dy * dy + soft
    if (r2 === 0) continue
    const k = c.q / (r2 * Math.sqrt(r2))
    ex += k * dx
    ey += k * dy
  }
  return [ex, ey]
}

/** Electric potential Σ q/r at (x, y). */
export function potentialAt(charges: readonly Charge[], x: number, y: number, soft = 0): number {
  let v = 0
  for (const c of charges) {
    const r = Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2 + soft)
    if (r > 0) v += c.q / r
  }
  return v
}

export interface TraceOpts {
  /** +1 follows the field, −1 runs against it. */
  dir?: number
  step?: number
  maxSteps?: number
  /** Stop once inside this distance of another charge. */
  stopRadius?: number
  bounds?: [number, number, number, number]
}

export interface Line {
  points: number[]
  /** How the line ended: on a charge, off the edge, or out of steps. */
  end: 'charge' | 'edge' | 'steps'
  /** Index of the charge it ended on, or −1. */
  hit: number
}

/** Traces a field line from (x0, y0) with RK4 on the unit field direction. */
export function traceLine(charges: readonly Charge[], x0: number, y0: number, { dir = 1, step = 4, maxSteps = 500, stopRadius = 8, bounds = [-50, -50, 850, 550] }: TraceOpts = {}): Line {
  const pts = [x0, y0]
  const unit = (x: number, y: number): [number, number] => {
    const [ex, ey] = fieldAt(charges, x, y)
    const m = Math.hypot(ex, ey) || 1
    return [(dir * ex) / m, (dir * ey) / m]
  }
  let x = x0
  let y = y0
  for (let i = 0; i < maxSteps; i++) {
    const k1 = unit(x, y)
    const k2 = unit(x + (step / 2) * k1[0], y + (step / 2) * k1[1])
    const k3 = unit(x + (step / 2) * k2[0], y + (step / 2) * k2[1])
    const k4 = unit(x + step * k3[0], y + step * k3[1])
    x += (step / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
    y += (step / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
    pts.push(x, y)
    for (let j = 0; j < charges.length; j++) {
      const c = charges[j]
      // Lines end on charges of the opposite kind to where they are heading.
      if (Math.sign(c.q) === -dir && (x - c.x) ** 2 + (y - c.y) ** 2 < stopRadius * stopRadius) return { points: pts, end: 'charge', hit: j }
    }
    if (x < bounds[0] || y < bounds[1] || x > bounds[2] || y > bounds[3]) return { points: pts, end: 'edge', hit: -1 }
  }
  return { points: pts, end: 'steps', hit: -1 }
}
