import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { tone as beep } from '../../sim/audio'
import { Choice, Hint, Select, Toggle } from '../../sim/controls'
import Clock from './Clock'
import { dayPart, digital, nearbyTimes, randomTime, timeToWords, wrapDelta, type Lang, type Level } from './logic'
import './tool.css'

type Mode = 'explore' | 'set' | 'read'
const LEVELS: [Level, string][] = [['hour', "O'clock"], ['half', 'Half hours'], ['quarter', 'Quarters'], ['five', '5 minutes'], ['minute', 'Any minute']]
const mod = (t: number) => ((t % 1440) + 1440) % 1440

function Words({ total, h24 }: { total: number; h24: boolean }) {
  const t = mod(total)
  const h = Math.floor(t / 60)
  const m = t % 60
  return (
    <div className="lc-words" aria-live="polite">
      <p key={`en${t}`}>
        <span className="lc-flag">EN</span>
        {timeToWords(h, m, 'en')}
        {h24 && <span className="muted"> {dayPart(h, 'en')}</span>}
      </p>
      <p key={`id${t}`}>
        <span className="lc-flag">ID</span>
        {timeToWords(h, m, 'id')}
        {h24 && <span className="muted"> {dayPart(h, 'id')}</span>}
      </p>
    </div>
  )
}

export default function LearnClock() {
  const [mode, setMode] = useState<Mode>('explore')
  const [total, setTotal] = useState(15 * 60 + 15)
  const [h24, setH24] = useState(false)
  const [labels, setLabels] = useState(true)
  const [level, setLevel] = useState<Level>('quarter')
  const [lang, setLang] = useState<Lang>('en')
  const [target, setTarget] = useState(0)
  const [options, setOptions] = useState<number[]>([])
  const [result, setResult] = useState<null | { ok: boolean; picked?: number }>(null)
  const [score, setScore] = useState({ right: 0, asked: 0, streak: 0 })
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  /** Moves the hands forward to `t` (mod 24 h) so they sweep instead of jumping back. */
  const goTo = (t: number) => setTotal((cur) => cur + ((wrapDelta(mod(cur), mod(t), 1440) + 1440) % 1440))

  const newQuestion = (m: Mode = mode, lv: Level = level) => {
    const t = randomTime(lv)
    setTarget(t)
    setResult(null)
    if (m === 'read') {
      setOptions(nearbyTimes(t, lv, 4))
      goTo(t)
    } else setTotal((cur) => cur - mod(cur) + 12 * 60)
  }

  useEffect(() => {
    if (mode !== 'explore') newQuestion(mode, level)
  }, [mode, level])

  const answer = (ok: boolean, picked?: number) => {
    if (result) return
    setResult({ ok, picked })
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), asked: s.asked + 1, streak: ok ? s.streak + 1 : 0 }))
    beep(ok ? 880 : 200, ok ? 120 : 220, ok ? 'sine' : 'triangle')
    if (!ok && mode === 'set') goTo(target)
    timer.current = window.setTimeout(() => newQuestion(), ok ? 1300 : 2600)
  }

  const now = () => {
    const d = new Date()
    goTo(d.getHours() * 60 + d.getMinutes())
  }
  const t = mod(total)
  const words = (x: number) => timeToWords(Math.floor(x / 60), x % 60, lang)

  return (
    <div className="lc">
      <Choice value={mode} onChange={setMode} options={[['explore', 'Explore'], ['set', 'Quiz: set the clock'], ['read', 'Quiz: what time?']]} />
      <div className="lc-grid">
        <div className="lc-left">
          <Clock
            total={total}
            onChange={mode === 'read' || result ? undefined : setTotal}
            minuteLabels={labels}
            label={`Clock showing ${digital(t, h24)}`}
            tone={result ? (result.ok ? 'ok' : 'bad') : null}
          />
          {mode !== 'read' && (
            <div className="row lc-nudge">
              <button type="button" className="btn" onClick={() => setTotal(total - 60)} disabled={!!result}>−1 h</button>
              <button type="button" className="btn" onClick={() => setTotal(total - 5)} disabled={!!result}>−5</button>
              <button type="button" className="btn" onClick={() => setTotal(total + 5)} disabled={!!result}>+5</button>
              <button type="button" className="btn" onClick={() => setTotal(total + 60)} disabled={!!result}>+1 h</button>
            </div>
          )}
        </div>
        <div className="lc-side">
          {mode === 'explore' ? (
            <>
              <div className="lc-digital"><Roll>{digital(t, h24)}</Roll></div>
              <Words total={total} h24={h24} />
              <div className="row">
                <button type="button" className="btn primary" onClick={now}>Now</button>
                <button type="button" className="btn" onClick={() => goTo(randomTime('five'))}>Random</button>
              </div>
            </>
          ) : (
            <>
              <div className="row lc-score">
                <span>Score <b><Roll>{`${score.right}/${score.asked}`}</Roll></b></span>
                <span>Streak <b><Roll>{score.streak}</Roll></b></span>
              </div>
              <Select label="Level" value={level} onChange={setLevel} options={LEVELS} />
              <Choice label="Words in" value={lang} onChange={setLang} options={[['en', 'English'], ['id', 'Indonesian']]} />
              {mode === 'set' ? (
                <div className="lc-q" key={target}>
                  <p className="muted">Set the clock to</p>
                  <p className="lc-prompt">{words(target)}</p>
                  <p className="muted lc-sub">{digital(target, h24)}</p>
                  <button type="button" className="btn primary lc-check" disabled={!!result} onClick={() => answer(mod(total) % 720 === target % 720)}>Check</button>
                </div>
              ) : (
                <div className="lc-q" key={target}>
                  <p className="muted">What time is it?</p>
                  <div className="lc-options">
                    {options.map((o, i) => {
                      const cls = result ? (o % 720 === target % 720 ? 'good' : o === result.picked ? 'bad' : 'dim') : ''
                      return (
                        <button key={o} type="button" className={`btn lc-opt ${cls}`} style={{ animationDelay: `${i * 60}ms` }} disabled={!!result} onClick={() => answer(o % 720 === target % 720, o)}>
                          {words(o)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {result && <p className={`lc-feedback ${result.ok ? 'ok' : 'error'}`}>{result.ok ? 'Correct!' : `Not quite. It's ${words(target)}.`}</p>}
            </>
          )}
          <Toggle label="24-hour clock" checked={h24} onChange={setH24} />
          <Toggle label="Show minute numbers" checked={labels} onChange={setLabels} />
        </div>
      </div>
      <Hint>Drag the long minute hand around the clock and the hour hand follows, or drag the short hour hand directly. Indonesian says 3:30 as "setengah empat" (half to four), and arrow keys nudge the time too.</Hint>
    </div>
  )
}
