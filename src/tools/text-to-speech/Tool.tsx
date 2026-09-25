import { useEffect, useMemo, useRef, useState } from 'react'
import Busy from '../../components/Busy'
import Icon from '../../components/Icon'
import PillRow from '../../motion/PillRow'
import { groupVoices, pickDefaultVoice, splitForSpeech, wordAt } from './speech'
import './tool.css'

const SAMPLE =
  'Halo! Ini adalah contoh teks yang dibacakan oleh suara perangkat Anda. ' +
  'You can paste an article, a lesson or your own notes here, pick a voice, and press Play. ' +
  'The word being spoken lights up as it goes, so you can follow along.'

type State = 'idle' | 'speaking' | 'paused'

function supported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
}

export default function TextToSpeech() {
  const [ready, setReady] = useState(false)
  const [ok, setOk] = useState(true)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState('')
  const [text, setText] = useState(SAMPLE)
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(1)
  const [state, setState] = useState<State>('idle')
  const [word, setWord] = useState<[number, number] | null>(null)
  const [chunk, setChunk] = useState<[number, number] | null>(null)
  const [error, setError] = useState('')
  const [spokenText, setSpokenText] = useState('')
  const keep = useRef<SpeechSynthesisUtterance[]>([])
  const run = useRef(0)

  useEffect(() => {
    if (!supported()) {
      setOk(false)
      setReady(true)
      return
    }
    const synth = window.speechSynthesis
    const load = () => {
      const list = synth.getVoices()
      if (list.length) {
        setVoices(list)
        setReady(true)
        setVoiceURI((cur) => cur || pickDefaultVoice(list)?.voiceURI || '')
      }
    }
    load()
    synth.addEventListener('voiceschanged', load)
    // Some browsers never fire voiceschanged when they have no voices at all.
    const t = window.setTimeout(() => setReady(true), 2500)
    return () => {
      synth.removeEventListener('voiceschanged', load)
      window.clearTimeout(t)
      synth.cancel()
    }
  }, [])

  const groups = useMemo(() => groupVoices(voices), [voices])
  const voice = voices.find((v) => v.voiceURI === voiceURI)

  function stop() {
    run.current++
    if (supported()) window.speechSynthesis.cancel()
    keep.current = []
    setState('idle')
    setWord(null)
    setChunk(null)
  }

  function play() {
    if (!supported()) return
    const synth = window.speechSynthesis
    if (state === 'paused') {
      synth.resume()
      setState('speaking')
      return
    }
    stop()
    const body = text
    if (!body.trim()) {
      setError('Type or paste some text first.')
      return
    }
    setError('')
    setSpokenText(body)
    const id = ++run.current
    const chunks = splitForSpeech(body)
    keep.current = chunks.map((c, i) => {
      const u = new SpeechSynthesisUtterance(c.text)
      if (voice) {
        u.voice = voice
        u.lang = voice.lang
      }
      u.rate = rate
      u.pitch = pitch
      u.volume = volume
      u.onstart = () => {
        if (run.current !== id) return
        setState('speaking')
        setChunk([c.start, c.start + c.text.length])
        setWord(null)
      }
      u.onboundary = (e) => {
        if (run.current !== id || e.name === 'sentence') return
        setWord(wordAt(body, c.start + e.charIndex))
      }
      u.onerror = (e) => {
        if (run.current !== id || e.error === 'interrupted' || e.error === 'canceled') return
        setError(`The browser could not speak this (${e.error}). Try another voice.`)
        stop()
      }
      if (i === chunks.length - 1) {
        u.onend = () => {
          if (run.current !== id) return
          setState('idle')
          setWord(null)
          setChunk(null)
        }
      }
      return u
    })
    keep.current.forEach((u) => synth.speak(u))
    setState('speaking')
  }

  function pause() {
    if (!supported()) return
    window.speechSynthesis.pause()
    setState('paused')
  }

  const progress = chunk && spokenText ? (word ? word[1] : chunk[0]) / spokenText.length : 0
  const shown = state === 'idle' ? text : spokenText

  if (ready && !ok) {
    return (
      <div>
        <p className="error" role="alert">This browser has no speech synthesis (Web Speech API), so it cannot read text aloud. Try a recent Chrome, Edge, Safari or Firefox.</p>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor="tts-text">Text to read</label>
      <textarea
        id="tts-text"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (state !== 'idle') stop()
        }}
        style={{ fontFamily: 'inherit', fontSize: '0.98rem', minHeight: 150 }}
        placeholder="Paste or type the text you want to hear…"
      />
      <p className="muted" style={{ fontSize: '0.82rem', margin: '4px 0 0' }}>{text.length.toLocaleString()} characters · about {Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length / (150 * rate)))} min at this speed</p>

      {!ready ? (
        <Busy label="Loading your device's voices…" />
      ) : (
        <>
          <label htmlFor="tts-voice">Voice ({voices.length} available)</label>
          {voices.length ? (
            <select id="tts-voice" value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
              {groups.map((g) => (
                <optgroup key={g.code} label={`${g.label} (${g.voices.length})`}>
                  {g.voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} · {v.lang}{v.localService ? '' : ' · online'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          ) : (
            <p className="muted">No voices reported yet; the browser default voice will be used.</p>
          )}
        </>
      )}

      <div className="tts-sliders">
        <div>
          <label htmlFor="tts-rate">Speed <b className="tts-val">{rate.toFixed(1)}×</b></label>
          <input id="tts-rate" type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="tts-pitch">Pitch <b className="tts-val">{pitch.toFixed(1)}</b></label>
          <input id="tts-pitch" type="range" min={0} max={2} step={0.1} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="tts-vol">Volume <b className="tts-val">{Math.round(volume * 100)}%</b></label>
          <input id="tts-vol" type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        </div>
      </div>

      <div className="row">
        <PillRow label="Playback">
          <button type="button" className={`btn btn-icon ${state === 'speaking' ? 'primary' : ''}`} onClick={state === 'speaking' ? pause : play} disabled={!ready}>
            <Icon key={state} name={state === 'speaking' ? 'pause-circle' : 'play-circle'} size={18} />
            {state === 'speaking' ? 'Pause' : state === 'paused' ? 'Resume' : 'Play'}
          </button>
          <button type="button" className="btn btn-icon" onClick={stop} disabled={state === 'idle'}>
            <Icon name="stop-circle" size={18} /> Stop
          </button>
        </PillRow>
        <span className={`tts-eq ${state === 'speaking' ? 'on' : ''}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span className="muted" role="status" style={{ fontSize: '0.86rem' }}>
          {state === 'speaking' ? 'Speaking…' : state === 'paused' ? 'Paused' : ''}
        </span>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {state !== 'idle' && (
        <>
          <div className="bar" aria-hidden="true"><i style={{ transform: `scaleX(${Math.min(1, Math.max(0.02, progress))})` }} /></div>
          <div className="tts-read output" aria-live="off">
            {chunk ? (
              <>
                {shown.slice(0, chunk[0])}
                <span className="tts-chunk">
                  {word && word[0] >= chunk[0] && word[1] <= chunk[1] ? (
                    <>
                      {shown.slice(chunk[0], word[0])}
                      <mark key={word[0]} className="tts-word">{shown.slice(word[0], word[1])}</mark>
                      {shown.slice(word[1], chunk[1])}
                    </>
                  ) : (
                    shown.slice(chunk[0], chunk[1])
                  )}
                </span>
                {shown.slice(chunk[1])}
              </>
            ) : (
              shown
            )}
          </div>
        </>
      )}

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Voices come from your device and browser, so the list differs between Windows, macOS, Android and iOS; voices marked “online” are streamed by the browser vendor.
        Word highlighting depends on the voice reporting word boundaries, and some voices only report sentences.
        The Web Speech API plays audio directly and does not give the page the sound, so saving the speech as an MP3 file is not possible here.
      </p>
    </div>
  )
}
