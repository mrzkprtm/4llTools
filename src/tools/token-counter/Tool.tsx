import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { useSettled } from '../../motion/useSettled'
import { CONTEXT_WINDOWS, ENCODINGS, ESTIMATES, countWords, estimateTokens, loadEncoder, showWhitespace, toPieces, usage, type Encoder, type EncodingName } from './tokens'
import './tool.css'

const SAMPLE = `You are a helpful assistant. Summarise the customer email below in three bullet points, then suggest a friendly reply.

Email: "Hi team, my order #48213 arrived yesterday but the blue mug was chipped 😢. Could you send a replacement? Terima kasih!"`

const VIS_CAP = 3000
const cache = new Map<EncodingName, Promise<Encoder>>()
function getEncoder(name: EncodingName) {
  let p = cache.get(name)
  if (!p) {
    p = loadEncoder(name)
    cache.set(name, p)
    p.catch(() => cache.delete(name))
  }
  return p
}

export default function TokenCounter() {
  const [text, setText] = useState(SAMPLE)
  const [encName, setEncName] = useState<EncodingName>('o200k_base')
  const [encoder, setEncoder] = useState<{ name: EncodingName; enc: Encoder } | null>(null)
  const [error, setError] = useState('')
  const [showIds, setShowIds] = useState(false)
  const deferred = useDeferredValue(text)

  useEffect(() => {
    let alive = true
    setError('')
    getEncoder(encName)
      .then((enc) => alive && setEncoder({ name: encName, enc }))
      .catch(() => alive && setError('The tokenizer could not be downloaded. Check your connection and try again.'))
    return () => {
      alive = false
    }
  }, [encName])

  const ready = encoder?.name === encName
  const tokens = useMemo(() => (ready && encoder ? encoder.enc.encode(deferred) : null), [ready, encoder, deferred])
  const pieces = useMemo(() => (tokens && encoder ? toPieces(tokens, encoder.enc.decode, VIS_CAP) : []), [tokens, encoder])
  const count = tokens?.length ?? 0
  const chars = [...deferred].length
  const words = countWords(deferred)
  const settled = useSettled(count, 350)
  const stale = deferred !== text

  return (
    <div>
      <label htmlFor="tk-in">Prompt or text</label>
      <textarea id="tk-in" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 180 }} placeholder="Paste a prompt, a document or code…" />

      <PillRow label="Tokenizer" style={{ marginTop: 12 }}>
        {ENCODINGS.map((e) => (
          <button key={e.id} type="button" className={`btn ${encName === e.id ? 'primary' : ''}`} aria-pressed={encName === e.id} onClick={() => setEncName(e.id)}>
            {e.label}
          </button>
        ))}
      </PillRow>
      <p className="muted" style={{ fontSize: '0.85rem', margin: '-6px 0 0' }}>{ENCODINGS.find((e) => e.id === encName)?.models}</p>

      {error && <p className="error" role="alert">{error}</p>}
      {!ready && !error && <Busy label="Downloading the tokenizer (first time only)…" />}

      <div className={`stats ${stale ? 'tk-stale' : ''}`}>
        <div key={`t${settled}`} className={`stat tk-main ${settled ? 'settle' : ''}`}>
          <b>{ready ? <Roll>{count.toLocaleString()}</Roll> : '…'}</b>
          <span>GPT tokens (exact)</span>
        </div>
        <div className="stat"><b><Roll>{chars.toLocaleString()}</Roll></b><span>Characters</span></div>
        <div className="stat"><b><Roll>{words.toLocaleString()}</Roll></b><span>Words</span></div>
        <div className="stat"><b>{ready && count ? (chars / count).toFixed(2) : '–'}</b><span>Characters per token</span></div>
      </div>

      <h3 className="tk-h">Other models (estimates)</h3>
      <div className="stats" style={{ marginTop: 6 }}>
        {ESTIMATES.map((m) => (
          <div key={m.id} className="stat">
            <b>≈ <Roll>{estimateTokens(deferred, m.charsPerToken).toLocaleString()}</Roll></b>
            <span>{m.label}</span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: '0.82rem' }}>
        Anthropic, Google and Meta don’t ship a tokenizer that runs in the browser, so these are rough estimates from characters
        (Claude ≈ characters ÷ 3.5, Gemini and Llama ≈ characters ÷ 4). Real counts can differ by 10–30%, more for code or non-English text.
      </p>

      <h3 className="tk-h">Context window used</h3>
      <div className="tk-windows">
        {CONTEXT_WINDOWS.map((w) => {
          const u = usage(count, w.size)
          return (
            <div key={w.size} className="tk-win">
              <span className="tk-win-label">{w.label}</span>
              <div className="bar" role="meter" aria-label={`${w.label} context window`} aria-valuemin={0} aria-valuemax={w.size} aria-valuenow={Math.min(count, w.size)}>
                <i className={u.over ? 'tk-over' : u.ratio > 0.8 ? 'tk-warn' : undefined} style={{ transform: `scaleX(${Math.max(0.004, u.ratio)})` }} />
              </div>
              <span className={`tk-win-pct ${u.over ? 'error' : ''}`}>{u.over ? 'too long' : `${(u.ratio * 100).toFixed(u.ratio < 0.01 ? 2 : 1)}%`}</span>
            </div>
          )
        })}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 22 }}>
        <h3 className="tk-h" style={{ margin: 0 }}>How the text is split</h3>
        <div className="row" style={{ margin: 0 }}>
          <label style={{ fontWeight: 400 }}><input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} /> Show token IDs</label>
          <CopyButton text={tokens ? tokens.join(', ') : ''} label="Copy IDs" />
        </div>
      </div>
      <div className="tk-vis" aria-label="Tokens">
        {pieces.map((p, i) => (
          <span key={i} className={`tk-tok tk-c${i % 5}`} title={`Token ${p.ids.join(' + ')}`} style={i < 120 ? { animationDelay: `${i * 6}ms` } : { animation: 'none' }}>
            {showIds ? p.ids.join(' ') : showWhitespace(p.text)}
          </span>
        ))}
        {!pieces.length && <span className="muted">{ready ? 'Tokens appear here.' : ''}</span>}
      </div>
      {tokens && tokens.length > VIS_CAP && <p className="muted" style={{ fontSize: '0.82rem' }}>Showing the first {VIS_CAP.toLocaleString()} tokens; the count above covers all {tokens.length.toLocaleString()}.</p>}
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        GPT counts use OpenAI’s real byte-pair encodings (the gpt-tokenizer library), run entirely in your browser. Chat APIs add a few extra tokens per message for roles and formatting.
      </p>
    </div>
  )
}
