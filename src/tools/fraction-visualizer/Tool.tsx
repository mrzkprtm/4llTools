import { useEffect, useMemo, useState } from 'react'
import { reducedMotion } from '../../motion/springs'
import { Choice, Hint } from '../../sim/controls'
import { add, compare, format, mul, parseFraction, simplify, sub, type Frac } from './logic'
import Model, { type Kind } from './Model'
import { buildSteps, COLOR_A, COLOR_B, COLOR_R, type ModelSpec, type Op } from './steps'
import './tool.css'

type Mode = Op | 'build'

function colorOf(spec: ModelSpec) {
  return (i: number) => {
    let at = 0
    for (const [count, color] of spec.runs) {
      if (i < at + count) return color
      at += count
    }
    return null
  }
}

function Area({ a, b }: { a: Frac; b: Frac }) {
  const S = 200
  return (
    <svg className="fv-area" viewBox={`-2 -2 ${S + 4} ${S + 4}`} role="img" aria-label={`Area model of ${a.n}/${a.d} times ${b.n}/${b.d}`}>
      {Array.from({ length: a.d }, (_, c) =>
        Array.from({ length: b.d }, (_, r) => {
          const inA = c < a.n
          const inB = r >= b.d - b.n
          const fill = inA && inB ? COLOR_R : inA ? COLOR_A : inB ? COLOR_B : 'none'
          return <rect key={`${c}-${r}`} x={(c * S) / a.d} y={(r * S) / b.d} width={S / a.d} height={S / b.d} className="fv-cell" style={{ fill, fillOpacity: inA && inB ? 0.9 : 0.28, animationDelay: `${(c + r) * 40}ms` }} />
        }),
      )}
      <rect x={0} y={0} width={S} height={S} className="fv-rim" />
    </svg>
  )
}

function FracInput({ label, value, onChange, color }: { label: string; value: string; onChange: (v: string) => void; color: string }) {
  const bad = parseFraction(value) === null || (parseFraction(value)?.n ?? 0) < 0
  return (
    <label className="fv-input">
      <span style={{ color }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="text" aria-invalid={bad} className={bad ? 'fv-bad' : ''} />
    </label>
  )
}

function Build({ kind }: { kind: Kind }) {
  const [d, setD] = useState(8)
  const [on, setOn] = useState<Set<number>>(() => new Set([0, 1, 2]))
  const [paint, setPaint] = useState(true)
  const n = on.size
  const s = simplify({ n, d })
  const piece = (i: number, how: 'down' | 'over') => {
    const value = how === 'down' ? !on.has(i) : paint
    if (how === 'down') setPaint(value)
    setOn((prev) => {
      const next = new Set(prev)
      if (value) next.add(i)
      else next.delete(i)
      return next
    })
  }
  return (
    <div className="fv-build">
      <div className="row fv-center">
        <button type="button" className="btn fv-step" onClick={() => { setD(Math.max(1, d - 1)); setOn(new Set()) }} aria-label="Fewer pieces">−</button>
        <span className="fv-dlabel">{d} pieces</span>
        <button type="button" className="btn fv-step" onClick={() => { setD(Math.min(24, d + 1)); setOn(new Set()) }} aria-label="More pieces">+</button>
      </div>
      <Model d={d} wholes={1} kind={kind} color={(i) => (on.has(i) ? COLOR_A : null)} onPiece={piece} label={`${n} of ${d} pieces shaded`} />
      <div className="fv-result pop" key={`${n}/${d}`}>
        <span className="fv-big">{n}/{d}</span>
        {s.d !== d && n > 0 && <span> = {format(s)}</span>}
        <span className="muted"> · {((n / d) * 100).toFixed(1).replace(/\.0$/, '')}% · {(n / d).toFixed(3).replace(/\.?0+$/, '') || '0'}</span>
      </div>
    </div>
  )
}

export default function FractionVisualizer() {
  const [ta, setTa] = useState('1/2')
  const [tb, setTb] = useState('1/3')
  const [mode, setMode] = useState<Mode>('add')
  const [kind, setKind] = useState<Kind>('pie')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const pa = parseFraction(ta)
  const pb = parseFraction(tb)
  const valid = !!pa && !!pb && pa.n >= 0 && pb.n >= 0 && pa.n / pa.d <= 12 && pb.n / pb.d <= 12 && pa.d <= 60 && pb.d <= 60
  const steps = useMemo(() => (valid && mode !== 'build' ? buildSteps(mode, pa!, pb!) : []), [ta, tb, mode])
  const last = steps.length - 1
  const cur = steps[Math.min(step, Math.max(0, last))]

  useEffect(() => {
    setStep(0)
    setPlaying(!reducedMotion())
  }, [ta, tb, mode])
  useEffect(() => {
    if (!playing) return
    if (step >= last) return setPlaying(false)
    const t = setTimeout(() => setStep((s) => s + 1), 1900)
    return () => clearTimeout(t)
  }, [playing, step, last])

  const answer = valid && pa && pb ? (mode === 'add' ? format(add(pa, pb)) : mode === 'sub' ? format(sub(pa, pb)) : mode === 'mul' ? format(mul(pa, pb)) : mode === 'cmp' ? `${format(pa)} ${['<', '=', '>'][compare(pa, pb) + 1]} ${format(pb)}` : format(simplify(pa))) : ''

  return (
    <div className="fv">
      <Choice value={mode} onChange={setMode} options={[['add', 'Add'], ['sub', 'Subtract'], ['mul', 'Multiply'], ['cmp', 'Compare'], ['simp', 'Simplify'], ['build', 'Build']]} />
      <div className="row fv-controls">
        {mode !== 'build' && <FracInput label="A" value={ta} onChange={setTa} color={COLOR_A} />}
        {mode !== 'build' && mode !== 'simp' && <FracInput label="B" value={tb} onChange={setTb} color={COLOR_B} />}
        <Choice value={kind} onChange={setKind} options={[['pie', 'Pie'], ['bar', 'Bar']]} />
      </div>
      {mode === 'build' ? (
        <Build kind={kind} />
      ) : !valid ? (
        <p className="error">Type fractions like 3/4, mixed numbers like 1 1/2, or whole numbers (0 to 12, denominators up to 60).</p>
      ) : (
        cur && (
          <div className="fv-stage">
            <ol className="fv-dots" aria-label="Steps">
              {steps.map((s, i) => (
                <li key={i}>
                  <button type="button" className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => { setPlaying(false); setStep(i) }}>
                    {i + 1}. {s.title}
                  </button>
                </li>
              ))}
            </ol>
            <div className="fv-models" key={step}>
              {cur.area && pa && pb ? (
                <div className="fv-slot"><Area a={pa} b={pb} /><span>{cur.models[0].caption}</span></div>
              ) : (
                cur.models.map((m, i) => (
                  <div className="fv-slot" key={i}>
                    <Model d={m.d} wholes={m.wholes} kind={kind} color={colorOf(m)} fading={m.fadeFrom !== undefined ? (x) => x >= m.fadeFrom! && x < m.fadeTo! : undefined} label={m.caption} small={cur.models.length > 1 && m.wholes > 1} />
                    <span>{m.caption}</span>
                  </div>
                ))
              )}
            </div>
            <p className="fv-text settle-in" key={`t${step}`}>{cur.text}</p>
            <div className="row fv-center">
              <button type="button" className="btn" disabled={step === 0} onClick={() => { setPlaying(false); setStep(step - 1) }}>Back</button>
              <button type="button" className="btn primary" onClick={() => (step >= last ? (setStep(0), setPlaying(!reducedMotion())) : (setPlaying(false), setStep(step + 1)))}>
                {step >= last ? 'Replay' : 'Next step'}
              </button>
            </div>
            <div className="fv-answer">Answer: <b>{answer}</b></div>
          </div>
        )
      )}
      <Hint>Type two fractions (mixed numbers like 1 1/2 work too) and pick an operation to watch the pieces re-cut to a common denominator and merge. In Build mode, tap or drag across slices to shade your own fraction.</Hint>
    </div>
  )
}
