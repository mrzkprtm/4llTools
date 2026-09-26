import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { Choice, Hint } from '../../sim/controls'
import { fromHijri, gregorianToJdn, HOLY_DAYS, illumination, jdnToGregorian, moonPath, moonPhase, MONTHS_AR, MONTHS_ID, nextOccurrence, phaseName, toHijri, toHijriTabular, toHijriUmmAlQura, type Engine, type HDate } from './hijri'
import './tool.css'

const p2 = (n: number) => String(n).padStart(2, '0')
const WEEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const G_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const fmtG = (g: HDate) => `${new Date(Date.UTC(g.year, g.month - 1, g.day)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}, ${g.day} ${G_MONTHS[g.month - 1]} ${g.year}`
const fmtH = (h: HDate) => `${h.day} ${MONTHS_ID[h.month - 1]} ${h.year} H`

function Moon({ phase, r = 7 }: { phase: number; r?: number }) {
  return (
    <svg viewBox={`${-r - 1} ${-r - 1} ${2 * r + 2} ${2 * r + 2}`} width={2 * r + 2} height={2 * r + 2} className="hj-moon" aria-label={phaseName(phase)} role="img">
      <circle r={r} className="hj-moon-dark" />
      <path d={moonPath(phase, r)} className="hj-moon-lit" />
    </svg>
  )
}

function today(): HDate {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

export default function HijriCalendar() {
  const [now, setNow] = useState<HDate>({ year: 2026, month: 1, day: 1 })
  const [sel, setSel] = useState<HDate>({ year: 2026, month: 1, day: 1 })
  const [view, setView] = useState({ year: 2026, month: 1 })
  const [engine, setEngine] = useState<Engine>('umalqura')
  const [hasIntl, setHasIntl] = useState(true)
  const [hIn, setHIn] = useState<HDate>({ year: 1447, month: 9, day: 1 })

  useEffect(() => {
    const t = today()
    setNow(t)
    setSel(t)
    setView({ year: t.year, month: t.month })
    const ok = toHijriUmmAlQura(t.year, t.month, t.day) !== null
    setHasIntl(ok)
    if (!ok) setEngine('tabular')
    setHIn(toHijri(ok ? 'umalqura' : 'tabular', t.year, t.month, t.day))
  }, [])

  const tab = toHijriTabular(sel.year, sel.month, sel.day)
  const uq = hasIntl ? toHijriUmmAlQura(sel.year, sel.month, sel.day) : null
  const ph = moonPhase(sel.year, sel.month, sel.day)

  const cells = useMemo(() => {
    const first = gregorianToJdn(view.year, view.month, 1)
    const dow = (first + 1) % 7
    const days = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate()
    const out: ({ g: HDate; h: HDate; p: number } | null)[] = Array(dow).fill(null)
    for (let i = 0; i < days; i++) {
      const g = jdnToGregorian(first + i)
      out.push({ g, h: toHijri(engine, g.year, g.month, g.day), p: moonPhase(g.year, g.month, g.day) })
    }
    return out
  }, [view, engine])
  const hMonths = [...new Set(cells.filter(Boolean).map((c) => `${MONTHS_ID[c!.h.month - 1]} ${c!.h.year}`))]

  const counts = HOLY_DAYS.map((d) => ({ ...d, ...nextOccurrence(engine, now, d.month, d.day) }))
  const hToG = fromHijri(engine, hIn.year, hIn.month, hIn.day)
  const shift = (n: number) => setView((v) => { const m = v.month + n; return { year: v.year + Math.floor((m - 1) / 12), month: ((m - 1 + 1200) % 12) + 1 } })
  const pick = (g: HDate) => { setSel(g); setView({ year: g.year, month: g.month }) }
  const same = (a: HDate, b: HDate) => a.year === b.year && a.month === b.month && a.day === b.day

  return (
    <div className="hj">
      <div className="hj-conv">
        <div className="hj-box">
          <label className="sim-label" htmlFor="hj-g">Gregorian date</label>
          <input id="hj-g" type="date" min="0700-01-01" max="2200-12-31" value={`${sel.year}-${p2(sel.month)}-${p2(sel.day)}`} onChange={(e) => { const [y, m, d] = e.target.value.split('-').map(Number); if (y >= 700) pick({ year: y, month: m, day: d }) }} />
          <div className="hj-out" key={`${sel.year}-${sel.month}-${sel.day}`}>
            {uq && <p><span className="chip">Umm al-Qura</span> <b>{fmtH(uq)}</b> <span className="muted">{MONTHS_AR[uq.month - 1]}</span></p>}
            <p><span className="chip">Tabular (Kuwaiti)</span> <b>{fmtH(tab)}</b></p>
            <p className="muted hj-small"><Moon phase={ph} r={9} /> {phaseName(ph)}, {Math.round(illumination(ph) * 100)}% lit</p>
          </div>
        </div>
        <div className="hj-box">
          <span className="sim-label">Hijri date</span>
          <div className="hj-hin">
            <input aria-label="Hijri day" type="number" min={1} max={30} value={hIn.day} onChange={(e) => setHIn({ ...hIn, day: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })} />
            <select aria-label="Hijri month" value={hIn.month} onChange={(e) => setHIn({ ...hIn, month: Number(e.target.value) })}>
              {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input aria-label="Hijri year" type="number" min={100} max={1700} value={hIn.year} onChange={(e) => setHIn({ ...hIn, year: Math.min(1700, Math.max(100, Number(e.target.value) || 1447)) })} />
          </div>
          <div className="hj-out" key={`${hIn.year}-${hIn.month}-${hIn.day}-${engine}`}>
            <p><b>{fmtG(hToG)}</b></p>
            <button type="button" className="btn btn-icon" onClick={() => pick(hToG)}><Icon name="calendar" size={18} />Show in calendar</button>
          </div>
        </div>
      </div>

      <div className="row hj-bar">
        {hasIntl ? <Choice label="Calendar grid uses" value={engine} options={[['umalqura', 'Umm al-Qura'], ['tabular', 'Tabular']]} onChange={setEngine} /> : <p className="muted hj-small">Umm al-Qura is not available in this browser, so the tabular calendar is used.</p>}
      </div>

      <div className="hj-counts">
        {counts.map((c, i) => {
          const R = 34
          const C = 2 * Math.PI * R
          const f = 1 - Math.min(1, c.days / 355)
          return (
            <button type="button" key={c.key} className="hj-count" style={{ animationDelay: `${i * 80}ms` }} onClick={() => pick(c.date)}>
              <svg viewBox="0 0 80 80" aria-hidden="true">
                <circle cx="40" cy="40" r={R} className="hj-ring-bg" />
                <circle cx="40" cy="40" r={R} className={`hj-ring hj-ring-${c.key}`} strokeDasharray={C} style={{ strokeDashoffset: C * (1 - f), ["--c" as string]: C }} />
                <text x="40" y="40" textAnchor="middle" dominantBaseline="central">{c.days}</text>
              </svg>
              <b>{c.name} {c.hijriYear}</b>
              <span className="muted">{c.days === 0 ? 'Today' : `${c.days} days`} · {c.date.day} {G_MONTHS[c.date.month - 1].slice(0, 3)} {c.date.year}</span>
            </button>
          )
        })}
      </div>
      <p className="muted hj-small">Estimated dates. In Indonesia the start of Ramadhan and the Eids is set by the government's sighting session (sidang isbat), so it can differ by a day.</p>

      <div className="hj-cal">
        <div className="hj-head">
          <button type="button" className="btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chevron-left" size={18} /></button>
          <div className="hj-title">
            <b>{G_MONTHS[view.month - 1]} {view.year}</b>
            <span className="muted">{hMonths.join(' – ')}</span>
          </div>
          <button type="button" className="btn" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevron-right" size={18} /></button>
        </div>
        <div className="hj-grid" key={`${view.year}-${view.month}`}>
          {WEEK.map((w, i) => <span key={w} className={`hj-dow ${i === 5 ? 'fri' : ''}`}>{w}</span>)}
          {cells.map((c, i) =>
            c ? (
              <button type="button" key={i} className={`hj-cell ${same(c.g, sel) ? 'sel' : ''} ${same(c.g, now) ? 'today' : ''} ${c.h.day === 1 ? 'first' : ''}`} style={{ animationDelay: `${(i % 7) * 20 + Math.floor(i / 7) * 30}ms` }} onClick={() => setSel(c.g)} aria-label={`${fmtG(c.g)}, ${fmtH(c.h)}`}>
                <span className="hj-gd">{c.g.day}</span>
                <span className="hj-hd">{c.h.day === 1 ? MONTHS_ID[c.h.month - 1].slice(0, 5) : c.h.day}</span>
                <Moon phase={c.p} r={5} />
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
      </div>
      <Hint>Pick a Gregorian date or type a Hijri date to convert. Tap any day in the grid to see both calendars; moon icons show the phase at noon UTC.</Hint>
    </div>
  )
}
