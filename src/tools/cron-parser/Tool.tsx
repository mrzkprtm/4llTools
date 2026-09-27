import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const CRON_FIELDS = [
  { name: 'Minute', min: 0, max: 59, examples: ['0', '*/15', '0,30'] },
  { name: 'Hour', min: 0, max: 23, examples: ['0', '*/2', '9-17'] },
  { name: 'Day of Month', min: 1, max: 31, examples: ['1', '15', 'L', '1,15'] },
  { name: 'Month', min: 1, max: 12, examples: ['1', '*/3', 'JAN-MAR'] },
  { name: 'Day of Week', min: 0, max: 7, examples: ['0', 'MON-FRI', 'SAT,SUN'] },
] as const

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function CronParser() {
  const [expression, setExpression] = useState('0 9 * * MON-FRI')
  const [timezone, setTimezone] = useState('UTC')
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(() => {
    try {
      const parts = expression.trim().split(/\s+/)
      if (parts.length !== 5) return null

      const parsed = parts.map((part, i) => ({
        field: CRON_FIELDS[i].name,
        value: part,
        min: CRON_FIELDS[i].min,
        max: CRON_FIELDS[i].max,
        parsed: parseCronPart(part, i),
      }))
      setError(null)
      return parsed
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid CRON expression')
      return null
    }
  }, [expression])

  const nextRuns = useMemo(() => {
    if (!parsed) return []
    const runs: { date: Date; local: string }[] = []
    const now = new Date()
    let current = new Date(now)
    current.setSeconds(0)
    current.setMilliseconds(0)

    for (let i = 0; i < 10; i++) {
      current = getNextRun(current, parsed)
      if (current) {
        runs.push({
          date: new Date(current),
          local: current.toLocaleString('en-US', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'medium' })
        })
        current = new Date(current.getTime() + 60000) // Move forward 1 minute
      }
    }
    return runs
  }, [parsed, timezone])

  const explanation = useMemo(() => {
    if (!parsed) return ''
    return parsed.map(p => {
      const desc = describePart(p.value, p.field)
      return `${p.field}: ${desc}`
    }).join('; ')
  }, [parsed])

  const nextRun = nextRuns[0]?.date
  const nextRunLocal = nextRuns[0]?.local

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>CRON Expression Parser</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 300 }}>
          <span>CRON Expression</span>
          <input
            type="text"
            value={expression}
            onChange={e => setExpression(e.target.value)}
            placeholder="0 9 * * MON-FRI"
            style={{ width: '100%', background: error ? 'var(--danger)10' : 'var(--bg)', border: error ? '2px solid var(--danger)' : '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '12px', fontFamily: 'var(--mono)', fontSize: '1.1rem' }}
          />
          {error && <span className="muted" style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</span>}
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Timezone</span>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px' }}>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Paris">Europe/Paris</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
            <option value="Asia/Shanghai">Asia/Shanghai</option>
            <option value="Asia/Jakarta">Asia/Jakarta</option>
            <option value="Australia/Sydney">Australia/Sydney</option>
          </select>
        </label>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setExpression('0 0 * * *')}>Daily Midnight</button>
        <button className="btn" onClick={() => setExpression('0 9 * * MON-FRI')}>Weekdays 9AM</button>
        <button className="btn" onClick={() => setExpression('0 */6 * * *')}>Every 6 Hours</button>
        <button className="btn" onClick={() => setExpression('0 0 1 * *')}>Monthly 1st</button>
        <button className="btn" onClick={() => setExpression('0 0 * * 0')}>Weekly Sunday</button>
        <button className="btn" onClick={() => setExpression('*/15 * * * *')}>Every 15 Min</button>
      </div>

      {error && (
        <div className="pop-row" style={{ padding: 12, background: 'var(--danger)10', border: '1px solid var(--danger)40', borderRadius: 'var(--radius)', marginBottom: 16, color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 20, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <h4 style={{ margin: '0 0 8px' }}>Next Run</h4>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: 8 }}>
            {nextRunLocal || 'Invalid expression'}
          </div>
          <div className="muted" style={{ fontSize: '0.9rem' }}>In {timezone}</div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <h4 style={{ margin: '0 0 12px' }}>Human-Readable Explanation</h4>
          <p style={{ lineHeight: 1.8, fontSize: '1rem' }}>{explanation || 'Enter a valid CRON expression'}</p>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Next 10 Runs</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {nextRuns.map((run, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: `${i * 60}ms` }}>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>#{i + 1}</span>
                <span>{run.local}</span>
              </div>
            ))}
            {nextRuns.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>No upcoming runs (invalid expression)</p>}
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '200ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Field Breakdown</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {CRON_FIELDS.map((field, i) => {
              const part = parsed?.[i]
              return (
                <div key={field.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{field.name}</div>
                    <div className="muted" style={{ fontSize: '0.75rem' }}>Range: ${field.min}–${field.max}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{part?.value || '—'}</code>
                    <div className="muted" style={{ fontSize: '0.7rem' }}>{part?.parsed?.map(p => typeof p === 'number' ? p : p).join(', ')}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Special Characters</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: '0.85rem' }}>
            <div><kbd>*</kbd> Any value</div>
            <div><kbd>,</kbd> List separator</div>
            <div><kbd>-</kbd> Range (e.g., 1-5)</div>
            <div><kbd>/</kbd> Step (e.g., */15)</div>
            <div><kbd>L</kbd> Last day of month/week</div>
            <div><kbd>W</kbd> Nearest weekday</div>
            <div><kbd>#</kbd> Nth weekday (e.g., 2#3)</div>
            <div><kbd>?</kbd> No specific value</div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Standard 5-field CRON: minute hour day-of-month month day-of-week. Supports *, ranges, steps, lists, L, W, #, ?. Timezone-aware next run calculation.
        </p>
      </div>
    </div>
  )
}

function parseCronPart(part: string, fieldIndex: number): (number | string)[] {
  if (part === '*') return ['*']
  if (part === '?') return ['?']

  const results: (number | string)[] = []
  const parts = part.split(',')

  for (const p of parts) {
    if (p.includes('/')) {
      const [range, step] = p.split('/')
      const step = parseInt(step, 10)
      let range: number[]
      if (range === '*') {
        range = getRange(0, 59)
      } else if (range.includes('-')) {
        const [min, max] = range.split('-').map(Number)
        range = getRange(min, max)
      } else {
        range = [parseInt(range, 10)]
      }
      for (const val of range) {
        if (val % step === 0) results.push(val)
      }
    } else if (part.includes('-')) {
      const [min, max] = part.split('-').map(Number)
      results.push(...getRange(min, max))
    } else if (part === 'L' || part === 'W' || part === '#' || part === '?') {
      results.push(part)
    } else {
      const num = parseInt(part, 10)
      if (!isNaN(num)) results.push(num)
      else results.push(part)
    }
  }
  return [...new Set(results)].sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : 0))
}

function getRange(min: number, max: number): number[] {
  const arr: number[] = []
  for (let i = min; i <= max; i++) arr.push(i)
  return arr
}

function describePart(value: string, field: string): string {
  if (value === '*') return 'every'
  if (value === '?') return 'no specific value'
  if (value.includes('/')) {
    const [range, step] = value.split('/')
    return `every ${step} ${range === '*' ? '' : range + ' '}`
  }
  if (value.includes('-')) return `from ${value.split('-')[0]} to ${value.split('-')[1]}`
  if (value.includes(',')) return value.split(',').join(', ')
  if (value === 'L') return 'last'
  if (value === 'W') return 'nearest weekday'
  if (value.includes('#')) return `${value.split('#')[0]}th ${value.split('#')[1]}`
  return value
}