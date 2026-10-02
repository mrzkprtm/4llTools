/** A cellular "falling sand" world: one material byte per cell, updated bottom-up. */

export const EMPTY = 0
export const SAND = 1
export const WATER = 2
export const STONE = 3
export const PLANT = 4
export const FIRE = 5
export const OIL = 6
export const STEAM = 7

export interface Material {
  id: number
  name: string
  /** Base colour [r, g, b]. */
  rgb: [number, number, number]
  /** How much the per-cell shade varies the colour. */
  vary: number
}

export const MATERIALS: Material[] = [
  { id: EMPTY, name: 'Eraser', rgb: [14, 13, 20], vary: 0 },
  { id: SAND, name: 'Sand', rgb: [226, 190, 110], vary: 26 },
  { id: WATER, name: 'Water', rgb: [48, 118, 230], vary: 18 },
  { id: STONE, name: 'Stone', rgb: [128, 126, 134], vary: 22 },
  { id: PLANT, name: 'Plant', rgb: [60, 170, 70], vary: 30 },
  { id: FIRE, name: 'Fire', rgb: [255, 140, 30], vary: 20 },
  { id: OIL, name: 'Oil', rgb: [92, 64, 40], vary: 12 },
  { id: STEAM, name: 'Steam', rgb: [200, 206, 220], vary: 16 },
]

/** Relative density: things sink through lighter fluids and gases rise through heavier ones. */
const DENSITY = [0, 3, 2, 9, 9, 0, 1, -1]
/** Cells other particles can move into (by swapping). */
const FLUID = [true, false, true, false, false, true, true, true]

/** Fire life at or above this is a glowing ember (burning plant) that stays put. */
export const EMBER = 100

export interface Grid {
  w: number
  h: number
  mat: Uint8Array
  shade: Uint8Array
  life: Uint8Array
  done: Uint8Array
  tick: number
}

export function makeGrid(w: number, h: number): Grid {
  const n = w * h
  return { w, h, mat: new Uint8Array(n), shade: new Uint8Array(n), life: new Uint8Array(n), done: new Uint8Array(n), tick: 0 }
}

/** Puts material `m` in cell i with a random shade and a fresh lifetime. */
export function place(g: Grid, i: number, m: number, random: () => number = Math.random, life?: number) {
  g.mat[i] = m
  g.shade[i] = (random() * 256) | 0
  g.life[i] = life ?? (m === FIRE ? 20 + random() * 40 : m === STEAM ? 90 + random() * 140 : 0)
}

function swap(g: Grid, i: number, j: number, stamp: number) {
  const { mat, shade, life, done } = g
  const m = mat[i]
  const s = shade[i]
  const l = life[i]
  mat[i] = mat[j]
  shade[i] = shade[j]
  life[i] = life[j]
  mat[j] = m
  shade[j] = s
  life[j] = l
  done[i] = stamp
  done[j] = stamp
}

/** True when a particle of material m may move into a cell holding t. */
const canEnter = (m: number, t: number) => FLUID[t] && DENSITY[t] < DENSITY[m]

/** Advances the whole world by one tick. */
export function step(g: Grid, random: () => number = Math.random) {
  const { w, h, mat, life, done } = g
  g.tick++
  const stamp = (g.tick % 255) + 1
  const ltr = (g.tick & 1) === 0
  for (let y = h - 1; y >= 0; y--) {
    for (let k = 0; k < w; k++) {
      const x = ltr ? k : w - 1 - k
      const i = y * w + x
      const m = mat[i]
      if (m === EMPTY || m === STONE || done[i] === stamp) continue
      if (m === SAND) powder(g, x, y, i, stamp, random)
      else if (m === WATER) liquid(g, x, y, i, stamp, random, 4)
      else if (m === OIL) liquid(g, x, y, i, stamp, random, 2)
      else if (m === PLANT) {
        // Plants drink neighbouring water and grow into it.
        if (random() < 0.08) {
          const j = neighbour(g, x, y, random)
          if (j >= 0 && mat[j] === WATER && random() < 0.35) {
            place(g, j, PLANT, random)
            done[j] = stamp
          }
        }
      } else if (m === FIRE) fire(g, x, y, i, stamp, random)
      else if (m === STEAM) {
        if (--life[i] === 0) {
          // Most steam simply vanishes; some condenses back into rain.
          if (random() < 0.3) place(g, i, WATER, random)
          else mat[i] = EMPTY
          continue
        }
        gas(g, x, y, i, stamp, random)
      }
    }
  }
}

/** A random 4-neighbour index, or -1 at the edge. */
function neighbour(g: Grid, x: number, y: number, random: () => number): number {
  const r = (random() * 4) | 0
  const nx = x + (r === 0 ? 1 : r === 1 ? -1 : 0)
  const ny = y + (r === 2 ? 1 : r === 3 ? -1 : 0)
  if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) return -1
  return ny * g.w + nx
}

function powder(g: Grid, x: number, y: number, i: number, stamp: number, random: () => number) {
  if (y + 1 >= g.h) return
  const { w, mat } = g
  const m = mat[i]
  const below = i + w
  if (canEnter(m, mat[below])) {
    // Sinking through water is slower than falling through air.
    if (mat[below] === EMPTY || random() < 0.6) swap(g, i, below, stamp)
    return
  }
  const a = random() < 0.5 ? -1 : 1
  for (const dx of [a, -a]) {
    const nx = x + dx
    if (nx < 0 || nx >= w) continue
    if (canEnter(m, mat[below + dx])) {
      swap(g, i, below + dx, stamp)
      return
    }
  }
}

function liquid(g: Grid, x: number, y: number, i: number, stamp: number, random: () => number, spread: number) {
  const { w, h, mat } = g
  const m = mat[i]
  if (y + 1 < h) {
    const below = i + w
    if (canEnter(m, mat[below])) {
      swap(g, i, below, stamp)
      return
    }
    const a = random() < 0.5 ? -1 : 1
    for (const dx of [a, -a]) {
      const nx = x + dx
      if (nx >= 0 && nx < w && canEnter(m, mat[below + dx])) {
        swap(g, i, below + dx, stamp)
        return
      }
    }
  }
  // Flow sideways up to `spread` cells, so pools level out quickly.
  const a = random() < 0.5 ? -1 : 1
  for (const dx of [a, -a]) {
    let best = -1
    for (let d = 1; d <= spread; d++) {
      const nx = x + dx * d
      if (nx < 0 || nx >= w) break
      const j = y * w + nx
      if (!canEnter(m, mat[j])) break
      best = j
      // Stop at a ledge so water pours over edges instead of skimming across them.
      if (y + 1 < h && canEnter(m, mat[j + w])) break
    }
    if (best >= 0) {
      swap(g, i, best, stamp)
      return
    }
  }
}

function gas(g: Grid, x: number, y: number, i: number, stamp: number, random: () => number) {
  const { w, mat } = g
  const dx = ((random() * 3) | 0) - 1
  const nx = x + dx
  if (y > 0 && nx >= 0 && nx < w) {
    const j = i - w + dx
    if (mat[j] === EMPTY || mat[j] === WATER || mat[j] === OIL) {
      swap(g, i, j, stamp)
      return
    }
  }
  const sx = x + (random() < 0.5 ? -1 : 1)
  if (sx >= 0 && sx < w && mat[y * w + sx] === EMPTY) swap(g, i, y * w + sx, stamp)
}

function fire(g: Grid, x: number, y: number, i: number, stamp: number, random: () => number) {
  const { w, h, mat, life, done } = g
  // Look at the neighbours: spread to fuel, get quenched by water.
  for (let k = 0; k < 4; k++) {
    const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0)
    const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0)
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
    const j = ny * w + nx
    const t = mat[j]
    if (t === PLANT && random() < 0.05) {
      place(g, j, FIRE, random, EMBER + 40 + random() * 80)
      done[j] = stamp
    } else if (t === OIL && random() < 0.3) {
      place(g, j, FIRE, random, 40 + random() * 30)
      done[j] = stamp
    } else if (t === WATER) {
      place(g, i, STEAM, random)
      if (random() < 0.4) place(g, j, STEAM, random)
      done[j] = stamp
      return
    }
  }
  const l = life[i]
  if (l <= 1) {
    mat[i] = EMPTY
    life[i] = 0
    return
  }
  life[i] = l === EMBER ? 1 : l - 1
  if (l >= EMBER) {
    // Embers stay put and throw flames upwards.
    if (y > 0 && random() < 0.3 && mat[i - w] === EMPTY) {
      place(g, i - w, FIRE, random, 8 + random() * 22)
      done[i - w] = stamp
    }
    return
  }
  if (y > 0 && random() < 0.7) {
    const dx = ((random() * 3) | 0) - 1
    const nx = x + dx
    if (nx >= 0 && nx < w && mat[i - w + dx] === EMPTY) swap(g, i, i - w + dx, stamp)
  }
}

/** Paints a disc of material m. Loose materials are sprinkled so they pour instead of forming blocks. */
export function paint(g: Grid, cx: number, cy: number, r: number, m: number, random: () => number = Math.random) {
  const { w, h, mat } = g
  const solid = m === EMPTY || m === STONE || m === PLANT
  const chance = solid ? 1 : m === FIRE || m === STEAM ? 0.4 : 0.3
  const r2 = r * r
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue
      const i = y * w + x
      if (m === EMPTY) {
        mat[i] = EMPTY
        continue
      }
      if (random() > chance) continue
      if (solid || mat[i] === EMPTY) place(g, i, m, random)
    }
}

/** Number of cells holding each material, indexed by material id. */
export function counts(g: Grid): number[] {
  const out = new Array<number>(MATERIALS.length).fill(0)
  for (let i = 0; i < g.mat.length; i++) out[g.mat[i]]++
  return out
}

/** Writes the world as RGBA pixels (one per cell) into `data`. */
export function render(g: Grid, data: Uint8ClampedArray, t = 0) {
  const { w, h, mat, shade, life } = g
  for (let y = 0; y < h; y++) {
    // A deep night-blue backdrop that gets a little lighter towards the floor.
    const br = 12 + (y / h) * 10
    const bg = 12 + (y / h) * 8
    const bb = 22 + (y / h) * 14
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const o = i * 4
      const m = mat[i]
      let r = br
      let gg = bg
      let b = bb
      if (m !== EMPTY) {
        const mt = MATERIALS[m]
        const v = ((shade[i] - 128) / 128) * mt.vary
        r = mt.rgb[0] + v
        gg = mt.rgb[1] + v
        b = mt.rgb[2] + v
        if (m === WATER) {
          const s = Math.sin(x * 0.35 + y * 0.2 + t * 3 + shade[i] * 0.02) * 10
          r += s
          gg += s
          b += s
        } else if (m === FIRE) {
          const l = life[i]
          if (l >= EMBER) {
            const f = 0.7 + 0.3 * Math.sin(t * 12 + shade[i])
            r = 240 * f + 15
            gg = 90 * f
            b = 20
          } else {
            const k = Math.min(1, l / 40)
            r = 200 + 55 * k
            gg = 40 + 190 * k * k + v
            b = 10 + 120 * k * k * k
          }
        } else if (m === STEAM) {
          const a = Math.min(1, life[i] / 120) * 0.75
          r = br + (r - br) * a
          gg = bg + (gg - bg) * a
          b = bb + (b - bb) * a
        }
      }
      data[o] = r
      data[o + 1] = gg
      data[o + 2] = b
      data[o + 3] = 255
    }
  }
}

function fillRect(g: Grid, x0: number, y0: number, x1: number, y1: number, m: number, random: () => number) {
  for (let y = Math.max(0, y0); y <= Math.min(g.h - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(g.w - 1, x1); x++) place(g, y * g.w + x, m, random)
}

/** A small starter scene: a ledge, a basin of water under oil, a plant in a pool and a block of sand about to fall. */
export function demoScene(g: Grid, random: () => number = Math.random) {
  g.mat.fill(EMPTY)
  g.life.fill(0)
  const { w, h } = g
  const sx = w / 200
  const sy = h / 130
  const X = (v: number) => Math.round(v * sx)
  const Y = (v: number) => Math.round(v * sy)
  // A sloping stone ledge.
  for (let x = X(18); x <= X(92); x++) {
    const y = Math.round(Y(52) + (x - X(18)) * 0.18 * (sy / sx))
    fillRect(g, x, y, x, y + 2, STONE, random)
  }
  // A basin on the right: water with a slick of oil on top.
  fillRect(g, X(118), Y(92), X(120), h - 1, STONE, random)
  fillRect(g, X(188), Y(92), X(190), h - 1, STONE, random)
  fillRect(g, X(121), Y(110), X(187), h - 1, WATER, random)
  fillRect(g, X(121), Y(105), X(187), Y(109), OIL, random)
  // A shallow pool on the left with a plant ready to grow into it.
  fillRect(g, 0, Y(121), X(70), h - 1, WATER, random)
  fillRect(g, X(8), Y(112), X(11), h - 1, PLANT, random)
  fillRect(g, X(5), Y(112), X(14), Y(113), PLANT, random)
  // A wooden shelf with a little fire already burning underneath it.
  fillRect(g, X(96), Y(74), X(114), Y(75), PLANT, random)
  fillRect(g, X(104), Y(76), X(106), Y(76), FIRE, random)
  // Sand hanging in the air, about to pour down.
  for (let y = Y(6); y <= Y(34); y++)
    for (let x = X(44); x <= X(82); x++) if (random() < 0.92) place(g, y * w + x, SAND, random)
  // Rain waiting to fall.
  for (let k = 0; k < 400; k++) {
    const x = X(128) + ((random() * X(56)) | 0)
    const y = Y(4) + ((random() * Y(40)) | 0)
    if (g.mat[y * w + x] === EMPTY) place(g, y * w + x, WATER, random)
  }
}
