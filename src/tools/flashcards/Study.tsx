import { useCallback, useEffect, useMemo, useState } from 'react'
import { tone } from '../../sim/audio'
import { dueCards, previewInterval, schedule, type Card, type Deck, type Grade } from './logic'

const GRADES: [Grade, string, string][] = [
  ['again', 'Again', '1'],
  ['hard', 'Hard', '2'],
  ['good', 'Good', '3'],
  ['easy', 'Easy', '4'],
]

function when(ms: number) {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${Math.max(1, m)} min`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h`
  return `${Math.round(h / 24)} days`
}

/** One study session: flip the card, grade it, and it moves to its new box. */
export default function Study({ deck, onUpdate }: { deck: Deck; onUpdate: (card: Card) => void }) {
  const [queue, setQueue] = useState<string[]>([])
  const [flipped, setFlipped] = useState(false)
  const [reverse, setReverse] = useState(false)
  const [done, setDone] = useState(0)
  const [cram, setCram] = useState(false)
  const [leaving, setLeaving] = useState<Grade | null>(null)

  const refill = useCallback((all = false) => {
    const now = Date.now()
    setQueue((all ? [...deck.cards].sort(() => Math.random() - 0.5) : dueCards(deck.cards, now)).map((c) => c.id))
    setCram(all)
    setFlipped(false)
  }, [deck.cards])

  useEffect(() => {
    refill()
    setDone(0)
  }, [deck.id])

  const card = useMemo(() => deck.cards.find((c) => c.id === queue[0]), [deck.cards, queue])
  const now = Date.now()

  const grade = useCallback(
    (g: Grade) => {
      if (!card || !flipped || leaving) return
      setLeaving(g)
      tone(g === 'again' ? 220 : g === 'hard' ? 330 : g === 'good' ? 520 : 700, 90)
      window.setTimeout(() => {
        onUpdate(schedule(card, g, Date.now()))
        setQueue((q) => (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)))
        setDone((d) => d + 1)
        setFlipped(false)
        setLeaving(null)
      }, 260)
    },
    [card, flipped, leaving, onUpdate],
  )

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select')) return
      if (e.key === ' ' || e.key === 'Enter') {
        if (!card) return
        e.preventDefault()
        setFlipped((f) => !f)
      } else {
        const g = GRADES.find((x) => x[2] === e.key)
        if (g) grade(g[0])
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [card, grade])

  if (!deck.cards.length) return <p className="muted fc-empty">This deck has no cards yet. Add some under Edit cards, or import a CSV.</p>

  if (!card) {
    const next = Math.min(...deck.cards.map((c) => c.due))
    return (
      <div className="fc-empty pop">
        <p className="fc-done">{done ? `Nice work: ${done} review${done === 1 ? '' : 's'} done.` : 'All caught up!'}</p>
        <p className="muted">{Number.isFinite(next) && next > now ? `Next card is due in ${when(next - now)}.` : 'Nothing is due right now.'}</p>
        <div className="row fc-center">
          <button type="button" className="btn primary" onClick={() => refill(true)}>Study all cards anyway</button>
          <button type="button" className="btn" onClick={() => refill()}>Check for due cards</button>
        </div>
      </div>
    )
  }

  const front = reverse ? card.back : card.front
  const back = reverse ? card.front : card.back
  return (
    <div className="fc-study">
      <div className="row fc-meta">
        <span className="muted">{queue.length} left{cram ? ' (study all)' : ''} · {done} done</span>
        <label className="sim-toggle">
          <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} /> Back first
        </label>
      </div>
      <div className={`fc-scene ${leaving ? `leave-${leaving}` : ''}`} key={card.id + queue.length}>
        <button type="button" className={`fc-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={flipped ? `Answer: ${back}` : `Question: ${front}. Tap to flip.`}>
          <span className="fc-face fc-front">
            <small>Box {card.box}</small>
            {front}
          </span>
          <span className="fc-face fc-back">
            <small>{front}</small>
            {back}
          </span>
        </button>
      </div>
      {flipped ? (
        <div className="fc-grades">
          {GRADES.map(([g, name, k]) => (
            <button key={g} type="button" className={`btn fc-${g}`} onClick={() => grade(g)}>
              <b>{name}</b>
              <small>{previewInterval(card, g, now)} · {k}</small>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="btn primary fc-show" onClick={() => setFlipped(true)}>Show answer <small>(Space)</small></button>
      )}
    </div>
  )
}
