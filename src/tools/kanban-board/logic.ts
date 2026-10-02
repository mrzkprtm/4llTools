/** Pure board operations for the Kanban board. Every function returns a new board. */

export interface Card {
  id: string
  title: string
  /** Index into LABELS. */
  label: number
  /** Optional due date, YYYY-MM-DD. */
  due?: string
}

export interface Column {
  id: string
  title: string
  /** Work-in-progress limit; 0 means no limit. */
  wip: number
  cards: Card[]
}

export interface Board {
  columns: Column[]
}

export const LABELS = [
  { name: 'None', color: '#868e96' },
  { name: 'Feature', color: '#1c7ed6' },
  { name: 'Bug', color: '#e03131' },
  { name: 'Chore', color: '#2f9e44' },
  { name: 'Idea', color: '#ae3ec9' },
  { name: 'Urgent', color: '#f59f00' },
] as const

export function findCard(board: Board, id: string): { col: number; index: number } | null {
  for (let c = 0; c < board.columns.length; c++) {
    const i = board.columns[c].cards.findIndex((k) => k.id === id)
    if (i >= 0) return { col: c, index: i }
  }
  return null
}

/**
 * Moves a card to column `toCol` at position `index`, where `index` counts the
 * target column's cards with the moving card already taken out. Out-of-range
 * indexes are clamped; unknown ids or columns leave the board unchanged.
 */
export function moveCard(board: Board, id: string, toCol: string, index: number): Board {
  const at = findCard(board, id)
  const target = board.columns.findIndex((c) => c.id === toCol)
  if (!at || target < 0) return board
  const card = board.columns[at.col].cards[at.index]
  const columns = board.columns.map((c) => ({ ...c, cards: c.cards.filter((k) => k.id !== id) }))
  const list = columns[target].cards
  const i = Math.max(0, Math.min(list.length, Math.round(index)))
  list.splice(i, 0, card)
  return { columns }
}

export function addCard(board: Board, colId: string, card: Card): Board {
  return { columns: board.columns.map((c) => (c.id === colId ? { ...c, cards: [...c.cards, card] } : c)) }
}

export function updateCard(board: Board, id: string, patch: Partial<Omit<Card, 'id'>>): Board {
  return { columns: board.columns.map((c) => ({ ...c, cards: c.cards.map((k) => (k.id === id ? { ...k, ...patch } : k)) })) }
}

export function deleteCard(board: Board, id: string): Board {
  return { columns: board.columns.map((c) => ({ ...c, cards: c.cards.filter((k) => k.id !== id) })) }
}

export function overLimit(col: Column): boolean {
  return col.wip > 0 && col.cards.length > col.wip
}

/** Validates imported JSON and returns a clean board, or null if it is not a board. */
export function parseBoard(text: string): Board | null {
  try {
    const raw = JSON.parse(text) as { columns?: unknown }
    if (!raw || !Array.isArray(raw.columns)) return null
    const columns: Column[] = raw.columns.map((c: Partial<Column>, ci: number) => ({
      id: String(c.id ?? `col${ci}`),
      title: String(c.title ?? `Column ${ci + 1}`),
      wip: Math.max(0, Math.floor(Number(c.wip) || 0)),
      cards: (Array.isArray(c.cards) ? c.cards : []).map((k: Partial<Card>, ki: number) => ({
        id: String(k.id ?? `c${ci}-${ki}-${Date.now()}`),
        title: String(k.title ?? ''),
        label: Math.max(0, Math.min(LABELS.length - 1, Math.floor(Number(k.label) || 0))),
        ...(typeof k.due === 'string' && /^\d{4}-\d\d-\d\d$/.test(k.due) ? { due: k.due } : {}),
      })),
    }))
    return columns.length ? { columns } : null
  } catch {
    return null
  }
}
