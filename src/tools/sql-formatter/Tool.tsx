import { useMemo, useRef, useState } from 'react'
import { format, type KeywordCase, type SqlLanguage } from 'sql-formatter'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import SettleOutput from '../../motion/SettleOutput'
import { friendlyParseError, lintSql, type Severity } from './lint'

const DIALECTS: [SqlLanguage, string][] = [
  ['sql', 'Standard SQL'], ['mysql', 'MySQL'], ['mariadb', 'MariaDB'], ['postgresql', 'PostgreSQL'], ['sqlite', 'SQLite'],
  ['transactsql', 'SQL Server (T-SQL)'], ['plsql', 'Oracle PL/SQL'], ['bigquery', 'BigQuery'], ['snowflake', 'Snowflake'],
  ['redshift', 'Redshift'], ['duckdb', 'DuckDB'], ['clickhouse', 'ClickHouse'], ['spark', 'Spark'], ['hive', 'Hive'],
  ['trino', 'Trino / Presto'], ['db2', 'Db2'], ['db2i', 'Db2 for IBM i'], ['singlestoredb', 'SingleStore'], ['tidb', 'TiDB'], ['n1ql', 'N1QL (Couchbase)'],
]

const SAMPLE = `select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id
where u.deleted_at = null and u.email like '%@example.com' group by u.id, u.name having count(o.id) > 3 order by orders desc limit 10;
select * from audit_log where actor = '' or '1'='1';
delete from sessions`

const SEVERITY_STYLE: Record<Severity, { color: string; label: string }> = {
  error: { color: 'var(--danger)', label: 'Error' },
  warning: { color: 'var(--accent)', label: 'Warning' },
  info: { color: 'var(--muted)', label: 'Info' },
}

export default function SqlFormatter() {
  const [sql, setSql] = useState(SAMPLE)
  const [language, setLanguage] = useState<SqlLanguage>('sql')
  const [keywordCase, setKeywordCase] = useState<KeywordCase>('upper')
  const [indent, setIndent] = useState<'2' | '4' | 'tab'>('2')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const formatted = useMemo(() => {
    if (!sql.trim()) return { ok: true as const, text: '' }
    try {
      const text = format(sql, {
        language,
        keywordCase,
        tabWidth: indent === 'tab' ? 2 : Number(indent),
        useTabs: indent === 'tab',
        linesBetweenQueries: 2,
      })
      return { ok: true as const, text }
    } catch (err) {
      return { ok: false as const, ...friendlyParseError(err instanceof Error ? err.message : String(err)) }
    }
  }, [sql, language, keywordCase, indent])

  const findings = useMemo(() => lintSql(sql), [sql])
  const counts = { error: 0, warning: 0, info: 0 }
  for (const f of findings) counts[f.severity]++

  function jumpToLine(line: number, column = 1) {
    const el = inputRef.current
    if (!el) return
    const lines = sql.split('\n')
    let pos = 0
    for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1
    const lineLen = lines[line - 1]?.length ?? 0
    el.focus()
    el.setSelectionRange(pos + Math.max(0, column - 1), pos + lineLen)
  }

  function download() {
    if (!formatted.ok) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([formatted.text], { type: 'application/sql' }))
    a.download = 'query.sql'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div className="row">
        <select value={language} onChange={(e) => setLanguage(e.target.value as SqlLanguage)} style={{ width: 'auto' }} aria-label="SQL dialect">
          {DIALECTS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={keywordCase} onChange={(e) => setKeywordCase(e.target.value as KeywordCase)} style={{ width: 'auto' }} aria-label="Keyword case">
          <option value="upper">KEYWORDS UPPER</option>
          <option value="lower">keywords lower</option>
          <option value="preserve">Keep keyword case</option>
        </select>
        <select value={indent} onChange={(e) => setIndent(e.target.value as '2' | '4' | 'tab')} style={{ width: 'auto' }} aria-label="Indent">
          <option value="2">2 spaces</option>
          <option value="4">4 spaces</option>
          <option value="tab">Tabs</option>
        </select>
      </div>
      <label htmlFor="sql-in">SQL</label>
      <textarea id="sql-in" ref={inputRef} value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} style={{ minHeight: 180 }} />

      <label>
        Checks{' '}
        <span className="muted" style={{ fontWeight: 400 }}>
          {findings.length === 0 ? '' : `· ${counts.error} error${counts.error === 1 ? '' : 's'}, ${counts.warning} warning${counts.warning === 1 ? '' : 's'}${counts.info ? `, ${counts.info} note${counts.info === 1 ? '' : 's'}` : ''}`}
        </span>
      </label>
      {findings.length === 0 ? (
        <p style={{ margin: 0 }}><span className="chip good"><Check size={14} /> No problems spotted</span></p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {findings.map((f, i) => (
            <li
              key={`${f.rule}-${f.line}-${i}`}
              className="finding"
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms`, borderLeft: `3px solid ${SEVERITY_STYLE[f.severity].color}`, background: 'var(--sunken)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}
            >
              <div className="row" style={{ margin: 0, gap: 6, justifyContent: 'space-between' }}>
                <span style={{ minWidth: 0 }}>
                  <b style={{ color: SEVERITY_STYLE[f.severity].color, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{SEVERITY_STYLE[f.severity].label}</b>{' '}
                  <b style={{ overflowWrap: 'anywhere' }}>{f.title}</b>
                </span>
                <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={() => jumpToLine(f.line)}>Line {f.line}</button>
              </div>
              <div className="muted" style={{ fontSize: '0.87rem', marginTop: 2 }}>{f.detail}</div>
            </li>
          ))}
        </ul>
      )}

      {!formatted.ok && (
        <p className="error" role="alert">
          Could not format: {formatted.message}
          {formatted.line ? ` (line ${formatted.line}, column ${formatted.column})` : ''}{' '}
          {formatted.line && (
            <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={() => jumpToLine(formatted.line!, formatted.column)}>Show</button>
          )}
          <br />
          <span className="muted" style={{ fontSize: '0.85rem' }}>Try another dialect if the query uses vendor-specific syntax.</span>
        </p>
      )}
      <label htmlFor="sql-out">Formatted</label>
      <SettleOutput id="sql-out" value={formatted.ok ? formatted.text : ''} motion="order" style={{ minHeight: 240 }} />
      <div className="row">
        <CopyButton text={formatted.ok ? formatted.text : ''} />
        <button type="button" className="btn" onClick={download} disabled={!formatted.ok || !formatted.text}>Download .sql</button>
      </div>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        The checks are quick pattern-based hints, not a full SQL parser or security audit. Always use parameterised queries for user input.
      </p>
    </div>
  )
}
