import { describe, expect, it } from 'vitest'
import { csvCell, generateRows, generateRowsAsync, mulberry32, sqlValue, toCSV, toSQL, type Field } from './mock'

const fields: Field[] = [
  { id: 1, name: 'id', type: 'id' },
  { id: 2, name: 'uuid', type: 'uuid' },
  { id: 3, name: 'first', type: 'firstName' },
  { id: 4, name: 'last', type: 'lastName' },
  { id: 5, name: 'email', type: 'email' },
  { id: 6, name: 'age', type: 'integer', min: 18, max: 30 },
  { id: 7, name: 'born', type: 'date', from: '1990-01-01', to: '1990-12-31' },
  { id: 8, name: 'at', type: 'datetime' },
  { id: 9, name: 'ip', type: 'ipv4' },
  { id: 10, name: 'color', type: 'color' },
  { id: 11, name: 'plan', type: 'pick', list: 'free, pro ,team' },
]

describe('mock-data', () => {
  it('is deterministic for the same seed and differs for another seed', async () => {
    const a = generateRows(fields, 50, 'hello')
    expect(generateRows(fields, 50, 'hello')).toEqual(a)
    expect(generateRows(fields, 50, 'other')).not.toEqual(a)
    expect(await generateRowsAsync(fields, 50, 'hello')).toEqual(a)
    const r = mulberry32(1)
    for (let i = 0; i < 100; i++) {
      const x = r()
      expect(x >= 0 && x < 1).toBe(true)
    }
  })

  it('produces well-formed values', () => {
    const rows = generateRows(fields, 300, 'formats')
    rows.forEach((row, i) => {
      expect(row.id).toBe(i + 1)
      expect(row.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(row.email).toMatch(/^[a-z0-9._]+@[a-z.]+$/)
      expect(String(row.email)).toContain(String(row.first).toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''))
      expect(row.age as number).toBeGreaterThanOrEqual(18)
      expect(row.age as number).toBeLessThanOrEqual(30)
      expect(row.born).toMatch(/^1990-\d{2}-\d{2}$/)
      expect(row.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
      expect(String(row.ip).split('.').every((p) => Number(p) >= 0 && Number(p) <= 255)).toBe(true)
      expect(row.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(['free', 'pro', 'team']).toContain(row.plan)
    })
  })

  it('escapes CSV cells', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
    const f: Field[] = [{ id: 1, name: 'name', type: 'lastName' }]
    expect(toCSV(f, [{ name: "O'Brien, Jr." }])).toBe('name\r\n"O\'Brien, Jr."\r\n')
  })

  it('quotes SQL and batches inserts', () => {
    expect(sqlValue("O'Brien")).toBe("'O''Brien'")
    expect(sqlValue('a\\b', 'mysql')).toBe("'a\\\\b'")
    expect(sqlValue(3.5)).toBe('3.5')
    expect(sqlValue(true)).toBe('TRUE')
    const f: Field[] = [{ id: 1, name: 'id', type: 'id' }, { id: 2, name: 'user name', type: 'fullName' }]
    const rows = generateRows(f, 5, 's')
    const sql = toSQL('app.users', f, rows, 2)
    expect(sql.match(/INSERT INTO "app"\."users" \("id", "user name"\) VALUES/g)).toHaveLength(3)
    expect(sql.trim().endsWith(';')).toBe(true)
    expect(toSQL('t', f, rows, 500, 'mysql')).toContain('INSERT INTO `t` (`id`, `user name`)')
  })
})
