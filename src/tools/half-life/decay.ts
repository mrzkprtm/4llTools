/** Radioactive decay: per-atom probabilities, the exponential law and isotope data. */

export interface Isotope {
  id: string
  name: string
  parent: string
  daughter: string
  /** Decay mode shown in the equation, e.g. "β⁻" or "α". */
  mode: string
  halfLife: number
  unit: string
}

export const ISOTOPES: Isotope[] = [
  { id: 'c14', name: 'Carbon-14', parent: 'C-14', daughter: 'N-14', mode: 'β⁻', halfLife: 5730, unit: 'years' },
  { id: 'i131', name: 'Iodine-131', parent: 'I-131', daughter: 'Xe-131', mode: 'β⁻', halfLife: 8.02, unit: 'days' },
  { id: 'u238', name: 'Uranium-238', parent: 'U-238', daughter: 'Th-234', mode: 'α', halfLife: 4.468e9, unit: 'years' },
  { id: 'rn222', name: 'Radon-222', parent: 'Rn-222', daughter: 'Po-218', mode: 'α', halfLife: 3.82, unit: 'days' },
  { id: 'custom', name: 'Custom isotope', parent: 'Parent', daughter: 'Daughter', mode: 'decay', halfLife: 4, unit: 's' },
]

/** Chance that one undecayed atom decays during a time step dt, for half-life T: 1 − 2^(−dt/T). */
export function decayProbability(dt: number, halfLife: number): number {
  if (dt <= 0) return 0
  if (halfLife <= 0) return 1
  return 1 - 2 ** (-dt / halfLife)
}

/** Expected number of atoms left after time t: N₀ · 2^(−t/T). */
export function theoretical(n0: number, t: number, halfLife: number): number {
  return n0 * 2 ** (-t / halfLife)
}

/** Decay constant λ = ln 2 / T. */
export const decayConstant = (halfLife: number) => Math.LN2 / halfLife

/**
 * Advances every undecayed atom (state 0) by one step with decay chance p.
 * Decayed atoms become 1. Returns the indices that decayed this step.
 */
export function stepDecay(state: Uint8Array, n: number, p: number, random: () => number = Math.random): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++)
    if (state[i] === 0 && random() < p) {
      state[i] = 1
      out.push(i)
    }
  return out
}

/** Grid layout for n atoms: as square as possible. */
export function gridFor(n: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)))
  return { cols, rows: Math.max(1, Math.ceil(n / cols)) }
}
