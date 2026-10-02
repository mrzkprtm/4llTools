import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { Hint, Slider } from '../../sim/controls'
import { MONO } from '../../sim/draw'
import Stage, { type SimPointer } from '../../sim/Stage'
import { alpha, PALETTE, useTheme } from '../../sim/theme'
import { ageOn, cellOf, cellRange, dayNum, lifeStats } from './life'
import './tool.css'

const STORE = '4lltools:life-in-weeks'
const CELL = 10
const LEFT = 24
const TOP = 16
const GAP = 4

interface Milestone { id: number; label: string; date: string; color: string }

const DEFAULTS = {
  birth: '1995-06-15',
  lifespan: 80,
  milestones: [
    { id: 1, label: 'Started school', date: '2002-07-15', color: PALETTE[1] },
    { id: 2, label: 'Graduated', date: '2017-08-26', color: PALETTE[2] },
    { id: 3, label: 'First job', date: '2018-02-01', color: PALETTE[3] },
  ] as Milestone[],
}

const rowY = (row: number) => TOP + row * CELL + Math.floor(row / 10) * GAP
const nice = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const big = (n: number) => Math.round(n).toLocaleString('en-US')

export default function LifeInWeeks() {
  const theme = useTheme()
  const [birth, setBirth] = useState(DEFAULTS.birth)
  const [lifespan, setLifespan] = useState(DEFAULTS.lifespan)
  const [milestones, setMilestones] = useState<Milestone[]>(DEFAULTS.milestones)
  const [today, setToday] = useState('2026-01-01')
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)
  const [draft, setDraft] = useState({ label: '', date: '' })
  const shown = useRef(0)
  const ready = useRef(false)

  useEffect(() => {
    const d = new Date()
    setToday(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? 'null')
      if (s) {
        if (/^\d{4}-\d\d-\d\d$/.test(s.birth)) setBirth(s.birth)
        if (s.lifespan >= 10 && s.lifespan <= 120) setLifespan(s.lifespan)
        if (Array.isArray(s.milestones)) setMilestones(s.milestones.filter((m: Milestone) => m && typeof m.label === 'string' && /^\d{4}-\d\d-\d\d$/.test(m.date)))
      }
    } catch {
      // Defaults.
    }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(STORE, JSON.stringify({ birth, lifespan, milestones }))
    } catch {
      // Not saved.
    }
  }, [birth, lifespan, milestones])

  // Replay the fill whenever the birth date or lifespan changes.
  useEffect(() => {
    shown.current = reducedMotion() ? 1e9 : 0
  }, [birth, lifespan])

  const valid = /^\d{4}-\d\d-\d\d$/.test(birth) && dayNum(birth) <= dayNum(today)
  const now = valid ? cellOf(birth, today) : { row: 0, col: 0 }
  const lived = now.row * 52 + now.col
  const stats = lifeStats(valid ? birth : today, today, lifespan)
  const H = rowY(lifespan) + 4
  const W = LEFT + 52 * CELL + 4
  const marks = milestones.filter((m) => dayNum(m.date) >= dayNum(birth)).map((m) => ({ ...m, ...cellOf(birth, m.date) }))

  function onFrame(ctx: CanvasRenderingContext2D, f: { w: number; h: number; dt: number; t: number }) {
    ctx.clearRect(0, 0, f.w, f.h)
    const speed = Math.max(400, lived / 1.8)
    shown.current = Math.min(lived, shown.current + speed * Math.min(f.dt || 1 / 60, 0.05))
    const s = shown.current
    ctx.font = `7px ${MONO}`
    ctx.fillStyle = theme.muted
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let r = 0; r < lifespan; r += 5) ctx.fillText(String(r), LEFT - 4, rowY(r) + CELL / 2)
    ctx.textAlign = 'center'
    for (const c of [1, 13, 26, 39, 52]) ctx.fillText(String(c), LEFT + (c - 0.5) * CELL, TOP - 7)
    const pulse = reducedMotion() ? 0.6 : 0.5 + 0.5 * Math.sin(f.t * 5)
    for (let r = 0; r < lifespan; r++) {
      const y = rowY(r)
      for (let c = 0; c < 52; c++) {
        const i = r * 52 + c
        const x = LEFT + c * CELL
        if (i < s) ctx.fillStyle = r >= 65 ? alpha(theme.accent, 0.65) : theme.accent
        else if (i === lived) ctx.fillStyle = alpha(theme.accent, 0.25 + 0.6 * pulse)
        else ctx.fillStyle = theme.sunken
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2)
        if (i > lived) {
          ctx.strokeStyle = alpha(theme.muted, 0.35)
          ctx.lineWidth = 0.6
          ctx.strokeRect(x + 1.3, y + 1.3, CELL - 2.6, CELL - 2.6)
        }
      }
    }
    for (const m of marks) {
      if (m.row >= lifespan) continue
      const reveal = m.row * 52 + m.col <= s ? 1 : 0.35
      ctx.globalAlpha = reveal
      ctx.beginPath()
      ctx.arc(LEFT + m.col * CELL + CELL / 2, rowY(m.row) + CELL / 2, 3.6, 0, Math.PI * 2)
      ctx.fillStyle = m.color
      ctx.fill()
      ctx.strokeStyle = theme.surface
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    if (hover) {
      ctx.strokeStyle = theme.text
      ctx.lineWidth = 1.5
      ctx.strokeRect(LEFT + hover.col * CELL + 0.5, rowY(hover.row) + 0.5, CELL - 1, CELL - 1)
    }
  }

  function onPointer(p: SimPointer) {
    const col = Math.floor((p.x - LEFT) / CELL)
    let row = -1
    for (let r = 0; r < lifespan; r++) if (p.y >= rowY(r) && p.y < rowY(r) + CELL) row = r
    if (col >= 0 && col < 52 && row >= 0) setHover({ row, col })
  }

  const info = hover && valid ? cellRange(birth, hover.row, hover.col) : null
  const infoMarks = info ? milestones.filter((m) => m.date >= info[0] && m.date <= info[1]) : []
  function add() {
    if (!draft.label.trim() || !/^\d{4}-\d\d-\d\d$/.test(draft.date)) return
    setMilestones([...milestones, { id: Date.now(), label: draft.label.trim(), date: draft.date, color: PALETTE[(milestones.length + 1) % PALETTE.length] }].sort((a, b) => a.date.localeCompare(b.date)))
    setDraft({ label: '', date: '' })
  }

  return (
    <div className="lw">
      <div className="lw-inputs">
        <label>Birth date<input type="date" value={birth} max={today} onChange={(e) => e.target.value && setBirth(e.target.value)} /></label>
        <Slider label="Expected lifespan" value={lifespan} min={40} max={110} unit=" years" onChange={setLifespan} />
      </div>
      {!valid && <p className="error">The birth date must be in the past.</p>}

      <div className="stats lw-stats">
        <div className="stat"><b><Roll>{big(stats.weeks)}</Roll></b>weeks lived</div>
        <div className="stat"><b><Roll>{big(stats.weeksLeft)}</Roll></b>weeks left (of {big(stats.weeksTotal)})</div>
        <div className="stat"><b><Roll>{stats.percent.toFixed(1)}</Roll>%</b>of {lifespan} years</div>
        <div className="stat"><b><Roll>{valid ? String(ageOn(birth, today)) : '0'}</Roll></b>years old</div>
      </div>

      <div className="lw-grid-wrap" onPointerLeave={() => setHover(null)}>
        <Stage world={[W, H]} running onFrame={onFrame} onPointer={onPointer} label={`Life grid: ${stats.weeks} of ${stats.weeksTotal} weeks lived`} cursor="pointer" className="sim-flat lw-stage" />
        <div className={`lw-info ${info ? 'on' : ''}`} aria-live="polite">
          {info ? (
            <>
              <b>Age {hover!.row}, week {hover!.col + 1}</b>
              <span>{nice(info[0])} – {nice(info[1])}</span>
              <span className="muted">{hover!.row * 52 + hover!.col < lived ? 'Lived' : hover!.row * 52 + hover!.col === lived ? 'This week' : 'Still ahead'}</span>
              {infoMarks.map((m) => <span key={m.id} className="lw-tag" style={{ borderColor: m.color }}>{m.label}</span>)}
            </>
          ) : (
            <span className="muted">Hover or tap a square to see its dates.</span>
          )}
        </div>
      </div>

      <h3 className="lw-h">Milestones</h3>
      <ul className="lw-ms">
        {milestones.map((m) => (
          <li key={m.id}>
            <i style={{ background: m.color }} />
            <span><b>{m.label}</b> <span className="muted">{nice(m.date)}{dayNum(m.date) >= dayNum(birth) ? ` · age ${ageOn(birth, m.date)}` : ''}</span></span>
            <button type="button" className="lw-x" aria-label={`Remove ${m.label}`} onClick={() => setMilestones(milestones.filter((x) => x.id !== m.id))}>×</button>
          </li>
        ))}
      </ul>
      <div className="lw-add">
        <input placeholder="Milestone (e.g. Wedding)" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input type="date" aria-label="Milestone date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        <button type="button" className="btn btn-icon" onClick={add} disabled={!draft.label.trim() || !draft.date}><Icon name="plus" size={18} />Add</button>
      </div>

      <div className="stats lw-fun">
        <div className="stat"><b><Roll>{big(stats.days)}</Roll></b>days lived</div>
        <div className="stat"><b>≈ <Roll>{(stats.heartbeats / 1e9).toFixed(2)}</Roll> bn</b>heartbeats (70 bpm)</div>
        <div className="stat"><b>≈ <Roll>{stats.sleepYears.toFixed(1)}</Roll> yrs</b>asleep (8 h a night)</div>
        <div className="stat"><b><Roll>{big(stats.fullMoons)}</Roll></b>full moons seen</div>
      </div>
      <Hint>Each row is one year of your life and each square one week. Set your birth date, then hover or tap squares; milestones stay on this device.</Hint>
    </div>
  )
}
