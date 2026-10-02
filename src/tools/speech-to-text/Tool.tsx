import { useEffect, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { useReplay } from '../../motion/useReplay'
import { LANGUAGES, appendPhrase, applyCommands, describeError } from './transcript'
import './tool.css'

/* The Web Speech recognition API is not in TypeScript's DOM types, so describe the parts used here. */
interface RecAlternative { transcript: string }
interface RecResult { isFinal: boolean; length: number; [i: number]: RecAlternative }
interface RecEvent { resultIndex: number; results: { length: number; [i: number]: RecResult } }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecCtor = new () => Recognition

function getCtor(): RecCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

type Status = 'idle' | 'starting' | 'listening'

export default function SpeechToText() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [lang, setLang] = useState('id-ID')
  const [continuous, setContinuous] = useState(true)
  const [interim, setInterim] = useState(true)
  const [commands, setCommands] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [hearing, setHearing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [partial, setPartial] = useState('')
  const [error, setError] = useState('')
  const rec = useRef<Recognition | null>(null)
  const wanted = useRef(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const opts = useRef({ commands })
  opts.current = { commands }
  useReplay(box, transcript.length, 'refresh', 300)

  useEffect(() => {
    setSupported(!!getCtor())
    return () => {
      wanted.current = false
      rec.current?.abort()
    }
  }, [])

  function start() {
    const Ctor = getCtor()
    if (!Ctor) return
    setError('')
    const r = new Ctor()
    r.lang = lang
    r.continuous = continuous
    r.interimResults = interim
    r.onstart = () => setStatus('listening')
    r.onspeechstart = () => setHearing(true)
    r.onspeechend = () => setHearing(false)
    r.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const said = res[0]?.transcript ?? ''
        if (res.isFinal) {
          setTranscript((t) => (opts.current.commands ? applyCommands(appendPhrase(t, said)) : appendPhrase(t, said)))
        } else live += said
      }
      setPartial(live)
    }
    r.onerror = (e) => {
      if (e.error === 'aborted') return
      if (e.error === 'no-speech' && wanted.current && continuous) return // keep listening
      setError(describeError(e.error))
      if (e.error !== 'no-speech') wanted.current = false
    }
    r.onend = () => {
      setHearing(false)
      setPartial('')
      // Chrome ends a session after a pause even in continuous mode; restart while the user wants it.
      if (wanted.current && continuous) {
        try {
          r.start()
          return
        } catch {
          /* fall through to idle */
        }
      }
      wanted.current = false
      setStatus('idle')
    }
    rec.current = r
    wanted.current = true
    setStatus('starting')
    try {
      r.start()
    } catch (err) {
      wanted.current = false
      setStatus('idle')
      setError(err instanceof Error ? err.message : 'Could not start the microphone.')
    }
  }

  function stop() {
    wanted.current = false
    rec.current?.stop()
  }

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([transcript], { type: 'text/plain;charset=utf-8' }))
    a.download = 'transcript.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0
  const active = status !== 'idle'

  if (supported === false) {
    return (
      <div>
        <p className="error" role="alert">
          This browser does not support speech recognition (the Web Speech API). It works in Chrome, Edge and Safari on desktop and mobile; Firefox does not support it yet.
        </p>
        <label htmlFor="stt-text">Transcript</label>
        <textarea id="stt-text" value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="You can still type or paste here." style={{ fontFamily: 'inherit' }} />
      </div>
    )
  }

  return (
    <div>
      <div className="row">
        <label htmlFor="stt-lang">Language</label>
        <select id="stt-lang" value={lang} onChange={(e) => setLang(e.target.value)} disabled={active} style={{ width: 'auto', maxWidth: '100%' }}>
          {LANGUAGES.map(([code, label]) => (
            <option key={code} value={code}>{label} · {code}</option>
          ))}
        </select>
      </div>
      <div className="row" style={{ gap: 16 }}>
        <label style={{ fontWeight: 400 }}><input type="checkbox" checked={continuous} disabled={active} onChange={(e) => setContinuous(e.target.checked)} /> Keep listening</label>
        <label style={{ fontWeight: 400 }}><input type="checkbox" checked={interim} disabled={active} onChange={(e) => setInterim(e.target.checked)} /> Show words as I speak</label>
        <label style={{ fontWeight: 400 }}><input type="checkbox" checked={commands} onChange={(e) => setCommands(e.target.checked)} /> Punctuation commands</label>
      </div>

      <div className="stt-stage">
        <button
          type="button"
          className={`stt-mic ${active ? 'on' : ''} ${hearing ? 'hearing' : ''}`}
          onClick={active ? stop : start}
          disabled={supported === null}
          aria-pressed={active}
          aria-label={active ? 'Stop listening' : 'Start listening'}
        >
          <span className="stt-ring" aria-hidden="true" />
          <span className="stt-ring r2" aria-hidden="true" />
          <Icon name={active ? 'stop-circle' : 'microphone'} size={34} />
        </button>
        <div style={{ minWidth: 0 }}>
          <b role="status" className="stt-state">
            {status === 'starting' ? 'Waiting for the microphone…' : status === 'listening' ? (hearing ? 'Hearing you…' : 'Listening — start speaking') : 'Press the mic to start'}
          </b>
          <span className={`stt-wave ${hearing ? 'on' : active ? 'idle' : ''}`} aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 5) * 0.09}s` }} />)}
          </span>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <label htmlFor="stt-text">Transcript <span className="muted" style={{ fontWeight: 400 }}>(you can edit it)</span></label>
      <textarea
        ref={box}
        id="stt-text"
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder={active ? 'Speak and your words appear here…' : 'Press the mic and speak. Try: “halo semua koma apa kabar tanda tanya”.'}
        style={{ fontFamily: 'inherit', fontSize: '1rem', minHeight: 180 }}
      />
      {partial && <p className="stt-partial" aria-live="off">{partial}</p>}
      <div className="row">
        <span className="chip"><Roll>{words}</Roll>&nbsp;words</span>
        <CopyButton text={transcript} />
        <button type="button" className="btn btn-icon" onClick={download} disabled={!transcript}><Icon name="file" size={18} /> Download .txt</button>
        <button type="button" className="btn btn-icon" onClick={() => setTranscript('')} disabled={!transcript}><Icon name="delete-bin" size={18} /> Clear</button>
      </div>

      <details>
        <summary>Punctuation commands</summary>
        <p className="muted" style={{ fontSize: '0.88rem' }}>
          Say <b>comma / koma</b>, <b>period / full stop / titik</b>, <b>question mark / tanda tanya</b>, <b>exclamation mark / tanda seru</b>,
          <b> colon / titik dua</b>, <b>semicolon / titik koma</b>, <b>new line / baris baru</b> or <b>new paragraph / paragraf baru</b>.
          Turn the option off if you need those words written out.
        </p>
      </details>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Privacy note: unlike most tools on this site, speech recognition is done by your browser’s speech service, not on this page.
        Chrome and Edge send your audio to Google or Microsoft servers to transcribe it, and Safari may use Apple’s servers, so the audio does leave your device.
        Works in Chrome, Edge and Safari; Firefox does not support it. Accuracy depends on your microphone and the language chosen.
      </p>
    </div>
  )
}
