import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import Icon from '../../components/Icon'
import { Choice, Hint, Slider } from '../../sim/controls'
import { dim, fromHex, kelvinToRgb, PRESETS, toHex } from './logic'
import './tool.css'

const STORE = '4lltools:screen-light'

interface Settings {
  mode: 'light' | 'ring'
  source: 'kelvin' | 'custom'
  kelvin: number
  custom: string
  brightness: number
  thickness: number
  center: 'black' | 'dim'
}

const DEFAULTS: Settings = { mode: 'light', source: 'kelvin', kelvin: 4000, custom: '#ffd6e8', brightness: 100, thickness: 18, center: 'black' }

interface WakeLockLike {
  release: () => Promise<void>
}

export default function ScreenLight() {
  const [s, setS] = useState<Settings>(DEFAULTS)
  const [on, setOn] = useState(false)
  const [controls, setControls] = useState(true)
  const [status, setStatus] = useState('')
  const overlay = useRef<HTMLDivElement>(null)
  const lock = useRef<WakeLockLike | null>(null)
  const hideTimer = useRef(0)
  const ready = useRef(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null') as Partial<Settings> | null
      if (saved) setS({ ...DEFAULTS, ...saved })
    } catch { /* storage is optional */ }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try { localStorage.setItem(STORE, JSON.stringify(s)) } catch { /* storage is optional */ }
  }, [s])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }))
  const base = s.source === 'custom' ? fromHex(s.custom) : kelvinToRgb(s.kelvin)
  const color = toHex(dim(base, s.brightness / 100))

  async function acquireLock() {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock
    if (!wl) return setStatus('Keep-awake is not supported here, so the screen may dim on its own.')
    try {
      lock.current = await wl.request('screen')
      setStatus('Screen will stay on while the light is showing.')
    } catch {
      setStatus('Keep-awake was refused, so the screen may dim on its own.')
    }
  }

  function start() {
    flushSync(() => setOn(true))
    showControls()
    overlay.current?.requestFullscreen?.().catch(() => {})
    void acquireLock()
  }

  function stop() {
    setOn(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    void lock.current?.release().catch(() => {})
    lock.current = null
  }

  function showControls() {
    setControls(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControls(false), 3500)
  }

  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) stop() }
    // The wake lock is dropped when the tab is hidden; take it again on return.
    const onVis = () => { if (document.visibilityState === 'visible' && overlay.current?.classList.contains('on')) void acquireLock() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stop() }
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(hideTimer.current)
      void lock.current?.release().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lightStyle = { '--sl': color, '--sl-t': `${s.thickness}` } as CSSProperties
  const face = (
    <div className={`sl-face ${s.mode} center-${s.center}`} style={lightStyle}>
      {s.mode === 'ring' && <div className="sl-ring" />}
    </div>
  )

  const sliders = (
    <>
      {s.source === 'kelvin' && <Slider label="Color temperature" value={s.kelvin} min={1500} max={10000} step={100} unit=" K" onChange={(v) => set('kelvin', v)} />}
      <Slider label="Brightness" value={s.brightness} min={10} max={100} unit="%" onChange={(v) => set('brightness', v)} />
      {s.mode === 'ring' && <Slider label="Ring thickness" value={s.thickness} min={4} max={40} unit="%" onChange={(v) => set('thickness', v)} />}
    </>
  )

  return (
    <div className="sl">
      <div className="sl-preview">{face}</div>

      <Choice label="Style" value={s.mode} options={[['light', 'Full light'], ['ring', 'Ring light']] as const} onChange={(v) => set('mode', v)} />

      <div className="sl-presets">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className={`sl-preset ${s.source === 'kelvin' && s.kelvin === p.k ? 'on' : ''}`} onClick={() => setS((o) => ({ ...o, source: 'kelvin', kelvin: p.k }))}>
            <i style={{ background: toHex(kelvinToRgb(p.k)) }} />
            <span>{p.name}<small>{p.k} K</small></span>
          </button>
        ))}
        <label className={`sl-preset ${s.source === 'custom' ? 'on' : ''}`}>
          <input type="color" value={s.custom} onChange={(e) => setS((o) => ({ ...o, source: 'custom', custom: e.target.value }))} onClick={() => set('source', 'custom')} />
          <span>Custom<small>{s.custom}</small></span>
        </label>
      </div>

      {sliders}
      {s.mode === 'ring' && <Choice label="Center" value={s.center} options={[['black', 'Black'], ['dim', 'Soft glow']] as const} onChange={(v) => set('center', v)} />}

      <button type="button" className="btn primary btn-icon sl-go" onClick={start}><Icon name="lightbulb-shine" size={18} /> Turn on the light</button>
      {status && <p className="muted">{status}</p>}

      <div ref={overlay} className={`sl-overlay ${on ? 'on' : ''}`} onPointerDown={showControls} onPointerMove={showControls} aria-hidden={!on}>
        {on && face}
        {on && (
          <div className={`sl-panel ${controls ? '' : 'hide'}`} onPointerDown={(e) => e.stopPropagation()}>
            {sliders}
            <button type="button" className="btn" onClick={stop}>Turn off</button>
          </div>
        )}
      </div>

      <Hint>Pick a warm or cool preset, then turn on the light and set your screen's own brightness to maximum. Tap the light to show the sliders; Esc or Turn off ends it.</Hint>
    </div>
  )
}
