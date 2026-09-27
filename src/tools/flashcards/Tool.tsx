import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Card {
  id: number
  front: string
  back: string
  tags: string[]
  ease: number
  interval: number
  due: number
  reviews: number
}

interface Deck {
  id: number
  name: string
  cards: Card[]
  created: string
}

const SAMPLE_DECK: Deck = {
  id: 1,
  name: 'Indonesian Vocabulary',
  created: new Date().toISOString(),
  cards: [
    { id: 1, front: 'Makan', back: 'To eat', tags: ['verb', 'basic'], ease: 2.5, interval: 0, due: 0, reviews: 0 },
    { id: 2, front: 'Minum', back: 'To drink', tags: ['verb', 'basic'], ease: 2.5, interval: 0, due: 0, reviews: 0 },
    { id: 3, front: 'Tidur', back: 'To sleep', tags: ['verb', 'basic'], ease: 2.5, interval: 0, due: 0, reviews: 0 },
    { id: 4, front: 'Sekolah', back: 'School', tags: ['noun', 'basic'], ease: 2.5, interval: 0, due: 0, reviews: 0 },
    { id: 5, front: 'Rumah', back: 'House', tags: ['noun', 'basic'], ease: 2.5, interval: 0, due: 0, reviews: 0 },
  ],
}

export default function Flashcards() {
  const [decks, setDecks] = useState<Deck[]>(() => {
    const saved = localStorage.getItem('flashcards')
    return saved ? JSON.parse(saved) : [SAMPLE_DECK]
  })
  const [activeDeckId, setActiveDeckId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'study' | 'editor'>('list')
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [newCard, setNewCard] = useState({ front: '', back: '', tags: '' })

  useEffect(() => {
    try { localStorage.setItem('flashcards', JSON.stringify(decks)) } catch {}
  }, [decks])

  const activeDeck = decks.find(d => d.id === activeDeckId)
  const dueCards = activeDeck?.cards.filter(c => c.due <= Date.now()) || []
  const newCards = activeDeck?.cards.filter(c => c.reviews === 0) || []
  const learningCards = activeDeck?.cards.filter(c => c.reviews > 0 && c.interval < 21) || []
  const reviewCards = activeDeck?.cards.filter(c => c.interval >= 21) || []

  const createDeck = () => {
    if (!newDeckName.trim()) return
    const deck: Deck = { id: Date.now(), name: newDeckName, cards: [], created: new Date().toISOString() }
    setDecks([...decks, deck])
    setActiveDeckId(deck.id)
    setViewMode('editor')
    setNewDeckName('')
  }

  const deleteDeck = (id: number) => {
    setDecks(decks.filter(d => d.id !== id))
    if (activeDeckId === id) setActiveDeckId(null)
  }

  const addCard = () => {
    if (!newCard.front.trim() || !newCard.back.trim()) return
    setDecks(decks.map(d => d.id === activeDeckId ? {
      ...d, cards: [...d.cards, {
        id: Date.now(), front: newCard.front, back: newCard.back,
        tags: newCard.tags.split(',').map(t => t.trim()).filter(Boolean),
        ease: 2.5, interval: 0, due: 0, reviews: 0
      }]
    } : d))
    setNewCard({ front: '', back: '', tags: '' })
  }

  const deleteCard = (deckId: number, cardId: number) => {
    setDecks(decks.map(d => d.id === deckId ? { ...d, cards: d.cards.filter(c => c.id !== cardId) } : d))
  }

  const updateCard = (deckId: number, cardId: number, field: string, value: string) => {
    setDecks(decks.map(d => d.id === deckId ? {
      ...d, cards: d.cards.map(c => c.id === cardId ? { ...c, [field]: value } : c)
    } : d))
  }

  const gradeCard = (grade: number) => {
    if (!activeDeck) return
    const card = dueCards[currentCardIndex] || newCards[currentCardIndex] || learningCards[currentCardIndex] || reviewCards[currentCardIndex]
    if (!card) return

    let { ease, interval, reviews } = card
    const now = Date.now()

    if (grade === 0) {
      interval = 0
      ease = Math.max(1.3, ease - 0.2)
    } else if (grade === 1) {
      interval = 0
      ease = Math.max(1.3, ease - 0.15)
    } else if (grade === 2) {
      if (reviews === 0) interval = 1
      else if (reviews === 1) interval = 6
      else interval = Math.round(interval * ease)
      ease = ease - 0.15 + 0.1
    } else if (grade === 3) {
      if (reviews === 0) interval = 1
      else if (reviews === 1) interval = 6
      else interval = Math.round(interval * ease * 1.3)
      ease = ease + 0.1
    }

    const due = now + interval * 24 * 60 * 60 * 1000
    reviews++

    setDecks(decks.map(d => d.id === activeDeckId ? {
      ...d, cards: d.cards.map(c => c.id === card.id ? { ...c, ease, interval, due, reviews } : c)
    } : d))

    setShowAnswer(false)
    if (currentCardIndex < (dueCards.length + newCards.length + learningCards.length + reviewCards.length) - 1) {
      setCurrentCardIndex(i => i + 1)
    } else {
      setViewMode('list')
    }
  }

  const studyCards = [...dueCards, ...newCards, ...learningCards, ...reviewCards]
  const currentCard = studyCards[currentCardIndex]

  const exportAnki = (deck: Deck) => {
    const lines = deck.cards.map(c => `${c.front}\t${c.back}\t${c.tags.join(' ')}`)
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.name.replace(/\s+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (viewMode === 'list') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Flashcard Maker</h3>
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="New deck name" value={newDeckName} onChange={e => setNewDeckName(e.target.value)} style={{ width: 200 }} />
            <button className="btn" onClick={createDeck}>Create Deck</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {decks.map(deck => (
            <div key={deck.id} className="pop-row" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{deck.name}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {deck.cards.length} cards · Due: {deck.cards.filter(c => c.due <= Date.now()).length} · New: {deck.cards.filter(c => c.reviews === 0).length}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={() => { setActiveDeckId(deck.id); setCurrentCardIndex(0); setShowAnswer(false); setViewMode('study') }}>Study</button>
                <button className="btn" onClick={() => { setActiveDeckId(deck.id); setViewMode('editor') }}>Edit</button>
                <button className="btn" onClick={() => exportAnki(deck)}>Export Anki</button>
                <button className="btn" onClick={() => deleteDeck(deck.id)} style={{ color: 'var(--danger)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Create decks and cards. Study mode uses SM-2 spaced repetition. Export to Anki format (tab-separated).
        </p>
      </div>
    )
  }

  if (viewMode === 'editor') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn" onClick={() => setViewMode('list')}>← Back to Decks</button>
          <h3 style={{ margin: 0 }}>{activeDeck?.name}</h3>
          <button className="btn" onClick={() => { setActiveDeckId(activeDeck!.id); setCurrentCardIndex(0); setShowAnswer(false); setViewMode('study') }}>Study Now</button>
        </div>

        <div style={{ marginBottom: 16, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Add New Card</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <input type="text" placeholder="Front (question)" value={newCard.front} onChange={e => setNewCard({ ...newCard, front: e.target.value })} style={{ padding: '12px', fontSize: '1rem' }} />
            <input type="text" placeholder="Back (answer)" value={newCard.back} onChange={e => setNewCard({ ...newCard, back: e.target.value })} style={{ padding: '12px', fontSize: '1rem' }} />
            <input type="text" placeholder="Tags (comma separated)" value={newCard.tags} onChange={e => setNewCard({ ...newCard, tags: e.target.value })} />
            <button className="btn" onClick={addCard} style={{ justifySelf: 'start' }}>Add Card</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {activeDeck?.cards.map((card, i) => (
            <div key={card.id} className="pop-row" style={{
              display: 'grid', gap: 8, padding: 12,
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 30}ms`,
            }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <input type="text" value={card.front} onChange={e => updateCard(activeDeck!.id, card.id, 'front', e.target.value)} style={{ flex: 1, minWidth: 200, background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500 }} />
                <input type="text" value={card.back} onChange={e => updateCard(activeDeck!.id, card.id, 'back', e.target.value)} style={{ flex: 1, minWidth: 200, background: 'transparent', border: 'none', color: 'var(--text)' }} />
                <input type="text" value={card.tags.join(', ')} onChange={e => updateCard(activeDeck!.id, card.id, 'tags', e.target.value)} style={{ width: 150, background: 'transparent', border: 'none', color: 'var(--muted)' }} />
                <div className="row" style={{ gap: 4 }}>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>IVL: {card.interval}d</span>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Ease: {card.ease.toFixed(1)}</span>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Reviews: {card.reviews}</span>
                </div>
                <button className="btn" onClick={() => deleteCard(activeDeck!.id, card.id)} style={{ color: 'var(--danger)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Edit cards directly. Interval (IVL) in days. Ease factor affects next interval. Reviews = total reviews.
        </p>
      </div>
    )
  }

  if (viewMode === 'study') {
    const total = studyCards.length
    const done = total - Math.max(0, total - currentCardIndex - (showAnswer ? 1 : 0))
    const progress = total > 0 ? (done / total) * 100 : 0

    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn" onClick={() => setViewMode('list')}>← Back</button>
          <h3 style={{ margin: 0 }}>{activeDeck?.name}</h3>
          <div className="stat"><b>{done}/{total}</b></div>
        </div>

        <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>

        {currentCard ? (
          <div className="pop-row" style={{
            padding: 32, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 24, color: 'var(--text)' }}>
              {showAnswer ? currentCard.back : currentCard.front}
            </div>

            {!showAnswer ? (
              <button className="btn" onClick={() => setShowAnswer(true)} style={{ fontSize: '1.1rem', padding: '16px 32px', width: 'fit-content', margin: '0 auto' }}>
                Show Answer
              </button>
            ) : (
              <div className="row" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => gradeCard(0)} style={{ background: 'var(--danger)', minWidth: 80 }}>Again</button>
                <button className="btn" onClick={() => gradeCard(1)} style={{ background: '#f59e0b', minWidth: 80 }}>Hard</button>
                <button className="btn" onClick={() => gradeCard(2)} style={{ background: 'var(--ok)', minWidth: 80 }}>Good</button>
                <button className="btn" onClick={() => gradeCard(3)} style={{ background: '#3b82f6', minWidth: 80 }}>Easy</button>
              </div>
            )}

            {showAnswer && currentCard.tags.length > 0 && (
              <div className="muted" style={{ marginTop: 16, fontSize: '0.8rem' }}>
                Tags: {currentCard.tags.join(', ')}
              </div>
            )}
          </div>
        ) : (
          <div className="pop-row" style={{ padding: 32, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 16 }}>🎉</div>
            <h3 style={{ margin: '0 0 8px' }}>Session Complete!</h3>
            <p className="muted">All cards reviewed. Great job!</p>
            <button className="btn" onClick={() => setViewMode('list')} style={{ marginTop: 16 }}>Back to Decks</button>
          </div>
        )}
      </div>
    )
  }

  return null
}