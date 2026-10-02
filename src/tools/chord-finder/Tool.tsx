import { useEffect, useRef, useState } from 'react'
import { Hint, Slider } from '../../sim/controls'
import Icon from '../../components/Icon'
import CopyButton from '../../components/CopyButton'
import { lazySynth } from '../piano-keyboard/synth'
import Diagram from './Diagram'
import { chordName, chordNotes, parseRoot, QUALITIES, ROOTS, transposeText, voicingMidi, voicings, type Quality } from './logic'
import './tool.css'

const SAMPLE = `Intro:  C  G  Am  F
C              G
  Kau begitu sempurna
Am             F
  Di mataku kau begitu indah
Dm7    G7sus4   C`

const QUALITY_IDS = Object.keys(QUALITIES) as Quality[]

export default function ChordFinder() {
  const [root, setRoot] = useState(0)
  const [quality, setQuality] = useState<Quality>('')
  const [idx, setIdx] = useState(0)
  const [capo, setCapo] = useState(0)
  const [sheet, setSheet] = useState(SAMPLE)
  const [shift, setShift] = useState(0)
  const [strumming, setStrumming] = useState(0)
  const synth = useRef(lazySynth())

  useEffect(() => {
    const s = synth.current
    return () => s.close()
  }, [])

  // With a capo, you play the shape of a lower chord that sounds as the chosen one.
  const shapeRoot = (((root - capo) % 12) + 12) % 12
  const list = voicings(shapeRoot, quality)
  const v = list[Math.min(idx, list.length - 1)]
  const name = chordName(root, quality)
  const shapeName = chordName(shapeRoot, quality)

  function strum(down = true) {
    const s = synth.current.get()
    if (!s || !v) return
    const notes = voicingMidi(v.frets, capo)
    const order = down ? notes : [...notes].reverse()
    const t = s.ctx.currentTime + 0.02
    order.forEach((m, i) => s.play(m, t + i * 0.035, 1.6, 0.7, 'pluck'))
    setStrumming((n) => n + 1)
  }

  function pick(r: number, q: Quality) {
    setRoot(r)
    setQuality(q)
    setIdx(0)
  }

  const transposed = transposeText(sheet, shift)
  const sheetChords = [...new Set(transposed.match(/\b[A-G][#b]?(?:m7b5|maj7|m7|sus2|sus4|add9|dim|aug|m|7|6)?(?=\s|$|\/)/g) ?? [])].slice(0, 16)

  return (
    <div className="cf">
      <div className="cf-main">
        <div className={`cf-card ${strumming ? 'strum' : ''}`} key={strumming}>
          <div className="cf-title">
            <b key={name} className="pop">{name}</b>
            <span className="muted">{chordNotes(root, quality).join(' · ')}</span>
          </div>
          {v ? (
            <button type="button" className="cf-diagram-btn" onClick={() => strum()} aria-label={`Strum ${name}`}>
              <Diagram v={v} capo={capo} name={name} />
            </button>
          ) : (
            <p className="muted">No voicing for this chord yet.</p>
          )}
          <div className="row cf-voicing">
            <button type="button" className="btn" disabled={list.length < 2} onClick={() => setIdx((i) => (i - 1 + list.length) % list.length)} aria-label="Previous voicing">‹</button>
            <span>{v ? `${v.kind} · ${Math.min(idx, list.length - 1) + 1}/${list.length}` : ''}</span>
            <button type="button" className="btn" disabled={list.length < 2} onClick={() => setIdx((i) => (i + 1) % list.length)} aria-label="Next voicing">›</button>
          </div>
          {capo > 0 && <p className="cf-capo-note settle-in">Capo on fret {capo}: play the <b>{shapeName}</b> shape, it sounds as <b>{name}</b>.</p>}
          <div className="row cf-strum">
            <button type="button" className="btn primary btn-icon" onClick={() => strum(true)}><Icon name="music-note" size={18} /> Strum down</button>
            <button type="button" className="btn" onClick={() => strum(false)}>Strum up</button>
          </div>
        </div>

        <div className="cf-pickers">
          <span className="sim-label">Root</span>
          <div className="cf-roots" role="group" aria-label="Root note">
            {ROOTS.map((r, i) => (
              <button key={r} type="button" className={`btn ${root === i ? 'primary' : ''}`} aria-pressed={root === i} onClick={() => pick(i, quality)}>{r}</button>
            ))}
          </div>
          <span className="sim-label">Type</span>
          <div className="cf-quals" role="group" aria-label="Chord type">
            {QUALITY_IDS.map((q) => (
              <button key={q || 'maj'} type="button" className={`btn ${quality === q ? 'primary' : ''}`} aria-pressed={quality === q} onClick={() => pick(root, q)}>{QUALITIES[q].name}</button>
            ))}
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => pick((root + 11) % 12, quality)}>♭ Transpose down</button>
            <button type="button" className="btn" onClick={() => pick((root + 1) % 12, quality)}>♯ Transpose up</button>
          </div>
          <Slider label="Capo" value={capo} min={0} max={7} onChange={(c) => { setCapo(c); setIdx(0) }} format={(c) => (c ? `Fret ${c}` : 'None')} />
        </div>
      </div>

      <section className="cf-sheet">
        <h3>Chord sheet transposer</h3>
        <textarea value={sheet} onChange={(e) => setSheet(e.target.value)} rows={6} spellCheck={false} aria-label="Chord sheet" />
        <div className="row">
          <button type="button" className="btn" onClick={() => setShift((s) => s - 1)} aria-label="Down a semitone">−1</button>
          <span className="cf-shift"><b>{shift > 0 ? `+${shift}` : shift}</b> semitones</span>
          <button type="button" className="btn" onClick={() => setShift((s) => s + 1)} aria-label="Up a semitone">+1</button>
          <button type="button" className="btn" onClick={() => setShift(0)} disabled={!shift}>Reset</button>
          <CopyButton text={transposed} label="Copy result" />
        </div>
        <pre className="output cf-out" key={shift}>{transposed}</pre>
        <div className="cf-chips">
          {sheetChords.map((c) => {
            const m = c.match(/^([A-G][#b]?)(.*)$/)!
            const r = parseRoot(m[1])
            const q = m[2] as Quality
            if (r === null || !(q in QUALITIES)) return null
            return <button key={c} type="button" className="chip pop" onClick={() => pick(r, q)}>{c}</button>
          })}
        </div>
      </section>
      <Hint>Pick a root and chord type to see where your fingers go; tap the diagram to hear it. Paste a song's chords below and shift them to a key that suits your voice. Tap a chord chip to see its shape.</Hint>
    </div>
  )
}
