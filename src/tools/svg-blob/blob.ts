/** Blob geometry: seeded randomness, radial jitter points and a smooth closed path. */

export interface Pt {
  x: number
  y: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** A tiny mulberry32 generator: the same seed always yields the same sequence in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = (Math.floor(seed) >>> 0) || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Points evenly spaced around a circle, each pushed in or out by up to `jitter` × radius. */
export function blobPoints(count: number, radius: number, jitter: number, random: () => number): Pt[] {
  const n = Number.isFinite(count) ? Math.min(24, Math.max(3, Math.round(count))) : 8
  const r = Number.isFinite(radius) ? Math.max(1, radius) : 100
  const j = Number.isFinite(jitter) ? Math.min(1, Math.max(0, jitter)) : 0
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2
    const rr = r * (1 + (random() * 2 - 1) * j)
    out.push({ x: round2(Math.cos(angle) * rr), y: round2(Math.sin(angle) * rr) })
  }
  return out
}

/** A closed cubic-bezier `d` string through the points (Catmull-Rom, converted to beziers). */
export function smoothPath(points: Pt[]): string {
  const n = points.length
  if (n < 3) return ''
  const at = (i: number) => points[(i + n) % n]
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1x = round2(p1.x + (p2.x - p0.x) / 6)
    const c1y = round2(p1.y + (p2.y - p0.y) / 6)
    const c2x = round2(p2.x - (p3.x - p1.x) / 6)
    const c2y = round2(p2.y - (p3.y - p1.y) / 6)
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }
  return `${d} Z`
}
