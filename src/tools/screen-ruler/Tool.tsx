import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import { Choice, Hint, Slider } from '../../sim/controls'
import { calibrate, CARD, guessPxPerMm, MM_PER_IN } from './logic'
import { Protractor, Ruler, useWidth } from './Parts'
import './tool.css'

const STORE = '4lltools:screen-ruler'
type Mode = 'ruler' | 'protractor' | 'calibrate'

export default function ScreenRuler() {
  const [mode, setMode] = useState<Mode>('ruler')
  const [pxPerMm, setPxPerMm] = useState(96 / MM_PER_IN)
  const [calibrated, setCalibrated] = useState(false)
  const [guess, setGuess] = useState(96 / MM_PER_IN)
  const box = useRef<HTMLDivElement>(null)
  const boxW = useWidth(box)

  useEffect(() => {
    const g = guessPxPerMm(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches)
    setGuess(g)
    let saved = 0
    try {
      saved = Number(JSON.parse(localStorage.getItem(STORE) || '{}').pxPerMm) || 0
    } catch { /* storage is optional */ }
    if (saved > 1 && saved < 30) {
      setPxPerMm(saved)
      setCalibrated(true)
    } else setPxPerMm(g)
  }, [])

  function save(v: number) {
    const clamped = Math.max(2, Math.min(12, v))
    setPxPerMm(clamped)
    setCalibrated(true)
    try { localStorage.setItem(STORE, JSON.stringify({ pxPerMm: clamped })) } catch { /* storage is optional */ }
  }

  function resetCal() {
    setPxPerMm(guess)
    setCalibrated(false)
    try { localStorage.removeItem(STORE) } catch { /* storage is optional */ }
  }

  function onCardDrag(e: RPE<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId) || !box.current) return
    const r = box.current.getBoundingClientRect()
    save(calibrate(Math.max(60, e.clientX - r.left)))
  }

  const cardW = pxPerMm * CARD.w
  const cardH = pxPerMm * CARD.h
  const tooWide = boxW > 0 && cardW > boxW

  return (
    <div className="sr">
      <Choice value={mode} options={[['ruler', 'Ruler'], ['protractor', 'Protractor'], ['calibrate', 'Calibrate']] as const} onChange={setMode} />

      {!calibrated && mode !== 'calibrate' && (
        <p className="sr-note">Using a guess of {(pxPerMm * MM_PER_IN).toFixed(0)} px per inch. <button type="button" className="btn" onClick={() => setMode('calibrate')}>Calibrate with a card</button> for accurate lengths.</p>
      )}

      {mode === 'ruler' && <Ruler key={pxPerMm.toFixed(3)} pxPerMm={pxPerMm} />}
      {mode === 'protractor' && <Protractor pxPerMm={pxPerMm} />}

      {mode === 'calibrate' && (
        <div className="sr-cal">
          <p>Hold a bank card, ID card or SIM-card holder (any ISO ID-1 card, 85.60 × 53.98 mm) against the screen with its left edge on the line. Drag the right handle until the outline matches the card exactly.</p>
          <div ref={box} className="sr-cal-box">
            <div className="sr-card" style={{ width: cardW, height: cardH }}>
              <div className="sr-chip" style={{ width: pxPerMm * 12, height: pxPerMm * 9, left: pxPerMm * 10, top: pxPerMm * 20 }} />
              <span className="sr-card-label">85.60 mm</span>
              <div
                className="sr-card-handle"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault() }}
                onPointerMove={onCardDrag}
                role="slider"
                aria-label="Card width"
                aria-valuenow={Math.round(cardW)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); save(pxPerMm + (e.key === 'ArrowRight' ? 0.01 : -0.01)) } }}
              >⇔</div>
            </div>
          </div>
          {tooWide && <p className="error">The card is wider than this window; widen the window or rotate the device.</p>}
          <Slider label="Fine tune" value={Math.round(pxPerMm * 100) / 100} min={2} max={12} step={0.01} unit=" px/mm" onChange={save} />
          <div className="row sr-cal-row">
            <span className="chip">{(pxPerMm * MM_PER_IN).toFixed(1)} px per inch</span>
            <span className="chip">1 cm = {(pxPerMm * 10).toFixed(1)} px</span>
            {calibrated ? <span className="chip good">Calibrated and saved</span> : <span className="chip">Guess</span>}
            <button type="button" className="btn" onClick={resetCal}>Reset to guess</button>
            <button type="button" className="btn primary" onClick={() => { save(pxPerMm); setMode('ruler') }}>Done</button>
          </div>
        </div>
      )}

      <Hint>Calibrate once with a real card for accurate results; it is remembered on this device and browser zoom must stay the same. Drag the round handles to measure a length or an angle.</Hint>
    </div>
  )
}
