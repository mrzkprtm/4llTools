import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import Busy from '../../components/Busy'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import Roll from '../../motion/Roll'
import './tool.css'
import { SCENARIOS, SCORE_LABELS, charsetSize, describeMatch, entropyBits, guessesToBits, loadChecker, scoreTone, type Checker } from './strength'

export default function PasswordStrength() {
  const [check, setCheck] = useState<Checker | null>(null)
  const [loadError, setLoadError] = useState('')
  const [pw, setPw] = useState('correct horse battery staple')
  const [show, setShow] = useState(false)
  const [inputs, setInputs] = useState('')
  const deferred = useDeferredValue(pw)

  useEffect(() => {
    loadChecker().then(
      (c) => setCheck(() => c),
      () => setLoadError('Could not load the password dictionaries. Check your connection and reload.'),
    )
  }, [])

  const userInputs = useMemo(() => inputs.split(/[\s,]+/).filter(Boolean), [inputs])
  const result = useMemo(() => (check && deferred ? check(deferred, userInputs) : null), [check, deferred, userInputs])
  const naive = entropyBits(pw)
  const score = result?.score ?? 0
  const tone = scoreTone(score)

  return (
    <div>
      <label htmlFor="ps-pw">Password to test</label>
      <div className="ps-field">
        <input
          id="ps-pw"
          type={show ? 'text' : 'password'}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          placeholder="Type a password"
          className="ps-input"
        />
        <button type="button" className="btn btn-icon ps-eye" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls="ps-pw">
          <Icon key={show ? 'on' : 'off'} name={show ? 'eye-off' : 'eye'} size={18} />
          {show ? 'Hide' : 'Show'}
        </button>
      </div>

      <div className={`ps-meter ps-${pw ? tone : 'none'}`} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className={pw && result && i <= score ? 'on' : ''} style={{ transitionDelay: `${i * 40}ms` }} />
        ))}
      </div>

      {loadError && <p className="error">{loadError}</p>}
      {!check && !loadError && <Busy label="Loading password dictionaries (about 1 MB)…" />}

      {pw && result && (
        <div className="ps-result" aria-live="polite">
          <p className="ps-verdict">
            <span key={score} className={`chip ${tone === 'good' ? 'good' : tone === 'bad' ? 'bad calm' : ''}`}>
              {tone === 'good' && <Check size={14} />} {SCORE_LABELS[score]} · {score}/4
            </span>
            <span className="muted">about 10<sup>{result.guessesLog10.toFixed(1)}</sup> guesses</span>
          </p>

          {(result.feedback.warning || result.feedback.suggestions.length > 0) && (
            <div className="ps-feedback">
              {result.feedback.warning && <p className="ps-warning">⚠ {result.feedback.warning}</p>}
              {result.feedback.suggestions.length > 0 && (
                <ul>
                  {result.feedback.suggestions.map((s) => <li key={s} className="finding">{s}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="stats">
            <div className="stat"><b><Roll>{String(Math.round(guessesToBits(result.guessesLog10)))}</Roll></b>bits (pattern-aware)</div>
            <div className="stat"><b><Roll>{String(Math.round(naive))}</Roll></b>bits (naive: {[...pw].length} × log2 {charsetSize(pw)})</div>
            <div className="stat"><b><Roll>{String([...pw].length)}</Roll></b>characters</div>
          </div>

          <h3 className="ps-h">Time to crack</h3>
          <div className="ps-table-wrap">
            <table className="simple">
              <tbody>
                {SCENARIOS.map((s) => {
                  const t = result.crackTimes[s.key]
                  return (
                    <tr key={s.key}>
                      <th scope="row">{s.label}<span className="ps-note">{s.note}</span></th>
                      <td className={`ps-time ${t.seconds < 3600 ? 'ps-fast' : t.seconds > 3.15e9 ? 'ps-slow' : ''}`}>{t.display}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <h3 className="ps-h">What an attacker would try</h3>
          <div className="ps-seq">
            {result.sequence.map((m, i) => (
              <span key={`${i}-${m.token}`} className={`ps-chunk ps-p-${m.pattern}`} style={{ animationDelay: `${i * 50}ms` }}>
                <code>{show ? m.token : '•'.repeat([...m.token].length)}</code>
                <small>{describeMatch(m)}</small>
              </span>
            ))}
          </div>
        </div>
      )}

      <details className="ps-more">
        <summary>Words to penalize (your name, email, site name)</summary>
        <label htmlFor="ps-inputs">Personal words, separated by spaces or commas</label>
        <input id="ps-inputs" type="text" value={inputs} onChange={(e) => setInputs(e.target.value)} placeholder="budi, budi@example.com, tokoku" spellCheck={false} />
      </details>

      <p className="muted">
        Scoring uses zxcvbn, which looks for dictionary words, names, keyboard patterns, dates and common passwords the way real cracking tools do, instead of just counting symbols.
        Everything runs in your browser: the password is never sent or stored. A long passphrase of random words usually beats a short string of symbols.
      </p>
    </div>
  )
}
