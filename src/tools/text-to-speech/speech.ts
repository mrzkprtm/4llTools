/** Pure helpers for the Text to Speech tool (no browser globals, so they are testable). */

export interface VoiceLike {
  name: string
  lang: string
  localService?: boolean
  default?: boolean
}

export interface VoiceGroup<V extends VoiceLike> {
  /** Base language code, such as "id" or "en". */
  code: string
  label: string
  voices: V[]
}

/** Languages listed first, in this order. */
export const PREFERRED_LANGS = ['id', 'en']

export function baseLang(lang: string): string {
  return (lang || 'und').replace('_', '-').split('-')[0].toLowerCase()
}

export function languageName(code: string, displayLocale = 'en'): string {
  try {
    const dn = new Intl.DisplayNames([displayLocale], { type: 'language' })
    const name = dn.of(code)
    if (name && name !== code) return name
  } catch {
    /* Intl.DisplayNames missing or code invalid */
  }
  return code.toUpperCase()
}

/**
 * Groups voices by base language. Preferred languages come first, then the
 * rest alphabetically by label. Inside a group, voices are sorted by locale then name.
 */
export function groupVoices<V extends VoiceLike>(voices: readonly V[], preferred: readonly string[] = PREFERRED_LANGS): VoiceGroup<V>[] {
  const map = new Map<string, V[]>()
  for (const v of voices) {
    const code = baseLang(v.lang)
    const list = map.get(code) ?? []
    list.push(v)
    map.set(code, list)
  }
  const groups = [...map.entries()].map(([code, list]) => ({
    code,
    label: languageName(code),
    voices: [...list].sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name)),
  }))
  const rank = (code: string) => {
    const i = preferred.indexOf(code)
    return i === -1 ? preferred.length : i
  }
  return groups.sort((a, b) => rank(a.code) - rank(b.code) || a.label.localeCompare(b.label))
}

/** Picks a sensible starting voice: the first voice of the first preferred language, then the browser default. */
export function pickDefaultVoice<V extends VoiceLike>(voices: readonly V[], preferred: readonly string[] = PREFERRED_LANGS): V | undefined {
  for (const code of preferred) {
    const match = voices.filter((v) => baseLang(v.lang) === code)
    if (match.length) return match.find((v) => v.localService) ?? match[0]
  }
  return voices.find((v) => v.default) ?? voices[0]
}

export interface Chunk {
  text: string
  /** Offset of this chunk in the original text. */
  start: number
}

/**
 * Splits text into chunks of at most `max` characters at sentence ends (or
 * spaces when a sentence is too long). Browsers such as Chrome stop long
 * utterances after roughly 15 seconds, so speaking short chunks in a queue
 * is more reliable. Offsets let boundary events map back to the full text.
 */
export function splitForSpeech(text: string, max = 220): Chunk[] {
  const chunks: Chunk[] = []
  const re = /[^.!?。！？\n]+[.!?。！？]*["'’”)\]]*\s*|\n+/g
  let m: RegExpExecArray | null
  let buf = ''
  let bufStart = 0
  const flush = () => {
    if (buf.trim()) chunks.push({ text: buf, start: bufStart })
    buf = ''
  }
  while ((m = re.exec(text))) {
    const piece = m[0]
    const at = m.index
    if (piece.length > max) {
      flush()
      // Hard-split a very long sentence at spaces.
      let i = 0
      while (i < piece.length) {
        let end = Math.min(piece.length, i + max)
        if (end < piece.length) {
          const sp = piece.lastIndexOf(' ', end)
          if (sp > i) end = sp + 1
        }
        const part = piece.slice(i, end)
        if (part.trim()) chunks.push({ text: part, start: at + i })
        i = end
      }
      bufStart = at + piece.length
      continue
    }
    if (buf && buf.length + piece.length > max) flush()
    if (!buf) bufStart = at
    buf += piece
  }
  flush()
  return chunks
}

/** Finds the word that starts at (or contains) `index`, returned as [start, end). */
export function wordAt(text: string, index: number): [number, number] {
  if (index < 0 || index >= text.length) return [index, index]
  let s = index
  let e = index
  const isWord = (ch: string) => !/\s/.test(ch)
  while (s > 0 && isWord(text[s - 1])) s--
  while (e < text.length && isWord(text[e])) e++
  return [s, e]
}
