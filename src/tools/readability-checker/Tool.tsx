import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import Roll from '../../motion/Roll'
import { useSettled } from '../../motion/useSettled'
import { LONG_SENTENCE, VERY_LONG_SENTENCE, analyze, easeLabel, findHints, sentenceLevel, splitSentences, type Hint } from './readability'
import './tool.css'

const SAMPLE = `Readability matters because people skim. Short sentences are easy to follow. Plain words help too.

However, when a sentence keeps going and adds clause after clause, with extra details that were really included only because the writer was not sure which point mattered most, readers are forced to hold everything in their heads until the very end, and many of them simply give up before they finally reach the point.

The report was written by the team and it was reviewed carefully. Try editing this text and watch the scores change.`

function minutes(m: number): string {
  if (m < 1) return `${Math.max(1, Math.round(m * 60))} sec`
  const whole = Math.floor(m)
  const sec = Math.round((m - whole) * 60)
  return sec ? `${whole} min ${sec} s` : `${whole} min`
}

function renderText(text: string, show: { long: boolean; passive: boolean; adverb: boolean }): ReactNode[] {
  const sentences = splitSentences(text)
  const hints = findHints(text).filter((h) => show[h.kind])
  const out: ReactNode[] = []
  let pos = 0
  const inner = (from: number, to: number, key: string) => {
    const nodes: ReactNode[] = []
    let p = from
    hints
      .filter((h: Hint) => h.start >= from && h.end <= to)
      .forEach((h, i) => {
        if (h.start < p) return
        nodes.push(text.slice(p, h.start))
        nodes.push(
          <mark key={`${key}h${i}`} className={`rd-${h.kind}`} title={h.kind === 'passive' ? 'Passive voice' : 'Adverb'}>
            {text.slice(h.start, h.end)}
          </mark>,
        )
        p = h.end
      })
    nodes.push(text.slice(p, to))
    return nodes
  }
  sentences.forEach((s, i) => {
    if (s.start > pos) out.push(text.slice(pos, s.start))
    const level = show.long ? sentenceLevel(s.words) : 'ok'
    out.push(
      <span key={`s${i}`} className={level === 'ok' ? undefined : `rd-${level}`} title={level === 'ok' ? undefined : `${s.words} words`}>
        {inner(s.start, s.end, `s${i}`)}
      </span>,
    )
    pos = s.end
  })
  if (pos < text.length) out.push(text.slice(pos))
  return out
}

export default function ReadabilityChecker() {
  const [text, setText] = useState(SAMPLE)
  const [show, setShow] = useState({ long: true, passive: true, adverb: true })
  const deferred = useDeferredValue(text)
  const report = useMemo(() => analyze(deferred), [deferred])
  const sentences = useMemo(() => splitSentences(deferred), [deferred])
  const hints = useMemo(() => findHints(deferred), [deferred])
  const settled = useSettled(report?.fleschEase, 450)

  const long = sentences.filter((s) => sentenceLevel(s.words) === 'long').length
  const veryLong = sentences.filter((s) => sentenceLevel(s.words) === 'very-long').length
  const passive = hints.filter((h) => h.kind === 'passive').length
  const adverbs = hints.filter((h) => h.kind === 'adverb').length
  const ease = report ? easeLabel(report.fleschEase) : null
  const grades = report ? [report.fleschKincaid, report.gunningFog, report.smog, report.colemanLiau, report.ari] : []
  const avgGrade = grades.length ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 10) / 10 : 0

  const scores: [string, number | undefined, string][] = report
    ? [
        ['Flesch-Kincaid Grade', report.fleschKincaid, 'US school grade from sentence length and syllables'],
        ['Gunning Fog', report.gunningFog, 'Years of schooling; counts 3+ syllable words'],
        ['SMOG Index', report.smog, 'Grade from polysyllables; best for 30+ sentences'],
        ['Coleman-Liau', report.colemanLiau, 'Grade from letters per word, not syllables'],
        ['Automated Readability (ARI)', report.ari, 'Grade from characters per word'],
      ]
    : []

  return (
    <div>
      <label htmlFor="rd-in">Your text (English)</label>
      <textarea id="rd-in" value={text} onChange={(e) => setText(e.target.value)} style={{ fontFamily: 'inherit', fontSize: '0.95rem', minHeight: 200 }} placeholder="Paste an article, email or essay…" />

      {!report ? (
        <p className="muted">Type or paste some English text to see its scores.</p>
      ) : (
        <>
          <div className="rd-hero">
            <div key={settled} className={`rd-ease ${settled ? 'settle' : ''}`}>
              <span className="muted">Flesch Reading Ease</span>
              <b><Roll>{report.fleschEase.toFixed(1)}</Roll></b>
              <div className="bar rd-gauge" role="meter" aria-label="Reading ease from 0 (hard) to 100 (easy)" aria-valuemin={0} aria-valuemax={100} aria-valuenow={report.fleschEase}>
                <i style={{ transform: `scaleX(${Math.min(1, Math.max(0.02, report.fleschEase / 100))})` }} />
              </div>
              <span key={ease!.label} className={`chip ${report.fleschEase >= 60 ? 'good' : report.fleschEase < 30 ? 'bad calm' : ''}`}>{ease!.label} · {ease!.audience}</span>
            </div>
            <div className="stats rd-stats">
              <div className="stat"><b><Roll>{avgGrade.toFixed(1)}</Roll></b>Average grade</div>
              <div className="stat"><b><Roll>{report.words.toLocaleString()}</Roll></b>Words</div>
              <div className="stat"><b><Roll>{report.sentences}</Roll></b>Sentences</div>
              <div className="stat"><b><Roll>{(report.words / report.sentences).toFixed(1)}</Roll></b>Words / sentence</div>
              <div className="stat"><b>{minutes(report.readingMinutes)}</b>Reading time</div>
              <div className="stat"><b>{minutes(report.speakingMinutes)}</b>Speaking time</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="simple">
              <thead><tr><th>Formula</th><th>Score</th><th>What it measures</th></tr></thead>
              <tbody>
                {scores.map(([name, v, note]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}><Roll>{(v ?? 0).toFixed(1)}</Roll></td>
                    <td className="muted" style={{ fontSize: '0.84rem' }}>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="rd-h">Highlights</h3>
          <div className="row rd-legend" role="group" aria-label="Highlight types">
            <label className="rd-toggle"><input type="checkbox" checked={show.long} onChange={(e) => setShow({ ...show, long: e.target.checked })} /> <span className="rd-key rd-long" /> Long ({long}) <span className="rd-key rd-very-long" /> Very long ({veryLong})</label>
            <label className="rd-toggle"><input type="checkbox" checked={show.passive} onChange={(e) => setShow({ ...show, passive: e.target.checked })} /> <span className="rd-key rd-passive" /> Passive voice ({passive})</label>
            <label className="rd-toggle"><input type="checkbox" checked={show.adverb} onChange={(e) => setShow({ ...show, adverb: e.target.checked })} /> <span className="rd-key rd-adverb" /> Adverbs ({adverbs})</label>
          </div>
          <div className="rd-view" aria-label="Text with highlights">{renderText(deferred, show)}</div>
          <p className="muted" style={{ fontSize: '0.84rem' }}>
            Long means more than {LONG_SENTENCE} words, very long more than {VERY_LONG_SENTENCE}. Passive voice and -ly adverbs are hints, not errors: keep them when they read better.
          </p>
        </>
      )}

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        These formulas were designed for English, so scores for Indonesian or other languages are not meaningful (syllables and word lengths differ).
        Syllables are counted with rules plus common exceptions, so a few words may be off by one; scores are estimates that work best on 100+ words.
        Aim for a Flesch score of 60 or more and a grade around 8 for general web readers.
      </p>
    </div>
  )
}
