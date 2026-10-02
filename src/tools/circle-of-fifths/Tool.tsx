import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import { Choice, Hint } from '../../sim/controls'
import { lazySynth } from '../piano-keyboard/synth'
import { CIRCLE, diatonic, keySignature, majorTonic, nearestAngle, neighbors, relativeMinor } from './logic'
import Staff from './Staff'
import './tool.css'

const C = 180
const R_OUT = 172
const R_MID = 118
const R_IN = 72
const SEG = 30

const polar = (r: number, deg: number) => [C + r * Math.sin((deg * Math.PI) / 180), C - r * Math.cos((deg * Math.PI) / 180)]

function wedge(r1: number, r2: number, a: number) {
  const [x1, y1] = polar(r2, a - SEG / 2)
  const [x2, y2] = polar(r2, a + SEG / 2)
  const [x3, y3] = polar(r1, a + SEG / 2)
  const [x4, y4] = polar(r1, a - SEG / 2)
  return `M${x1} ${y1}A${r2} ${r2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`
}

export default function CircleOfFifths() {
  const [pos, setPos] = useState(0)
  const [flat6, setFlat6] = useState(false)
  const [minor, setMinor] = useState(false)
  const [angle, setAngle] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [playingIdx, setPlayingIdx] = useState(-1)
  const drag = useRef<{ start: number; base: number; moved: boolean } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const synth = useRef(lazySynth())

  useEffect(() => {
    const s = synth.current
    return () => s.close()
  }, [])

  const fifths = pos === 6 && flat6 ? -6 : CIRCLE[pos]
  const { scale, chords } = diatonic(fifths, minor)
  const sig = keySignature(fifths)
  const nb = neighbors(fifths)
  const tonic = minor ? relativeMinor(fifths) : majorTonic(fifths)

  function select(p: number) {
    const i = ((p % 12) + 12) % 12
    setPos(i)
    setAngle((a) => nearestAngle(a, -i * SEG))
  }

  const pointerDeg = (e: RPE) => {
    const r = svg.current!.getBoundingClientRect()
    return (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI
  }
  function onDown(e: RPE<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { start: pointerDeg(e), base: angle, moved: false }
  }
  function onMove(e: RPE<SVGSVGElement>) {
    const d = drag.current
    if (!d) return
    const delta = ((((pointerDeg(e) - d.start) % 360) + 540) % 360) - 180
    if (Math.abs(delta) > 4) d.moved = true
    if (d.moved) {
      setDragging(true)
      setAngle(d.base + delta)
    }
  }
  function onUp(e: RPE<SVGSVGElement>) {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d) return
    if (d.moved) {
      const i = Math.round(-angle / SEG)
      setPos(((i % 12) + 12) % 12)
      setAngle(i * -SEG)
      return
    }
    // A tap: pick the segment under the finger.
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-pos]')
    if (target) {
      const p = Number(target.getAttribute('data-pos'))
      setMinor(target.getAttribute('data-ring') === 'in')
      select(p)
    }
  }

  function playChord(i: number) {
    const s = synth.current.get()
    if (!s) return
    const pcs = chords[i].pcs
    const root = 48 + pcs[0]
    let prev = root
    const notes = pcs.map((p, k) => {
      if (k === 0) return root
      let m = prev - (prev % 12) + p
      while (m <= prev) m += 12
      prev = m
      return m
    })
    const t = s.ctx.currentTime + 0.02
    ;[root - 12, ...notes].forEach((m, k) => s.play(m, t + k * 0.03, 1.3, 0.7))
    setPlayingIdx(i)
    window.setTimeout(() => setPlayingIdx((x) => (x === i ? -1 : x)), 500)
  }

  // Segments in the key: tonic, IV and V outside, their relative minors inside.
  const inKey = (p: number) => [0, 1, 11].includes((((p - pos) % 12) + 12) % 12)

  return (
    <div className="co">
      <div className="co-layout">
        <div className="co-wheel-wrap">
          <span className="co-pointer" aria-hidden="true">▼</span>
          <svg ref={svg} viewBox="0 0 360 360" className="co-wheel" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="group" aria-label={`Circle of fifths, ${tonic} ${minor ? 'minor' : 'major'} at the top. Drag to turn or tap a key.`}>
            <g className={`co-rot ${dragging ? 'drag' : ''}`} style={{ transform: `rotate(${angle}deg)` }}>
              {CIRCLE.map((f, p) => {
                const a = p * SEG
                const sel = p === pos
                const [ox, oy] = polar((R_OUT + R_MID) / 2, a)
                const [ix, iy] = polar((R_MID + R_IN) / 2, a)
                const outName = p === 6 ? 'F♯/G♭' : majorTonic(f)
                return (
                  <g key={p}>
                    <path d={wedge(R_MID, R_OUT, a)} data-pos={p} data-ring="out" className={`co-seg out ${inKey(p) ? 'key' : ''} ${sel && !minor ? 'sel' : ''}`} />
                    <path d={wedge(R_IN, R_MID, a)} data-pos={p} data-ring="in" className={`co-seg in ${inKey(p) ? 'key' : ''} ${sel && minor ? 'sel' : ''}`} />
                    <text x={ox} y={oy} className={`co-lbl out ${p === 6 ? 'small' : ''}`} style={{ transform: `rotate(${-angle}deg)`, transformOrigin: `${ox}px ${oy}px` }}>{outName}</text>
                    <text x={ix} y={iy} className="co-lbl in" style={{ transform: `rotate(${-angle}deg)`, transformOrigin: `${ix}px ${iy}px` }}>{relativeMinor(f)}m</text>
                  </g>
                )
              })}
            </g>
            <circle cx={C} cy={C} r={R_IN - 4} className="co-hub" />
            <text x={C} y={C - 6} className="co-hub-key">{tonic}{minor ? 'm' : ''}</text>
            <text x={C} y={C + 18} className="co-hub-sig">{sig.count ? `${sig.count} ${sig.type}${sig.count > 1 ? 's' : ''}` : 'no ♯ or ♭'}</text>
          </svg>
          <div className="row co-turn">
            <button type="button" className="btn" onClick={() => select(pos - 1)} aria-label="Turn one step counter-clockwise">↺ −1 fifth</button>
            <button type="button" className="btn" onClick={() => select(pos + 1)} aria-label="Turn one step clockwise">+1 fifth ↻</button>
          </div>
        </div>

        <div className="co-info">
          <Choice label="View" value={minor ? 'minor' : 'major'} options={[['major', `${majorTonic(fifths)} major`], ['minor', `${relativeMinor(fifths)} minor`]]} onChange={(v) => setMinor(v === 'minor')} />
          {pos === 6 && <button type="button" className="btn co-enh" onClick={() => setFlat6((f) => !f)}>Show as {flat6 ? 'F♯ (6 sharps)' : 'G♭ (6 flats)'}</button>}
          <div className="co-card">
            <span className="sim-label">Key signature</span>
            <Staff sig={sig} />
            <p className="co-sig">{sig.count ? sig.letters.map((l) => l + (sig.type === 'sharp' ? '♯' : '♭')).join(' ') : 'No sharps or flats'}</p>
          </div>
          <div className="co-card">
            <span className="sim-label">Scale</span>
            <div className="co-notes" key={tonic + minor}>
              {scale.map((n, i) => <span key={i} className="chip pop" style={{ animationDelay: `${i * 35}ms` }}>{n}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="co-card">
        <span className="sim-label">Diatonic chords (tap to play)</span>
        <div className="co-chords" key={tonic + minor}>
          {chords.map((c, i) => (
            <button key={i} type="button" className={`co-chord pop ${playingIdx === i ? 'on' : ''}`} style={{ animationDelay: `${i * 35}ms` }} onClick={() => playChord(i)}>
              <small>{c.roman}</small>
              <b>{c.name}</b>
            </button>
          ))}
        </div>
        <p className="muted co-nb">Neighbors: <b>{nb.iv}</b> (IV, one step left) and <b>{nb.v}</b> (V, one step right) share all but one note with {majorTonic(fifths)} major.</p>
      </div>
      <Hint>Drag the wheel to turn it, or tap any key to spin it to the top. The highlighted wedges are the six chords that live in the key; the staff shows its key signature.</Hint>
    </div>
  )
}
