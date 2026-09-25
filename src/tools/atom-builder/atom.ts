/** Element data for Z = 1–36, electron configurations and Bohr shells. */

export type Category = 'nonmetal' | 'noble gas' | 'alkali metal' | 'alkaline earth metal' | 'metalloid' | 'halogen' | 'transition metal' | 'post-transition metal'

export interface Element {
  z: number
  symbol: string
  name: string
  /** Standard atomic weight. */
  mass: number
  category: Category
  /** Neutron counts of the stable isotopes, most abundant first. */
  stable: number[]
}

const N: Category = 'nonmetal'
const G: Category = 'noble gas'
const AK: Category = 'alkali metal'
const AE: Category = 'alkaline earth metal'
const MD: Category = 'metalloid'
const HA: Category = 'halogen'
const TM: Category = 'transition metal'
const PT: Category = 'post-transition metal'

const DATA: [string, string, number, Category, number[]][] = [
  ['H', 'Hydrogen', 1.008, N, [0, 1]],
  ['He', 'Helium', 4.0026, G, [2, 1]],
  ['Li', 'Lithium', 6.94, AK, [4, 3]],
  ['Be', 'Beryllium', 9.0122, AE, [5]],
  ['B', 'Boron', 10.81, MD, [6, 5]],
  ['C', 'Carbon', 12.011, N, [6, 7]],
  ['N', 'Nitrogen', 14.007, N, [7, 8]],
  ['O', 'Oxygen', 15.999, N, [8, 10, 9]],
  ['F', 'Fluorine', 18.998, HA, [10]],
  ['Ne', 'Neon', 20.18, G, [10, 12, 11]],
  ['Na', 'Sodium', 22.99, AK, [12]],
  ['Mg', 'Magnesium', 24.305, AE, [12, 14, 13]],
  ['Al', 'Aluminium', 26.982, PT, [14]],
  ['Si', 'Silicon', 28.085, MD, [14, 15, 16]],
  ['P', 'Phosphorus', 30.974, N, [16]],
  ['S', 'Sulfur', 32.06, N, [16, 18, 17, 20]],
  ['Cl', 'Chlorine', 35.45, HA, [18, 20]],
  ['Ar', 'Argon', 39.948, G, [22, 18, 20]],
  ['K', 'Potassium', 39.098, AK, [20, 22]],
  ['Ca', 'Calcium', 40.078, AE, [20, 24, 22, 23, 26]],
  ['Sc', 'Scandium', 44.956, TM, [24]],
  ['Ti', 'Titanium', 47.867, TM, [26, 24, 25, 27, 28]],
  ['V', 'Vanadium', 50.942, TM, [28]],
  ['Cr', 'Chromium', 51.996, TM, [28, 29, 26, 30]],
  ['Mn', 'Manganese', 54.938, TM, [30]],
  ['Fe', 'Iron', 55.845, TM, [30, 28, 31, 32]],
  ['Co', 'Cobalt', 58.933, TM, [32]],
  ['Ni', 'Nickel', 58.693, TM, [30, 32, 34, 33, 36]],
  ['Cu', 'Copper', 63.546, TM, [34, 36]],
  ['Zn', 'Zinc', 65.38, TM, [34, 36, 38, 37, 40]],
  ['Ga', 'Gallium', 69.723, PT, [38, 40]],
  ['Ge', 'Germanium', 72.63, MD, [42, 40, 38, 41]],
  ['As', 'Arsenic', 74.922, MD, [42]],
  ['Se', 'Selenium', 78.971, N, [46, 44, 42, 40, 43]],
  ['Br', 'Bromine', 79.904, HA, [44, 46]],
  ['Kr', 'Krypton', 83.798, G, [48, 50, 46, 47, 44]],
]

export const ELEMENTS: Element[] = DATA.map(([symbol, name, mass, category, stable], i) => ({ z: i + 1, symbol, name, mass, category, stable }))

export function element(z: number): Element | null {
  return ELEMENTS[z - 1] ?? null
}

export function isStable(z: number, neutrons: number): boolean {
  return element(z)?.stable.includes(neutrons) ?? false
}

/** Subshells in Madelung (aufbau) order. */
export const AUFBAU = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p'] as const
const CAPACITY: Record<string, number> = { s: 2, p: 6, d: 10, f: 14 }
const NOBLE: [number, string][] = [
  [86, 'Rn'],
  [54, 'Xe'],
  [36, 'Kr'],
  [18, 'Ar'],
  [10, 'Ne'],
  [2, 'He'],
]

/**
 * Electron configuration for a number of electrons, filling subshells in aufbau order.
 * Chromium-like (24) and copper-like (29) counts promote one 4s electron to a half-full or full 3d.
 */
export function electronConfig(electrons: number): [string, number][] {
  const out: [string, number][] = []
  let left = Math.max(0, Math.floor(electrons))
  for (const sub of AUFBAU) {
    if (left <= 0) break
    const k = Math.min(left, CAPACITY[sub[1]])
    out.push([sub, k])
    left -= k
  }
  if (electrons === 24 || electrons === 29) {
    const s4 = out.find(([sub]) => sub === '4s')
    const d3 = out.find(([sub]) => sub === '3d')
    if (s4 && d3) {
      s4[1]--
      d3[1]++
    }
  }
  return out
}

/** "1s2 2s2 2p6 …", or with `short` the noble-gas core form "[Ar] 4s2 3d6". */
export function configString(electrons: number, short = false): string {
  const cfg = electronConfig(electrons)
  if (!cfg.length) return '—'
  if (short) {
    for (const [n, sym] of NOBLE) {
      if (electrons <= n) continue
      let count = 0
      let k = 0
      while (k < cfg.length && count < n) count += cfg[k++][1]
      if (count === n) return [`[${sym}]`, ...cfg.slice(k).map(([s, c]) => `${s}${c}`)].join(' ')
    }
  }
  return cfg.map(([s, c]) => `${s}${c}`).join(' ')
}

/** Electrons per Bohr shell (principal quantum number n = 1, 2, 3, …). */
export function shellCounts(electrons: number): number[] {
  const shells: number[] = []
  for (const [sub, c] of electronConfig(electrons)) {
    const n = Number(sub[0])
    while (shells.length < n) shells.push(0)
    shells[n - 1] += c
  }
  while (shells.length && shells[shells.length - 1] === 0) shells.pop()
  return shells
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
/** Replaces the electron counts in a configuration string with superscript digits. */
export function superscriptConfig(cfg: string): string {
  return cfg.replace(/([spdf])(\d+)/g, (_, l: string, d: string) => l + [...d].map((c) => SUP[Number(c)]).join(''))
}

export function chargeLabel(charge: number): string {
  if (charge === 0) return 'neutral atom'
  return charge > 0 ? `cation, charge +${charge}` : `anion, charge −${-charge}`
}
