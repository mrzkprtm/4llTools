import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { tone } from '../../sim/audio'
import { Choice, Hint, Toggle } from '../../sim/controls'
import { firstWrong, reshuffle, scramble, wordPoints, type Tile } from './logic'
import { playable, type Difficulty, type Lang } from './words'
import './tool.css'

const TIME = 45
type Status = 'play' | 'win' | 'wrong' | 'timeout'

export default function WordScramble() {
  const [lang, setLang] = useState<Lang>('en')
  const [diff, setDiff] = useState<Difficulty>('easy')
  const [timed, setTimed] = useState(false)
  const [word, setWord] = useState('')
  const [order, setOrder] = useState<Tile[]>([])
  const [slots, setSlots] = useState<(number | null)[]>([])
  const [locked, setLocked] = useState<Set<number>>(new Set())
  const [status, setStatus] = useState<Status>('play')
  const [hints, setHints] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [solved, setSolved] = useState(0)
  const [left, setLeft] = useState(TIME)
  const recent = useRef<string[]>([])
  const pool = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLDivElement>(null)
  const timer = useRef(0)
  useFlip(pool)
  useFlip(board)

  const next = useCallback(() => {
    const words = playable(lang, diff)
    const fresh = words.filter((w) => !recent.current.includes(w))
    const w = (fresh.length ? fresh : words)[Math.floor(Math.random() * (fresh.length || words.length))]
    recent.current = [w, ...recent.current].slice(0, Math.min(30, words.length - 1))
    setWord(w)
    setOrder(scramble(w))
    setSlots(Array(w.length).fill(null))
    setLocked(new Set())
    setStatus('play')
    setHints(0)
    setLeft(TIME)
  }, [lang, diff])

  useEffect(() => {
    recent.current = []
    next()
  }, [next])
  useEffect(() => () => clearTimeout(timer.current), [])

  // Countdown when the timer is on.
  useEffect(() => {
    if (!timed || status !== 'play' || !word) return
    if (left <= 0) {
      setStatus('timeout')
      setStreak(0)
      const used = new Set<number>()
      setSlots([...word].map((c) => {
        const t = order.find((x) => x.letter === c && !used.has(x.id))
        if (t) used.add(t.id)
        return t?.id ?? null
      }))
      setLocked(new Set(word.split('').map((_, i) => i)))
      tone(160, 250, 'triangle')
      return
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(id)
  }, [timed, status, left, word, order])

  const tileOf = (id: number | null) => (id === null ? undefined : order.find((t) => t.id === id))
  const guess = slots.map((id) => tileOf(id)?.letter ?? null)
  const placed = new Set(slots.filter((x): x is number => x !== null))

  const check = (s: (number | null)[]) => {
    if (s.some((x) => x === null)) return
    const g = s.map((id) => order.find((t) => t.id === id)!.letter).join('')
    if (g === word) {
      setStatus('win')
      setScore((x) => x + wordPoints(word, hints, streak))
      setStreak((x) => x + 1)
      setSolved((x) => x + 1)
      ;[523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 120), i * 90))
      timer.current = window.setTimeout(next, 1500)
    } else {
      setStatus('wrong')
      tone(200, 200, 'triangle')
      timer.current = window.setTimeout(() => setStatus('play'), 500)
    }
  }
  const place = (id: number) => {
    if (status !== 'play' && status !== 'wrong') return
    const i = slots.indexOf(null)
    if (i < 0) return
    const s = slots.map((x, j) => (j === i ? id : x))
    setSlots(s)
    tone(900, 30)
    check(s)
  }
  const unplace = (i: number) => {
    if (locked.has(i) || slots[i] === null || status === 'win' || status === 'timeout') return
    setSlots(slots.map((x, j) => (j === i ? null : x)))
  }
  const hint = () => {
    if (status === 'win' || status === 'timeout') return
    const i = firstWrong(guess, word)
    if (i < 0) return
    let s = slots.map((x, j) => (j === i ? null : x))
    const used = new Set(s.filter((x): x is number => x !== null))
    let tile = order.find((t) => t.letter === word[i] && !used.has(t.id))
    if (!tile) {
      // The letter sits in a wrong unlocked slot: take it back from there.
      const j = s.findIndex((id, k) => id !== null && !locked.has(k) && tileOf(id)?.letter === word[i])
      tile = tileOf(s[j])
      s = s.map((x, k) => (k === j ? null : x))
    }
    if (!tile) return
    s[i] = tile.id
    setSlots(s)
    setLocked(new Set([...locked, i]))
    setHints((h) => h + 1)
    check(s)
  }

  // Typing: letters place a matching tile, Backspace takes the last one back.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select') || e.metaKey || e.ctrlKey) return
      if (e.key === 'Backspace') {
        for (let i = slots.length - 1; i >= 0; i--) if (slots[i] !== null && !locked.has(i)) return unplace(i)
      } else if (e.key === 'Enter' && status !== 'play') next()
      else if (/^[a-z]$/i.test(e.key)) {
        const tile = order.find((x) => x.letter === e.key.toLowerCase() && !placed.has(x.id))
        if (tile) place(tile.id)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  return (
    <div className="ws">
      <div className="row ws-settings">
        <Choice value={lang} onChange={setLang} options={[['en', 'English'], ['id', 'Indonesia']]} />
        <Choice value={diff} onChange={setDiff} options={[['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]} />
        <Toggle label={`Timer (${TIME} s)`} checked={timed} onChange={(v) => { setTimed(v); setLeft(TIME) }} />
      </div>
      <div className="ws-hud">
        <span><b><Roll>{score}</Roll></b> score</span>
        <span><b><Roll>{streak}</Roll></b> streak</span>
        <span><b><Roll>{solved}</Roll></b> solved</span>
        {timed && <span className={left <= 10 ? 'ws-low' : ''}><b><Roll>{left}</Roll></b> sec</span>}
      </div>
      {timed && <div className="bar ws-time"><i style={{ transform: `scaleX(${left / TIME})` }} /></div>}

      <div ref={board} className={`ws-slots ${status}`} aria-label="Your answer" aria-live="polite">
        {slots.map((id, i) => {
          const t = tileOf(id)
          return (
            <button key={t ? `t${t.id}` : `s${i}`} data-flip={t ? `t${t.id}` : undefined} type="button" className={`ws-tile ws-slot ${t ? 'full' : ''} ${locked.has(i) ? 'locked' : ''}`} style={{ animationDelay: `${i * 50}ms` }} onClick={() => unplace(i)} aria-label={t ? `Slot ${i + 1}: ${t.letter}. Tap to remove` : `Empty slot ${i + 1}`}>
              {t?.letter.toUpperCase() ?? ''}
            </button>
          )
        })}
      </div>

      <div ref={pool} className="ws-pool" aria-label="Letters">
        {order.filter((t) => !placed.has(t.id)).map((t) => (
          <button key={`t${t.id}`} data-flip={`t${t.id}`} type="button" className="ws-tile" onClick={() => place(t.id)}>
            {t.letter.toUpperCase()}
          </button>
        ))}
      </div>

      <p className="ws-msg" key={status + word}>
        {status === 'win' ? `🎉 ${word.toUpperCase()}! +${wordPoints(word, hints, Math.max(0, streak - 1))}` : status === 'timeout' ? `Time's up! It was ${word.toUpperCase()}.` : status === 'wrong' ? 'Not quite. Tap a letter to take it back.' : `${word.length} letters`}
      </p>

      <div className="row ws-actions">
        <button type="button" className="btn btn-icon" onClick={() => setOrder(reshuffle(order, word))} disabled={status === 'win'}><Icon name="reload" size={18} />Shuffle</button>
        <button type="button" className="btn btn-icon" onClick={hint} disabled={status === 'win' || status === 'timeout'}><Icon name="lightbulb-shine" size={18} />Hint</button>
        <button type="button" className="btn" onClick={() => setSlots(slots.map((x, i) => (locked.has(i) ? x : null)))} disabled={status === 'win' || status === 'timeout'}>Clear</button>
        <button type="button" className="btn primary" onClick={() => { if (status === 'play' || status === 'wrong') setStreak(0); clearTimeout(timer.current); next() }}>{status === 'play' || status === 'wrong' ? 'Skip' : 'Next word'}</button>
      </div>
      <Hint>Tap letters to fill the slots in order, or just type on your keyboard; tap a placed letter (or press Backspace) to take it back. A hint locks in the next correct letter but costs 10 points.</Hint>
    </div>
  )
}
