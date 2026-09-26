import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import Roll from '../../motion/Roll'
import { Hint, Readout, Toggle } from '../../sim/controls'
import { FULL_WIDTH, HEIGHT, initKb, kbReducer, LAYOUT, LOCATION, NAV_KEYS, stuckKeys, testedCount, TKL_WIDTH } from './logic'
import './tool.css'

interface LogItem {
  id: number
  label: string
}

export default function KeyboardTester() {
  const [state, dispatch] = useReducer(kbReducer, undefined, initKb)
  const [numpad, setNumpad] = useState(true)
  const [focused, setFocused] = useState(false)
  const [now, setNow] = useState(0)
  const [log, setLog] = useState<LogItem[]>([])
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      return !!el?.closest?.('input, textarea, select, [contenteditable]')
    }
    const onDown = (e: KeyboardEvent) => {
      if (typing(e)) return
      if (document.activeElement === box.current && NAV_KEYS.has(e.code)) e.preventDefault()
      dispatch({ type: 'down', info: { key: e.key, code: e.code, keyCode: e.keyCode, location: e.location, repeat: e.repeat }, t: performance.now() })
      if (!e.repeat) {
        const label = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key
        setLog((l) => [{ id: performance.now(), label }, ...l].slice(0, 14))
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (typing(e)) return
      if (document.activeElement === box.current && NAV_KEYS.has(e.code)) e.preventDefault()
      dispatch({ type: 'up', code: e.code || e.key })
    }
    const onBlur = () => dispatch({ type: 'release-all' })
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // Re-check for stuck keys while anything is held.
  const heldCount = Object.keys(state.down).length
  useEffect(() => {
    if (!heldCount) return
    setNow(performance.now())
    const id = setInterval(() => setNow(performance.now()), 500)
    return () => clearInterval(id)
  }, [heldCount])

  const keys = numpad ? LAYOUT : LAYOUT.filter((k) => !k.numpad)
  const W = numpad ? FULL_WIDTH : TKL_WIDTH
  const stuck = heldCount ? stuckKeys(state, now) : []
  const done = testedCount(state, keys)
  const pct = (done / keys.length) * 100
  const last = state.last

  return (
    <div className="kb">
      <div className="row kb-top">
        <button type="button" className="btn primary" onClick={() => box.current?.focus({ preventScroll: true })}>{focused ? 'Ready: start typing' : 'Click to start'}</button>
        <Toggle label="Numpad" checked={numpad} onChange={setNumpad} />
        <button type="button" className="btn" onClick={() => { dispatch({ type: 'reset' }); setLog([]) }}>Reset</button>
      </div>

      <div className="kb-progress" aria-label={`${done} of ${keys.length} keys tested`}>
        <div className="kb-bar"><i style={{ width: `${pct}%` }} /></div>
        <span><Roll>{String(done)}</Roll>/{keys.length} keys tested</span>
      </div>

      <div className="kb-scroll">
        <div
          ref={box}
          tabIndex={0}
          className={`kb-board ${focused ? 'focused' : ''}`}
          style={{ '--kw': W, '--kh': HEIGHT } as CSSProperties}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          role="application"
          aria-label="On-screen keyboard. Press keys to test them."
        >
          {keys.map((k) => {
            const cls = stuck.includes(k.code) ? 'stuck' : k.code in state.down ? 'on' : state.tested[k.code] ? 'done' : ''
            return (
              <div
                key={k.code}
                className={`kb-key ${cls}`}
                style={{ left: `${(k.x / W) * 100}%`, top: `${(k.y / HEIGHT) * 100}%`, width: `${(k.w / W) * 100}%`, height: `${(k.h / HEIGHT) * 100}%` }}
                title={k.code}
              >
                <span>{k.label}</span>
              </div>
            )
          })}
          {!focused && <div className="kb-cover">Click here, then press keys</div>}
        </div>
      </div>

      {stuck.length > 0 && <p className="error kb-alert" role="alert">Possibly stuck: {stuck.join(', ')} has been down for over 3 seconds without being released.</p>}

      <div className="kb-cols">
        <div className="kb-last" aria-live="polite">
          <div className="kb-cap" key={last ? state.presses : 0}>{last ? (last.key === ' ' ? '␣' : last.key) : '–'}</div>
          <table className="simple">
            <tbody>
              <tr><th>key</th><td>{last ? JSON.stringify(last.key) : '–'}</td></tr>
              <tr><th>code</th><td>{last?.code || '–'}</td></tr>
              <tr><th>keyCode</th><td>{last ? last.keyCode : '–'}</td></tr>
              <tr><th>location</th><td>{last ? `${last.location} (${LOCATION[last.location] ?? '?'})` : '–'}</td></tr>
              <tr><th>repeat</th><td>{last ? String(last.repeat) : '–'}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <Readout items={[['held now', <Roll key="h">{String(heldCount)}</Roll>], ['most at once', <Roll key="m">{String(state.maxHeld)}</Roll>], ['presses', <Roll key="p">{String(state.presses)}</Roll>]]} />
          <p className="muted kb-small">Rollover test: hold several keys together (try A S D F J K L). If one you hold does not light up, the keyboard is blocking or ghosting that combination.</p>
          <div className="kb-log">
            {log.map((l) => <span key={l.id} className="chip">{l.label}</span>)}
          </div>
        </div>
      </div>

      <Hint>Click the keyboard so it has focus, then press every key: held keys glow, tested keys stay green and a key held over 3 seconds turns red. Some keys, like Print Screen or Fn, may be caught by your system and never reach the browser.</Hint>
    </div>
  )
}
