import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Icon from '../../components/Icon'
import { useFlip } from '../../motion/useFlip'
import { reducedMotion } from '../../motion/springs'
import { tone } from '../../sim/audio'
import { Hint, Slider, Toggle } from '../../sim/controls'
import { PALETTE } from '../../sim/theme'
import { freshShuffle, mmss } from './logic'
import './tool.css'

const KEY = '4lltools:standup-timer'
const R = 92
const C = 2 * Math.PI * R

function chime() {
  ;[784, 988, 1175].forEach((f, i) => setTimeout(() => tone(f, 380, 'sine', 0.07), i * 140))
}

const colorOf = (name: string) => PALETTE[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length]
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')

export default function StandupTimer() {
  const [names, setNames] = useState(['Ayu', 'Bima', 'Citra', 'Dimas', 'Eka', 'Farah'])
  const [per, setPer] = useState(90)
  const [auto, setAuto] = useState(true)
  const [sound, setSound] = useState(true)
  const [draft, setDraft] = useState('')
  const [phase, setPhase] = useState<'setup' | 'running' | 'done'>('setup')
  const [idx, setIdx] = useState(0)
  const [extra, setExtra] = useState<number[]>([])
  const [running, setRunning] = useState(false)
  const [acc, setAcc] = useState(0)
  const [since, setSince] = useState(0)
  const [used, setUsed] = useState(0)
  const [now, setNow] = useState(0)
  const [wiggle, setWiggle] = useState(0)
  const list = useRef<HTMLOListElement>(null)
  const ready = useRef(false)
  const rang = useRef(-1)
  useFlip(list, { spring: 'bouncy' })

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { names?: string[]; per?: number; auto?: boolean; sound?: boolean } | null
      if (s?.names?.length) setNames(s.names)
      if (s?.per) setPer(s.per)
      if (typeof s?.auto === 'boolean') setAuto(s.auto)
      if (typeof s?.sound === 'boolean') setSound(s.sound)
    } catch {
      // Defaults.
    }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify({ names, per, auto, sound }))
    } catch {
      // Storage is optional.
    }
  }, [names, per, auto, sound])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [running])

  const elapsed = (acc + (running ? Math.max(0, now - since) : 0)) / 1000
  const length = per + (extra[idx] ?? 0)
  const left = length - elapsed

  function advance() {
    const t = Date.now()
    setUsed((u) => u + elapsed)
    setAcc(0)
    setSince(t)
    setNow(t)
    if (idx + 1 >= names.length) {
      setPhase('done')
      setRunning(false)
    } else setIdx(idx + 1)
  }

  const adv = useRef(advance)
  adv.current = advance
  useEffect(() => {
    if (phase !== 'running' || left > 0 || rang.current === idx) return
    rang.current = idx
    if (sound) chime()
    if (auto) adv.current()
  }, [left, phase, idx, auto, sound])

  function start() {
    const t = Date.now()
    setPhase('running')
    setIdx(0)
    setExtra([])
    setUsed(0)
    setAcc(0)
    setSince(t)
    setNow(t)
    setRunning(true)
    rang.current = -1
    tone(660, 120)
  }
  function toggle() {
    const t = Date.now()
    if (running) setAcc(acc + (t - since))
    else setSince(t)
    setNow(t)
    setRunning(!running)
  }
  function extend() {
    setExtra((e) => {
      const n = [...e]
      n[idx] = (n[idx] ?? 0) + 30
      return n
    })
    if (rang.current === idx) rang.current = -1
  }
  function doShuffle() {
    setNames(freshShuffle(names))
    if (!reducedMotion()) setWiggle((w) => w + 1)
  }
  function add() {
    const n = draft.trim()
    if (!n || names.includes(n)) return
    setNames([...names, n])
    setDraft('')
  }

  const total = used + (phase === 'running' ? elapsed : 0)
  const planned = names.length * per + extra.reduce((a, b) => a + (b || 0), 0)
  const cur = names[idx]
  const next = names[idx + 1]
  const over = phase === 'running' && left <= 0

  return (
    <div>
      {phase === 'running' && cur && (
        <div className={`su-stage ${over ? 'over' : ''} ${left <= 10 && !over ? 'soon' : ''}`}>
          <div className="su-now" key={cur}>
            <svg viewBox="0 0 220 220" className="su-ring" role="timer" aria-label={`${cur}: ${mmss(left)} left`}>
              <circle cx={110} cy={110} r={R} className="su-track" />
              <circle cx={110} cy={110} r={R} className="su-prog" strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, left) / length)} />
              <text x={110} y={96} textAnchor="middle" className="su-name">{cur.length > 12 ? cur.slice(0, 11) + '…' : cur}</text>
              <text x={110} y={140} textAnchor="middle" className="su-time">{over ? `+${mmss(-left)}` : mmss(left)}</text>
            </svg>
          </div>
          <div className="su-side">
            <div className="su-next">{next ? <>Next up: <b key={next} className="pop">{next}</b></> : <b>Last speaker</b>}</div>
            <div className="row">
              <button type="button" className="btn primary btn-icon" onClick={toggle}><Icon name={running ? 'pause-circle' : 'play-circle'} size={18} />{running ? 'Pause' : 'Resume'}</button>
              <button type="button" className="btn" onClick={extend}>+30s</button>
              <button type="button" className="btn btn-icon" onClick={advance}><Icon name="forward-end-circle" size={18} />{next ? 'Next' : 'Finish'}</button>
            </div>
            <div className="stats su-stats">
              <div className="stat"><b>{mmss(total)}</b>meeting so far</div>
              <div className="stat"><b>{mmss(planned)}</b>planned</div>
              <div className="stat"><b>{idx + 1}/{names.length}</b>speaker</div>
            </div>
            <button type="button" className="btn su-end" onClick={() => { setPhase('setup'); setRunning(false) }}>End standup</button>
          </div>
        </div>
      )}
      {phase === 'done' && (
        <div className="su-done">
          <b>Standup done in {mmss(used)}</b>
          <span className="muted">Planned {mmss(planned)} for {names.length} people.</span>
          <button type="button" className="btn" onClick={() => setPhase('setup')}>Back to team</button>
        </div>
      )}

      <ol ref={list} className={`su-cards ${wiggle ? 'shuffled' : ''}`} key={`w${wiggle % 2}`} aria-label="Speaking order">
        {names.map((n, i) => {
          const state = phase === 'running' ? (i < idx ? 'done' : i === idx ? 'current' : '') : phase === 'done' ? 'done' : ''
          return (
            <li key={n} data-flip={n} className={`su-card ${state}`} style={{ '--c': colorOf(n), '--r': `${((i * 37) % 9) - 4}deg` } as CSSProperties}>
              <span className="su-av">{initials(n)}</span>
              <span className="su-n">{n}</span>
              {phase === 'setup' && <button type="button" className="su-x" aria-label={`Remove ${n}`} onClick={() => setNames(names.filter((x) => x !== n))}>×</button>}
            </li>
          )
        })}
      </ol>

      {phase === 'setup' && (
        <div className="su-setup">
          <div className="su-add">
            <input type="text" placeholder="Add a teammate…" aria-label="Teammate name" value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button type="button" className="btn" onClick={add} disabled={!draft.trim()}>Add</button>
          </div>
          <Slider label="Time per person" value={per} min={30} max={300} step={15} onChange={setPer} format={(v) => mmss(v)} />
          <Toggle label="Move to the next person when time is up" checked={auto} onChange={setAuto} />
          <Toggle label="Chime at the end of each turn" checked={sound} onChange={setSound} />
          <div className="row">
            <button type="button" className="btn btn-icon" onClick={doShuffle} disabled={names.length < 2}><Icon name="repeat-circle" size={18} /> Shuffle</button>
            <button type="button" className="btn primary btn-icon" onClick={start} disabled={!names.length}><Icon name="play-circle" size={18} /> Start standup ({mmss(names.length * per)})</button>
          </div>
        </div>
      )}
      <Hint>Add your team, shuffle the speaking order, and press Start. Each person gets a countdown; use +30s or Next as needed. Your team list is saved in this browser.</Hint>
    </div>
  )
}
