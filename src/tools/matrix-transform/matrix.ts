/** A 2×2 matrix [[a, b], [c, d]] stored row by row as [a, b, c, d]. Its columns are the images of î and ĵ. */
export type Mat = [number, number, number, number]

export const IDENTITY: Mat = [1, 0, 0, 1]

export const det = (m: Mat) => m[0] * m[3] - m[1] * m[2]
export const trace = (m: Mat) => m[0] + m[3]

export function apply(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[1] * y, m[2] * x + m[3] * y]
}

/** Entry-wise interpolation (1 − t)·A + t·B. From the identity it shares B's eigenvectors at every t. */
export function lerpMatrix(a: Mat, b: Mat, t: number): Mat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]
}

export type Eigen =
  | { real: true; values: [number, number]; /** Unit eigenvectors (0–2 distinct directions). */ vectors: [number, number][]; /** Every direction is an eigenvector (a multiple of I). */ all: boolean }
  | { real: false; re: number; im: number }

/** Eigenvalues from the characteristic polynomial λ² − tr·λ + det = 0, plus real eigen-directions. */
export function eigen2x2(m: Mat, eps = 1e-9): Eigen {
  const T = trace(m)
  const D = det(m)
  const disc = (T * T) / 4 - D
  if (disc < -eps) return { real: false, re: T / 2, im: Math.sqrt(-disc) }
  const r = Math.sqrt(Math.max(0, disc))
  const values: [number, number] = [T / 2 + r, T / 2 - r]
  const vectors: [number, number][] = []
  let all = false
  for (const l of values) {
    // A null vector of (A − λI) is perpendicular to its larger row.
    const r1: [number, number] = [m[0] - l, m[1]]
    const r2: [number, number] = [m[2], m[3] - l]
    const row = Math.hypot(...r1) >= Math.hypot(...r2) ? r1 : r2
    const n = Math.hypot(row[0], row[1])
    if (n < 1e-7) {
      all = true
      continue
    }
    // Point eigenvectors right (or up) so arrows read naturally.
    const sgn = row[1] > 1e-12 || (Math.abs(row[1]) <= 1e-12 && row[0] < 0) ? -1 : 1
    const v: [number, number] = [(sgn * -row[1]) / n, (sgn * row[0]) / n]
    if (!vectors.some((u) => Math.abs(u[0] * v[1] - u[1] * v[0]) < 1e-6)) vectors.push(v)
  }
  if (all) return { real: true, values, vectors: [], all }
  return { real: true, values, vectors, all }
}

export const PRESETS: { id: string; name: string; m: Mat }[] = [
  { id: 'shear', name: 'Shear', m: [1, 1, 0, 1] },
  { id: 'rot', name: 'Rotation 45°', m: [Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2, Math.SQRT1_2] },
  { id: 'rot90', name: 'Rotation 90°', m: [0, -1, 1, 0] },
  { id: 'scale', name: 'Scale (2, 0.5)', m: [2, 0, 0, 0.5] },
  { id: 'stretch', name: 'Symmetric stretch', m: [1.5, 0.5, 0.5, 1.5] },
  { id: 'reflect', name: 'Reflection in y = x', m: [0, 1, 1, 0] },
  { id: 'flipx', name: 'Reflection in the y-axis', m: [-1, 0, 0, 1] },
  { id: 'project', name: 'Projection onto x-axis', m: [1, 0, 0, 0] },
  { id: 'singular', name: 'Singular (squash to a line)', m: [1, 2, 0.5, 1] },
  { id: 'spiral', name: 'Rotate and scale', m: [1.2, -0.8, 0.8, 1.2] },
  { id: 'identity', name: 'Identity', m: [1, 0, 0, 1] },
]
