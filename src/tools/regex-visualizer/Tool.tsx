import { useMemo, useState, type ReactNode } from 'react'
import { explain, findMatches, layoutDiagram, parseRegex, type BoxKind, type Diagram, type Explanation, type FrameKind } from './diagram'

const FLAGS = [
  ['g', 'global'],
  ['i', 'ignore case'],
  ['m', 'multiline'],
  ['s', 'dot matches newline'],
  ['u', 'unicode'],
  ['y', 'sticky'],
] as const

const EXAMPLES: [string, string, string][] = [
  ['Email', '^(?<user>[\\w.+-]+)@((?:[a-z0-9-]+\\.)+[a-z]{2,})$', 'gim'],
  ['Date', '(\\d{4})-(0[1-9]|1[0-2])-(\\d{2})', 'g'],
  ['Hex color', '#(?:[0-9a-f]{3}){1,2}\\b', 'gi'],
  ['Price', '(?<=\\$)\\d+(?:\\.\\d{2})?', 'g'],
  ['Password rule', '^(?=.*\\d)(?=.*[A-Z]).{8,}$', ''],
]

const BOX_COLORS: Record<BoxKind, { fill: string; stroke: string }> = {
  literal: { fill: 'rgba(99, 102, 241, 0.14)', stroke: 'rgb(99, 102, 241)' },
  set: { fill: 'rgba(16, 185, 129, 0.15)', stroke: 'rgb(16, 160, 110)' },
  class: { fill: 'rgba(245, 158, 11, 0.16)', stroke: 'rgb(217, 119, 6)' },
  anchor: { fill: 'rgba(236, 72, 153, 0.13)', stroke: 'rgb(219, 39, 119)' },
  backref: { fill: 'rgba(14, 165, 233, 0.15)', stroke: 'rgb(2, 132, 199)' },
  terminal: { fill: 'var(--surface)', stroke: 'var(--muted)' },
}

const FRAME_COLORS: Record<FrameKind, string> = {
  capture: 'rgb(99, 102, 241)',
  group: 'var(--muted)',
  lookaround: 'rgb(219, 39, 119)',
}

function DiagramSvg({ d }: { d: Diagram }) {
  // The track draws in from left to right; each piece starts when the pen reaches its x position.
  const delay = (x: number) => ({ animationDelay: `${Math.round((x / Math.max(1, d.width)) * 420)}ms` })
  const startX = (path: string) => Number(/M\s*(-?[\d.]+)/.exec(path)?.[1] ?? 0)
  return (
    <svg
      width={d.width}
      height={d.height}
      viewBox={`0 0 ${d.width} ${d.height}`}
      role="img"
      aria-label="Railroad diagram of the regular expression"
      style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 12 }}
    >
      {d.prims.map((p, i) => {
        if (p.kind === 'frame') {
          const c = FRAME_COLORS[p.style]
          return (
            <g key={i} className="rr-fade" style={delay(p.x)}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={8} fill="none" stroke={c} strokeWidth={1.2} strokeDasharray={p.style === 'capture' ? undefined : '4 3'} />
              <text x={p.x + 4} y={p.y - 5} fill={c} fontSize={11}>{p.label}</text>
            </g>
          )
        }
        return null
      })}
      {d.prims.map((p, i) =>
        p.kind === 'path' ? (
          <path key={i} d={p.d} pathLength={1} className="rr-path" style={delay(startX(p.d))} fill="none" stroke={p.role === 'loop' || p.role === 'skip' ? 'var(--muted)' : 'var(--text)'} strokeWidth={1.5} strokeOpacity={p.role ? 0.75 : 0.55} strokeLinecap="round" />
        ) : null,
      )}
      {d.prims.map((p, i) => {
        if (p.kind === 'box') {
          const c = BOX_COLORS[p.style]
          if (p.style === 'terminal') {
            return <circle key={i} className="rr-pop" style={delay(p.x)} cx={p.x + p.w / 2} cy={p.y + p.h / 2} r={p.w / 2} fill={c.fill} stroke={c.stroke} strokeWidth={2}><title>{p.label}</title></circle>
          }
          return (
            <g key={i} className="rr-pop" style={delay(p.x)}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.style === 'anchor' ? 14 : 5} fill={c.fill} stroke={c.stroke} strokeWidth={1.2} />
              <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="central" fill="var(--text)">{p.label}</text>
            </g>
          )
        }
        if (p.kind === 'text') {
          return <text key={i} className="rr-fade" style={delay(p.x)} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fill="var(--muted)" fontSize={11}>{p.text}</text>
        }
        return null
      })}
    </svg>
  )
}

function ExplainList({ items }: { items: Explanation[] }) {
  return (
    <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
      {items.map((e, i) => (
        <li key={i} style={{ margin: '3px 0' }}>
          <code style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 4px', marginRight: 6, wordBreak: 'break-all' }}>{e.code || '∅'}</code>
          {e.text}
          {e.children.length > 0 && <ExplainList items={e.children} />}
        </li>
      ))}
    </ul>
  )
}

export default function RegexVisualizer() {
  const [pattern, setPattern] = useState(EXAMPLES[0][1])
  const [flags, setFlags] = useState(EXAMPLES[0][2])
  const [text, setText] = useState('hello@example.com\nnot an email\nfirst.last+tag@mail.co.uk')

  const parsed = useMemo(() => parseRegex(pattern, flags), [pattern, flags])
  const diagram = useMemo(() => (parsed.ok ? layoutDiagram(parsed.pattern, parsed.flags) : null), [parsed])
  const explanation = useMemo(() => (parsed.ok ? explain(parsed.pattern, parsed.flags) : []), [parsed])

  // regexpp may accept syntax the running browser does not support yet, so guard the real RegExp too.
  let matchError = ''
  let highlighted: ReactNode[] = []
  let count = 0
  if (parsed.ok && text) {
    try {
      const matches = findMatches(pattern, flags, text)
      count = matches.length
      let last = 0
      matches.forEach((m, i) => {
        if (!m.text) return
        highlighted.push(text.slice(last, m.index), <mark key={i}>{m.text}</mark>)
        last = m.index + m.text.length
      })
      highlighted.push(text.slice(last))
    } catch (err) {
      matchError = err instanceof Error ? err.message : String(err)
      highlighted = []
    }
  }

  return (
    <div>
      <div className="row">
        <span className="muted">Examples:</span>
        {EXAMPLES.map(([name, p, f]) => (
          <button key={name} type="button" className="btn" onClick={() => { setPattern(p); setFlags(f) }}>{name}</button>
        ))}
      </div>
      <label htmlFor="rv-pattern">Pattern</label>
      <div className="row" style={{ marginTop: 0, flexWrap: 'nowrap' }}>
        <span className="muted">/</span>
        <input id="rv-pattern" type="text" value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" style={{ fontFamily: 'var(--mono)', flex: 1, minWidth: 0 }} />
        <span className="muted">/</span>
        <input type="text" value={flags} onChange={(e) => setFlags(e.target.value.replace(/[^a-z]/gi, ''))} aria-label="Flags" spellCheck={false} style={{ fontFamily: 'var(--mono)', width: 64, flex: 'none' }} />
      </div>
      <div className="row">
        {FLAGS.map(([f, label]) => (
          <label key={f} style={{ fontWeight: 400, margin: 0 }}>
            <input type="checkbox" checked={flags.includes(f)} onChange={(e) => setFlags(e.target.checked ? flags + f : flags.replace(f, ''))} /> {f} <span className="muted">({label})</span>
          </label>
        ))}
      </div>

      {!parsed.ok && <p className="error">{parsed.error}</p>}
      {diagram && (
        <>
          <label>Diagram</label>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', WebkitOverflowScrolling: 'touch' }}>
            <DiagramSvg key={pattern} d={diagram} />
          </div>
          <p className="muted" style={{ fontSize: '0.82rem', margin: '6px 0 0' }}>
            Read left to right. Branches are alternatives, a line looping back underneath means “repeat”, and a line over the top means “can be skipped”.
            Solid frames capture; dashed frames group or look around without capturing.
          </p>

          <label>Explanation</label>
          <div className="output" style={{ fontFamily: 'inherit', wordBreak: 'normal', overflowX: 'auto' }}>
            {explanation.length ? <ExplainList items={explanation} /> : <span className="muted">Empty pattern: matches the empty string everywhere.</span>}
          </div>
        </>
      )}

      <label htmlFor="rv-text">Test string</label>
      <textarea id="rv-text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} style={{ minHeight: 90 }} />
      {matchError && <p className="error">{matchError}</p>}
      {parsed.ok && !matchError && text && (
        <>
          <label>{count} match{count === 1 ? '' : 'es'}{!flags.includes('g') && count > 0 ? ' (first only, add the g flag for all)' : ''}</label>
          <div className="output" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', wordBreak: 'break-word' }}>{highlighted}</div>
        </>
      )}
    </div>
  )
}
