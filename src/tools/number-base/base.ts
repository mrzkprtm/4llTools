export const BASES = [
  { base: 2, name: 'Binary', prefix: '0b' },
  { base: 8, name: 'Octal', prefix: '0o' },
  { base: 10, name: 'Decimal', prefix: '' },
  { base: 16, name: 'Hexadecimal', prefix: '0x' },
] as const

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Parses a whole number in the given base using BigInt, so large values stay exact. */
export function parseInBase(input: string, base: number): bigint | null {
  let s = input.trim().toLowerCase().replace(/[_\s]/g, '')
  const negative = s.startsWith('-')
  if (negative) s = s.slice(1)
  s = s.replace(/^0[box]/, '')
  if (!s) return null
  let value = 0n
  for (const ch of s) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= base) return null
    value = value * BigInt(base) + BigInt(d)
  }
  return negative ? -value : value
}

export function formatInBase(value: bigint, base: number): string {
  return value.toString(base)
}
