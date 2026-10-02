import { rng } from '../../sim/math'

/**
 * One step of the classic two-buffer ripple (a leapfrog wave equation):
 *   next = (sum of the 4 neighbours) / 2 − prev
 * with damping d applied as friction on the velocity, which (unlike simply scaling the result)
 * makes the wave energy fall on every step:
 *   next = d · (sum of the 4 neighbours) / 2 − (2d − 1) · prev
 * The result is written into `prev`, which the caller then swaps with `cur`.
 * Edge cells and wall cells are held at zero, so waves reflect off them.
 */
export function stepWave(cur: Float32Array, prev: Float32Array, w: number, h: number, damping: number, walls?: Uint8Array) {
  const a = damping * 0.5
  const b = 2 * damping - 1
  for (let y = 1; y < h - 1; y++) {
    let i = y * w + 1
    for (let x = 1; x < w - 1; x++, i++) prev[i] = (cur[i - 1] + cur[i + 1] + cur[i - w] + cur[i + w]) * a - b * prev[i]
  }
  if (walls) for (let i = 0; i < walls.length; i++) if (walls[i]) prev[i] = 0
}

/**
 * The quantity the undamped scheme conserves exactly: kinetic (change between buffers) plus
 * potential (products of neighbour differences, weighted by the scheme's r = ½).
 */
export function waveEnergy(cur: Float32Array, prev: Float32Array, w: number, h: number): number {
  let kin = 0
  let pot = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const d = cur[i] - prev[i]
      kin += d * d
      if (x + 1 < w) pot += (cur[i] - cur[i + 1]) * (prev[i] - prev[i + 1])
      if (y + 1 < h) pot += (cur[i] - cur[i + w]) * (prev[i] - prev[i + w])
    }
  return kin + 0.5 * pot
}

/** Presses a smooth dimple of radius r (cells) and depth `amp` into the surface. */
export function addDrop(buf: Float32Array, w: number, h: number, cx: number, cy: number, r: number, amp: number) {
  const x0 = Math.max(1, Math.floor(cx - r))
  const x1 = Math.min(w - 2, Math.ceil(cx + r))
  const y0 = Math.max(1, Math.floor(cy - r))
  const y1 = Math.min(h - 2, Math.ceil(cy + r))
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d < r) buf[y * w + x] -= amp * 0.5 * (1 + Math.cos((Math.PI * d) / r))
    }
}

export type Floor = 'pebbles' | 'tiles' | 'deep'

/** A procedural pond floor as RGB bytes (3 per cell). */
export function makeFloor(kind: Floor, w: number, h: number, seed = 3): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 3)
  const random = rng(seed)
  if (kind === 'pebbles') {
    // Worley noise: each cell takes the colour of its nearest pebble centre, darkened near the gaps.
    const n = Math.round((w * h) / 520)
    const px = new Float32Array(n)
    const py = new Float32Array(n)
    const col = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) {
      px[k] = random() * w
      py[k] = random() * h
      const tone = random()
      const warm = random() < 0.6
      col[k * 3] = warm ? 150 + tone * 70 : 110 + tone * 60
      col[k * 3 + 1] = warm ? 130 + tone * 60 : 115 + tone * 55
      col[k * 3 + 2] = warm ? 100 + tone * 45 : 110 + tone * 60
    }
    // Bucket centres on a coarse grid to keep the search local.
    const G = 24
    const gw = Math.ceil(w / G)
    const gh = Math.ceil(h / G)
    const cells: number[][] = Array.from({ length: gw * gh }, () => [])
    for (let k = 0; k < n; k++) cells[Math.min(gh - 1, Math.floor(py[k] / G)) * gw + Math.min(gw - 1, Math.floor(px[k] / G))].push(k)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let d1 = 1e9
        let d2 = 1e9
        let best = 0
        const cx = Math.floor(x / G)
        const cy = Math.floor(y / G)
        for (let oy = -2; oy <= 2; oy++)
          for (let ox = -2; ox <= 2; ox++) {
            const gx = cx + ox
            const gy = cy + oy
            if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue
            for (const k of cells[gy * gw + gx]) {
              const d = (px[k] - x) ** 2 + (py[k] - y) ** 2
              if (d < d1) {
                d2 = d1
                d1 = d
                best = k
              } else if (d < d2) d2 = d
            }
          }
        const edge = Math.sqrt(d2) - Math.sqrt(d1)
        const rim = Math.min(1, edge / 3)
        const dome = 1 - Math.min(1, Math.sqrt(d1) / 16) * 0.25
        const f = (0.25 + 0.75 * rim) * dome
        const o = (y * w + x) * 3
        // A cool aqua tint, as if seen through a little depth of water.
        out[o] = col[best * 3] * f * 0.78
        out[o + 1] = col[best * 3 + 1] * f * 0.92 + 14
        out[o + 2] = col[best * 3 + 2] * f * 0.95 + 26
      }
    return out
  }
  if (kind === 'tiles') {
    const s = 14
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 3
        const tx = Math.floor(x / s)
        const ty = Math.floor(y / s)
        const grout = x % s === 0 || y % s === 0
        const lane = Math.floor(y / (s * 4)) % 3 === 1 && ty % 4 === 2
        const v = ((tx * 7 + ty * 13) % 5) * 4
        if (grout) {
          out[o] = 225
          out[o + 1] = 240
          out[o + 2] = 245
        } else if (lane) {
          out[o] = 20 + v
          out[o + 1] = 60 + v
          out[o + 2] = 130 + v
        } else {
          out[o] = 95 + v
          out[o + 1] = 190 + v
          out[o + 2] = 215 + v
        }
      }
    return out
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3
      const t = y / h
      out[o] = 8 + t * 6
      out[o + 1] = 40 + t * 30
      out[o + 2] = 80 + t * 40
    }
  return out
}

/**
 * Shades the water: each cell looks at the floor through the surface, displaced by the slope
 * (refraction), and gets a light-from-top-left highlight.
 */
export function renderWater(height: Float32Array, floor: Uint8ClampedArray, walls: Uint8Array, out: Uint8ClampedArray, w: number, h: number, refract: number, shine: number) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const o = i * 4
      if (walls[i]) {
        const v = 70 + ((x * 13 + y * 7) % 9) * 3
        out[o] = v
        out[o + 1] = v - 4
        out[o + 2] = v - 10
        out[o + 3] = 255
        continue
      }
      const gx = x > 0 && x < w - 1 ? height[i + 1] - height[i - 1] : 0
      const gy = y > 0 && y < h - 1 ? height[i + w] - height[i - w] : 0
      let sx = (x + gx * refract) | 0
      let sy = (y + gy * refract) | 0
      if (sx < 0) sx = 0
      else if (sx >= w) sx = w - 1
      if (sy < 0) sy = 0
      else if (sy >= h) sy = h - 1
      const b = (sy * w + sx) * 3
      const slope = -(gx + gy) * shine
      const light = 1 + slope * 0.6
      const spec = slope > 0.35 ? (slope - 0.35) * 260 : 0
      out[o] = floor[b] * light + spec
      out[o + 1] = floor[b + 1] * light + spec
      out[o + 2] = floor[b + 2] * light + spec
      out[o + 3] = 255
    }
}
