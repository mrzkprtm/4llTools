import { useState } from 'react'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { ACTIVITY, CUTS, bmiOf, bmr, bodyFatEstimate, classify, gaugePos, healthyRange, LB, toMetric, type Scheme, type Sex } from './bmi'
import './tool.css'

const MIN = 15
const MAX = 40
const CX = 120
const CY = 120
const R = 96

function point(v: number) {
  const a = Math.PI * (1 - (Math.min(MAX, Math.max(MIN, v)) - MIN) / (MAX - MIN))
  return [CX + R * Math.cos(a), CY - R * Math.sin(a)]
}

function arc(from: number, to: number) {
  const [x1, y1] = point(from)
  const [x2, y2] = point(to)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

function Gauge({ bmi, scheme }: { bmi: number; scheme: Scheme }) {
  const cuts = CUTS[scheme]
  const current = classify(bmi, scheme)
  let lo = MIN
  const segs = cuts.map((c) => {
    const s = { from: lo, to: Math.min(MAX, c.max), cls: c.cls }
    lo = Math.min(MAX, c.max)
    return s
  }).filter((s) => s.to > s.from)
  const angle = -90 + gaugePos(bmi, MIN, MAX) * 180
  return (
    <svg className="bmi-gauge" viewBox="0 0 240 136" role="img" aria-label={Number.isFinite(bmi) ? `BMI gauge at ${bmi.toFixed(1)}, ${current?.label}` : 'BMI gauge'}>
      {segs.map((s, i) => (
        <path key={`${scheme}-${i}`} d={arc(s.from + (i ? 0.25 : 0), s.to - (i < segs.length - 1 ? 0.25 : 0))} pathLength={1} className={`bmi-seg ${s.cls.tone} ${current && current !== s.cls ? 'dim' : ''}`} style={{ animationDelay: `${i * 90}ms` }} />
      ))}
      {[15, 18.5, scheme === 'asia' ? 23 : 25, scheme === 'asia' ? 25 : 30, scheme === 'asia' ? 30 : 35, 40].map((v) => {
        const a = Math.PI * (1 - (v - MIN) / (MAX - MIN))
        return <text key={v} className="bmi-tick" x={CX + (R + 16) * Math.cos(a)} y={CY - (R + 16) * Math.sin(a) + 3} textAnchor="middle">{v}</text>
      })}
      <g className="bmi-needle" style={{ transform: `rotate(${angle}deg)` }}>
        <line x1={CX} y1={CY} x2={CX} y2={CY - R + 14} />
        <circle cx={CX} cy={CY} r={7} />
      </g>
    </svg>
  )
}

const TONE_COLOR = { low: '#60a5fa', good: '#22c55e', warn: '#f59e0b', high: '#ef4444' } as const
const num = (s: string) => (s.trim() === '' ? NaN : Number(s))
const kcal = (n: number) => `${Math.round(n).toLocaleString('en-US')}`

export default function BmiCalculator() {
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric')
  const [cm, setCm] = useState('170')
  const [kg, setKg] = useState('68')
  const [ft, setFt] = useState('5')
  const [inch, setInch] = useState('7')
  const [lb, setLb] = useState('150')
  const [age, setAge] = useState('30')
  const [sex, setSex] = useState<Sex>('male')
  const [scheme, setScheme] = useState<Scheme>('asia')
  const [activity, setActivity] = useState(1)

  const metric = unit === 'metric' ? { kg: num(kg), cm: num(cm) } : toMetric(num(lb), num(ft), num(inch) || 0)
  const years = num(age)
  const bmi = bmiOf(metric.kg, metric.cm)
  const valid = Number.isFinite(bmi) && metric.cm >= 50 && metric.cm <= 272 && metric.kg >= 10 && metric.kg <= 500
  const ageOk = years >= 18 && years <= 120
  const cls = valid ? classify(bmi, scheme) : null
  const [lo, hi] = healthyRange(metric.cm, scheme)
  const w = (k: number) => (unit === 'metric' ? `${k.toFixed(1)} kg` : `${(k / LB).toFixed(0)} lb`)
  const base = valid && ageOk ? bmr(metric.kg, metric.cm, years, sex) : NaN
  const tdee = base * ACTIVITY[activity].factor
  const fat = valid && ageOk ? bodyFatEstimate(bmi, years, sex) : NaN

  function switchUnit(next: 'metric' | 'imperial') {
    if (next === unit) return
    // Carry the current numbers across so the result stays put.
    if (valid) {
      if (next === 'imperial') {
        const totalIn = metric.cm / 2.54
        setFt(String(Math.floor(totalIn / 12)))
        setInch(String(Math.round(totalIn % 12)))
        setLb(String(Math.round(metric.kg / LB)))
      } else {
        setCm(String(Math.round(metric.cm)))
        setKg(String(Math.round(metric.kg * 10) / 10))
      }
    }
    setUnit(next)
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <PillRow label="Units" style={{ margin: 0 }}>
          <button type="button" className={`btn ${unit === 'metric' ? 'primary' : ''}`} aria-pressed={unit === 'metric'} onClick={() => switchUnit('metric')}>Metric (kg, cm)</button>
          <button type="button" className={`btn ${unit === 'imperial' ? 'primary' : ''}`} aria-pressed={unit === 'imperial'} onClick={() => switchUnit('imperial')}>Imperial (lb, ft)</button>
        </PillRow>
        <PillRow label="BMI cut-offs" style={{ margin: 0 }}>
          <button type="button" className={`btn ${scheme === 'asia' ? 'primary' : ''}`} aria-pressed={scheme === 'asia'} onClick={() => setScheme('asia')}>Asia-Pacific</button>
          <button type="button" className={`btn ${scheme === 'who' ? 'primary' : ''}`} aria-pressed={scheme === 'who'} onClick={() => setScheme('who')}>WHO global</button>
        </PillRow>
      </div>

      <div className="bmi-top">
        <div>
          {unit === 'metric' ? (
            <div className="bmi-inline">
              <div><label htmlFor="bmi-cm">Height (cm)</label><input id="bmi-cm" type="number" inputMode="decimal" min={50} max={272} value={cm} onChange={(e) => setCm(e.target.value)} /></div>
              <div><label htmlFor="bmi-kg">Weight (kg)</label><input id="bmi-kg" type="number" inputMode="decimal" min={10} max={500} step={0.1} value={kg} onChange={(e) => setKg(e.target.value)} /></div>
            </div>
          ) : (
            <div className="bmi-inline">
              <div><label htmlFor="bmi-ft">Height (ft)</label><input id="bmi-ft" type="number" inputMode="numeric" min={1} max={8} value={ft} onChange={(e) => setFt(e.target.value)} /></div>
              <div><label htmlFor="bmi-in">(in)</label><input id="bmi-in" type="number" inputMode="decimal" min={0} max={11.9} value={inch} onChange={(e) => setInch(e.target.value)} /></div>
              <div><label htmlFor="bmi-lb">Weight (lb)</label><input id="bmi-lb" type="number" inputMode="decimal" min={20} max={1100} value={lb} onChange={(e) => setLb(e.target.value)} /></div>
            </div>
          )}
          <div className="bmi-inline">
            <div><label htmlFor="bmi-age">Age (years)</label><input id="bmi-age" type="number" inputMode="numeric" min={18} max={120} value={age} onChange={(e) => setAge(e.target.value)} /></div>
            <div>
              <span className="bmi-lab" aria-hidden="true">Sex</span>
              <PillRow label="Sex" style={{ margin: 0 }}>
                <button type="button" className={`btn ${sex === 'male' ? 'primary' : ''}`} aria-pressed={sex === 'male'} onClick={() => setSex('male')}>Male</button>
                <button type="button" className={`btn ${sex === 'female' ? 'primary' : ''}`} aria-pressed={sex === 'female'} onClick={() => setSex('female')}>Female</button>
              </PillRow>
            </div>
          </div>
          <label htmlFor="bmi-act">Activity level</label>
          <select id="bmi-act" value={activity} onChange={(e) => setActivity(Number(e.target.value))}>
            {ACTIVITY.map((a, i) => <option key={a.factor} value={i}>{a.label} ×{a.factor}</option>)}
          </select>
          {!valid && <p className="error">Enter a height between 50 and 272 cm and a weight between 10 and 500 kg.</p>}
          {valid && !ageOk && <p className="error">BMR and calories need an adult age (18–120). BMI for children uses growth charts instead.</p>}
        </div>

        <div aria-live="polite">
          <Gauge bmi={valid ? bmi : NaN} scheme={scheme} />
          <div className="bmi-readout">
            <div className={`bmi-value ${cls?.tone ?? ''}`}><Roll>{valid ? bmi.toFixed(1) : '0.0'}</Roll></div>
            {cls && (
              <span key={`${cls.label}-${scheme}`} className={`chip bmi-chip ${cls.tone === 'good' ? 'good' : cls.tone === 'high' ? 'bad calm' : cls.tone}`}>
                {cls.label} · {cls.id}
              </span>
            )}
          </div>
          <div className="bmi-legend">
            {CUTS[scheme].map((c, i) => {
              const from = i ? CUTS[scheme][i - 1].max : 0
              return (
                <span key={c.cls.label}><i style={{ background: TONE_COLOR[c.cls.tone] }} />{c.max === Infinity ? `≥ ${from}` : i ? `${from}–${(c.max - 0.1).toFixed(1)}` : `< ${c.max}`} <b>{c.cls.label.replace(' (at risk)', '')}</b></span>
              )
            })}
          </div>
        </div>
      </div>

      {valid && (
        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))' }}>
          <div className="stat"><b><Roll>{`${w(lo)}`}</Roll></b>to {w(hi)}: healthy weight for your height</div>
          <div className="stat"><b><Roll>{Number.isFinite(base) ? kcal(base) : '—'}</Roll></b>kcal/day BMR (at rest)</div>
          <div className="stat"><b><Roll>{Number.isFinite(tdee) ? kcal(tdee) : '—'}</Roll></b>kcal/day to maintain weight</div>
          <div className="stat"><b><Roll>{Number.isFinite(tdee) ? kcal(Math.max(tdee - 500, sex === 'male' ? 1500 : 1200)) : '—'}</Roll></b>kcal/day to lose ~0.5 kg a week</div>
          <div className="stat"><b><Roll>{Number.isFinite(fat) ? `${Math.max(0, fat).toFixed(0)}%` : '—'}</Roll></b>estimated body fat</div>
        </div>
      )}

      <p className="muted bmi-note">
        <b>Asia-Pacific cut-offs</b> (WHO WPRO) flag risk at a lower BMI (overweight from 23, obese from 25) because many Asian people, including Indonesians, carry more body fat at the same BMI; the Indonesian Ministry of Health (Kemenkes) uses similar thresholds. BMR uses the Mifflin-St Jeor equation. Body fat is a rough estimate from BMI (Deurenberg); healthy ranges are roughly 8–19% for men and 21–33% for women aged 20–39, and a waist measurement or body-composition scale tells you more.
      </p>
      <p className="muted bmi-note">
        Not medical advice: BMI does not tell muscle from fat and does not apply to children, pregnancy or athletes. Talk to a doctor or nutritionist before changing your diet. Your numbers stay in your browser.
      </p>
    </div>
  )
}
