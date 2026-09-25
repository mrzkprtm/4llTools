import { describe, expect, it } from 'vitest'
import { byteLength, hashPassword, hashWithSalt, parseHash, verifyPassword } from './bcrypt'

describe('bcrypt', () => {
  it('matches a known OpenBSD test vector', async () => {
    const known = '$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW'
    expect(await hashWithSalt('U*U', '$2a$05$CCCCCCCCCCCCCCCCCCCCC.')).toBe(known)
    expect(await verifyPassword('U*U', known)).toBe(true)
    expect(await verifyPassword('U*V', known)).toBe(false)
  })

  it('hashes and verifies (with $2y$ too)', async () => {
    const sample = ['kopi', 'susu', 'gula'].join('-')
    const progress: number[] = []
    const h = await hashPassword(sample, 4, (p) => progress.push(p))
    expect(h).toMatch(/^\$2b\$04\$/)
    expect(await verifyPassword(sample, h)).toBe(true)
    expect(await verifyPassword(sample, h.replace('$2b$', '$2y$'))).toBe(true)
    expect(await verifyPassword('wrong', h)).toBe(false)
  })

  it('parses and validates hash parts', () => {
    const r = parseHash('$2y$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')
    expect(r).toEqual({ parts: { version: '2y', cost: 12, salt: 'R9h/cIPz0gi.URNNX3kh2O', hash: 'PST9/PgBkqquzi.Ss7KIUgO2t0jWMUW' } })
    expect('error' in parseHash('$2b$10$short')).toBe(true)
    expect('error' in parseHash('5f4dcc3b5aa765d61d8327deb882cf99')).toBe(true)
    expect('error' in parseHash('$2x$10$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true)
    expect('error' in parseHash('$2b$10$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWM!W')).toBe(true)
  })

  it('counts bytes for the 72-byte limit', () => {
    expect(byteLength('abc')).toBe(3)
    expect(byteLength('é')).toBe(2)
    expect(byteLength('😀')).toBe(4)
  })
})
