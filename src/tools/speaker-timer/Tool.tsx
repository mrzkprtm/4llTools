import { useEffect, useRef, useState } from 'react'
import { Hint, Toggle } from '../../sim/controls'
import { tone } from '../../sim/audio'
import Icon from '../../components/Icon'
import { clock, phaseAt, sectionAt, segments, type Phase, type Section } from './logic'
import './tool.css'

const KEY = '4lltools:speaker-timer'

interface Saved {
  total: number
  yellow: number
  red: number
  sections: Section[]
  sound: boolean
}

const DEFAULTS: Saved = {
  total: 20,
  yellow: 5,
  red: 1,
  sound: true,
  sections: [
    { name: 'Intro', minutes: 2 },
    { name: 'Problem', minutes: 4 },
    { name: 'Demo', minutes: 8 },
    { name: 'Results', minutes: 4 },
    { name: 'Q&A', minutes: 2 },
  ],
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Saved>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

const LABEL: Record<Phase, string> = { green: 'On time', yellow: 'Start wrapping up', red: 'Last minute', over: 'Overtime' }

export default function SpeakerTimer() {
  const [cfg, setCfg] = useState<Saved>(DEFAULTS)
  const [running, setRunning] = useState(false)
  const [acc, setAcc] = useState(0)
  const [startAt, setStartAt] = useState(0)
  const [now, setNow] = useState(0)
  const [fsMsg, setFsMsg] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const ready = useRef(false)
  const lastPhase = useRef<Phase>('green')

  useEffect(() => {
    setCfg(load())
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg))
    } catch {
      // Storage is optional.
    }
  }, [cfg])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [running])

  const elapsed = (acc + (running ? Math.max(0, now - startAt) : 0)) / 1000
  const total = cfg.total * 60
  const t = { total, yellow: cfg.yellow * 60, red: cfg.red * 60 }
  const phase = phaseAt(elapsed, t)
  const segs = segments(cfg.sections)
  const current = sectionAt(elapsed, cfg.sections)
  const agendaTotal = segs.length ? segs[segs.length - 1].end : 0
  const scale = Math.max(total, agendaTotal) || 1

  useEffect(() => {
    if (phase !== lastPhase.current && running && cfg.sound) {
      const f = phase === 'yellow' ? 660 : phase === 'red' ? 520 : phase === 'over' ? 392 : 0
      if (f) {
        tone(f, 220, 'sine', 0.08)
        setTimeout(() => tone(f, 300, 'sine', 0.08), 260)
      }
    }
    lastPhase.current = phase
  }, [phase, running, cfg.sound])

  function toggle() {
    const t0 = Date.now()
    if (running) setAcc((a) => a + (t0 - startAt))
    else setStartAt(t0)
    setNow(t0)
    setRunning(!running)
  }
  function reset() {
    setRunning(false)
    setAcc(0)
    setNow(0)
    setStartAt(0)
  }
  async function fullscreen() {
    const el = box.current
    setFsMsg('')
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (el?.requestFullscreen) await el.requestFullscreen()
      else setFsMsg('Fullscreen is not supported in this browser. Try rotating your phone or zooming in.')
    } catch {
      setFsMsg('The browser refused fullscreen. You can still use the timer here.')
    }
  }

  const keys = useRef({ toggle, reset, fullscreen })
  keys.current = { toggle, reset, fullscreen }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest('input, textarea, select, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === ' ') {
        e.preventDefault()
        keys.current.toggle()
      } else if (k === 'r') keys.current.reset()
      else if (k === 'f') void keys.current.fullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const setSection = (i: number, patch: Partial<Section>) => setCfg({ ...cfg, sections: cfg.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || 0))

  return (
    <div>
      <div ref={box} className={`spt-box spt-${phase} ${running ? 'running' : ''}`} role="timer" aria-label={`${clock(total - elapsed)} ${phase === 'over' ? 'over time' : 'left'}`}>
        <div className="spt-phase">{running || elapsed > 0 ? LABEL[phase] : 'Ready'}</div>
        <div className="spt-digits">{clock(total - elapsed)}</div>
        {current >= 0 && (
          <div className="spt-sec" key={current}>
            <b>{segs[current].name}</b> · {clock(segs[current].end - elapsed)} left in section
          </div>
        )}
        <div className="spt-track" aria-hidden="true">
          {segs.map((s, i) => (
            <span key={i} className={`spt-seg ${i === current ? 'on' : ''} ${elapsed >= s.end ? 'done' : ''}`} style={{ left: `${(s.start / scale) * 100}%`, width: `${((s.end - s.start) / scale) * 100}%` }}>
              <em>{s.name}</em>
            </span>
          ))}
          <i className="spt-fill" style={{ transform: `scaleX(${Math.min(1, elapsed / scale)})` }} />
          <i className="spt-mark" style={{ left: `${Math.min(100, (elapsed / scale) * 100)}%` }} />
          {total < scale && <i className="spt-end" style={{ left: `${(total / scale) * 100}%` }} />}
        </div>
        <div className="row spt-controls">
          <button type="button" className="btn primary btn-icon" onClick={toggle}>
            <Icon name={running ? 'pause-circle' : 'play-circle'} size={18} />
            {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
          </button>
          <button type="button" className="btn btn-icon" onClick={reset} disabled={elapsed === 0}>
            <Icon name="reload" size={18} /> Reset
          </button>
          <button type="button" className="btn btn-icon" onClick={() => void fullscreen()}>
            <Icon name="maximize" size={18} /> Fullscreen
          </button>
        </div>
      </div>
      {fsMsg && <p className="error">{fsMsg}</p>}
      <p className="muted spt-keys">
        <kbd>Space</kbd> start/pause · <kbd>R</kbd> reset · <kbd>F</kbd> fullscreen
      </p>

      <div className="spt-cols">
        <div>
          <h2 className="spt-h">Timing</h2>
          <div className="spt-grid3">
            <label>
              Talk length (min)
              <input type="number" min={1} max={600} value={cfg.total} onChange={(e) => setCfg({ ...cfg, total: num(e.target.value, 1, 600) })} />
            </label>
            <label>
              Yellow at (min left)
              <input type="number" min={0} max={600} value={cfg.yellow} onChange={(e) => setCfg({ ...cfg, yellow: num(e.target.value, 0, 600) })} />
            </label>
            <label>
              Red at (min left)
              <input type="number" min={0} max={600} step={0.5} value={cfg.red} onChange={(e) => setCfg({ ...cfg, red: num(e.target.value, 0, 600) })} />
            </label>
          </div>
          <Toggle label="Soft chime when the color changes" checked={cfg.sound} onChange={(v) => setCfg({ ...cfg, sound: v })} />
        </div>
        <div>
          <h2 className="spt-h">Agenda</h2>
          <ul className="spt-list">
            {cfg.sections.map((s, i) => (
              <li key={i} className={i === current ? 'on' : ''}>
                <input type="text" aria-label="Section name" value={s.name} onChange={(e) => setSection(i, { name: e.target.value })} />
                <input type="number" aria-label="Minutes" min={0} max={600} step={0.5} value={s.minutes} onChange={(e) => setSection(i, { minutes: num(e.target.value, 0, 600) })} />
                <button type="button" className="spt-x" aria-label={`Remove ${s.name}`} onClick={() => setCfg({ ...cfg, sections: cfg.sections.filter((_, j) => j !== i) })}>×</button>
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="btn" onClick={() => setCfg({ ...cfg, sections: [...cfg.sections, { name: `Part ${cfg.sections.length + 1}`, minutes: 3 }] })}>
              + Add section
            </button>
            {agendaTotal > 0 && agendaTotal !== total && (
              <button type="button" className="btn" onClick={() => setCfg({ ...cfg, total: agendaTotal / 60 })}>
                Use agenda total ({agendaTotal / 60} min)
              </button>
            )}
          </div>
        </div>
      </div>
      <Hint>Set the talk length and when to warn, add agenda sections if you like, then press Start or Space. Go fullscreen (F) and put the screen where you can see it while you speak.</Hint>
    </div>
  )
}
