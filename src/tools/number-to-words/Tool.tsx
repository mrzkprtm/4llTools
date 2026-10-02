import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import MorphText from '../../motion/MorphText'
import PillRow from '../../motion/PillRow'
import { applyCase, formatParsed, parseNumber, toEnglish, toIndonesian, type Casing, type DecimalSep, type EnglishStyle } from './words'
import './tool.css'

type Lang = 'en' | 'id'

const CURRENCIES: Record<string, { label: string; major: [string, string]; minor: [string, string] }> = {
  usd: { label: 'US dollar', major: ['dollar', 'dollars'], minor: ['cent', 'cents'] },
  eur: { label: 'Euro', major: ['euro', 'euros'], minor: ['cent', 'cents'] },
  gbp: { label: 'Pound sterling', major: ['pound', 'pounds'], minor: ['penny', 'pence'] },
  idr: { label: 'Rupiah', major: ['rupiah', 'rupiah'], minor: ['sen', 'sen'] },
  inr: { label: 'Rupee', major: ['rupee', 'rupees'], minor: ['paisa', 'paise'] },
  sgd: { label: 'Singapore dollar', major: ['Singapore dollar', 'Singapore dollars'], minor: ['cent', 'cents'] },
}

const EXAMPLES: Record<Lang, string[]> = {
  en: ['1,250.75', '21', '1,000,000', '-3.05', '999,999,999,999,999'],
  id: ['1.250.000', '1.100', '11.000', '2.500.000,50', '1.000.000.000'],
}

const STYLES: [EnglishStyle, string][] = [
  ['cardinal', 'Cardinal'],
  ['ordinal', 'Ordinal'],
  ['currency', 'Currency'],
  ['check', 'Check'],
]

export default function NumberToWords() {
  const [input, setInput] = useState('1.250.000')
  const [lang, setLang] = useState<Lang>('id')
  const [style, setStyle] = useState<EnglishStyle>('cardinal')
  const [currency, setCurrency] = useState('usd')
  const [useAnd, setUseAnd] = useState(false)
  const [rupiah, setRupiah] = useState(true)
  const [casing, setCasing] = useState<Casing>('sentence')
  const [sep, setSep] = useState<DecimalSep>('auto')

  const parsed = useMemo(() => parseNumber(input, sep), [input, sep])
  const result = useMemo(() => {
    if (!parsed.ok) return { text: '', error: parsed.error }
    try {
      const c = CURRENCIES[currency]
      const raw = lang === 'id' ? toIndonesian(parsed.value, { rupiah }) : toEnglish(parsed.value, { style, useAnd, major: c.major, minor: c.minor })
      return { text: applyCase(raw, casing), error: '' }
    } catch (e) {
      return { text: '', error: e instanceof Error ? e.message : String(e) }
    }
  }, [parsed, lang, style, currency, useAnd, rupiah, casing])

  function switchLang(l: Lang) {
    setLang(l)
    if (l === 'id' && casing === 'upper') setCasing('title')
  }

  const words = result.text.split(' ')

  return (
    <div>
      <label htmlFor="nw-in">Number</label>
      <input
        id="nw-in"
        type="text"
        inputMode="decimal"
        className="nw-in"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={!!result.error}
        aria-describedby="nw-read"
      />
      <div id="nw-read" className="nw-read" aria-live="polite">
        {parsed.ok ? (
          <>
            <span className="muted">Read as</span>
            <span className="chip pop" key={parsed.value.int + parsed.value.frac + parsed.value.negative}>{formatParsed(parsed.value, lang)}</span>
          </>
        ) : null}
      </div>

      <PillRow label="Language">
        <button type="button" className={`btn ${lang === 'id' ? 'primary' : ''}`} aria-pressed={lang === 'id'} onClick={() => switchLang('id')}>Bahasa Indonesia (terbilang)</button>
        <button type="button" className={`btn ${lang === 'en' ? 'primary' : ''}`} aria-pressed={lang === 'en'} onClick={() => switchLang('en')}>English</button>
      </PillRow>

      {lang === 'en' && (
        <PillRow label="Style">
          {STYLES.map(([id, label]) => (
            <button key={id} type="button" className={`btn ${style === id ? 'primary' : ''}`} aria-pressed={style === id} onClick={() => setStyle(id)}>
              {label}
            </button>
          ))}
        </PillRow>
      )}

      <div className="nw-opts">
        {lang === 'en' && (style === 'currency' || style === 'check') && (
          <div>
            <label htmlFor="nw-cur">Currency</label>
            <select id="nw-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {Object.entries(CURRENCIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="nw-case">Letter case</label>
          <select id="nw-case" value={casing} onChange={(e) => setCasing(e.target.value as Casing)}>
            <option value="sentence">Sentence case</option>
            <option value="lower">lower case</option>
            <option value="title">Title Case</option>
            <option value="upper">UPPER CASE (checks)</option>
          </select>
        </div>
        <div>
          <label htmlFor="nw-sep">Decimal separator</label>
          <select id="nw-sep" value={sep} onChange={(e) => setSep(e.target.value as DecimalSep)}>
            <option value="auto">Auto-detect</option>
            <option value=".">Point (1,250.50)</option>
            <option value=",">Comma (1.250,50)</option>
          </select>
        </div>
        {lang === 'id' && (
          <label><input type="checkbox" checked={rupiah} onChange={(e) => setRupiah(e.target.checked)} /> Add “rupiah”</label>
        )}
        {lang === 'en' && (
          <label title="British style: one hundred and five"><input type="checkbox" checked={useAnd} onChange={(e) => setUseAnd(e.target.checked)} /> “and” after hundreds</label>
        )}
      </div>

      <div className={`nw-out ${result.text ? '' : 'is-empty'}`} aria-live="polite" aria-atomic="true">
        {result.text ? (
          words.map((w, i) => (
            <span key={i}>
              <span className="nw-word"><MorphText text={w} stagger={3} /></span>
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ))
        ) : result.error ? (
          <span className="error shake-once" key={result.error} role="alert">{result.error}</span>
        ) : (
          'The words appear here.'
        )}
      </div>
      <div className="row">
        <CopyButton text={result.text} />
      </div>

      <p className="muted" style={{ marginBottom: 6 }}>Try:</p>
      <div className="nw-examples">
        {EXAMPLES[lang].map((ex) => (
          <button key={ex} type="button" className="btn" onClick={() => setInput(ex)}>{ex}</button>
        ))}
      </div>
      <p className="muted">
        Works exactly (no rounding errors) for whole numbers up to 999 quadrillion / 999 kuadriliun. Auto-detect reads a single separator followed by exactly three digits as thousands (<code>1.250</code> = 1250), so pick the separator yourself for amounts like <code>1.250</code> meaning one and a quarter. Terbilang follows standard Indonesian: <i>seribu</i>, <i>seratus</i>, <i>sebelas</i>, <i>satu juta</i>, and decimals with <i>koma</i>; money amounts are rounded to 2 decimals (<i>sen</i> / cents). Check style prints “… and 75/100 dollars”.
      </p>
    </div>
  )
}
