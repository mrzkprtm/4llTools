export interface Card {
  id: string
  front: string
  back: string
  /** Leitner box 1–5. */
  box: number
  /** Time (ms) when the card is next due. 0 means new. */
  due: number
  reviews: number
  lapses: number
}

export interface Deck {
  id: string
  name: string
  cards: Card[]
}

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export const BOXES = 5
const MIN = 60_000
const DAY = 86_400_000
/** Review interval for each box (index 1–5): today, 1, 3, 7 and 14 days. */
export const BOX_DAYS = [0, 0, 1, 3, 7, 14]

export const intervalFor = (box: number) => BOX_DAYS[Math.min(BOXES, Math.max(1, box))] * DAY

/**
 * Leitner scheduling. Again sends the card back to box 1 (seen again this
 * session), Hard keeps it in its box with half the wait, Good moves it up one
 * box and Easy moves it up two.
 */
export function schedule(card: Card, grade: Grade, now: number): Card {
  const reviews = card.reviews + 1
  if (grade === 'again') return { ...card, box: 1, due: now + MIN, reviews, lapses: card.lapses + 1 }
  if (grade === 'hard') {
    const box = Math.max(1, card.box)
    return { ...card, box, due: now + Math.max(10 * MIN, intervalFor(box) / 2), reviews }
  }
  const box = Math.min(BOXES, Math.max(1, card.box) + (grade === 'easy' ? 2 : 1))
  return { ...card, box, due: now + intervalFor(box), reviews }
}

/** How long each grade would wait, in words, for the buttons. */
export function previewInterval(card: Card, grade: Grade, now: number): string {
  const ms = schedule(card, grade, now).due - now
  if (ms < 60 * MIN) return `${Math.round(ms / MIN)}m`
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`
  return `${Math.round(ms / DAY)}d`
}

/** Cards due at `now`, oldest due first, lower boxes first on ties. */
export const dueCards = (cards: readonly Card[], now: number) => cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due || a.box - b.box)

export const boxCounts = (cards: readonly Card[]) => {
  const out = Array(BOXES).fill(0) as number[]
  for (const c of cards) out[Math.min(BOXES, Math.max(1, c.box)) - 1]++
  return out
}

/** Splits CSV text into rows of fields. Handles quotes, doubled quotes and newlines inside quotes. */
export function parseCSVRows(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delim = delimiter ?? (firstLine.includes('\t') ? '\t' : !firstLine.includes(',') && firstLine.includes(';') ? ';' : ',')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Front/back pairs from CSV. Skips blank rows and a "front,back" header. */
export function parseCardsCSV(text: string): [string, string][] {
  const rows = parseCSVRows(text)
    .map((r) => [r[0]?.trim() ?? '', r[1]?.trim() ?? ''] as [string, string])
    .filter(([f, b]) => f || b)
  if (rows.length && rows[0][0].toLowerCase() === 'front' && rows[0][1].toLowerCase() === 'back') rows.shift()
  return rows.filter(([f, b]) => f && b)
}

const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

export const toCSV = (cards: readonly Pick<Card, 'front' | 'back'>[]) => ['front,back', ...cards.map((c) => `${esc(c.front)},${esc(c.back)}`)].join('\n')

let seq = 0
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const newCard = (front: string, back: string): Card => ({ id: newId(), front, back, box: 1, due: 0, reviews: 0, lapses: 0 })
