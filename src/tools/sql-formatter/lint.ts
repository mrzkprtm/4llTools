/** A fast, heuristic SQL checker. It does not parse SQL; it scans text with quotes and comments masked out. */

export type Severity = 'error' | 'warning' | 'info'

export interface Finding {
  severity: Severity
  rule: string
  title: string
  detail: string
  line: number
}

interface StringLit {
  start: number
  end: number // index after the closing quote
  quote: string
  content: string
}

interface Comment {
  start: number
  end: number
  kind: 'line' | 'block'
}

export interface Scan {
  /** Same length as the input; string/comment contents replaced with spaces (quotes kept). */
  masked: string
  strings: StringLit[]
  comments: Comment[]
  unterminated?: { quote: string; offset: number }
}

export function scan(sql: string): Scan {
  const out = sql.split('')
  const strings: StringLit[] = []
  const comments: Comment[] = []
  let unterminated: Scan['unterminated']
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '
  }
  let i = 0
  const n = sql.length
  while (i < n) {
    const ch = sql[i]
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      const stop = end < 0 ? n : end
      comments.push({ start: i, end: stop, kind: 'line' })
      blank(i, stop)
      i = stop
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      const stop = end < 0 ? n : end + 2
      comments.push({ start: i, end: stop, kind: 'block' })
      blank(i, stop)
      i = stop
      continue
    }
    if (ch === '$') {
      const m = /^\$([A-Za-z_]\w*)?\$/.exec(sql.slice(i, i + 64))
      if (m) {
        const tag = m[0]
        const end = sql.indexOf(tag, i + tag.length)
        if (end < 0) {
          unterminated = { quote: tag, offset: i }
          blank(i + tag.length, n)
          break
        }
        strings.push({ start: i, end: end + tag.length, quote: tag, content: sql.slice(i + tag.length, end) })
        blank(i + tag.length, end)
        i = end + tag.length
        continue
      }
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      let closed = false
      while (j < n) {
        if (sql[j] === '\\' && ch === "'") {
          j += 2
          continue
        }
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2 // doubled quote escape
            continue
          }
          closed = true
          break
        }
        j++
      }
      if (!closed) {
        unterminated = { quote: ch, offset: i }
        blank(i + 1, n)
        break
      }
      strings.push({ start: i, end: j + 1, quote: ch, content: sql.slice(i + 1, j) })
      blank(i + 1, j)
      i = j + 1
      continue
    }
    i++
  }
  return { masked: out.join(''), strings, comments, unterminated }
}

export const lineOf = (text: string, offset: number) => {
  let line = 1
  for (let k = 0; k < offset && k < text.length; k++) if (text[k] === '\n') line++
  return line
}

const CONTINUATION = new Set([
  'UNION', 'ALL', 'INTERSECT', 'EXCEPT', 'MINUS', 'AS', 'DISTINCT', 'THEN', 'ELSE', 'BEGIN', 'FOR', 'KEY', 'DO', 'ON', 'OF', 'EXPLAIN',
  'GRANT', 'REVOKE', 'OR', 'AND', 'NOT', 'EXISTS', 'IN', 'WHEN', 'RETURN', 'RETURNS', 'QUERY', 'ANALYZE', 'INSTEAD', 'BEFORE', 'AFTER', 'EACH', 'ROW', 'ATOMIC',
])
const STATEMENT_START = /\n[ \t]*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|MERGE)\b/gi

export function lintSql(sql: string): Finding[] {
  const findings: Finding[] = []
  const add = (severity: Severity, rule: string, offset: number, title: string, detail: string) =>
    findings.push({ severity, rule, title, detail, line: lineOf(sql, offset) })
  if (!sql.trim()) return findings

  const s = scan(sql)
  const m = s.masked

  if (s.unterminated) {
    add('error', 'unbalanced-quote', s.unterminated.offset, `Unclosed ${s.unterminated.quote} quote`,
      'A string or quoted identifier is opened here but never closed, so everything after it is swallowed.')
  }

  // Parentheses
  const openStack: number[] = []
  for (let k = 0; k < m.length; k++) {
    if (m[k] === '(') openStack.push(k)
    else if (m[k] === ')') {
      if (!openStack.length) add('error', 'unbalanced-parens', k, 'Extra closing parenthesis', 'This ")" has no matching "(".')
      else openStack.pop()
    }
  }
  if (openStack.length) {
    add('error', 'unbalanced-parens', openStack[openStack.length - 1], `Unclosed parenthesis${openStack.length > 1 ? ` (${openStack.length})` : ''}`, 'This "(" is never closed.')
  }

  // Raw-text injection patterns (these look inside strings on purpose).
  for (const match of sql.matchAll(/\$\{[^}\n]*\}/g)) {
    add('error', 'injection', match.index!, 'Template interpolation in SQL', `${match[0]} pastes a value straight into the query. Use a bound parameter (?, $1, :name) instead.`)
  }
  for (const match of sql.matchAll(/(['"])\s*\+\s*[A-Za-z_$@][\w.$@]*(\([^()\n]*\))?(\s*\+\s*\1|\s*$)/gm)) {
    const hostCode = match[1] === '"' || /[$@]/.test(match[0])
    add(hostCode ? 'error' : 'warning', 'injection', match.index!, 'String concatenation builds the query', `"${match[0].trim()}" concatenates a variable into SQL text, which is the classic SQL injection pattern. Use parameters.`)
  }
  for (const match of sql.matchAll(/'\s*\|\|\s*[:@$][A-Za-z_]\w*|[:@$][A-Za-z_]\w*\s*\|\|\s*'/g)) {
    add('warning', 'injection', match.index!, 'Variable concatenated with ||', `"${match[0]}" glues a variable into the SQL text. If this is dynamic SQL, bind it as a parameter instead.`)
  }
  for (const str of s.strings) {
    if (/^%[sd]$/.test(str.content)) {
      add('warning', 'injection', str.start, 'Quoted placeholder', `${str.quote}${str.content}${str.quote} looks like string formatting. Let the database driver quote values: use an unquoted parameter.`)
    }
  }

  // Tautologies
  const tautologies = [/\bOR\s+(\d+)\s*=\s*\1(?!\d)/gi, /\bOR\s+'([^'\n]*)'\s*=\s*'\1'/gi, /\bOR\s+"([^"\n]*)"\s*=\s*"\1"/gi, /\bOR\s+(TRUE|1)\b(?!\s*[=<>!])/gi]
  for (const re of tautologies) {
    for (const match of sql.matchAll(re)) {
      add('error', 'tautology', match.index!, `Always-true condition "${match[0]}"`, 'An OR with a condition that is always true makes the WHERE clause match every row. This is a typical injection payload.')
    }
  }

  // Comments used to cut off the rest of a query
  for (const c of s.comments) {
    if (c.kind !== 'line') continue
    const before = sql.slice(0, c.start)
    const lineStart = before.lastIndexOf('\n') + 1
    const sameLine = before.slice(lineStart)
    const text = sql.slice(c.start, c.end)
    if (/;\s*(DROP|DELETE|INSERT|UPDATE|ALTER|TRUNCATE|EXEC|EXECUTE|SHUTDOWN|CREATE|GRANT|SELECT)\b[^;]*;?\s*$/i.test(sameLine)) {
      add('error', 'stacked-comment', c.start, 'Stacked statement followed by a comment', 'A second statement after ";" and then "--" to comment out the rest is how injected queries usually look.')
    } else if (/'\s*$/.test(sameLine) && /'/.test(text)) {
      add('warning', 'stacked-comment', c.start, 'Comment right after a string cuts the query', 'The "--" after a closing quote comments out the rest of the line, including another quote. Check that this is intended.')
    }
  }

  // Per statement checks
  let offset = 0
  for (const stmt of m.split(';')) {
    const start = offset
    offset += stmt.length + 1
    const trimmed = stmt.trim()
    if (!trimmed) continue
    const lead = stmt.length - stmt.trimStart().length
    const first = /^\w+/.exec(trimmed)?.[0].toUpperCase() ?? ''
    const upper = stmt.toUpperCase()
    const at = (k: number) => start + k

    if (first === 'DELETE' && !/\bWHERE\b/.test(upper)) {
      add('error', 'delete-no-where', at(lead), 'DELETE without WHERE', 'This removes every row in the table. Add a WHERE clause, or use TRUNCATE if that is really what you want.')
    }
    if (first === 'UPDATE' && /\bSET\b/.test(upper) && !/\bWHERE\b/.test(upper)) {
      add('error', 'update-no-where', at(lead), 'UPDATE without WHERE', 'This changes every row in the table. Add a WHERE clause to limit it.')
    }
    for (const match of upper.matchAll(/\bSELECT\s+(ALL\s+|DISTINCT\s+|TOP\s+\(?\d+\)?\s+)?\*/g)) {
      add('warning', 'select-star', at(match.index!), 'SELECT *', 'Selecting every column fetches more data than needed and breaks when columns change. List the columns you need.')
    }
    const whereAt = upper.search(/\bWHERE\b/)
    for (const match of upper.matchAll(/(!=|<>|=)\s*NULL\b/g)) {
      const isAssignment = match[1] === '=' && (first === 'UPDATE' || first === 'MERGE') && (whereAt < 0 || match.index! < whereAt)
      if (isAssignment) continue
      add('warning', 'null-compare', at(match.index!), `"${match[0].replace(/\s+/g, ' ')}" is never true`, `Comparing with NULL always gives NULL. Use IS ${match[1] === '=' ? '' : 'NOT '}NULL.`)
    }
    // Missing semicolon: a new statement keyword at the start of a line, outside parentheses.
    for (const match of stmt.matchAll(STATEMENT_START)) {
      const kw = match[1].toUpperCase()
      const pos = match.index! + 1
      if (pos <= lead) continue
      let depth = 0
      for (let k = 0; k < pos; k++) {
        if (stmt[k] === '(') depth++
        else if (stmt[k] === ')') depth--
      }
      if (depth !== 0) continue
      const prevTok = /(\S+)\s*$/.exec(stmt.slice(0, pos))?.[1].toUpperCase() ?? ''
      if (prevTok.endsWith(',') || prevTok.endsWith('(') || CONTINUATION.has(prevTok.replace(/\W+$/, ''))) continue
      if (kw === 'SELECT' && ['INSERT', 'CREATE', 'WITH', 'EXPLAIN', 'REPLACE'].includes(first)) continue
      if (['UPDATE', 'DELETE', 'INSERT', 'SELECT', 'MERGE'].includes(kw) && first === 'WITH') continue
      if (first === 'CREATE' && /\b(TRIGGER|FUNCTION|PROCEDURE|RULE)\b/.test(upper)) continue
      add('warning', 'missing-semicolon', at(pos), `Missing ";" before ${kw}`, 'Two statements run together without a semicolon. Most databases will reject this or read it as one broken statement.')
    }
    if (first === 'INSERT' && /^\s*INSERT\s+INTO\s+[\w."`[\]]+\s+(VALUES|SELECT)\b/i.test(stmt)) {
      add('info', 'insert-columns', at(lead), 'INSERT without a column list', 'Naming the columns (INSERT INTO t (a, b) VALUES …) keeps the query working when the table changes.')
    }
  }

  // Leading-wildcard LIKE
  for (const str of s.strings) {
    if (!/^[%_]/.test(str.content) || str.quote !== "'") continue
    if (/\b(I?LIKE)\s*$/i.test(m.slice(Math.max(0, str.start - 12), str.start))) {
      add('warning', 'leading-wildcard', str.start, `LIKE '${str.content.slice(0, 20)}${str.content.length > 20 ? '…' : ''}' starts with a wildcard`, 'A pattern that starts with % or _ cannot use an index, so the database scans every row. Consider full-text search.')
    }
  }

  const rank: Record<Severity, number> = { error: 0, warning: 1, info: 2 }
  return findings.sort((a, b) => a.line - b.line || rank[a.severity] - rank[b.severity])
}

/** Turns sql-formatter's long parser errors into one readable line. */
export function friendlyParseError(message: string): { message: string; line?: number; column?: number } {
  const pos = /line (\d+),? column (\d+)/i.exec(message)
  let first = message.split('\n')[0]
  first = first.replace(/^Parse error:?\s*/i, '').replace(/\s*at line \d+,? column \d+\.?/i, '')
  const tok = /Unexpected ([A-Z_]+) token: \{"type":"[A-Z_]+","raw":"([^"]*)"/.exec(message)
  if (/^at token: «EOF»/.test(first) || tok?.[2] === '«EOF»') first = 'The query ends too early (something is left open)'
  else if (/^at token:/.test(first) && tok) first = `Unexpected "${tok[2]}"`
  return { message: first.trim() || 'Could not parse this SQL.', line: pos ? Number(pos[1]) : undefined, column: pos ? Number(pos[2]) : undefined }
}
