export interface PasswordOptions {
  length: number
  lower: boolean
  upper: boolean
  digits: boolean
  symbols: boolean
  avoidAmbiguous: boolean
}

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
}
const AMBIGUOUS = /[Il1O0o]/g

/** Unbiased random integer in [0, max) using the Web Crypto API. */
function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % max
}

/** Returns a password with at least one character from every chosen set, or '' if none is chosen. */
export function generatePassword(opts: PasswordOptions): string {
  const sets = (Object.keys(SETS) as (keyof typeof SETS)[])
    .filter((k) => opts[k])
    .map((k) => (opts.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]))
  if (sets.length === 0 || opts.length < 1) return ''

  const all = sets.join('')
  const chars = sets.slice(0, opts.length).map((s) => s[randomInt(s.length)])
  while (chars.length < opts.length) chars.push(all[randomInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export function strengthBits(opts: PasswordOptions): number {
  const pool = (Object.keys(SETS) as (keyof typeof SETS)[])
    .filter((k) => opts[k])
    .reduce((n, k) => n + (opts.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]).length, 0)
  return pool ? Math.round(opts.length * Math.log2(pool)) : 0
}
