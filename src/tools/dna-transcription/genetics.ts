/** DNA → mRNA → protein with the standard genetic code. */

const BASES = 'UCAG'
/** NCBI translation table 1, codons ordered UUU, UUC, UUA, UUG, UCU … GGG. */
const TABLE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG'

export const THREE: Record<string, string> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', E: 'Glu', Q: 'Gln', G: 'Gly', H: 'His', I: 'Ile',
  L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val', '*': 'Stop',
}

/** Rough side-chain class, for colouring the amino-acid bubbles. */
export function aminoClass(one: string): 'nonpolar' | 'polar' | 'acidic' | 'basic' | 'stop' {
  if (one === '*') return 'stop'
  if ('DE'.includes(one)) return 'acidic'
  if ('KRH'.includes(one)) return 'basic'
  if ('STCYNQ'.includes(one)) return 'polar'
  return 'nonpolar'
}

/** Cleans typed input: upper case, spaces removed. `bad` lists characters that are not A, C, G or T. */
export function cleanDNA(raw: string): { seq: string; bad: string[] } {
  const s = raw.toUpperCase().replace(/[\s\d-]/g, '')
  const bad = [...new Set(s.replace(/[ACGT]/g, ''))]
  return { seq: s.replace(/[^ACGT]/g, ''), bad }
}

const PAIR: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' }
const RNA_PAIR: Record<string, string> = { A: 'U', T: 'A', C: 'G', G: 'C' }

/** The complementary DNA strand, base by base (A↔T, C↔G). */
export function complement(dna: string): string {
  return [...dna].map((b) => PAIR[b] ?? b).join('')
}

/** mRNA made on a template strand: each base paired, with U in place of T. */
export function transcribe(template: string): string {
  return [...template].map((b) => RNA_PAIR[b] ?? b).join('')
}

/** One-letter amino acid for an mRNA codon ('*' for stop). */
export function codonToAmino(codon: string): string {
  if (codon.length !== 3) return '?'
  const idx = [...codon].reduce((a, b) => a * 4 + BASES.indexOf(b), 0)
  return [...codon].every((b) => BASES.includes(b)) ? TABLE[idx] : '?'
}

export interface Translation {
  /** Index of the first base of the reading frame, or −1 when no start codon was found. */
  start: number
  codons: string[]
  /** One-letter codes, including a final '*' when a stop codon ends the chain. */
  aminos: string[]
  stopped: boolean
}

/** Reads codons from the first AUG (or from base 0) until a stop codon or the end of the mRNA. */
export function translate(mrna: string, fromStart = true): Translation {
  const start = fromStart ? mrna.indexOf('AUG') : 0
  const out: Translation = { start, codons: [], aminos: [], stopped: false }
  if (start < 0) return out
  for (let i = start; i + 3 <= mrna.length; i += 3) {
    const c = mrna.slice(i, i + 3)
    const a = codonToAmino(c)
    out.codons.push(c)
    out.aminos.push(a)
    if (a === '*') {
      out.stopped = true
      break
    }
  }
  return out
}

/** Protein as a one-letter string, without the stop. */
export const proteinString = (t: Translation) => t.aminos.filter((a) => a !== '*').join('')

export function gcContent(seq: string): number {
  if (!seq.length) return 0
  let gc = 0
  for (const b of seq) if (b === 'G' || b === 'C') gc++
  return gc / seq.length
}

/** A random coding strand: a few bases, ATG, some sense codons, a stop codon and a short tail. */
export function randomCoding(codons = 8, random: () => number = Math.random): string {
  const pick = (s: string) => s[Math.floor(random() * s.length)]
  const base = () => pick('ACGT')
  let s = pick('CGT') + base() + base() + 'ATG'
  for (let k = 0; k < codons; k++) {
    let c = ''
    do c = base() + base() + base()
    while (['TAA', 'TAG', 'TGA'].includes(c))
    s += c
  }
  const stops = ['TAA', 'TAG', 'TGA']
  return s + stops[Math.floor(random() * stops.length)] + base() + base()
}

/** Every codon in table order, for drawing the codon wheel/table. */
export const ALL_CODONS: string[] = [...BASES].flatMap((a) => [...BASES].flatMap((b) => [...BASES].map((c) => a + b + c)))
