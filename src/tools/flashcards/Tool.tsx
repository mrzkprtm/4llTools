import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { Choice, Hint } from '../../sim/controls'
import { BOX_DAYS, boxCounts, dueCards, newCard, newId, type Card, type Deck } from './logic'
import Manage from './Manage'
import { SAMPLE, SAMPLE_NAME } from './sample'
import Study from './Study'
import './tool.css'

const KEY = '4lltools:flashcards'
interface Saved {
  decks: Deck[]
  current: string
}

function sampleDeck(): Deck {
  return { id: 'sample', name: SAMPLE_NAME, cards: SAMPLE.map(([f, b]) => newCard(f, b)) }
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as Saved
      if (Array.isArray(s.decks) && s.decks.length) return s
    }
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  const d = sampleDeck()
  return { decks: [d], current: d.id }
}

function BoxBars({ cards }: { cards: Card[] }) {
  const counts = boxCounts(cards)
  const max = Math.max(1, ...counts)
  const due = dueCards(cards, Date.now()).length
  return (
    <div className="fc-boxes" aria-label="Cards per Leitner box">
      {counts.map((n, i) => (
        <div key={i} className="fc-boxcol">
          <b><Roll>{n}</Roll></b>
          <div className="fc-bar"><i style={{ transform: `scaleY(${n / max})` }} data-box={i + 1} /></div>
          <span>Box {i + 1}</span>
          <small>{i === 0 ? 'daily' : `${BOX_DAYS[i + 1]} d`}</small>
        </div>
      ))}
      <div className="fc-due"><b><Roll>{due}</Roll></b>due now</div>
    </div>
  )
}

export default function Flashcards() {
  const [saved, setSaved] = useState<Saved>(() => ({ decks: [sampleDeck()], current: 'sample' }))
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<'study' | 'edit'>('study')

  useEffect(() => {
    setSaved(load())
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(KEY, JSON.stringify(saved))
    } catch {
      // Storage full or blocked: keep working in memory.
    }
  }, [saved, ready])

  const deck = saved.decks.find((d) => d.id === saved.current) ?? saved.decks[0]
  if (!deck) return null

  const setCards = (cards: Card[]) => setSaved((s) => ({ ...s, decks: s.decks.map((d) => (d.id === deck.id ? { ...d, cards } : d)) }))
  const updateCard = (card: Card) => setSaved((s) => ({ ...s, decks: s.decks.map((d) => (d.id === deck.id ? { ...d, cards: d.cards.map((c) => (c.id === card.id ? card : c)) } : d)) }))

  const addDeck = () => {
    const name = window.prompt('Name for the new deck', 'My deck')?.trim()
    if (!name) return
    const d: Deck = { id: newId(), name, cards: [] }
    setSaved((s) => ({ decks: [...s.decks, d], current: d.id }))
    setTab('edit')
  }
  const rename = () => {
    const name = window.prompt('Rename deck', deck.name)?.trim()
    if (name) setSaved((s) => ({ ...s, decks: s.decks.map((d) => (d.id === deck.id ? { ...d, name } : d)) }))
  }
  const remove = () => {
    if (!window.confirm(`Delete the deck "${deck.name}" and its ${deck.cards.length} cards?`)) return
    setSaved((s) => {
      const decks = s.decks.filter((d) => d.id !== deck.id)
      return decks.length ? { decks, current: decks[0].id } : { decks: [sampleDeck()], current: 'sample' }
    })
  }

  return (
    <div className="fc">
      <div className="row fc-decks">
        <select value={deck.id} onChange={(e) => setSaved((s) => ({ ...s, current: e.target.value }))} aria-label="Deck">
          {saved.decks.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.cards.length})</option>)}
        </select>
        <button type="button" className="btn btn-icon" onClick={addDeck}><Icon name="plus" size={18} />New deck</button>
        <button type="button" className="btn" onClick={rename}>Rename</button>
        <button type="button" className="btn" onClick={remove} aria-label="Delete deck"><Icon name="delete-bin" size={18} /></button>
      </div>
      <BoxBars cards={deck.cards} />
      <Choice value={tab} onChange={setTab} options={[['study', 'Study'], ['edit', `Edit cards (${deck.cards.length})`]]} />
      <div key={tab + deck.id} className="settle-in">
        {tab === 'study' ? <Study deck={deck} onUpdate={updateCard} /> : <Manage deck={deck} onCards={setCards} />}
      </div>
      <Hint>Tap the card (or press Space) to flip it, then grade yourself with 1–4. Good moves a card up a box so you see it less often; Again sends it back to box 1. Decks stay in this browser.</Hint>
    </div>
  )
}
