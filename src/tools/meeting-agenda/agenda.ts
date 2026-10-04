/** Agenda maths and Markdown for the Meeting Agenda Maker. Pure functions only. */

export interface AgendaItem {
  id: string
  title: string
  /** Length in minutes. */
  minutes: number
  owner: string
}

export interface SlottedItem extends AgendaItem {
  /** Minutes since midnight. */
  start: number
  end: number
}

const saneMinutes = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0)

/** Total planned minutes, ignoring blanks and nonsense. */
export function totalMinutes(items: { minutes: number }[]): number {
  return (items ?? []).reduce((sum, it) => sum + saneMinutes(it?.minutes), 0)
}

/** Start and end time (minutes since midnight) for each item in order. */
export function timeSlots(startMinutes: number, items: { minutes: number }[]): { start: number; end: number }[] {
  let cursor = Number.isFinite(startMinutes) ? Math.round(startMinutes) : 0
  return (items ?? []).map((it) => {
    const start = cursor
    cursor += saneMinutes(it?.minutes)
    return { start, end: cursor }
  })
}

/** 12-hour clock label, wrapping around midnight and handling negative input. */
export function formatClock(minutes: number): string {
  const raw = Number.isFinite(minutes) ? Math.round(minutes) : 0
  const day = ((raw % 1440) + 1440) % 1440
  const hours = Math.floor(day / 60)
  const mins = day % 60
  const h12 = hours % 12 === 0 ? 12 : hours % 12
  return `${h12}:${String(mins).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
}

/** "09:30" or "9:30 pm" to minutes since midnight; null when it cannot be read. */
export function parseClock(text: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?\s*$/i.exec(String(text ?? ''))
  if (!m) return null
  let hours = Number(m[1])
  const mins = Number(m[2])
  if (mins > 59) return null
  const suffix = m[3]?.toLowerCase()
  if (suffix) {
    if (hours < 1 || hours > 12) return null
    if (suffix === 'pm' && hours !== 12) hours += 12
    if (suffix === 'am' && hours === 12) hours = 0
    return hours * 60 + mins
  }
  if (hours > 23) return null
  return hours * 60 + mins
}

/** "1 h 15 min" style total for the summary line. */
export function totalLabel(minutes: number): string {
  const total = saneMinutes(minutes)
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (!hours) return `${mins} min`
  return mins ? `${hours} h ${mins} min` : `${hours} h`
}

/** Moves an item in the list; out-of-range moves return the list unchanged. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Slotted items with start and end times attached, ready to print. */
export function schedule(items: AgendaItem[], startMinutes: number): SlottedItem[] {
  const slots = timeSlots(startMinutes, items)
  return items.map((it, i) => ({ ...it, start: slots[i].start, end: slots[i].end }))
}

/** Markdown checklist of the timed agenda, ready to paste into notes or a ticket. */
export function toMarkdown(items: SlottedItem[], title = 'Meeting agenda'): string {
  const head = `# ${String(title ?? '').trim() || 'Meeting agenda'}`
  const lines = (items ?? []).map((it) => {
    const owner = String(it.owner ?? '').trim()
    const minutes = Math.max(0, Math.round(Number.isFinite(it.minutes) ? it.minutes : 0))
    const name = String(it.title ?? '').trim() || 'Untitled item'
    return `- **${formatClock(it.start)} – ${formatClock(it.end)}** ${name} (${minutes} min)${owner ? ` — ${owner}` : ''}`
  })
  const total = `_Total: ${totalMinutes(items)} minutes_`
  return `${head}\n\n${lines.length ? `${lines.join('\n')}\n\n` : ''}${total}\n`
}

export const exampleItems: AgendaItem[] = [
  { id: 'a1', title: 'Welcome and context', minutes: 5, owner: 'Ana' },
  { id: 'a2', title: 'Progress since last week', minutes: 10, owner: 'Budi' },
  { id: 'a3', title: 'Blockers and decisions', minutes: 15, owner: 'Everyone' },
  { id: 'a4', title: 'Next steps', minutes: 5, owner: 'Ana' },
]
