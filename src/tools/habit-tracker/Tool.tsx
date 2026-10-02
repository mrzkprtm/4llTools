import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { Hint } from '../../sim/controls'
import { addDays, bestStreak, completionRate, currentStreak, flameScale, heatmapWeeks, iso } from './logic'
import './tool.css'

interface Habit {
  id: string
  emoji: string
  name: string
  color: string
  done: string[]
}

const KEY = '4lltools:habit-tracker'
const COLORS = ['#2f9e44', '#1c7ed6', '#e8590c', '#ae3ec9', '#0ca678', '#f59f00']
const WEEKS = 20

function load(): Habit[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Habit[]) : null
  } catch {
    return null
  }
}

function save(h: Habit[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(h))
  } catch {
    // Storage is optional.
  }
}

/** Believable example history so the page looks alive on first visit. */
function demo(today: string): Habit[] {
  let seed = 11
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const make = (emoji: string, name: string, color: string, p: number, skipToday: boolean): Habit => {
    const done: string[] = []
    for (let i = WEEKS * 7; i >= 0; i--) {
      if (i === 0 && skipToday) continue
      // Recent days are denser so the current streak looks healthy.
      if (r() < (i < 9 ? 0.97 : p)) done.push(addDays(today, -i))
    }
    return { id: name, emoji, name, color, done }
  }
  return [make('💧', 'Drink 8 glasses of water', COLORS[1], 0.8, true), make('📖', 'Read 20 pages', COLORS[0], 0.6, false), make('🏃', 'Morning walk', COLORS[2], 0.45, true)]
}

export default function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [today, setToday] = useState('')
  const [emoji, setEmoji] = useState('🧘')
  const [name, setName] = useState('')
  const [burst, setBurst] = useState('')
  const ready = useRef(false)
  const list = useRef<HTMLDivElement>(null)
  useFlip(list)

  useEffect(() => {
    const t = iso(new Date())
    setToday(t)
    setHabits(load() ?? demo(t))
    ready.current = true
    // Roll over to the next day if the page stays open past midnight.
    const id = setInterval(() => setToday(iso(new Date())), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (ready.current) save(habits)
  }, [habits])

  function toggle(id: string, day: string) {
    setHabits((hs) => hs.map((h) => (h.id !== id ? h : { ...h, done: h.done.includes(day) ? h.done.filter((d) => d !== day) : [...h.done, day] })))
    const h = habits.find((x) => x.id === id)
    if (h && !h.done.includes(day) && day === today) setBurst(id + Date.now())
  }

  function add() {
    const n = name.trim()
    if (!n) return
    setHabits((hs) => [...hs, { id: `${Date.now()}`, emoji: emoji.trim() || '✅', name: n, color: COLORS[hs.length % COLORS.length], done: [] }])
    setName('')
  }

  const weeks = useMemo(() => (today ? heatmapWeeks(today, WEEKS) : []), [today])
  const doneToday = habits.filter((h) => h.done.includes(today)).length

  return (
    <div className="ht">
      <div className="ht-summary">
        <div className="ht-ring" style={{ '--p': habits.length ? doneToday / habits.length : 0 } as CSSProperties}>
          <b>
            <Roll>{`${doneToday}/${habits.length}`}</Roll>
          </b>
          <span>today</span>
        </div>
        <p className="muted">{habits.length && doneToday === habits.length ? 'Everything done today. Nice work!' : 'Tap a big circle to check off today.'}</p>
      </div>

      <div ref={list} className="ht-list">
        {habits.map((h) => {
          const set = new Set(h.done)
          const cur = currentStreak(h.done, today)
          const best = bestStreak(h.done)
          const rate = completionRate(h.done, today, 30)
          const on = set.has(today)
          return (
            <section key={h.id} data-flip={h.id} className="ht-card" style={{ '--hc': h.color } as CSSProperties}>
              <div className="ht-head">
                <button type="button" className={`ht-today ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`${h.name}: ${on ? 'done' : 'not done'} today`} onClick={() => toggle(h.id, today)}>
                  <span key={on ? 'y' : 'n'} className="ht-today-in">{on ? <Check size={26} /> : h.emoji}</span>
                  {burst.startsWith(h.id) && on && (
                    <span key={burst} className="ht-burst" aria-hidden="true">
                      {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--a': `${i * 45}deg` } as CSSProperties} />)}
                    </span>
                  )}
                </button>
                <div className="ht-title">
                  <b>
                    {h.emoji} {h.name}
                  </b>
                  <span className="muted">
                    Best {best} d · {Math.round(rate * 100)}% last 30 days
                  </span>
                </div>
                <div className={`ht-flame ${cur ? 'lit' : ''}`} title={`Current streak: ${cur} days`}>
                  <svg viewBox="0 0 24 32" style={{ transform: `scale(${cur ? flameScale(cur) : 0.5})` }} aria-hidden="true">
                    <path d="M12 1c1 5 7 8 7 16a7 7 0 0 1-14 0c0-4 2-6 3-8 0 3 1 5 3 5-1-5 0-9 1-13z" fill="var(--ht-fl1)" />
                    <path d="M12 14c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3-.5-3 0-5 0-8z" fill="var(--ht-fl2)" />
                  </svg>
                  <b>
                    <Roll>{String(cur)}</Roll>
                  </b>
                </div>
                <button type="button" className="btn ht-del" aria-label={`Delete ${h.name}`} onClick={() => confirm(`Delete "${h.name}" and its history?`) && setHabits((hs) => hs.filter((x) => x.id !== h.id))}>
                  <Icon name="close" size={16} />
                </button>
              </div>
              <div className="ht-grid" role="grid" aria-label={`${h.name} history, last ${WEEKS} weeks`}>
                {weeks.map((col, w) => (
                  <div key={w} className="ht-col" role="row">
                    {col.map((d, r) =>
                      d ? (
                        <button key={r} type="button" role="gridcell" className={`ht-cell ${set.has(d) ? 'on' : ''} ${d === today ? 'now' : ''}`} title={d} aria-label={`${d} ${set.has(d) ? 'done' : 'not done'}`} onClick={() => toggle(h.id, d)} />
                      ) : (
                        <span key={r} className="ht-cell empty" />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <form
        className="row ht-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input type="text" aria-label="Emoji" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} className="ht-emoji" />
        <input type="text" aria-label="Habit name" placeholder="New habit, e.g. Stretch 5 minutes" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn primary btn-icon" disabled={!name.trim()}>
          <Icon name="plus" size={18} />
          Add habit
        </button>
      </form>
      <Hint>Tap the big circle to mark today done; tap any heatmap square to fix past days. The flame grows with your streak, and everything stays in this browser.</Hint>
    </div>
  )
}
