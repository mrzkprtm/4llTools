/** K-means clustering with Lloyd's algorithm. */

export interface Pt {
  x: number
  y: number
}

const d2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

/** Gaussian blobs: `k` random centres inside the box, `n` points shared between them. */
export function blobs(n: number, k: number, spread: number, random: () => number, box: { x: number; y: number; w: number; h: number }): Pt[] {
  const gauss = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
  const pad = Math.min(spread * 1.5, box.w / 4, box.h / 4)
  const centres = Array.from({ length: k }, () => ({ x: box.x + pad + random() * (box.w - 2 * pad), y: box.y + pad + random() * (box.h - 2 * pad) }))
  return Array.from({ length: n }, (_, i) => {
    const c = centres[i % k]
    return {
      x: Math.min(box.x + box.w, Math.max(box.x, c.x + gauss() * spread)),
      y: Math.min(box.y + box.h, Math.max(box.y, c.y + gauss() * spread)),
    }
  })
}

/** Picks k starting centroids: k distinct random points, or k-means++ (spread out, chosen ∝ squared distance). */
export function initCentroids(points: readonly Pt[], k: number, method: 'random' | 'plusplus', random: () => number): Pt[] {
  const n = points.length
  if (!n) return []
  if (method === 'random') {
    const idx = Array.from({ length: n }, (_, i) => i)
    for (let i = 0; i < Math.min(k, n); i++) {
      const j = i + Math.floor(random() * (n - i))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return Array.from({ length: k }, (_, i) => ({ ...points[idx[i % n]] }))
  }
  const out: Pt[] = [{ ...points[Math.floor(random() * n)] }]
  const best = points.map((p) => d2(p, out[0]))
  while (out.length < k) {
    const total = best.reduce((s, v) => s + v, 0)
    let r = random() * total
    let pick = n - 1
    for (let i = 0; i < n; i++) {
      r -= best[i]
      if (r <= 0) {
        pick = i
        break
      }
    }
    if (total === 0) pick = Math.floor(random() * n)
    out.push({ ...points[pick] })
    for (let i = 0; i < n; i++) best[i] = Math.min(best[i], d2(points[i], out[out.length - 1]))
  }
  return out
}

/** Assigns every point to its nearest centroid; returns how many labels changed. */
export function assign(points: readonly Pt[], centroids: readonly Pt[], labels: Int32Array): number {
  let changed = 0
  if (!centroids.length) return 0
  for (let i = 0; i < points.length; i++) {
    let best = 0
    let bd = Infinity
    for (let j = 0; j < centroids.length; j++) {
      const d = d2(points[i], centroids[j])
      if (d < bd) {
        bd = d
        best = j
      }
    }
    if (labels[i] !== best) {
      labels[i] = best
      changed++
    }
  }
  return changed
}

/** Moves each centroid to the mean of its points (an empty cluster stays where it was). */
export function updateCentroids(points: readonly Pt[], labels: Int32Array, old: readonly Pt[]): Pt[] {
  const k = old.length
  const sx = new Float64Array(k)
  const sy = new Float64Array(k)
  const cnt = new Float64Array(k)
  for (let i = 0; i < points.length; i++) {
    const l = labels[i]
    if (l < 0) continue
    sx[l] += points[i].x
    sy[l] += points[i].y
    cnt[l]++
  }
  return old.map((c, j) => (cnt[j] ? { x: sx[j] / cnt[j], y: sy[j] / cnt[j] } : { ...c }))
}

/** Sum of squared distances from each point to its centroid. */
export function inertia(points: readonly Pt[], centroids: readonly Pt[], labels: Int32Array): number {
  let s = 0
  for (let i = 0; i < points.length; i++) if (labels[i] >= 0 && centroids[labels[i]]) s += d2(points[i], centroids[labels[i]])
  return s
}

export interface LloydStep {
  phase: 'assign' | 'update' | 'done'
  iter: number
  centroids: Pt[]
  /** Centroids before an update step (for animating the move). */
  previous?: Pt[]
  labels: Int32Array
  changed: number
  inertia: number
}

/** Lloyd's algorithm one half-step at a time: assign points, move centroids, repeat until nothing changes. */
export function* lloyd(points: readonly Pt[], start: readonly Pt[], labels = new Int32Array(points.length).fill(-1), maxIter = 300): Generator<LloydStep> {
  let c = start.map((p) => ({ ...p }))
  for (let iter = 1; iter <= maxIter; iter++) {
    const changed = assign(points, c, labels)
    if (changed === 0 && iter > 1) break
    yield { phase: 'assign', iter, centroids: c, labels, changed, inertia: inertia(points, c, labels) }
    const prev = c
    c = updateCentroids(points, labels, c)
    yield { phase: 'update', iter, centroids: c, previous: prev, labels, changed, inertia: inertia(points, c, labels) }
  }
  yield { phase: 'done', iter: 0, centroids: c, labels, changed: 0, inertia: inertia(points, c, labels) }
}

/** Runs k-means to convergence. */
export function kmeans(points: readonly Pt[], k: number, init: 'random' | 'plusplus', random: () => number) {
  const labels = new Int32Array(points.length).fill(-1)
  let last: LloydStep | undefined
  let iterations = 0
  for (const s of lloyd(points, initCentroids(points, k, init, random), labels)) {
    last = s
    if (s.phase === 'update') iterations = s.iter
  }
  return { centroids: last?.centroids ?? [], labels, inertia: last?.inertia ?? 0, iterations }
}

/** Best inertia out of a few k-means++ runs for each k = 1…kmax, for an elbow plot. */
export function elbow(points: readonly Pt[], kmax: number, random: () => number, runs = 3): number[] {
  return Array.from({ length: kmax }, (_, i) => {
    let best = Infinity
    for (let r = 0; r < runs; r++) best = Math.min(best, kmeans(points, i + 1, 'plusplus', random).inertia)
    return points.length ? best : 0
  })
}
