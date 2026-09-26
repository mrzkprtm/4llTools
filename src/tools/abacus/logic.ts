/** One rod of a soroban: the heaven bead (worth 5) and how many of the 4 earth beads (worth 1) touch the beam. */
export interface Rod {
  heaven: boolean
  earth: number
}

export const digitToRod = (d: number): Rod => ({ heaven: d >= 5, earth: d % 5 })
export const rodToDigit = (r: Rod) => (r.heaven ? 5 : 0) + r.earth

/** Bead state for a value, most significant rod first. Values that don't fit are clamped to the largest. */
export function valueToBeads(value: number, rods: number): Rod[] {
  const max = 10 ** rods - 1
  let v = Math.max(0, Math.min(max, Math.floor(value)))
  const out: Rod[] = []
  for (let i = 0; i < rods; i++) {
    out.unshift(digitToRod(v % 10))
    v = Math.floor(v / 10)
  }
  return out
}

export const beadsToValue = (rods: readonly Rod[]) => rods.reduce((v, r) => v * 10 + rodToDigit(r), 0)

const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands', 'millions', 'ten-millions', 'hundred-millions', 'billions', 'ten-billions', 'hundred-billions', 'trillions']
export const placeName = (p: number) => PLACES[p] ?? `10^${p}`

export type Rule = 'direct' | 'five' | 'ten'

export interface Step {
  /** Place value (0 = ones) of the digit being added. */
  place: number
  digit: number
  rule: Rule
  text: string
  before: number
  after: number
}

const beads = (n: number, word = 'earth bead') => `${n} ${word}${n === 1 ? '' : 's'}`

/** How to take k (1–9) away from digit c (c ≥ k) on one rod, in words. */
function subtractText(c: number, k: number): string {
  const ce = c % 5
  if (k < 5) {
    if (ce >= k) return `push ${beads(k)} down`
    return `lift the heaven bead and push ${beads(5 - k)} up (−${k} = −5 + ${5 - k})`
  }
  return k === 5 ? 'lift the heaven bead' : `lift the heaven bead and push ${beads(k - 5)} down`
}

/**
 * Soroban steps for a + b, adding b one digit at a time from the left, the
 * way it is taught: direct moves, the 5-complement (+4 = +5 − 1) and the
 * 10-complement (+7 = +10 − 3).
 */
export function additionSteps(a: number, b: number): Step[] {
  const steps: Step[] = []
  let v = a
  const digits = String(Math.floor(b)).split('').map(Number)
  digits.forEach((d, i) => {
    const place = digits.length - 1 - i
    if (!d) return
    const unit = 10 ** place
    const c = Math.floor(v / unit) % 10
    const where = placeName(place)
    let rule: Rule
    let text: string
    if (c + d <= 9) {
      const ce = c % 5
      if (d < 5 && ce + d <= 4) {
        rule = 'direct'
        text = `Add ${d} on the ${where} rod: push ${beads(d)} up.`
      } else if (d < 5) {
        rule = 'five'
        text = `Add ${d} on the ${where} rod using the 5-complement: ${d} = 5 − ${5 - d}. Bring the heaven bead down and push ${beads(5 - d)} away.`
      } else {
        rule = 'direct'
        text = `Add ${d} on the ${where} rod: bring the heaven bead down${d > 5 ? ` and push ${beads(d - 5)} up` : ''}.`
      }
    } else {
      rule = 'ten'
      const k = 10 - d
      const next = Math.floor(v / (unit * 10)) % 10
      text = `Add ${d} on the ${where} rod using the 10-complement: ${d} = 10 − ${k}. On the ${where} rod ${subtractText(c, k)}, then add 1 to the ${placeName(place + 1)} rod${next === 9 ? ' (it is 9, so it rolls over and carries again)' : ''}.`
    }
    const after = v + d * unit
    steps.push({ place, digit: d, rule, text, before: v, after })
    v = after
  })
  return steps
}
