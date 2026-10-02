/** Pure helpers for the Speech to Text tool. */

export const LANGUAGES: [code: string, label: string][] = [
  ['id-ID', 'Bahasa Indonesia'],
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['ms-MY', 'Bahasa Melayu'],
  ['jv-ID', 'Basa Jawa'],
  ['su-ID', 'Basa Sunda'],
  ['es-ES', 'Español'],
  ['fr-FR', 'Français'],
  ['de-DE', 'Deutsch'],
  ['pt-BR', 'Português (Brasil)'],
  ['it-IT', 'Italiano'],
  ['nl-NL', 'Nederlands'],
  ['ar-SA', 'العربية'],
  ['hi-IN', 'हिन्दी'],
  ['ja-JP', '日本語'],
  ['ko-KR', '한국어'],
  ['zh-CN', '中文 (普通话)'],
  ['th-TH', 'ไทย'],
  ['vi-VN', 'Tiếng Việt'],
  ['tr-TR', 'Türkçe'],
  ['ru-RU', 'Русский'],
]

/** Spoken punctuation commands, longest phrases first so "new paragraph" wins over "new". */
const COMMANDS: [phrase: string, output: string][] = [
  ['new paragraph', '\n\n'],
  ['paragraf baru', '\n\n'],
  ['new line', '\n'],
  ['baris baru', '\n'],
  ['question mark', '?'],
  ['tanda tanya', '?'],
  ['exclamation mark', '!'],
  ['exclamation point', '!'],
  ['tanda seru', '!'],
  ['full stop', '.'],
  ['titik dua', ':'],
  ['titik koma', ';'],
  ['semicolon', ';'],
  ['colon', ':'],
  ['period', '.'],
  ['titik', '.'],
  ['comma', ','],
  ['koma', ','],
]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const COMMAND_RE = new RegExp(`(^|\\s)(${COMMANDS.map(([p]) => escape(p).replace(/ /g, '\\s+')).join('|')})(?=\\s|$|[.,!?])`, 'gi')

/** Turns spoken punctuation words ("comma", "titik", "new line") into symbols and tidies the spacing. */
export function applyCommands(text: string): string {
  const out = text.replace(COMMAND_RE, (_m, lead: string, phrase: string) => {
    const key = phrase.toLowerCase().replace(/\s+/g, ' ')
    const sym = COMMANDS.find(([p]) => p === key)?.[1] ?? phrase
    return sym.startsWith('\n') ? sym : `${lead}${sym}`
  })
  return tidy(out)
}

/** Removes spaces before punctuation, trims around line breaks and capitalises sentence starts. */
export function tidy(text: string): string {
  let t = text
    .replace(/[ \t]+([.,!?;:])/g, '$1')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
  t = t.replace(/(^|[.!?]\s+|\n)(\p{Ll})/gu, (_m, pre: string, ch: string) => pre + ch.toUpperCase())
  return t
}

/** Appends a new final phrase to the transcript with sensible spacing. */
export function appendPhrase(transcript: string, phrase: string): string {
  const p = phrase.trim()
  if (!p) return transcript
  if (!transcript) return p
  const sep = /[\s\n]$/.test(transcript) || /^[.,!?;:]/.test(p) ? '' : ' '
  return transcript + sep + p
}

/** Friendly messages for SpeechRecognition error codes. */
export function describeError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow the microphone for this site in your browser settings and try again.'
    case 'no-speech':
      return 'No speech was heard. Check that the right microphone is selected and speak a little closer.'
    case 'audio-capture':
      return 'No microphone was found, or another app is using it.'
    case 'network':
      return 'The speech service could not be reached. This browser needs an internet connection for recognition.'
    case 'language-not-supported':
      return 'This language is not supported by your browser’s speech service. Pick another one.'
    default:
      return `Recognition stopped (${code}).`
  }
}
