/** Small 3D vector and matrix helpers for the molecule viewer. */

export type Vec3 = [number, number, number]
/** Row-major 3×3 matrix. */
export type Mat3 = [number, number, number, number, number, number, number, number, number]

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const distance = (a: Vec3, b: Vec3) => len(sub(a, b))

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

export function mul(a: Mat3, b: Mat3): Mat3 {
  const out = new Array(9).fill(0) as Mat3
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]
  return out
}

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
}

/** Rotation by angle (radians) about a unit axis, by Rodrigues' formula. */
export function rotation(axis: Vec3, angle: number): Mat3 {
  const [x, y, z] = norm(axis)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c]
}

/** Re-orthonormalises a rotation matrix (Gram–Schmidt on the rows) so drift never skews the model. */
export function orthonormalize(m: Mat3): Mat3 {
  const a = norm([m[0], m[1], m[2]])
  let b: Vec3 = [m[3], m[4], m[5]]
  b = norm(sub(b, scale(a, dot(a, b))))
  const c = cross(a, b)
  return [...a, ...b, ...c] as Mat3
}

/** Angle ABC at vertex B, in degrees. */
export function angleAt(a: Vec3, b: Vec3, c: Vec3): number {
  const u = norm(sub(a, b))
  const v = norm(sub(c, b))
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI
}

/** Perspective projection: camera on the +z axis at `camera` units, looking at the origin. */
export function project(p: Vec3, camera: number, pixels: number, cx: number, cy: number): { x: number; y: number; z: number; s: number } {
  const s = (camera / Math.max(0.5, camera - p[2])) * pixels
  return { x: cx + p[0] * s, y: cy - p[1] * s, z: p[2], s }
}

/** Two unit directions that complete a tetrahedron around a centre that already has bonds u and v. */
export function tetraPair(u: Vec3, v: Vec3): [Vec3, Vec3] {
  const m = scale(add(norm(u), norm(v)), -0.5)
  const n = norm(cross(u, v))
  const k = Math.sqrt(Math.max(0, 1 - dot(m, m)))
  return [add(m, scale(n, k)), sub(m, scale(n, k))]
}

/** Three unit directions that complete a tetrahedron around a centre bonded along u (like a CH₃). */
export function tetraTriple(u: Vec3, twist = 0): Vec3[] {
  const a = norm(u)
  const p = norm(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]))
  const q = cross(a, p)
  const out: Vec3[] = []
  for (let k = 0; k < 3; k++) {
    const phi = twist + (k * 2 * Math.PI) / 3
    out.push(add(scale(a, -1 / 3), scale(add(scale(p, Math.cos(phi)), scale(q, Math.sin(phi))), Math.sqrt(8 / 9))))
  }
  return out
}
