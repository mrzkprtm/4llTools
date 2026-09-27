/**
 * Procedural Ishihara-style plates. Dots are packed by grid-accelerated dart
 * throwing; figure colors are background colors moved along a dichromat
 * confusion line (only the L, M or S cone response changes), so a person
 * missing that cone type sees figure and background as the same color.
 */
import { rng } from '../../sim/math'

export interface Dot {
  x: number
  y: number
  r: number
}

/**
 * Packs non-overlapping dots inside a circle of radius R centered at (R, R).
 * Radii go from large to small in passes, and a spatial hash keeps each
 * overlap check to the few neighbors in adjacent cells.
 */
export function packDots(random: () => number, R: number, radii: readonly number[] = [9, 7.5, 6, 4.8, 3.8, 3, 2.4], gap = 1.1, attemptsPerPass = 9000): Dot[] {
  const maxR = Math.max(...radii)
  const cell = 2 * maxR + gap
  const n = Math.ceil((2 * R) / cell)
  const buckets: Dot[][] = Array.from({ length: n * n }, () => [])
  const dots: Dot[] = []
  for (const base of radii) {
    for (let k = 0; k < attemptsPerPass; k++) {
      const r = base * (0.85 + random() * 0.3)
      const x = random() * 2 * R
      const y = random() * 2 * R
      if (Math.hypot(x - R, y - R) + r > R) continue
      const cx = Math.floor(x / cell)
      const cy = Math.floor(y / cell)
      let ok = true
      for (let j = Math.max(0, cy - 1); ok && j <= Math.min(n - 1, cy + 1); j++)
        for (let i = Math.max(0, cx - 1); ok && i <= Math.min(n - 1, cx + 1); i++)
          for (const d of buckets[j * n + i])
            if ((d.x - x) ** 2 + (d.y - y) ** 2 < (d.r + r + gap) ** 2) {
              ok = false
              break
            }
      if (!ok) continue
      const dot = { x, y, r }
      dots.push(dot)
      buckets[cy * n + cx].push(dot)
    }
  }
  return dots
}

/** True when the mask (RGBA pixels, w × h) is inked at (x, y). */
export function maskAt(data: ArrayLike<number>, w: number, h: number, x: number, y: number): boolean {
  const px = Math.floor(x)
  const py = Math.floor(y)
  if (px < 0 || py < 0 || px >= w || py >= h) return false
  return data[(py * w + px) * 4 + 3] > 127
}

/** A dot belongs to the figure when most of five sample points inside it hit the mask. */
export function inFigure(data: ArrayLike<number>, w: number, h: number, d: Dot): boolean {
  const o = d.r * 0.5
  const pts = [[0, 0], [o, 0], [-o, 0], [0, o], [0, -o]]
  let hits = 0
  for (const [dx, dy] of pts) if (maskAt(data, w, h, d.x + dx, d.y + dy)) hits++
  return hits >= 3
}

// Color science: sRGB ↔ linear RGB ↔ LMS (Viénot, Brettel & Mollon 1999).
export type RGB = [number, number, number]
type M3 = number[][]
const RGB2LMS: M3 = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
]
function inv3(m: M3): M3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ]
}
const LMS2RGB = inv3(RGB2LMS)
const mul = (m: M3, v: number[]): RGB => [0, 1, 2].map((r) => m[r][0] * v[0] + m[r][1] * v[1] + m[r][2] * v[2]) as RGB
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export const rgbToLms = (rgb: RGB): RGB => mul(RGB2LMS, rgb.map((c) => toLin(c / 255)))
export function lmsToRgb(lms: readonly number[]): { rgb: RGB; inGamut: boolean } {
  const lin = mul(LMS2RGB, [...lms])
  const inGamut = lin.every((c) => c >= -1e-6 && c <= 1 + 1e-6)
  return { rgb: lin.map((c) => Math.round(toSrgb(Math.min(1, Math.max(0, c))) * 255)) as RGB, inGamut }
}

export type Axis = 'protan' | 'deutan' | 'tritan'
const AXIS_INDEX: Record<Axis, number> = { protan: 0, deutan: 1, tritan: 2 }

/**
 * Moves a color along the confusion line of `axis`: only that cone's response
 * changes (by `amount`, a fraction), halving the step until it fits in sRGB.
 * A dichromat missing that cone cannot tell the two colors apart.
 */
export function confuse(base: RGB, axis: Axis, amount: number): RGB {
  const lms = rgbToLms(base)
  let a = amount
  for (let k = 0; k < 8; k++) {
    const next = [...lms]
    next[AXIS_INDEX[axis]] *= 1 + a
    const { rgb, inGamut } = lmsToRgb(next)
    if (inGamut) return rgb
    a /= 1.5
  }
  return base
}

export type PlateKind = 'control' | Axis | 'blank'

export interface PlateSpec {
  kind: PlateKind
  /** Strong or mild color difference. */
  strength: 'strong' | 'mild'
  /** Background base colors; the figure uses shifted versions of them. */
  palette: RGB[]
  /** The digit to find, or null for a plate with no number. */
  digit: number | null
}

const PAL = {
  sand: [[196, 170, 120], [212, 186, 132], [180, 160, 110]] as RGB[],
  olive: [[150, 160, 100], [168, 172, 110], [138, 150, 96]] as RGB[],
  rose: [[205, 150, 140], [190, 140, 132], [215, 165, 150]] as RGB[],
  lilac: [[160, 150, 190], [150, 160, 200], [172, 160, 196]] as RGB[],
}

const AMOUNT: Record<Axis, Record<'strong' | 'mild', number>> = {
  protan: { strong: 0.2, mild: 0.1 },
  deutan: { strong: -0.25, mild: -0.12 },
  tritan: { strong: -0.6, mild: -0.35 },
}

/** Figure color for a background base on a plate. */
export function figureColor(spec: PlateSpec, base: RGB): RGB {
  if (spec.kind === 'control') return [Math.round(base[0] * 0.95), Math.round(base[1] * 0.45), Math.round(base[2] * 0.3)]
  if (spec.kind === 'blank') return base
  return confuse(base, spec.kind, AMOUNT[spec.kind][spec.strength])
}

/** The ten plates of a test run, in shuffled order, with random digits. */
export function buildPlan(seed: number): PlateSpec[] {
  const random = rng(seed)
  const digit = () => 1 + Math.floor(random() * 9)
  const plates: PlateSpec[] = [
    { kind: 'protan', strength: 'strong', palette: PAL.olive, digit: digit() },
    { kind: 'protan', strength: 'mild', palette: PAL.sand, digit: digit() },
    { kind: 'protan', strength: 'strong', palette: PAL.rose, digit: digit() },
    { kind: 'deutan', strength: 'strong', palette: PAL.sand, digit: digit() },
    { kind: 'deutan', strength: 'mild', palette: PAL.olive, digit: digit() },
    { kind: 'deutan', strength: 'strong', palette: PAL.rose, digit: digit() },
    { kind: 'tritan', strength: 'strong', palette: PAL.lilac, digit: digit() },
    { kind: 'tritan', strength: 'mild', palette: PAL.sand, digit: digit() },
    { kind: 'blank', strength: 'strong', palette: PAL.olive, digit: null },
  ]
  for (let i = plates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[plates[i], plates[j]] = [plates[j], plates[i]]
  }
  // The control plate always comes first, like plate 1 of a printed test.
  return [{ kind: 'control', strength: 'strong', palette: PAL.lilac, digit: digit() }, ...plates]
}

export interface Summary {
  reliable: boolean
  fails: Record<Axis, { failed: number; total: number; strongFailed: number }>
  likely: Axis | null
  severity: 'strong' | 'mild' | null
  correct: number
  total: number
}

/** Scores answers (a digit, or null for "nothing") against the plan. */
export function score(plan: readonly PlateSpec[], answers: readonly (number | null)[]): Summary {
  const fails: Summary['fails'] = { protan: { failed: 0, total: 0, strongFailed: 0 }, deutan: { failed: 0, total: 0, strongFailed: 0 }, tritan: { failed: 0, total: 0, strongFailed: 0 } }
  let reliable = true
  let correct = 0
  plan.forEach((p, i) => {
    const ok = answers[i] === p.digit
    if (ok) correct++
    if (p.kind === 'control' || p.kind === 'blank') {
      if (!ok) reliable = false
      return
    }
    const f = fails[p.kind]
    f.total++
    if (!ok) {
      f.failed++
      if (p.strength === 'strong') f.strongFailed++
    }
  })
  let likely: Axis | null = null
  let worst = 0
  for (const a of ['protan', 'deutan', 'tritan'] as const) {
    const rate = fails[a].total ? fails[a].failed / fails[a].total : 0
    if (rate >= 0.5 && rate > worst) {
      worst = rate
      likely = a
    }
  }
  const severity = likely ? (fails[likely].strongFailed > 0 ? 'strong' : 'mild') : null
  return { reliable, fails, likely, severity, correct, total: plan.length }
}
