import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { charStates, consistency, makeWords, perSecondWpm, score } from './typing'
import { LISTS, type Lang } from './words'
import './tool.css'

type Mode = { kind: 'time' | 'words'; value: number }
const MODES: Mode[] = [
  { kind: 'time', value: 15 },
  { kind: 'time', value: 30 },
  { kind: 'time', value: 60 },
  { kind: 'words', value: 10 },
  { kind: 'words', value: 25 },
  { kind: 'words', value: 50 },
]
const modeKey = (m: Mode) => `${m.kind}${m.value}`
const modeLabel = (m: Mode) => (m.kind === 'time' ? `${m.value}s` : `${m.value} words`)

function readPb(key: string): number {
  try {
    return Number(localStorage.getItem(`typing-pb-${key}`)) || 0
  } catch {
    return 0
  }
}

function writePb(key: string, wpm: number) {
  try {
    localStorage.setItem(`typing-pb-${key}`, String(Math.round(wpm)))
  } catch {
    // Storage is optional.
  }
}

function Chart({ net, raw }: { net: number[]; raw: number[] }) {
  const W = 600
  const H = 170
  const P = { l: 34, r: 10, t: 10, b: 22 }
  const max = Math.max(20, ...raw, ...net) * 1.1
  const n = net.length
  const x = (i: number) => P.l + (n > 1 ? (i / (n - 1)) * (W - P.l - P.r) : 0)
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b)
  const path = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ticks = [0, 0.5, 1].map((f) => Math.round(f * max))
  return (
    <svg className="ty-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Speed each second, from ${Math.round(Math.min(...net))} to ${Math.round(Math.max(...net))} WPM`}>
      {ticks.map((t) => <g key={t}><line className="grid" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} /><text x={P.l - 6} y={y(t) + 3} textAnchor="end">{t}</text></g>)}
      {net.map((_, i) => (i % Math.max(1, Math.ceil(n / 10)) === 0 || i === n - 1 ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{i + 1}s</text> : null))}
      <path className="raw" d={path(raw)} />
      <path className="net" d={path(net)} pathLength={1} />
    </svg>
  )
}

export default function TypingTest() {
  const [lang, setLang] = useState<Lang>('en')
  const [mode, setMode] = useState<Mode>(MODES[1])
  const [words, setWords] = useState<string[]>(() => makeWords(LISTS.en, 120))
  const [typed, setTyped] = useState('')
  const [startAt, setStartAt] = useState<number | null>(null)
  const [endAt, setEndAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [keys, setKeys] = useState({ total: 0, wrong: 0 })
  const [samples, setSamples] = useState<{ typed: number; correct: number }[]>([])
  const [focused, setFocused] = useState(false)
  const [pb, setPb] = useState(0)
  const [newPb, setNewPb] = useState(false)
  const [layout, setLayout] = useState(0)
  const input = useRef<HTMLTextAreaElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const caret = useRef<HTMLSpanElement>(null)
  const tabAt = useRef(0)
  const live = useRef({ typed: '', target: '' })

  const target = words.join(' ')
  live.current = { typed, target }
  const states = useMemo(() => charStates(target, typed), [target, typed])
  const finished = endAt !== null
  const running = startAt !== null && !finished
  const elapsed = startAt === null ? 0 : (endAt ?? now) - startAt
  const pbKey = `${lang}-${modeKey(mode)}`

  useEffect(() => setPb(readPb(pbKey)), [pbKey])

  // Re-measure the caret when the width changes or the web font arrives.
  useEffect(() => {
    const bump = () => setLayout((n) => n + 1)
    window.addEventListener('resize', bump)
    void document.fonts?.ready.then(bump)
    return () => window.removeEventListener('resize', bump)
  }, [])

  function restart(nextLang = lang, nextMode = mode) {
    setWords(makeWords(LISTS[nextLang], nextMode.kind === 'words' ? nextMode.value : 120))
    setTyped('')
    setStartAt(null)
    setEndAt(null)
    setKeys({ total: 0, wrong: 0 })
    setSamples([])
    setNewPb(false)
    input.current?.focus()
  }

  // Tick while running; record one sample per second; end timed tests.
  useEffect(() => {
    if (!running || startAt === null) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      const secs = Math.floor((t - startAt) / 1000)
      setSamples((s) => {
        if (secs <= s.length) return s
        const { typed: ty, target: tg } = live.current
        let correct = 0
        for (let i = 0; i < ty.length && i < tg.length; i++) if (ty[i] === tg[i]) correct++
        return [...s, { typed: ty.length, correct }]
      })
      if (mode.kind === 'time' && t - startAt >= mode.value * 1000) setEndAt(startAt + mode.value * 1000)
    }, 100)
    return () => clearInterval(id)
  }, [running, startAt, mode])

  // Place the caret and keep the current line in view.
  useLayoutEffect(() => {
    const box = textRef.current
    const c = caret.current
    if (!box || !c) return
    const chars = box.querySelectorAll<HTMLElement>('.ty-c')
    const at = chars[Math.min(typed.length, chars.length - 1)]
    if (!at) return
    const after = typed.length >= chars.length
    const lineH = at.offsetHeight || 30
    const top = at.offsetTop
    const shift = Math.max(0, top - lineH)
    box.style.transform = `translateY(${-shift}px)`
    c.style.transform = `translate(${at.offsetLeft + (after ? at.offsetWidth : 0)}px, ${top}px)`
  }, [typed, words, layout, finished])

  const final = useMemo(() => {
    if (!finished || startAt === null || endAt === null) return null
    const s = score(target, typed, endAt - startAt, keys.total, keys.wrong)
    const cumTyped = samples.map((x) => x.typed)
    const cumCorrect = samples.map((x) => x.correct)
    const raw = perSecondWpm(cumTyped)
    const net = perSecondWpm(cumCorrect)
    return { ...s, raw: s.raw, rawSeries: raw, netSeries: net, consistency: consistency(raw) }
  }, [finished])

  useEffect(() => {
    if (!final) return
    if (final.wpm > pb && final.wpm > 0) {
      writePb(pbKey, final.wpm)
      setNewPb(pb > 0)
      setPb(Math.round(final.wpm))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final])

  function onType(v: string) {
    if (finished) return
    v = v.replace(/\n/g, '').slice(0, target.length)
    let t0 = startAt
    if (t0 === null && v.length) {
      t0 = Date.now()
      setStartAt(t0)
      setNow(t0)
    }
    if (v.length > typed.length) {
      let wrong = 0
      for (let i = typed.length; i < v.length; i++) if (v[i] !== target[i]) wrong++
      setKeys((k) => ({ total: k.total + v.length - typed.length, wrong: k.wrong + wrong }))
    }
    setTyped(v)
    // Keep enough words ahead in timed mode.
    if (mode.kind === 'time' && target.length - v.length < 80) setWords((w) => [...w, ...makeWords(LISTS[lang], 60)])
    if (mode.kind === 'words' && v.length >= target.length && t0 !== null) {
      const t = Date.now()
      setNow(t)
      setEndAt(t)
      setSamples((s) => {
        let correct = 0
        for (let i = 0; i < v.length; i++) if (v[i] === target[i]) correct++
        return [...s, { typed: v.length, correct }]
      })
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault()
      tabAt.current = Date.now()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (Date.now() - tabAt.current < 1500 || finished) restart()
    } else if (e.key === 'Escape') {
      restart()
    }
  }

  const liveScore = startAt !== null ? score(target, typed, Math.max(elapsed, 1000), keys.total, keys.wrong) : null
  const left = mode.kind === 'time' ? Math.max(0, mode.value - Math.floor(elapsed / 1000)) : null
  const wordsDone = typed.split(' ').length - (typed.endsWith(' ') || !typed ? 1 : 0)

  let idx = 0
  return (
    <div>
      <div className="ty-bar">
        <PillRow label="Language" style={{ margin: 0 }}>
          <button type="button" className={`btn ${lang === 'en' ? 'primary' : ''}`} aria-pressed={lang === 'en'} onClick={() => { setLang('en'); restart('en') }}>English</button>
          <button type="button" className={`btn ${lang === 'id' ? 'primary' : ''}`} aria-pressed={lang === 'id'} onClick={() => { setLang('id'); restart('id') }}>Indonesia</button>
        </PillRow>
        <PillRow label="Test length" style={{ margin: 0 }}>
          {MODES.map((m) => (
            <button key={modeKey(m)} type="button" className={`btn ${modeKey(m) === modeKey(mode) ? 'primary' : ''}`} aria-pressed={modeKey(m) === modeKey(mode)} onClick={() => { setMode(m); restart(lang, m) }}>{modeLabel(m)}</button>
          ))}
        </PillRow>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="ty-live" aria-live="off">
          {left !== null ? <span><b><Roll>{left}</Roll></b> s</span> : <span><b><Roll>{Math.min(wordsDone, mode.value)}</Roll></b>/{mode.value}</span>}
          <span><Roll>{liveScore ? Math.round(liveScore.wpm) : 0}</Roll> wpm</span>
          <span><Roll>{liveScore ? Math.round(liveScore.accuracy) : 100}</Roll>% acc</span>
        </div>
        <span className="muted" style={{ fontSize: '0.85rem' }}>Best ({modeLabel(mode)}, {lang === 'en' ? 'EN' : 'ID'}): <b style={{ color: 'var(--text)' }}>{pb || '—'}</b>{pb ? ' wpm' : ''}</span>
      </div>

      {!finished && (
        <div className={`ty-box ${focused ? 'focus' : ''} ${running ? 'typing' : ''}`} onClick={() => input.current?.focus()}>
          <div className="ty-view">
            <div className="ty-text" ref={textRef} aria-hidden="true">
              {words.map((w, wi) => {
                const start = idx
                idx += w.length + 1
                return (
                  <span key={wi} className="ty-word">
                    {[...w].map((ch, ci) => <span key={ci} className={`ty-c ${states[start + ci]}`}>{ch}</span>)}
                    {wi < words.length - 1 && <span className={`ty-c sp ${states[start + w.length]}`}>{' '}</span>}
                  </span>
                )
              })}
              <span ref={caret} className="ty-caret" />
            </div>
          </div>
          <textarea
            ref={input}
            className="ty-input"
            value={typed}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            aria-label={`Type the words shown: ${target.slice(0, 200)}`}
          />
          {!focused && <div className="ty-hint">{startAt ? 'Paused view: click or tap to keep typing' : 'Click or tap here, then start typing'}</div>}
        </div>
      )}

      {final && (
        <div className="ty-result settle-in" aria-live="polite">
          <div className="ty-hero">
            <div className="ty-big"><Roll>{Math.round(final.wpm)}</Roll><small>WPM (net)</small></div>
            <div className="ty-big" style={{ color: 'var(--text)' }}><Roll>{`${Math.round(final.accuracy)}%`}</Roll><small>accuracy</small></div>
            {newPb && <span className="chip good">New personal best!</span>}
          </div>
          <div className="stats">
            <div className="stat"><b><Roll>{Math.round(final.raw)}</Roll></b>raw WPM</div>
            <div className="stat"><b><Roll>{final.correct}</Roll></b>correct characters</div>
            <div className="stat"><b><Roll>{keys.wrong}</Roll></b>errors typed ({final.incorrect} left)</div>
            <div className="stat"><b><Roll>{`${Math.round(final.consistency)}%`}</Roll></b>consistency</div>
            <div className="stat"><b><Roll>{((endAt! - startAt!) / 1000).toFixed(1)}</Roll></b>seconds</div>
          </div>
          {final.netSeries.length > 1 && <Chart net={final.netSeries} raw={final.rawSeries} />}
          {final.netSeries.length > 1 && <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>Solid: correct characters per second as WPM. Dashed: everything typed (raw).</p>}
        </div>
      )}

      <div className="row">
        <button type="button" className="btn primary" onClick={() => restart()}>{finished ? 'Try again' : 'Restart'}</button>
        <span className="muted" style={{ fontSize: '0.85rem' }}><span className="ty-kbd">Tab</span> + <span className="ty-kbd">Enter</span> or <span className="ty-kbd">Esc</span> to restart</span>
      </div>
      <p className="muted">
        WPM counts 5 characters as one word. Net WPM uses only correct characters; raw WPM counts everything you typed; accuracy counts every key press, including mistakes you fixed. Consistency is how steady your speed was second by second. The timer starts on your first key. Best scores are saved only in this browser. Works with phone keyboards too; autocorrect is turned off for the test.
      </p>
    </div>
  )
}
