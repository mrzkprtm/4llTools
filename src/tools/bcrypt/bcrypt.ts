import bcrypt from 'bcryptjs'

export const MIN_COST = 4
export const MAX_COST = 15
export const SLOW_COST = 12
export const MAX_BYTES = 72

export interface HashParts {
  version: string
  cost: number
  salt: string
  hash: string
}

const BCRYPT_RE = /^\$(2[abxy]?)\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/

/** Splits a bcrypt hash into its parts, or returns an error message explaining what is wrong. */
export function parseHash(input: string): { parts: HashParts } | { error: string } {
  const h = input.trim()
  if (!h) return { error: 'Paste a bcrypt hash.' }
  if (!h.startsWith('$2')) return { error: 'A bcrypt hash starts with $2a$, $2b$ or $2y$.' }
  if (h.length !== 60) return { error: `A bcrypt hash is exactly 60 characters; this one is ${h.length}.` }
  const m = h.match(BCRYPT_RE)
  if (!m) return { error: 'The hash has the right length but invalid characters or structure ($2b$10$ + 53 characters of ./A-Za-z0-9).' }
  const version = m[1]
  if (version !== '2a' && version !== '2b' && version !== '2y') return { error: `Version $${version}$ is not supported (use $2a$, $2b$ or $2y$).` }
  const cost = Number(m[2])
  if (cost < 4 || cost > 31) return { error: `Cost ${cost} is out of range (4–31).` }
  return { parts: { version, cost, salt: m[3], hash: m[4] } }
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function hashPassword(password: string, cost: number, onProgress?: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    bcrypt.hash(
      password,
      cost,
      (err, res) => (err || !res ? reject(err ?? new Error('Hashing failed')) : resolve(res)),
      (p) => onProgress?.(p),
    )
  })
}

export function hashWithSalt(password: string, salt: string): Promise<string> {
  return bcrypt.hash(password, salt)
}

export function verifyPassword(password: string, hash: string, onProgress?: (p: number) => void): Promise<boolean> {
  return new Promise((resolve, reject) => {
    bcrypt.compare(
      password,
      hash.trim(),
      (err, res) => (err ? reject(err) : resolve(Boolean(res))),
      (p) => onProgress?.(p),
    )
  })
}
