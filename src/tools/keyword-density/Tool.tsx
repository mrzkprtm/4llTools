import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { density, toCsv, type KwRow } from './density'

const N_CHOICES = [
  { n: 1 as const, label: 'Single words' },
  { n: 2 as const, label: 'Two-word phrases' },
  { n: 3 as const, label: 'Three-word phrases' },
]

export default function Tool() {
  const [text, setText] = useState('')
  const [n, setN] = useState<1 | 2 | 3>(1)
  const [skipStopwords, setSkipStopwords] = useState(true)
  const [maxRows, setMaxRows] = useState(25)

  const result = useMemo(
    () => density(text, { n, maxRows, skipStopwords }),
    [text, n, maxRows, skipStopwords],
  )
  const maxCount = result.rows[0]?.count ?? 1

  return (
    <div>
      <label htmlFor="kd-in" style={{ marginTop: 0 }}>Your text</label>
      <textarea
        id="kd-in"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste an article, page copy or essay to analyse its keyword balance…"
        style={{ minHeight: 180 }}
      />

      <div className="row" style={{ marginTop: 16 }}>
        {N_CHOICES.map((c) => (
          <button
            key={c.n}
            type="button"
            className={`btn ${n === c.n ? 'primary' : ''}`}
            style={{ fontSize: '0.86rem' }}
            onClick={() => setN(c.n)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="row">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, margin: 0 }}>
          <input type="checkbox" checked={skipStopwords} onChange={(e) => setSkipStopwords(e.target.checked)} />
          Skip stopwords (the, and, of…)
        </label>
        <label htmlFor="kd-rows" style={{ margin: '0 0 0 auto', fontWeight: 500 }}>
          Top{' '}
          <input
            id="kd-rows"
            type="number"
            min={5}
            max={100}
            value={maxRows}
            onChange={(e) => setMaxRows(Math.min(100, Math.max(5, Number(e.target.value) || 5)))}
            style={{ width: 74, display: 'inline-block', padding: '5px 8px' }}
          />{' '}
          rows
        </label>
      </div>

      <div className="stats">
        <div className="stat">
          Words
          <b>
            <Roll>{result.tokens}</Roll>
          </b>
        </div>
        <div className="stat">
          {n === 1 ? 'Words' : `${n}-word phrases`} counted
          <b>
            <Roll>{result.totalGrams}</Roll>
          </b>
        </div>
        <div className="stat">
          Unique terms
          <b>
            <Roll>{result.rows.length}</Roll>
          </b>
        </div>
      </div>

      {text.trim() && result.rows.length > 0 ? (
        <div style={{ marginTop: 20 }}>
          <table className="simple">
            <thead>
              <tr>
                <th style={{ width: '52%' }}>Term</th>
                <th>Count</th>
                <th>Density</th>
                <th style={{ width: '30%' }} aria-label="Share bar" />
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <Row key={row.term} row={row} max={maxCount} delay={i} />
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 16 }}>
            <CopyButton text={toCsv(result.rows)} label="Copy CSV" />
            <CsvDownload rows={result.rows} />
          </div>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 20 }}>
          {text.trim() ? 'Nothing to count yet — try disabling stopword filtering.' : 'Results appear here once you add some text.'}
        </p>
      )}
    </div>
  )
}

function Row({ row, max, delay }: { row: KwRow; max: number; delay: number }) {
  return (
    <tr style={{ animationDelay: `${Math.min(delay, 20) * 30}ms` }}>
      <td style={{ overflowWrap: 'anywhere' }}>{row.term}</td>
      <td>
        <Roll>{row.count}</Roll>
      </td>
      <td>{row.pct.toFixed(2)}%</td>
      <td>
        <span
          style={{
            display: 'block',
            height: 10,
            borderRadius: 5,
            background: 'var(--accent)',
            width: `${Math.max(3, (row.count / max) * 100)}%`,
            opacity: 0.85,
          }}
        />
      </td>
    </tr>
  )
}

function CsvDownload({ rows }: { rows: KwRow[] }) {
  const [saved, setSaved] = useState(false)
  function download() {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'keyword-density.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  return (
    <button type="button" className={`btn btn-icon ${saved ? 'is-done' : ''}`} onClick={download}>
      <Icon name="save" size={16} /> {saved ? 'Saved!' : 'Download CSV'}
    </button>
  )
}
