import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Choice, Hint, Select, Slider, Toggle } from '../../sim/controls'
import { CHORDS, isBlack, keyToMidi, layout, midiToKey, NAMES, noteName, pc, pitchClasses, SCALES, spell, type ChordId, type ScaleId } from './logic'
import { lazySynth, type Voice } from './synth'
import './tool.css'

type Mode = 'none' | 'scale' | 'chord'

export default function VirtualPiano() {
  const [octaves, setOctaves] = useState(2)
  const [start, setStart] = useState(3)
  const [shift, setShift] = useState(0)
  const [sustain, setSustain] = useState(false)
  const [names, setNames] = useState(true)
  const [mode, setMode] = useState<Mode>('scale')
  const [root, setRoot] = useState(0)
  const [scale, setScale] = useState<ScaleId>('major')
  const [chord, setChord] = useState<ChordId>('maj')
  const [volume, setVolume] = useState(80)
  const [down, setDown] = useState<Set<number>>(new Set())
  const [recent, setRecent] = useState<{ id: number; midi: number }[]>([])
  const synth = useRef(lazySynth())
  const voices = useRef(new Map<number, Voice>())
  const ringing = useRef<Voice[]>([])
  const pointers = useRef(new Map<number, number>())
  const nextId = useRef(0)
  const live = useRef({ sustain })
  live.current = { sustain }

  useEffect(() => {
    if (window.innerWidth >= 900) setOctaves(3)
    const s = synth.current
    return () => s.close()
  }, [])

  function press(midi: number) {
    const s = synth.current.get()
    if (!s) return
    s.volume = volume / 100
    voices.current.get(midi)?.stop()
    voices.current.set(midi, s.noteOn(midi, 0.85))
    setDown((d) => new Set(d).add(midi))
    setRecent((r) => [...r.slice(-13), { id: nextId.current++, midi }])
  }

  function release(midi: number) {
    const v = voices.current.get(midi)
    if (v && live.current.sustain) ringing.current.push(v)
    else v?.stop()
    voices.current.delete(midi)
    setDown((d) => {
      const n = new Set(d)
      n.delete(midi)
      return n
    })
  }

  // Letting go of sustain damps everything that is not held.
  useEffect(() => {
    if (sustain) return
    ringing.current.forEach((v) => v.stop())
    ringing.current = []
  }, [sustain])

  const base = (start + 1 + shift) * 12
  const act = useRef({ press, release, base })
  act.current = { press, release, base }

  useEffect(() => {
    const held = new Map<string, number>()
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'z') return setShift((s) => Math.max(-2, s - 1))
      if (e.key === 'x') return setShift((s) => Math.min(2, s + 1))
      const m = keyToMidi(e.key, act.current.base)
      if (m === null) return
      e.preventDefault()
      held.set(e.key.toLowerCase(), m)
      act.current.press(m)
    }
    const onUp = (e: KeyboardEvent) => {
      const m = held.get(e.key.toLowerCase())
      if (m === undefined) return
      held.delete(e.key.toLowerCase())
      act.current.release(m)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      held.forEach((m) => act.current.release(m))
    }
  }, [])

  const midiAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-midi]')
    return el ? Number(el.dataset.midi) : null
  }
  function onPointerDown(e: RPointerEvent<HTMLDivElement>) {
    const m = midiAt(e.clientX, e.clientY)
    if (m === null) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, m)
    press(m)
  }
  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    const cur = pointers.current.get(e.pointerId)
    if (cur === undefined) return
    const m = midiAt(e.clientX, e.clientY)
    if (m === null || m === cur) return
    release(cur)
    pointers.current.set(e.pointerId, m)
    press(m)
  }
  function onPointerUp(e: RPointerEvent<HTMLDivElement>) {
    const cur = pointers.current.get(e.pointerId)
    if (cur === undefined) return
    pointers.current.delete(e.pointerId)
    release(cur)
  }

  const keys = layout(start, octaves)
  const whites = keys.filter((k) => !k.black).length
  const steps = mode === 'scale' ? SCALES[scale].steps : mode === 'chord' ? CHORDS[chord].steps : []
  const lit = mode === 'none' ? new Set<number>() : pitchClasses(root, steps)
  const label = mode === 'scale' ? `${NAMES[root]} ${SCALES[scale].name}` : mode === 'chord' ? `${NAMES[root]} ${CHORDS[chord].name}` : ''

  return (
    <div className="pk">
      <div className="pk-scroll">
        <div className="pk-keys" style={{ '--whites': whites } as React.CSSProperties} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onContextMenu={(e) => e.preventDefault()} role="group" aria-label="Piano keys">
          {keys.map((k) => {
            const hot = lit.has(pc(k.midi))
            const isRoot = hot && pc(k.midi) === root
            const comp = midiToKey(k.midi, base)
            return (
              <div
                key={k.midi}
                data-midi={k.midi}
                role="button"
                aria-label={noteName(k.midi)}
                aria-pressed={down.has(k.midi)}
                className={`pk-key ${k.black ? 'black' : 'white'} ${down.has(k.midi) ? 'down' : ''} ${hot ? 'hot' : ''} ${isRoot ? 'root' : ''}`}
                style={{ left: `calc(${k.x} * 100% / var(--whites))` }}
              >
                {hot && <i className="pk-dot" />}
                {names && !isBlack(k.midi) && <span className="pk-name">{noteName(k.midi)}</span>}
                {comp && <kbd>{comp}</kbd>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="pk-recent" aria-live="off">
        {recent.length === 0 ? <span className="muted">Notes you play show up here.</span> : recent.map((r) => <span key={r.id} className="chip pop">{noteName(r.midi)}</span>)}
      </div>
      {label && <p className="pk-label settle-in" key={label}><b>{label}:</b> {spell(root, steps).join(' · ')}</p>}

      <div className="two-col">
        <div>
          <Choice label="Highlight" value={mode} options={[['none', 'Off'], ['scale', 'Scale'], ['chord', 'Chord']]} onChange={setMode} />
          {mode !== 'none' && (
            <div className="pk-pick">
              <Select label="Key" value={String(root)} options={NAMES.map((n, i) => [String(i), n] as const)} onChange={(v) => setRoot(Number(v))} />
              {mode === 'scale' ? (
                <Select label="Scale" value={scale} options={Object.entries(SCALES).map(([id, s]) => [id as ScaleId, s.name] as const)} onChange={setScale} />
              ) : (
                <Select label="Chord" value={chord} options={Object.entries(CHORDS).map(([id, s]) => [id as ChordId, s.name] as const)} onChange={setChord} />
              )}
            </div>
          )}
          {mode === 'chord' && <button type="button" className="btn pk-playchord" onClick={() => {
            const s = synth.current.get()
            if (!s) return
            CHORDS[chord].steps.forEach((st, i) => s.play((start + 2) * 12 + root + st, s.ctx.currentTime + i * 0.05, 1.4))
          }}>Play chord</button>}
        </div>
        <div>
          <Choice label="Octaves" value={octaves} options={[[2, '2'], [3, '3'], [4, '4']]} onChange={setOctaves} />
          <Choice label="Starts at" value={start} options={[[2, 'C2'], [3, 'C3'], [4, 'C4']]} onChange={(v) => { setStart(v); setShift(0) }} />
          <Toggle label="Sustain pedal" checked={sustain} onChange={setSustain} />
          <Toggle label="Show note names" checked={names} onChange={setNames} />
          <Slider label="Volume" value={volume} min={0} max={100} unit="%" onChange={setVolume} />
        </div>
      </div>
      <Hint>Play with a mouse, several fingers, or your keyboard: A W S E D F T G Y H U J K… (Z and X shift the octave). Highlighted keys show the chosen scale or chord, with the root in orange.</Hint>
    </div>
  )
}
