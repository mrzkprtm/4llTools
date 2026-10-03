/** Parses "1:23", "1:02:03", "90" or "1h 2m" into total seconds. Null when unparseable. */
export function parseStamp(text: string): number | null {
  const s = text.trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  const clock = s.match(/^(?:(\d+):)?([0-5]?\d):([0-5]\d)$/)
  if (clock) {
    const h = clock[1] ? parseInt(clock[1], 10) : 0
    return h * 3600 + parseInt(clock[2], 10) * 60 + parseInt(clock[3], 10)
  }
  const units = s.match(/\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m(?!s)|seconds?|secs?|s)\b/gi)
  if (units) {
    let total = 0
    for (const u of units) {
      const n = parseFloat(u)
      if (/h/i.test(u)) total += n * 3600
      else if (/m(?!s)/i.test(u)) total += n * 60
      else total += n
    }
    return Math.round(total)
  }
  return null
}

export interface Chapter {
  time: number
  label: string
}

/** One chapter per line: "0:00 Intro", "1:23:45 Finale" or plain seconds followed by a title. */
export function parseChapters(text: string): Chapter[] {
  const out: Chapter[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^(\d+(?::[0-5]?\d){0,2})\s+(.+)$/)
    if (!m) continue
    const t = parseStamp(m[1])
    if (t !== null) out.push({ time: t, label: m[2].trim() })
  }
  return out.sort((a, b) => a.time - b.time)
}

export const stampLink = (id: string, t: number) => `https://youtu.be/${id}?t=${t}`

/** 65 → "1:05", 3723 → "1:02:03". */
export function fmtStamp(t: number): string {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** YouTube description format: "0:00 Intro" lines. */
export function toYoutubeText(chapters: Chapter[]): string {
  return chapters.map((c) => `${fmtStamp(c.time)} ${c.label}`).join('\n')
}

/** Markdown list with clickable links. */
export function toMarkdown(id: string, chapters: Chapter[]): string {
  return chapters.map((c) => `- [${fmtStamp(c.time)} ${c.label}](${stampLink(id, c.time)})`).join('\n')
}
