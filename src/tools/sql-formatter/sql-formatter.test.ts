import { describe, expect, it } from 'vitest'
import { format } from 'sql-formatter'
import { friendlyParseError, lintSql, scan } from './lint'

const rules = (sql: string) => lintSql(sql).map((f) => f.rule)

describe('scan', () => {
  it('masks strings and comments but keeps offsets', () => {
    const sql = "SELECT 'a;b' -- x;y\nFROM t /* ; */"
    const s = scan(sql)
    expect(s.masked).toHaveLength(sql.length)
    expect(s.masked).not.toContain(';')
    expect(s.strings[0].content).toBe('a;b')
    expect(s.comments.map((c) => c.kind)).toEqual(['line', 'block'])
  })

  it('handles doubled quotes and dollar quoting', () => {
    expect(scan("SELECT 'it''s'").unterminated).toBeUndefined()
    expect(scan('SELECT $$ it\'s $$').unterminated).toBeUndefined()
    expect(scan("SELECT 'oops FROM t").unterminated?.offset).toBe(7)
  })
})

describe('lint', () => {
  it('flags DELETE/UPDATE without WHERE but not with it', () => {
    expect(rules('DELETE FROM users')).toContain('delete-no-where')
    expect(rules('UPDATE users SET active = 0')).toContain('update-no-where')
    expect(rules('DELETE FROM users WHERE id = 1')).not.toContain('delete-no-where')
    expect(rules('UPDATE users SET note = NULL WHERE id = 2')).toEqual([])
  })

  it('flags SELECT *, NULL comparisons and leading wildcards', () => {
    const f = lintSql("SELECT * FROM t\nWHERE a = NULL AND b <> NULL AND name LIKE '%son'")
    expect(f.map((x) => x.rule)).toEqual(['select-star', 'null-compare', 'null-compare', 'leading-wildcard'])
    expect(f[1].line).toBe(2)
    expect(rules("SELECT a FROM t WHERE a IS NULL AND n LIKE 'son%'")).toEqual([])
  })

  it('flags unbalanced quotes and parentheses', () => {
    expect(rules("SELECT 'abc FROM t")).toContain('unbalanced-quote')
    expect(rules('SELECT (a + (b FROM t')).toContain('unbalanced-parens')
    expect(rules('SELECT a) FROM t')).toContain('unbalanced-parens')
  })

  it('flags injection-looking input', () => {
    expect(rules('SELECT id FROM users WHERE id = ${userId}')).toContain('injection')
    expect(rules(`"SELECT id FROM users WHERE name = '" + name + "'"`)).toContain('injection')
    expect(rules("SELECT id FROM users WHERE name = '' OR '1'='1'")).toContain('tautology')
    expect(rules('SELECT id FROM users WHERE id = 5 OR 1=1')).toContain('tautology')
    expect(rules("SELECT * FROM t WHERE id = 1; DROP TABLE users; --'")).toContain('stacked-comment')
    expect(rules('SELECT first_name || \' \' || last_name FROM people')).not.toContain('injection')
  })

  it('notices two statements without a semicolon, but not UNION or INSERT … SELECT', () => {
    expect(rules('SELECT a FROM t\nSELECT b FROM u')).toContain('missing-semicolon')
    expect(rules('SELECT a FROM t\nUNION ALL\nSELECT b FROM u')).not.toContain('missing-semicolon')
    expect(rules('INSERT INTO t (a)\nSELECT a FROM u')).not.toContain('missing-semicolon')
    expect(rules('WITH x AS (SELECT 1 AS a)\nSELECT a FROM x')).not.toContain('missing-semicolon')
  })
})

describe('formatter errors', () => {
  it('turns sql-formatter errors into a short message with a position', () => {
    let msg = ''
    try {
      format('SELECT a FROM b WHERE @@@', { language: 'mysql' })
    } catch (err) {
      msg = (err as Error).message
    }
    const f = friendlyParseError(msg)
    expect(f.line).toBe(1)
    expect(f.column).toBe(23)
    expect(f.message).toContain('@@@')
    expect(f.message).not.toContain('\n')
  })
})
