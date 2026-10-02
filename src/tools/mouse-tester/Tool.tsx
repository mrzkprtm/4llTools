import { useEffect, useRef, useState, type MouseEvent as RMouseEvent } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { Choice, Hint, Readout } from '../../sim/controls'
import { PALETTE } from '../../sim/theme'
import { BOUNCE_MS, BUTTONS, cps } from './logic'
import { MouseSvg, TrailTest, WheelTest } from './Parts'
import './tool.css'

const STORE = '4lltools:mouse-tester'

interface Particle {
  id: number
  x: number
  y: number
  color: string
  n: number
}

interface BounceLog {
  id: number
  gap: number
  at: string
}

function loadBest(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export default function MouseTester() {
  const [secs, setSecs] = useState<5 | 10>(5)
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [clicks, setClicks] = useState(0)
  const [left, setLeft] = useState(0)
  const [result, setResult] = useState(0)
  const [best, setBest] = useState<Record<string, number>>({})
  const [held, setHeld] = useState([false, false, false, false, false])
  const [counts, setCounts] = useState([0, 0, 0, 0, 0])
  const [parts, setParts] = useState<Particle[]>([])
  const [bounces, setBounces] = useState<BounceLog[]>([])
  const startT = useRef(0)
  const clicksRef = useRef(0)
  const lastDown = useRef<number[]>([-1e9, -1e9, -1e9, -1e9, -1e9])
  const area = useRef<HTMLDivElement>(null)

  useEffect(() => setBest(loadBest()), [])

  // Countdown while a CPS run is going.
  useEffect(() => {
    if (phase !== 'running') return
    let raf = 0
    const loop = () => {
      const el = performance.now() - startT.current
      if (el >= secs * 1000) {
        const r = cps(clicksRef.current, secs * 1000)
        setResult(r)
        setLeft(0)
        setPhase('done')
        setBest((b) => {
          if (r <= (b[secs] ?? 0)) return b
          const nb = { ...b, [secs]: r }
          try { localStorage.setItem(STORE, JSON.stringify(nb)) } catch { /* optional */ }
          return nb
        })
        return
      }
      setLeft(secs * 1000 - el)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, secs])

  function onDown(e: RMouseEvent<HTMLDivElement>) {
    const b = e.button
    // Stop middle-click autoscroll and back/forward navigation inside the test area.
    if (b !== 0) e.preventDefault()
    const now = e.timeStamp || performance.now()
    if (b >= 0 && b < 5) {
      const gap = now - lastDown.current[b]
      if (b === 0 && gap < BOUNCE_MS) setBounces((l) => [{ id: now, gap, at: new Date().toLocaleTimeString() }, ...l].slice(0, 8))
      lastDown.current[b] = now
      setHeld((h) => h.map((v, i) => (i === b ? true : v)))
      setCounts((c) => c.map((v, i) => (i === b ? v + 1 : v)))
    }
    if (b !== 0) return
    if (phase !== 'running') {
      if (phase === 'done' && performance.now() - startT.current < secs * 1000 + 700) return // ignore stray clicks right after the end
      startT.current = performance.now()
      clicksRef.current = 0
      setPhase('running')
      setLeft(secs * 1000)
    }
    clicksRef.current++
    setClicks(clicksRef.current)
    if (!reducedMotion() && area.current) {
      const r = area.current.getBoundingClientRect()
      const id = now + Math.random()
      setParts((p) => [...p.slice(-24), { id, x: e.clientX - r.left, y: e.clientY - r.top, color: PALETTE[clicksRef.current % PALETTE.length], n: clicksRef.current }])
      setTimeout(() => setParts((p) => p.filter((q) => q.id !== id)), 650)
    }
  }

  function onUp(e: RMouseEvent<HTMLDivElement>) {
    if (e.button !== 0) e.preventDefault()
    const b = e.button
    setHeld((h) => h.map((v, i) => (i === b ? false : v)))
  }

  function reset() {
    setPhase('idle')
    setClicks(0)
    setResult(0)
    clicksRef.current = 0
  }

  const liveCps = phase === 'running' ? cps(clicks, Math.max(250, secs * 1000 - left)) : result
  const frac = phase === 'running' ? left / (secs * 1000) : phase === 'done' ? 0 : 1

  return (
    <div className="mt">
      <div className="row mt-top">
        <Choice label="CPS test" value={secs} options={[[5, '5 seconds'], [10, '10 seconds']] as const} onChange={(v) => { setSecs(v); reset() }} />
        <button type="button" className="btn" onClick={() => { reset(); setCounts([0, 0, 0, 0, 0]); setBounces([]) }}>Reset all</button>
      </div>

      <div
        ref={area}
        className={`mt-area ${phase}`}
        onMouseDown={onDown}
        onMouseUp={onUp}
        onAuxClick={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        role="button"
        aria-label="Click test area"
      >
        <div className="mt-timer" style={{ transform: `scaleX(${frac})` }} />
        <div className="mt-center">
          {phase === 'idle' && <><b>Click to start</b><span>Click as fast as you can for {secs} seconds. Any button works for the button test.</span></>}
          {phase === 'running' && <><b className="mt-big"><Roll>{String(clicks)}</Roll></b><span>{(left / 1000).toFixed(1)} s left · {liveCps.toFixed(1)} CPS</span></>}
          {phase === 'done' && <><b className="mt-big pop">{result.toFixed(1)} <small>CPS</small></b><span>{clicks} clicks in {secs} s{result >= (best[secs] ?? 0) && result > 0 ? ' · new best!' : ''}. Click to go again.</span></>}
        </div>
        {parts.map((p) => (
          <span key={p.id} className="mt-burst" style={{ left: p.x, top: p.y, color: p.color }} aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ transform: `rotate(${i * 45 + (p.n % 3) * 15}deg)` }} />)}
          </span>
        ))}
      </div>

      <Readout items={[['best 5 s', best[5] ? best[5].toFixed(1) : '–'], ['best 10 s', best[10] ? best[10].toFixed(1) : '–'], ['double-click faults', <Roll key="b">{String(bounces.length)}</Roll>]]} />

      <div className="mt-cols">
        <div className="mt-card">
          <h4>Buttons</h4>
          <MouseSvg held={held} counts={counts} />
          <div className="mt-chips">
            {BUTTONS.map((n, i) => <span key={n} className={`chip ${held[i] ? 'good' : ''}`}>{n} {counts[i]}</span>)}
          </div>
        </div>
        <div className="mt-card">
          <h4>Double-click fault detector</h4>
          <p className="muted mt-small">Two left presses less than {BOUNCE_MS} ms apart are flagged; a single click that registers twice is a worn switch. Very fast clicking can also trigger it.</p>
          {bounces.length === 0 ? <p className="ok mt-small">No faults detected yet.</p> : (
            <ul className="mt-log">
              {bounces.map((b) => <li key={b.id}><span className="chip bad calm">{b.gap.toFixed(0)} ms</span> {b.at}</li>)}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-cols">
        <div className="mt-card">
          <h4>Scroll wheel</h4>
          <WheelTest />
        </div>
        <div className="mt-card">
          <h4>Movement and polling rate</h4>
          <TrailTest />
        </div>
      </div>

      <Hint>Click in the big area to start the CPS run; the mouse drawing lights up each button, including side buttons, which cannot navigate away here. Scroll inside the wheel box and draw fast circles on the trail pad to estimate polling rate.</Hint>
    </div>
  )
}
