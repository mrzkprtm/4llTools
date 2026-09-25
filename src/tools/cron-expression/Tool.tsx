import { useMemo, useState } from 'react'
import cronstrue from 'cronstrue/i18n'
import CopyButton from '../../components/CopyButton'
import { FIELD_SPECS, generate, nextRuns, parseCron, PRESETS, type FieldName, type GenMode, type GenOptions } from './cron'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FIELD_ORDER5: FieldName[] = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']

function describeValues(name: FieldName, values: number[], wildcard: boolean): string {
  if (wildcard) return 'every'
  const label = (v: number) => (name === 'dayOfWeek' ? DAY_NAMES[v] : name === 'month' ? MONTH_NAMES[v - 1] : String(v))
  if (values.length > 12) return `${values.length} values: ${values.slice(0, 8).map(label).join(', ')}, …`
  return values.map(label).join(', ')
}

const pad = (n: number) => String(n).padStart(2, '0')

function describe(expr: string, locale: string, h24: boolean): string {
  try {
    return cronstrue.toString(expr, { locale, use24HourTimeFormat: h24, throwExceptionOnParseError: true, verbose: false })
  } catch (err) {
    return typeof err === 'string' ? err : err instanceof Error ? err.message : 'Could not describe this expression.'
  }
}

export default function CronExpression() {
  const [expr, setExpr] = useState('0 9 * * 1-5')
  const [locale, setLocale] = useState('en')
  const [h24, setH24] = useState(true)
  const [gen, setGen] = useState<GenOptions>({ mode: 'daily', everyMinutes: 15, minute: 0, hour: 9, weekdays: [1, 2, 3, 4, 5], dayOfMonth: 1, month: 1 })

  const result = useMemo(() => parseCron(expr), [expr])
  const runs = useMemo(() => (result.ok ? nextRuns(result.cron, new Date(), 10) : []), [result])
  const description = result.ok ? describe(result.cron.expression, locale, h24) : ''

  function updateGen(patch: Partial<GenOptions>) {
    const next = { ...gen, ...patch }
    setGen(next)
    setExpr(generate(next))
  }

  const rawParts = expr.trim().split(/\s+/)
  const badField = !result.ok ? result.field : undefined
  const fieldNames: FieldName[] = result.ok
    ? result.cron.fields.map((f) => f.name)
    : rawParts.length === 6
      ? ['second', ...FIELD_ORDER5]
      : FIELD_ORDER5

  const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v)) || min))

  return (
    <div>
      <label htmlFor="cron-in">Cron expression</label>
      <div className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
        <input
          id="cron-in"
          type="text"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          style={{ fontFamily: 'var(--mono)', fontSize: '1.1rem', flex: 1, minWidth: 0 }}
          aria-invalid={!result.ok}
        />
        <CopyButton text={expr.trim()} />
      </div>

      {/* Visual field chips */}
      <div className="row" style={{ gap: 6 }} aria-hidden="true">
        {fieldNames.map((name, i) => (
          <div
            key={name}
            style={{
              flex: '1 1 70px',
              minWidth: 0,
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${badField === name ? 'var(--danger)' : 'var(--border)'}`,
              background: badField === name ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'var(--sunken)',
              textAlign: 'center',
              transition: 'border-color .2s, background-color .2s',
            }}
          >
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {expr.trim().startsWith('@') ? (result.ok ? result.cron.expression.split(' ')[i] : '·') : (rawParts[i] ?? '·')}
            </div>
            <div className="muted" style={{ fontSize: '0.72rem' }}>{FIELD_SPECS[name].label}</div>
          </div>
        ))}
      </div>

      {result.ok ? (
        <p style={{ fontSize: '1.15rem', fontWeight: 600, margin: '10px 0' }} aria-live="polite">
          <span className="ok" aria-hidden="true">✓ </span>
          {description}
        </p>
      ) : (
        <p className="error" role="alert">{result.error}</p>
      )}

      <div className="row">
        <select value={locale} onChange={(e) => setLocale(e.target.value)} style={{ width: 'auto' }} aria-label="Description language">
          <option value="en">English</option>
          <option value="id">Bahasa Indonesia</option>
          <option value="es">Español</option>
          <option value="de">Deutsch</option>
          <option value="fr">Français</option>
          <option value="ja">日本語</option>
        </select>
        <label style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={h24} onChange={(e) => setH24(e.target.checked)} /> 24-hour time
        </label>
        <select value="" onChange={(e) => e.target.value && setExpr(e.target.value)} style={{ width: 'auto' }} aria-label="Presets">
          <option value="">Presets…</option>
          {PRESETS.map((p) => (
            <option key={p.label} value={p.expr}>{p.label} ({p.expr})</option>
          ))}
        </select>
      </div>

      <div className="two-col">
        <div>
          <label>Field breakdown</label>
          <div style={{ overflowX: 'auto' }}>
            <table className="simple">
              <thead>
                <tr><th>Field</th><th>Value</th><th>Matches</th></tr>
              </thead>
              <tbody>
                {result.ok
                  ? result.cron.fields.map((f) => (
                      <tr key={f.name}>
                        <td>{FIELD_SPECS[f.name].label}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{f.source}</td>
                        <td>{describeValues(f.name, f.values, f.wildcard)}</td>
                      </tr>
                    ))
                  : fieldNames.map((name) => (
                      <tr key={name} className={badField === name ? 'error' : undefined}>
                        <td>{FIELD_SPECS[name].label}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{rawParts[fieldNames.indexOf(name)] ?? ''}</td>
                        <td>{badField === name ? 'invalid' : ''}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {result.ok && !result.cron.domWildcard && !result.cron.dowWildcard && (
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Both day-of-month and day-of-week are set, so cron runs when <b>either</b> matches (standard Vixie cron behaviour).
            </p>
          )}
        </div>
        <div>
          <label>Next 10 runs (your local time)</label>
          {result.ok && runs.length === 0 && <p className="muted">This schedule never matches a real date.</p>}
          <ol style={{ margin: 0, paddingLeft: 22, fontFamily: 'var(--mono)', fontSize: '0.86rem', lineHeight: 1.8 }}>
            {runs.map((d) => (
              <li key={d.getTime()}>
                {DAY_NAMES[d.getDay()]} {d.getFullYear()}-{pad(d.getMonth() + 1)}-{pad(d.getDate())} {pad(d.getHours())}:{pad(d.getMinutes())}
                {result.ok && result.cron.hasSeconds ? `:${pad(d.getSeconds())}` : ''}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <h3 style={{ marginTop: 28, marginBottom: 0, fontSize: '1rem' }}>Generator</h3>
      <div className="row">
        {(['minutes', 'hourly', 'daily', 'weekly', 'monthly', 'yearly'] as GenMode[]).map((m) => (
          <button key={m} type="button" className={`btn ${gen.mode === m ? 'primary' : ''}`} onClick={() => updateGen({ mode: m })}>
            {m === 'minutes' ? 'Every N min' : m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      <div className="row">
        {gen.mode === 'minutes' && (
          <>
            <label htmlFor="g-n">Every</label>
            <select id="g-n" value={gen.everyMinutes} onChange={(e) => updateGen({ everyMinutes: Number(e.target.value) })} style={{ width: 'auto' }}>
              {[1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>minute(s)</span>
          </>
        )}
        {gen.mode !== 'minutes' && gen.mode !== 'hourly' && (
          <>
            <label htmlFor="g-time">At</label>
            <input
              id="g-time"
              type="time"
              value={`${pad(gen.hour)}:${pad(gen.minute)}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                if (!Number.isNaN(h) && !Number.isNaN(m)) updateGen({ hour: h, minute: m })
              }}
              style={{ font: 'inherit', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--sunken)', color: 'var(--text)' }}
            />
          </>
        )}
        {gen.mode === 'hourly' && (
          <>
            <label htmlFor="g-min">At minute</label>
            <input id="g-min" type="number" min={0} max={59} value={gen.minute} onChange={(e) => updateGen({ minute: num(e.target.value, 0, 59) })} style={{ width: 90 }} />
          </>
        )}
        {(gen.mode === 'monthly' || gen.mode === 'yearly') && (
          <>
            <label htmlFor="g-dom">on day</label>
            <input id="g-dom" type="number" min={1} max={31} value={gen.dayOfMonth} onChange={(e) => updateGen({ dayOfMonth: num(e.target.value, 1, 31) })} style={{ width: 80 }} />
          </>
        )}
        {gen.mode === 'yearly' && (
          <>
            <label htmlFor="g-mon">of</label>
            <select id="g-mon" value={gen.month} onChange={(e) => updateGen({ month: Number(e.target.value) })} style={{ width: 'auto' }}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </>
        )}
      </div>
      {gen.mode === 'weekly' && (
        <div className="row" role="group" aria-label="Weekdays">
          {DAY_NAMES.map((d, i) => {
            const on = gen.weekdays.includes(i)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                className={`btn ${on ? 'primary' : ''}`}
                style={{ padding: '7px 10px', minWidth: 48 }}
                onClick={() => updateGen({ weekdays: on ? gen.weekdays.filter((x) => x !== i) : [...gen.weekdays, i] })}
              >
                {d}
              </button>
            )
          })}
        </div>
      )}
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Supports standard 5-field cron, an optional leading seconds field (6 fields), names like MON or JAN, and @daily-style macros.
        Quartz extras like L, W and # are not supported.
      </p>
    </div>
  )
}
