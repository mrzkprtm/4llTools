/** Mendelian crosses: gametes, Punnett squares, ratios and a chi-square test. */

export type Dominance = 'complete' | 'incomplete' | 'codominant'

/** Parses "Aa" or "AaBb" into genes of two alleles each. Returns null when the input is not a genotype. */
export function parseGenotype(input: string): string[][] | null {
  const s = input.replace(/\s/g, '')
  if (!/^([A-Za-z]{2}){1,2}$/.test(s)) return null
  const genes: string[][] = []
  for (let i = 0; i < s.length; i += 2) {
    const pair = [s[i], s[i + 1]]
    if (pair[0].toLowerCase() !== pair[1].toLowerCase()) return null
    genes.push(pair)
  }
  const letters = genes.map((g) => g[0].toLowerCase())
  return new Set(letters).size === letters.length ? genes : null
}

/** All gametes in Punnett order: one allele from each gene (2ⁿ of them, duplicates kept). */
export function gametes(genes: string[][]): string[] {
  let out = ['']
  for (const g of genes) out = out.flatMap((prefix) => g.map((allele) => prefix + allele))
  return out
}

/** Offspring genotype from two gametes, dominant allele written first in each gene: "aA" → "Aa". */
export function combine(g1: string, g2: string): string {
  let out = ''
  for (let i = 0; i < g1.length; i++) {
    const pair = [g1[i], g2[i]].sort((a, b) => (a === a.toUpperCase() ? 0 : 1) - (b === b.toUpperCase() ? 0 : 1))
    out += pair.join('')
  }
  return out
}

/** The full Punnett square: rows follow parent 2's gametes, columns parent 1's. */
export function punnett(p1: string[][], p2: string[][]): { cols: string[]; rows: string[]; cells: string[][] } {
  const cols = gametes(p1)
  const rows = gametes(p2)
  return { cols, rows, cells: rows.map((r) => cols.map((c) => combine(c, r))) }
}

export type GeneState = 'dom' | 'rec' | 'mid' | 'both'

/** How one gene shows up: homozygous dominant/recessive, or a heterozygote under the dominance rule. */
export function geneState(pair: string, dominance: Dominance): GeneState {
  const big = [...pair].filter((c) => c === c.toUpperCase()).length
  if (big === 2) return 'dom'
  if (big === 0) return 'rec'
  return dominance === 'complete' ? 'dom' : dominance === 'incomplete' ? 'mid' : 'both'
}

/** Phenotype key per gene, e.g. "dom|rec". */
export function phenotypeKey(genotype: string, dominance: Dominance[]): string {
  const out: string[] = []
  for (let i = 0; i < genotype.length; i += 2) out.push(geneState(genotype.slice(i, i + 2), dominance[i / 2] ?? 'complete'))
  return out.join('|')
}

/** Counts of each value, in first-seen order. */
export function tally(values: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1)
  return m
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** Counts reduced to the simplest whole-number ratio, e.g. [12, 4] → [3, 1]. */
export function simplestRatio(counts: number[]): number[] {
  const g = counts.reduce((a, b) => gcd(a, b), 0) || 1
  return counts.map((c) => c / g)
}

/** Pearson's chi-square statistic over classes with non-zero expectation. */
export function chiSquare(observed: number[], expected: number[]): number {
  let x = 0
  for (let i = 0; i < observed.length; i++) if (expected[i] > 0) x += (observed[i] - expected[i]) ** 2 / expected[i]
  return x
}

function gammaln(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5)
  let ser = 1.000000000190015
  for (const k of c) ser += k / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

/** Regularised upper incomplete gamma Q(a, x). */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1
  if (x < a + 1) {
    let sum = 1 / a
    let term = sum
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - gammaln(a))
  }
  let b = x + 1 - a
  let c = 1e300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-14) break
  }
  return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h
}

/** p-value of a chi-square statistic with df degrees of freedom. */
export function chiSquareP(x: number, df: number): number {
  if (df <= 0) return 1
  return Math.min(1, Math.max(0, gammaQ(df / 2, x / 2)))
}
