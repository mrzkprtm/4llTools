import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from '../../motion/springs'
import { Hint } from '../../sim/controls'
import { rng } from '../../sim/math'
import { buildPlan, figureColor, inFigure, packDots, score, type PlateSpec, type RGB } from './logic'
import './tool.css'

const R = 180
const NAMES = { protan: 'Protan (red-weak)', deutan: 'Deutan (green-weak)', tritan: 'Tritan (blue-yellow)' } as const

/** Draws one plate: packed dots, colored by whether they fall inside the digit mask. */
function Plate({ spec, seed }: { spec: PlateSpec; seed: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const random = rng(seed)
    const dots = packDots(random, R)
    // Render the digit off-screen and sample its alpha as a mask.
    const m = document.createElement('canvas')
    m.width = m.height = 2 * R
    const mc = m.getContext('2d')
    let data: Uint8ClampedArray = new Uint8ClampedArray(4 * 4 * R * R)
    if (mc && spec.digit !== null) {
      mc.font = `900 ${R * 1.35}px "Bricolage Grotesque Variable", system-ui, sans-serif`
      mc.textAlign = 'center'
      mc.textBaseline = 'middle'
      mc.fillStyle = '#000'
      mc.fillText(String(spec.digit), R, R * 1.06)
      data = mc.getImageData(0, 0, 2 * R, 2 * R).data
    }
    const painted = dots.map((d) => {
      const base = spec.palette[Math.floor(random() * spec.palette.length)]
      const col: RGB = inFigure(data, 2 * R, 2 * R, d) ? figureColor(spec, base) : base
      const k = 0.88 + random() * 0.22 // lightness noise hides the figure from brightness cues
      return { d, color: `rgb(${col.map((v) => Math.min(255, Math.round(v * k))).join(',')})` }
    })
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = c.height = Math.round(2 * R * dpr)
    let raf = 0
    const t0 = performance.now()
    const still = reducedMotion()
    const draw = (now: number) => {
      const p = still ? 1 : Math.min(1, (now - t0) / 450)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, 2 * R, 2 * R)
      ctx.fillStyle = '#f4f1ea'
      ctx.beginPath()
      ctx.arc(R, R, R, 0, Math.PI * 2)
      ctx.fill()
      for (const { d, color } of painted) {
        // Dots grow outward from the center.
        const local = Math.max(0, Math.min(1, p * 1.6 - (Math.hypot(d.x - R, d.y - R) / R) * 0.6))
        if (!local) continue
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r * local, 0, Math.PI * 2)
        ctx.fill()
      }
      if (p < 1) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [spec, seed])
  return <canvas ref={ref} className="cb-plate" role="img" aria-label="Dot plate; find the number hidden in the dots" />
}

export default function ColorBlindTest() {
  const [seed, setSeed] = useState(12345)
  const [plan, setPlan] = useState<PlateSpec[]>(() => buildPlan(12345))
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [phase, setPhase] = useState<'intro' | 'test' | 'done'>('intro')

  function start() {
    const s = Math.floor(Math.random() * 1e9)
    setSeed(s)
    setPlan(buildPlan(s))
    setIdx(0)
    setAnswers([])
    setPhase('test')
  }

  function answer(v: number | null) {
    if (phase !== 'test') return
    const next = [...answers, v]
    setAnswers(next)
    if (idx + 1 >= plan.length) setPhase('done')
    else setIdx(idx + 1)
  }

  useEffect(() => {
    if (phase !== 'test') return
    const on = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) answer(Number(e.key))
      else if (e.key === '0' || e.key.toLowerCase() === 'n') answer(null)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  const sum = phase === 'done' ? score(plan, answers) : null

  return (
    <div className="cb">
      <p className="cb-note"><b>Not a diagnosis.</b> Screens, night-light filters and room lighting change colors. This is a quick screening for fun and curiosity; an eye care professional can test properly.</p>

      {phase === 'intro' && (
        <div className="cb-intro">
          <Plate spec={plan[0]} seed={seed} />
          <p>You will see {plan.length} dot plates. Pick the number you see in each, or "Nothing" if you see none. Answer quickly, within a few seconds.</p>
          <button type="button" className="btn primary cb-go" onClick={start}>Start the test</button>
        </div>
      )}

      {phase === 'test' && (
        <div className="cb-test">
          <div className="cb-progress"><i style={{ width: `${(idx / plan.length) * 100}%` }} /></div>
          <p className="muted">Plate {idx + 1} of {plan.length}</p>
          <div key={idx} className="cb-plate-wrap">
            <Plate spec={plan[idx]} seed={seed + idx * 7919} />
          </div>
          <div className="cb-keys" role="group" aria-label="Your answer">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button key={n} type="button" className="btn" onClick={() => answer(n)}>{n}</button>
            ))}
            <button type="button" className="btn cb-none" onClick={() => answer(null)}>Nothing</button>
          </div>
        </div>
      )}

      {sum && (
        <div className="cb-result pop">
          <h3>{!sum.reliable ? 'Result unclear' : sum.likely ? `Possible ${NAMES[sum.likely].toLowerCase()} ${sum.severity === 'mild' ? '(mild)' : ''}` : 'No sign of a color vision deficiency'}</h3>
          <p>
            {!sum.reliable
              ? 'You missed the control plate or the plate with no number, which almost everyone gets right. Check screen brightness and color filters, then try again.'
              : sum.likely
                ? `You missed most plates designed for ${NAMES[sum.likely].split(' ')[0].toLowerCase()} color vision. ${sum.likely === 'tritan' ? 'Blue-yellow deficiency is rare, so check for a warm night-light filter first.' : 'Red-green deficiency affects about 1 in 12 men and 1 in 200 women.'}`
                : 'You read the plates that people with common deficiencies usually miss.'}
          </p>
          <div className="cb-bars">
            {(['protan', 'deutan', 'tritan'] as const).map((a, i) => {
              const f = sum.fails[a]
              return (
                <div key={a} className="cb-bar-row">
                  <span>{NAMES[a]}</span>
                  <div className="cb-bar"><i style={{ width: `${f.total ? (f.failed / f.total) * 100 : 0}%`, animationDelay: `${i * 120}ms` }} /></div>
                  <b>{f.failed}/{f.total} missed</b>
                </div>
              )
            })}
          </div>
          <p className="muted">{sum.correct} of {sum.total} plates correct.</p>
          <ol className="cb-review">
            {plan.map((p, i) => (
              <li key={i} className={answers[i] === p.digit ? 'ok' : 'bad'}>
                <span>{p.kind === 'blank' ? 'no number' : p.kind}</span> {p.digit ?? '–'} → you: {answers[i] ?? 'nothing'}
              </li>
            ))}
          </ol>
          <button type="button" className="btn primary" onClick={start}>Take a new test</button>
        </div>
      )}

      <Hint>Each run draws fresh plates. Figure dots differ from background dots only along a color line that people with one type of color blindness cannot see, while dot brightness varies randomly so you cannot cheat with contrast.</Hint>
    </div>
  )
}
