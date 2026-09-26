import { useEffect, useRef, useState } from 'react'
import { Hint, Slider } from '../../sim/controls'
import Icon from '../../components/Icon'
import CopyButton from '../../components/CopyButton'
import Roll from '../../motion/Roll'
import { decode, DRUMS, dueSteps, emptyPattern, encode, fromRows, PRESETS, randomPattern, STEPS, type Cursor, type Pattern } from './logic'
import { DrumKit } from './kit'
import './tool.css'

const KEY = '4lltools:drum-machine'
const LOOKAHEAD = 0.12

interface Saved { code: string; vols: number[]; mutes: boolean[] }

export default function DrumMachine() {
  const first = PRESETS[0]
  const [pattern, setPattern] = useState<Pattern>(() => fromRows(first.rows))
  const [bpm, setBpm] = useState(first.bpm)
  const [swing, setSwing] = useState(first.swing)
  const [vols, setVols] = useState<number[]>(() => DRUMS.map(() => 80))
  const [mutes, setMutes] = useState<boolean[]>(() => DRUMS.map(() => false))
  const [playing, setPlaying] = useState(false)
  const [step, setStep] = useState(-1)
  const [preset, setPreset] = useState(first.name)
  const [error, setError] = useState(false)
  const kit = useRef<DrumKit | null>(null)
  const live = useRef({ pattern, bpm, swing, vols, mutes })
  live.current = { pattern, bpm, swing, vols, mutes }
  const cursor = useRef<Cursor>({ next: 0, step: 0 })
  const queue = useRef<{ step: number; time: number }[]>([])
  const timer = useRef(0)
  const raf = useRef(0)
  const ready = useRef(false)
  const paint = useRef<boolean | null>(null)

  // Restore: a shared link wins over the saved pattern.
  useEffect(() => {
    const fromHash = decode(location.hash)
    let saved: Saved | null = null
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    } catch {
      saved = null
    }
    const song = fromHash ?? (saved ? decode(saved.code) : null)
    if (song) {
      setPattern(song.pattern)
      setBpm(song.bpm)
      setSwing(song.swing)
      setPreset('')
    }
    if (saved && Array.isArray(saved.vols) && saved.vols.length === DRUMS.length) setVols(saved.vols)
    if (saved && Array.isArray(saved.mutes) && saved.mutes.length === DRUMS.length) setMutes(saved.mutes)
    ready.current = true
    return () => {
      clearInterval(timer.current)
      cancelAnimationFrame(raf.current)
      kit.current?.close()
    }
  }, [])

  const code = encode({ pattern, bpm, swing })
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify({ code, vols, mutes } satisfies Saved))
    } catch {
      // Storage is optional.
    }
  }, [code, vols, mutes])

  function getKit() {
    try {
      kit.current ??= new DrumKit()
      void kit.current.ctx.resume()
      return kit.current
    } catch {
      setError(true)
      return null
    }
  }

  function start() {
    const k = getKit()
    if (!k) return
    cursor.current = { next: k.ctx.currentTime + 0.05, step: 0 }
    queue.current = []
    const run = () => {
      const s = live.current
      const r = dueSteps(cursor.current, k.ctx.currentTime + LOOKAHEAD, s.bpm, s.swing)
      cursor.current = r.cursor
      for (const due of r.steps) {
        DRUMS.forEach((_, row) => {
          if (s.pattern[row][due.step] && !s.mutes[row]) k.play(DRUMS[row].id, due.time, s.vols[row] / 100)
        })
        queue.current.push(due)
      }
    }
    run()
    timer.current = window.setInterval(run, 25)
    const draw = () => {
      raf.current = requestAnimationFrame(draw)
      const now = k.ctx.currentTime
      let cur = -1
      while (queue.current.length && queue.current[0].time <= now) cur = queue.current.shift()!.step
      if (cur >= 0) setStep(cur)
    }
    raf.current = requestAnimationFrame(draw)
    setPlaying(true)
  }

  function stop() {
    clearInterval(timer.current)
    cancelAnimationFrame(raf.current)
    setPlaying(false)
    setStep(-1)
  }

  function toggleCell(r: number, i: number, value?: boolean) {
    setPattern((p) => p.map((row, ri) => (ri === r ? row.map((on, ii) => (ii === i ? (value ?? !on) : on)) : row)))
    setPreset('')
  }

  function loadPreset(name: string) {
    const p = PRESETS.find((x) => x.name === name)!
    setPattern(fromRows(p.rows))
    setBpm(p.bpm)
    setSwing(p.swing)
    setPreset(name)
  }

  const shareUrl = typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}#${code}`

  return (
    <div className="dm">
      <div className="row dm-top">
        <button type="button" className="btn primary btn-icon dm-play" onClick={playing ? stop : start} aria-pressed={playing}>
          <Icon key={playing ? 's' : 'p'} name={playing ? 'stop-circle' : 'play-circle'} size={20} />
          {playing ? 'Stop' : 'Play'}
        </button>
        <div className="dm-bpm"><b><Roll>{String(bpm)}</Roll></b> BPM</div>
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className={`btn ${preset === p.name ? 'primary' : ''}`} onClick={() => loadPreset(p.name)}>{p.name}</button>
        ))}
      </div>
      {error && <p className="error">Your browser could not start Web Audio.</p>}

      <div className="dm-scroll">
        <div className="dm-grid" onPointerUp={() => (paint.current = null)} onPointerLeave={() => (paint.current = null)}>
          {DRUMS.map((d, r) => (
            <div key={d.id} className={`dm-row ${mutes[r] ? 'muted' : ''}`} style={{ '--hue': `${r * 45}` } as React.CSSProperties}>
              <div className="dm-label">
                <button type="button" className="dm-name" onClick={() => { const k = getKit(); k?.play(d.id, k.ctx.currentTime, vols[r] / 100) }}>{d.name}</button>
                <button type="button" className={`dm-mute ${mutes[r] ? 'on' : ''}`} aria-pressed={mutes[r]} aria-label={`Mute ${d.name}`} onClick={() => setMutes((m) => m.map((x, i) => (i === r ? !x : x)))}>M</button>
              </div>
              {pattern[r].map((on, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${d.name} step ${i + 1}`}
                  aria-pressed={on}
                  className={`dm-cell ${on ? 'on' : ''} ${i === step ? 'now' : ''} ${i % 4 === 0 ? 'beat' : ''}`}
                  onPointerDown={(e) => { if (e.pointerType === 'mouse') paint.current = !on; toggleCell(r, i, !on) }}
                  onPointerEnter={() => paint.current !== null && paint.current !== on && toggleCell(r, i, paint.current)}
                  onClick={(e) => e.detail === 0 && toggleCell(r, i)}
                />
              ))}
            </div>
          ))}
          <div className="dm-row dm-ruler" aria-hidden="true">
            <div className="dm-label" />
            {Array.from({ length: STEPS }, (_, i) => <span key={i} className={i === step ? 'now' : ''}>{i % 4 === 0 ? i / 4 + 1 : '·'}</span>)}
          </div>
        </div>
      </div>

      <div className="row">
        <button type="button" className="btn btn-icon" onClick={() => { setPattern(randomPattern()); setPreset('') }}><Icon name="lightning-bolt" size={18} /> Randomize</button>
        <button type="button" className="btn btn-icon" onClick={() => { setPattern(emptyPattern()); setPreset('') }}><Icon name="delete-bin" size={18} /> Clear</button>
        <CopyButton text={shareUrl} label="Copy share link" />
      </div>

      <div className="two-col">
        <div>
          <Slider label="Tempo" value={bpm} min={60} max={200} unit=" BPM" onChange={setBpm} />
          <Slider label="Swing" value={swing} min={50} max={75} onChange={setSwing} format={(v) => (v === 50 ? 'Straight' : `${v}%`)} />
        </div>
        <details className="dm-mixer">
          <summary>Mixer</summary>
          {DRUMS.map((d, r) => (
            <Slider key={d.id} label={d.name} value={vols[r]} min={0} max={100} unit="%" onChange={(v) => setVols((a) => a.map((x, i) => (i === r ? v : x)))} />
          ))}
        </details>
      </div>
      <Hint>Tap or drag across the grid to place hits, then press Play. Tap a drum name to hear it and M to mute it. Your beat is saved in this browser, and the share link carries the pattern in its address.</Hint>
    </div>
  )
}
