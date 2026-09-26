import { useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import { newCard, parseCardsCSV, toCSV, type Card, type Deck } from './logic'

/** Add, remove, import and export the cards of one deck. */
export default function Manage({ deck, onCards }: { deck: Deck; onCards: (cards: Card[]) => void }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [csv, setCsv] = useState('')
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const frontRef = useRef<HTMLInputElement>(null)

  const addOne = () => {
    if (!front.trim() || !back.trim()) return
    onCards([...deck.cards, newCard(front.trim(), back.trim())])
    setFront('')
    setBack('')
    frontRef.current?.focus()
  }

  const importText = (text: string) => {
    const pairs = parseCardsCSV(text)
    if (!pairs.length) return setMsg('No cards found. Use one card per line: front,back')
    const seen = new Set(deck.cards.map((c) => `${c.front}\u0000${c.back}`))
    const fresh = pairs.filter(([f, b]) => !seen.has(`${f}\u0000${b}`)).map(([f, b]) => newCard(f, b))
    onCards([...deck.cards, ...fresh])
    setMsg(`Imported ${fresh.length} card${fresh.length === 1 ? '' : 's'}${fresh.length < pairs.length ? ` (${pairs.length - fresh.length} duplicates skipped)` : ''}.`)
    setCsv('')
  }

  const exportFile = () => {
    const blob = new Blob([toCSV(deck.cards)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'deck'}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="fc-manage">
      <form className="fc-add" onSubmit={(e) => { e.preventDefault(); addOne() }}>
        <input ref={frontRef} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front (question)" aria-label="Front" />
        <input value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back (answer)" aria-label="Back" />
        <button type="submit" className="btn primary btn-icon" disabled={!front.trim() || !back.trim()}><Icon name="plus" size={18} />Add</button>
      </form>
      <ul className="fc-list">
        {deck.cards.map((c) => (
          <li key={c.id}>
            <span className="fc-box-chip" data-box={c.box}>{c.box}</span>
            <span className="fc-f">{c.front}</span>
            <span className="fc-b">{c.back}</span>
            <button type="button" className="btn fc-del" aria-label={`Delete ${c.front}`} onClick={() => onCards(deck.cards.filter((x) => x.id !== c.id))}>
              <Icon name="delete-bin" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <details className="fc-csv">
        <summary>Import or export CSV</summary>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} placeholder={'front,back\nhello,halo\n"thank you","terima kasih"'} aria-label="CSV to import" />
        <div className="row">
          <button type="button" className="btn primary" disabled={!csv.trim()} onClick={() => importText(csv)}>Import pasted text</button>
          <button type="button" className="btn btn-icon" onClick={() => file.current?.click()}><Icon name="arrow-up" size={18} />Open .csv file</button>
          <button type="button" className="btn btn-icon" onClick={exportFile} disabled={!deck.cards.length}><Icon name="arrow-down" size={18} />Download .csv</button>
          <CopyButton text={toCSV(deck.cards)} />
        </div>
        <input
          ref={file}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) importText(await f.text())
            e.target.value = ''
          }}
        />
        {msg && <p className="muted pop" key={msg}>{msg}</p>}
      </details>
    </div>
  )
}
