import { describe, expect, it } from 'vitest'
import { rng } from '../sim/math'
import { decayProbability, stepDecay, theoretical } from './half-life/decay'
import { configString, element, isStable, shellCounts } from './atom-builder/atom'
import { angleAt, apply, mul, rotation, type Vec3 } from './molecule-viewer/geometry'
import { MOLECULES, hillFormula } from './molecule-viewer/molecules'
import { cleanDNA, codonToAmino, complement, gcContent, proteinString, randomCoding, transcribe, translate } from './dna-transcription/genetics'
import { chiSquare, chiSquareP, gametes, parseGenotype, phenotypeKey, punnett, simplestRatio, tally } from './punnett-square/mendel'
import { FIRE, ASH, TREE, crossingProbability, igniteChance, makeGrid, percolates, randomForest, stepForest } from './forest-fire/forest'
import { SOLAR, emissivityFromCO2, equilibriumTemp, outgoing, stepClimate, absorbedSolar } from './greenhouse-effect/climate'
import { PRESETS, laplacian, seedField, stepGrayScott } from './reaction-diffusion/grayscott'
import { barriers, collisionEnergy, equilibriumK, predictedK, reacts } from './reaction-equilibrium/equilibrium'
import { concentration, fitsPore, passesMembrane, poreCentres, waterActivity } from './diffusion-membrane/membrane'

describe('half-life', () => {
  it('gives a 50% decay chance over one half-life, compounding over steps', () => {
    expect(decayProbability(5730, 5730)).toBeCloseTo(0.5, 12)
    expect(decayProbability(0, 10)).toBe(0)
    // Ten steps of a tenth of a half-life leave the same survival as one full step.
    const p = decayProbability(0.1, 1)
    expect((1 - p) ** 10).toBeCloseTo(0.5, 12)
  })

  it('follows N0 · 2^(−t/T) and the random process matches it', () => {
    expect(theoretical(1000, 0, 8)).toBe(1000)
    expect(theoretical(1000, 16, 8)).toBeCloseTo(250, 10)
    const n = 20000
    const state = new Uint8Array(n)
    const random = rng(7)
    for (let i = 0; i < 20; i++) stepDecay(state, n, decayProbability(0.1, 1), random)
    const left = state.reduce((a, v) => a + (v === 0 ? 1 : 0), 0)
    expect(Math.abs(left - theoretical(n, 2, 1))).toBeLessThan(200)
  })
})

describe('diffusion-membrane', () => {
  it('lets particles through only when they fit and line up with a pore', () => {
    const centres = poreCentres(4, 0, 400)
    expect(centres).toEqual([50, 150, 250, 350])
    expect(fitsPore(5, 10)).toBe(true)
    expect(fitsPore(12, 10)).toBe(false)
    expect(passesMembrane(5, 152, 10, centres)).toBe(true)
    expect(passesMembrane(5, 100, 10, centres)).toBe(false)
    expect(passesMembrane(12, 150, 10, centres)).toBe(false)
    expect(passesMembrane(12, 150, 16, centres)).toBe(true)
  })

  it('computes concentrations and water activity', () => {
    expect(concentration(30, 10)).toBe(3)
    expect(concentration(5, 0)).toBe(0)
    expect(waterActivity(100, 0)).toBe(1)
    expect(waterActivity(100, 25, 4)).toBe(0.5)
  })
})

describe('reaction-equilibrium', () => {
  it('only counts the head-on part of a collision against the barrier', () => {
    // Head-on: closing speed 2 along the normal, reduced mass ½ → energy ½·½·4 = 1.
    expect(collisionEnergy(1, 1, 1, 0, -1, 0, 1, 0)).toBeCloseTo(1, 12)
    // Glancing: motion perpendicular to the line of centres carries no reactive energy.
    expect(collisionEnergy(1, 1, 0, 5, 0, -5, 1, 0)).toBe(0)
    // Moving apart never reacts.
    expect(collisionEnergy(1, 1, -1, 0, 1, 0, 1, 0)).toBe(0)
    expect(reacts(1, 1)).toBe(true)
    expect(reacts(0.99, 1)).toBe(false)
    expect(barriers(5, -3)).toEqual({ forward: 5, reverse: 8 })
    expect(barriers(2, 4)).toEqual({ forward: 4, reverse: 0 })
  })

  it('computes K from concentrations and from detailed balance', () => {
    expect(equilibriumK(20, 20, 40, 40)).toBe(4)
    expect(equilibriumK(0, 10, 5, 5)).toBe(Infinity)
    expect(predictedK(0, 300)).toBe(1)
    expect(predictedK(-3, 300)).toBeGreaterThan(1)
    expect(predictedK(-3, 600)).toBeLessThan(predictedK(-3, 300))
  })
})

describe('atom-builder', () => {
  it('writes electron configurations in aufbau order', () => {
    expect(configString(26)).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d6')
    expect(configString(26, true)).toBe('[Ar] 4s2 3d6')
    expect(configString(8)).toBe('1s2 2s2 2p4')
    expect(configString(18, true)).toBe('[Ne] 3s2 3p6')
    // Chromium and copper promote a 4s electron.
    expect(configString(24, true)).toBe('[Ar] 4s1 3d5')
    expect(configString(29, true)).toBe('[Ar] 4s1 3d10')
    expect(configString(0)).toBe('—')
  })

  it('fills Bohr shells by principal quantum number', () => {
    expect(shellCounts(11)).toEqual([2, 8, 1])
    expect(shellCounts(20)).toEqual([2, 8, 8, 2])
    expect(shellCounts(26)).toEqual([2, 8, 14, 2])
    expect(shellCounts(36)).toEqual([2, 8, 18, 8])
  })

  it('looks up elements and stable isotopes', () => {
    expect(element(6)?.name).toBe('Carbon')
    expect(element(36)?.symbol).toBe('Kr')
    expect(element(0)).toBeNull()
    expect(isStable(6, 6)).toBe(true)
    expect(isStable(6, 8)).toBe(false)
    expect(isStable(26, 30)).toBe(true)
  })
})

describe('molecule-viewer', () => {
  it('builds proper rotation matrices', () => {
    const r = rotation([0, 0, 1], Math.PI / 2)
    const v = apply(r, [1, 0, 0])
    expect(v[0]).toBeCloseTo(0, 12)
    expect(v[1]).toBeCloseTo(1, 12)
    // Orthonormal: R·Rᵀ = I, and rotations compose.
    const q = rotation([1, 2, 3], 0.7)
    const qt = [q[0], q[3], q[6], q[1], q[4], q[7], q[2], q[5], q[8]] as typeof q
    mul(q, qt).forEach((x, i) => expect(x).toBeCloseTo(i % 4 === 0 ? 1 : 0, 12))
    const twice = mul(rotation([0, 1, 0], 0.3), rotation([0, 1, 0], 0.4))
    rotation([0, 1, 0], 0.7).forEach((x, i) => expect(twice[i]).toBeCloseTo(x, 12))
  })

  it('measures textbook bond angles from the models', () => {
    const mol = (id: string) => MOLECULES.find((m) => m.id === id)!
    const ref = (id: string) => {
      const m = mol(id)
      const [a, b, c] = m.angle.map((i) => m.atoms[i].p) as [Vec3, Vec3, Vec3]
      return angleAt(a, b, c)
    }
    expect(ref('h2o')).toBeCloseTo(104.5, 1)
    expect(ref('ch4')).toBeCloseTo(109.47, 1)
    expect(ref('nh3')).toBeCloseTo(106.7, 1)
    expect(ref('co2')).toBeCloseTo(180, 6)
    expect(ref('sf6')).toBeCloseTo(90, 6)
    expect(ref('c6h6')).toBeCloseTo(120, 6)
  })

  it('has the right atoms and bonds for the bigger molecules', () => {
    const mol = (id: string) => MOLECULES.find((m) => m.id === id)!
    expect(hillFormula(mol('glucose').atoms)).toBe('C6H12O6')
    expect(hillFormula(mol('caffeine').atoms)).toBe('C8H10N4O2')
    expect(hillFormula(mol('ethanol').atoms)).toBe('C2H6O')
    // Bonds = atoms − 1 + rings when nothing spurious is detected.
    expect(mol('glucose').bonds.length).toBe(24)
    expect(mol('caffeine').bonds.length).toBe(25)
    expect(mol('c6h6').bonds.filter((b) => b[2] === 2).length).toBe(3)
  })
})

describe('dna-transcription', () => {
  it('pairs bases for the complement and the mRNA', () => {
    expect(complement('ATGC')).toBe('TACG')
    expect(transcribe('TACG')).toBe('AUGC')
    expect(transcribe(complement('ATGGCC'))).toBe('AUGGCC')
    expect(cleanDNA('atg c-x1')).toEqual({ seq: 'ATGC', bad: ['X'] })
    expect(gcContent('GGCA')).toBe(0.75)
  })

  it('translates with the standard codon table until a stop codon', () => {
    expect(codonToAmino('AUG')).toBe('M')
    expect(codonToAmino('UGG')).toBe('W')
    expect(codonToAmino('UGA')).toBe('*')
    expect(codonToAmino('GGG')).toBe('G')
    const t = translate('GCAUGGCCAAGUUUGGACUGUGGCAUUAAGC')
    expect(t.start).toBe(2)
    expect(proteinString(t)).toBe('MAKFGLWH')
    expect(t.stopped).toBe(true)
  })

  it('respects the reading frame', () => {
    // From base 0 the frame is GCA UGG CCA …; from the first AUG it is AUG GCC AAG …
    expect(translate('GCAUGGCCAAG', false).aminos.join('')).toBe('AWP')
    expect(translate('GCAUGGCCAAG', true).aminos.join('')).toBe('MAK')
    expect(translate('CCCGGG', true).start).toBe(-1)
    const gene = translate(transcribe(complement(randomCoding(10, rng(3)))))
    expect(gene.aminos[0]).toBe('M')
    expect(gene.aminos.at(-1)).toBe('*')
    expect(gene.aminos.length).toBe(12)
  })
})

describe('punnett-square', () => {
  const ratio = (a: string, b: string, dom: ('complete' | 'incomplete' | 'codominant')[] = ['complete', 'complete']) => {
    const sq = punnett(parseGenotype(a)!, parseGenotype(b)!)
    const t = tally(sq.cells.flat().map((g) => phenotypeKey(g, dom)))
    return simplestRatio([...t.entries()].sort().map(([, n]) => n))
  }

  it('makes gametes with one allele per gene', () => {
    expect(gametes(parseGenotype('Aa')!)).toEqual(['A', 'a'])
    expect(gametes(parseGenotype('AaBb')!)).toEqual(['AB', 'Ab', 'aB', 'ab'])
    expect(gametes(parseGenotype('AABb')!)).toEqual(['AB', 'Ab', 'AB', 'Ab'])
    expect(parseGenotype('Ab')).toBeNull()
    expect(parseGenotype('AaAa')).toBeNull()
  })

  it('gives 3:1, 1:2:1 and 9:3:3:1', () => {
    expect(ratio('Aa', 'Aa')).toEqual([3, 1])
    expect(ratio('Aa', 'Aa', ['incomplete'])).toEqual([1, 2, 1])
    expect(ratio('Aa', 'aa')).toEqual([1, 1])
    // Sorted keys: dom|dom, dom|rec, rec|dom, rec|rec.
    expect(ratio('AaBb', 'AaBb')).toEqual([9, 3, 3, 1])
    const geno = tally(punnett(parseGenotype('Aa')!, parseGenotype('aA')!).cells.flat())
    expect(Object.fromEntries(geno)).toEqual({ AA: 1, Aa: 2, aa: 1 })
  })

  it('computes chi-square and its p-value', () => {
    expect(chiSquare([75, 25], [75, 25])).toBe(0)
    expect(chiSquare([60, 40], [75, 25])).toBeCloseTo(12, 10)
    expect(chiSquareP(3.841, 1)).toBeCloseTo(0.05, 3)
    expect(chiSquareP(7.815, 3)).toBeCloseTo(0.05, 3)
    expect(chiSquareP(0, 2)).toBe(1)
  })
})

describe('forest-fire', () => {
  const still = { grow: 0, lightning: 0, spread: 1, wind: 0, wx: 1, wy: 0, ashDecay: 0 }

  it('burning cells ignite every neighbouring tree when spread = 1', () => {
    const a = makeGrid(5, 5)
    const b = makeGrid(5, 5)
    a.cell.fill(TREE)
    a.cell[12] = FIRE
    a.fire[12] = 1
    let id = 2
    stepForest(a, b, still, () => id++, rng(1))
    expect(b.cell[12]).toBe(ASH)
    for (const i of [7, 11, 13, 17]) expect(b.cell[i]).toBe(FIRE)
    for (const i of [6, 8, 16, 18, 0]) expect(b.cell[i]).toBe(TREE)
    expect(igniteChance(1, 0, 0.3)).toBe(1)
    // Wind helps downwind and hinders upwind.
    expect(igniteChance(0.5, 1, 1)).toBe(1)
    expect(igniteChance(0.5, 1, -1)).toBe(0)
  })

  it('detects left-to-right percolation', () => {
    expect(percolates(new Uint8Array(12).fill(1), 4, 3)).toBe(true)
    expect(percolates(new Uint8Array(12), 4, 3)).toBe(false)
    // A full column of gaps blocks every path.
    const t = new Uint8Array(12).fill(1)
    for (let y = 0; y < 3; y++) t[y * 4 + 2] = 0
    expect(percolates(t, 4, 3)).toBe(false)
    expect(randomForest(50, 50, 1).every((v) => v === 1)).toBe(true)
    const r = rng(11)
    expect(crossingProbability(0.45, 20, 60, 40, r)).toBeLessThan(0.1)
    expect(crossingProbability(0.75, 20, 60, 40, r)).toBeGreaterThan(0.9)
  })
})

describe('greenhouse-effect', () => {
  it('gives the classic one-layer temperatures', () => {
    // No greenhouse layer: about 255 K. A perfectly absorbing layer: 2^¼ times warmer, about 303 K.
    expect(equilibriumTemp(SOLAR, 0.3, 0)).toBeCloseTo(254.6, 0)
    expect(equilibriumTemp(SOLAR, 0.3, 1)).toBeCloseTo(254.6 * 2 ** 0.25, 0)
    expect(equilibriumTemp(SOLAR, 0.3, 1, 2)).toBeCloseTo(254.6 * 3 ** 0.25, 0)
    // More reflective planets are colder.
    expect(equilibriumTemp(SOLAR, 0.5, 0.78)).toBeLessThan(equilibriumTemp(SOLAR, 0.3, 0.78))
  })

  it('warms with CO₂ by about 3 °C per doubling', () => {
    const t280 = equilibriumTemp(SOLAR, 0.3, emissivityFromCO2(280))
    const t560 = equilibriumTemp(SOLAR, 0.3, emissivityFromCO2(560))
    expect(t280 - 273.15).toBeCloseTo(14, 0)
    expect(t560 - t280).toBeGreaterThan(2.5)
    expect(t560 - t280).toBeLessThan(3.5)
  })

  it('relaxes to the equilibrium where heat out equals sunlight in', () => {
    const eps = emissivityFromCO2(420)
    let s = { ts: 280, ta: 240 }
    for (let k = 0; k < 400; k++) s = stepClimate(s, 0.5, SOLAR, 0.3, eps)
    expect(s.ts).toBeCloseTo(equilibriumTemp(SOLAR, 0.3, eps), 2)
    expect(outgoing(s, eps)).toBeCloseTo(absorbedSolar(SOLAR, 0.3), 1)
  })
})

describe('reaction-diffusion', () => {
  it('has a zero Laplacian on a constant field, including at the wrapped edges', () => {
    const f = new Float32Array(6 * 4).fill(0.7)
    for (const [x, y] of [[0, 0], [5, 3], [2, 1]]) expect(laplacian(f, 6, 4, x, y)).toBeCloseTo(0, 6)
    // A single spike spreads: negative at the spike, positive next to it.
    const g = new Float32Array(25)
    g[12] = 1
    expect(laplacian(g, 5, 5, 2, 2)).toBeCloseTo(-1, 6)
    expect(laplacian(g, 5, 5, 3, 2)).toBeCloseTo(0.2, 6)
    expect(laplacian(g, 5, 5, 3, 3)).toBeCloseTo(0.05, 6)
  })

  it('keeps concentrations in [0, 1] and leaves the uniform state alone', () => {
    const w = 40
    const h = 30
    const a = new Float32Array(w * h)
    const b = new Float32Array(w * h)
    const a2 = new Float32Array(w * h)
    const b2 = new Float32Array(w * h)
    seedField(a, b, w, h, 6, rng(5))
    const coral = PRESETS.find((p) => p.id === 'coral')!
    stepGrayScott(a, b, a2, b2, w, h, { Da: 1, Db: 0.5, F: coral.F, k: coral.k, dt: 1 })
    for (let i = 0; i < w * h; i++) {
      expect(a2[i]).toBeGreaterThanOrEqual(0)
      expect(a2[i]).toBeLessThanOrEqual(1)
      expect(b2[i]).toBeGreaterThanOrEqual(0)
      expect(b2[i]).toBeLessThanOrEqual(1)
    }
    a.fill(1)
    b.fill(0)
    stepGrayScott(a, b, a2, b2, w, h, { Da: 1, Db: 0.5, F: 0.05, k: 0.06, dt: 1 })
    expect(a2.every((v) => v === 1) && b2.every((v) => v === 0)).toBe(true)
  })
})
