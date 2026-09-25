/** Ball-and-stick models: element data (CPK colours, radii) and 3D coordinates in ångströms. */
import { add, distance, norm, scale, sub, tetraTriple, type Vec3 } from './geometry'

export type El = 'H' | 'C' | 'N' | 'O' | 'F' | 'P' | 'S' | 'Cl'

export const ELEMENTS: Record<El, { color: string; vdw: number; covalent: number; name: string }> = {
  H: { color: '#f1f3f5', vdw: 1.2, covalent: 0.31, name: 'hydrogen' },
  C: { color: '#505050', vdw: 1.7, covalent: 0.76, name: 'carbon' },
  N: { color: '#3050f8', vdw: 1.55, covalent: 0.71, name: 'nitrogen' },
  O: { color: '#ff0d0d', vdw: 1.52, covalent: 0.66, name: 'oxygen' },
  F: { color: '#90e050', vdw: 1.47, covalent: 0.57, name: 'fluorine' },
  P: { color: '#ff8000', vdw: 1.8, covalent: 1.07, name: 'phosphorus' },
  S: { color: '#e8d000', vdw: 1.8, covalent: 1.05, name: 'sulfur' },
  Cl: { color: '#1fd01f', vdw: 1.75, covalent: 1.02, name: 'chlorine' },
}

export interface Atom {
  el: El
  p: Vec3
}

export interface Molecule {
  id: string
  name: string
  formula: string
  geometry: string
  /** Atoms whose angle (at the middle one) is the characteristic bond angle. */
  angle: [number, number, number]
  atoms: Atom[]
  bonds: [number, number, number][]
}

const rad = (d: number) => (d * Math.PI) / 180
const at = (el: El, x: number, y: number, z: number): Atom => ({ el, p: [x, y, z] })

/** Bonds by distance (covalent radii + 25%), with explicit bond orders for multiple bonds. */
function bonded(atoms: Atom[], orders: [number, number, number][] = []): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) {
      const lim = (ELEMENTS[atoms[i].el].covalent + ELEMENTS[atoms[j].el].covalent) * 1.25
      if (distance(atoms[i].p, atoms[j].p) < lim) {
        const o = orders.find(([a, b]) => (a === i && b === j) || (a === j && b === i))
        out.push([i, j, o ? o[2] : 1])
      }
    }
  return out
}

/** Centres a list of atoms on their mean position. */
function centre(atoms: Atom[]): Atom[] {
  const c = scale(atoms.reduce<Vec3>((s, a) => add(s, a.p), [0, 0, 0]), 1 / atoms.length)
  return atoms.map((a) => ({ el: a.el, p: sub(a.p, c) }))
}

function water(): Atom[] {
  const h = rad(104.5 / 2)
  return [at('O', 0, 0, 0), at('H', 0.9572 * Math.sin(h), -0.9572 * Math.cos(h), 0), at('H', -0.9572 * Math.sin(h), -0.9572 * Math.cos(h), 0)]
}

function ammonia(): Atom[] {
  // H–N–H of 106.7° puts each N–H bond at this angle from the threefold axis.
  const theta = Math.asin((2 / Math.sqrt(3)) * Math.sin(rad(106.7 / 2)))
  const out = [at('N', 0, 0, 0)]
  for (let k = 0; k < 3; k++) {
    const phi = (k * 2 * Math.PI) / 3
    out.push(at('H', 1.012 * Math.sin(theta) * Math.cos(phi), -1.012 * Math.cos(theta), 1.012 * Math.sin(theta) * Math.sin(phi)))
  }
  return out
}

function methane(): Atom[] {
  const d = 1.09 / Math.sqrt(3)
  return [at('C', 0, 0, 0), at('H', d, d, d), at('H', -d, -d, d), at('H', -d, d, -d), at('H', d, -d, -d)]
}

function ethene(): Atom[] {
  const c = 1.339 / 2
  const a = rad(180 - 121.3)
  return [
    at('C', -c, 0, 0),
    at('C', c, 0, 0),
    at('H', -c - 1.087 * Math.cos(a), 1.087 * Math.sin(a), 0),
    at('H', -c - 1.087 * Math.cos(a), -1.087 * Math.sin(a), 0),
    at('H', c + 1.087 * Math.cos(a), 1.087 * Math.sin(a), 0),
    at('H', c + 1.087 * Math.cos(a), -1.087 * Math.sin(a), 0),
  ]
}

function benzene(): Atom[] {
  const out: Atom[] = []
  for (let k = 0; k < 6; k++) out.push(at('C', 1.39 * Math.cos((k * Math.PI) / 3), 1.39 * Math.sin((k * Math.PI) / 3), 0))
  for (let k = 0; k < 6; k++) out.push(at('H', 2.48 * Math.cos((k * Math.PI) / 3), 2.48 * Math.sin((k * Math.PI) / 3), 0))
  return out
}

function ethanol(): Atom[] {
  return [
    at('C', 1.1879, -0.3829, 0),
    at('C', 0, 0.5526, 0),
    at('O', -1.1867, -0.2472, 0),
    at('H', -1.9237, 0.385, 0),
    at('H', 0.0227, 1.1812, 0.8852),
    at('H', 0.0227, 1.1812, -0.8852),
    at('H', 2.1302, 0.1658, 0),
    at('H', 1.1486, -1.017, 0.8818),
    at('H', 1.1486, -1.017, -0.8818),
  ]
}

function sf6(): Atom[] {
  const d = 1.564
  return [at('S', 0, 0, 0), at('F', d, 0, 0), at('F', -d, 0, 0), at('F', 0, d, 0), at('F', 0, -d, 0), at('F', 0, 0, d), at('F', 0, 0, -d)]
}

function pcl5(): Atom[] {
  const out = [at('P', 0, 0, 0), at('Cl', 0, 2.14, 0), at('Cl', 0, -2.14, 0)]
  for (let k = 0; k < 3; k++) out.push(at('Cl', 2.02 * Math.cos((k * 2 * Math.PI) / 3), 0, 2.02 * Math.sin((k * 2 * Math.PI) / 3)))
  return out
}

/** β-D-glucopyranose in the chair form: every OH (and the CH₂OH) equatorial. */
function glucose(): Atom[] {
  const R = 1.45
  const h = 0.25
  // Ring order O5, C1, C2, C3, C4, C5.
  const ring: Vec3[] = []
  for (let k = 0; k < 6; k++) ring.push([R * Math.cos((k * Math.PI) / 3), R * Math.sin((k * Math.PI) / 3), k % 2 ? -h : h])
  const out: Atom[] = ring.map((p, k) => ({ el: k === 0 ? 'O' : 'C', p }))
  const axial = (k: number): Vec3 => [0, 0, k % 2 ? -1 : 1]
  const equatorial = (k: number): Vec3 => norm(add(scale(norm([ring[k][0], ring[k][1], 0]), 0.94), scale(axial(k), -0.33)))
  for (let k = 1; k <= 5; k++) {
    out.push(at('H', ...add(ring[k], scale(axial(k), 1.09))))
    const e = equatorial(k)
    if (k < 5) {
      const o = add(ring[k], scale(e, 1.43))
      out.push({ el: 'O', p: o })
      out.push({ el: 'H', p: add(o, scale(norm(add(e, scale(axial(k), 0.9))), 0.96)) })
    } else {
      // C6 (CH₂OH) with its oxygen and two hydrogens.
      const c6 = add(ring[5], scale(e, 1.52))
      out.push({ el: 'C', p: c6 })
      const back = norm(sub(ring[5], c6))
      const [d1, d2, d3] = tetraTriple(back, 0.4)
      const o6 = add(c6, scale(d1, 1.43))
      out.push({ el: 'O', p: o6 })
      out.push({ el: 'H', p: add(c6, scale(d2, 1.09)) })
      out.push({ el: 'H', p: add(c6, scale(d3, 1.09)) })
      out.push({ el: 'H', p: add(o6, scale(tetraTriple(norm(sub(c6, o6)), 1)[0], 0.96)) })
    }
  }
  return out
}

/** Caffeine: a flat purine (hexagon fused to a pentagon) with two C=O and three methyl groups. */
function caffeine(): Atom[] {
  const s = 1.39
  const hex = (deg: number): Vec3 => [s * Math.cos(rad(deg)), s * Math.sin(rad(deg)), 0]
  const pc: Vec3 = [s * Math.cos(rad(30)) + s / (2 * Math.tan(rad(36))), 0, 0]
  const R5 = s / (2 * Math.sin(rad(36)))
  const pent = (deg: number): Vec3 => [pc[0] + R5 * Math.cos(rad(deg)), R5 * Math.sin(rad(deg)), 0]
  const N1 = hex(150)
  const C2 = hex(210)
  const N3 = hex(270)
  const C4 = hex(330)
  const C5 = hex(30)
  const C6 = hex(90)
  const N7 = pent(72)
  const C8 = pent(0)
  const N9 = pent(-72)
  const out: Atom[] = [
    { el: 'N', p: N1 },
    { el: 'C', p: C2 },
    { el: 'N', p: N3 },
    { el: 'C', p: C4 },
    { el: 'C', p: C5 },
    { el: 'C', p: C6 },
    { el: 'N', p: N7 },
    { el: 'C', p: C8 },
    { el: 'N', p: N9 },
    { el: 'O', p: scale(norm(C2), s + 1.23) },
    { el: 'O', p: scale(norm(C6), s + 1.23) },
    { el: 'H', p: add(C8, [1.08, 0, 0]) },
  ]
  const methyl = (n: Vec3, dir: Vec3) => {
    const c = add(n, scale(dir, 1.47))
    out.push({ el: 'C', p: c })
    for (const d of tetraTriple(scale(dir, -1), 0.5)) out.push({ el: 'H', p: add(c, scale(d, 1.09)) })
  }
  methyl(N1, norm(N1))
  methyl(N3, norm(N3))
  methyl(N7, norm(sub(N7, pc)))
  return out
}

function build(id: string, name: string, formula: string, geometry: string, angle: [number, number, number], atoms: Atom[], orders: [number, number, number][] = []): Molecule {
  return { id, name, formula, geometry, angle, atoms: centre(atoms), bonds: bonded(atoms, orders) }
}

export const MOLECULES: Molecule[] = [
  build('h2o', 'Water', 'H₂O', 'bent (AX₂E₂)', [1, 0, 2], water()),
  build('co2', 'Carbon dioxide', 'CO₂', 'linear (AX₂)', [1, 0, 2], [at('C', 0, 0, 0), at('O', 1.16, 0, 0), at('O', -1.16, 0, 0)], [[0, 1, 2], [0, 2, 2]]),
  build('nh3', 'Ammonia', 'NH₃', 'trigonal pyramidal (AX₃E)', [1, 0, 2], ammonia()),
  build('ch4', 'Methane', 'CH₄', 'tetrahedral (AX₄)', [1, 0, 2], methane()),
  build('c2h4', 'Ethene', 'C₂H₄', 'trigonal planar (AX₃)', [2, 0, 3], ethene(), [[0, 1, 2]]),
  build('c2h2', 'Ethyne', 'C₂H₂', 'linear (AX₂)', [2, 0, 1], [at('C', -0.6, 0, 0), at('C', 0.6, 0, 0), at('H', -1.66, 0, 0), at('H', 1.66, 0, 0)], [[0, 1, 3]]),
  build('c6h6', 'Benzene', 'C₆H₆', 'trigonal planar ring (AX₃)', [0, 1, 2], benzene(), [[0, 1, 2], [2, 3, 2], [4, 5, 2]]),
  build('ethanol', 'Ethanol', 'C₂H₅OH', 'tetrahedral C, bent O', [0, 1, 2], ethanol()),
  build('sf6', 'Sulfur hexafluoride', 'SF₆', 'octahedral (AX₆)', [1, 0, 3], sf6()),
  build('pcl5', 'Phosphorus pentachloride', 'PCl₅', 'trigonal bipyramidal (AX₅)', [3, 0, 4], pcl5()),
  build('glucose', 'Glucose (ring, chair)', 'C₆H₁₂O₆', 'chair ring, tetrahedral C', [0, 1, 2], glucose()),
  build('caffeine', 'Caffeine', 'C₈H₁₀N₄O₂', 'planar rings (AX₃)', [0, 1, 2], caffeine(), [[1, 9, 2], [5, 10, 2], [3, 4, 2], [7, 8, 2]]),
]

/** Hill-system formula (C, H, then alphabetical) with plain digits, e.g. "C6H12O6". */
export function hillFormula(atoms: Atom[]): string {
  const count = new Map<string, number>()
  for (const a of atoms) count.set(a.el, (count.get(a.el) ?? 0) + 1)
  const keys = [...count.keys()].sort()
  const order = count.has('C') ? ['C', ...(count.has('H') ? ['H'] : []), ...keys.filter((k) => k !== 'C' && k !== 'H')] : keys
  return order.map((k) => `${k}${count.get(k)! > 1 ? count.get(k) : ''}`).join('')
}

