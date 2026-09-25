/** Pure helpers for the Emoji Finder. */

export interface EmojiItem {
  emoji: string
  name: string
  slug: string
  group: string
  skin: boolean
  version: string
}

export interface RawGroup {
  name: string
  slug: string
  emojis: { emoji: string; name: string; slug: string; skin_tone_support: boolean; emoji_version: string }[]
}

export function flatten(groups: readonly RawGroup[]): EmojiItem[] {
  return groups.flatMap((g) =>
    g.emojis.map((e) => ({ emoji: e.emoji, name: e.name, slug: e.slug, group: g.name, skin: e.skin_tone_support, version: e.emoji_version })),
  )
}

/** Common Indonesian words mapped to English words that appear in emoji names. */
export const ID_SYNONYMS: Record<string, string[]> = {
  senyum: ['smiling', 'smile', 'grinning'],
  tersenyum: ['smiling', 'smile'],
  tertawa: ['joy', 'laughing', 'rolling', 'grinning'],
  ketawa: ['joy', 'laughing', 'rolling'],
  ngakak: ['rolling on the floor', 'joy'],
  hati: ['heart'],
  cinta: ['heart', 'love', 'kiss'],
  sayang: ['heart', 'hugging', 'kiss'],
  api: ['fire'],
  sedih: ['sad', 'crying', 'pensive', 'disappointed'],
  menangis: ['crying', 'sob'],
  nangis: ['crying'],
  marah: ['angry', 'rage', 'pouting'],
  takut: ['fearful', 'scream', 'anxious'],
  kaget: ['astonished', 'surprised', 'open mouth', 'exploding'],
  bingung: ['confused', 'thinking', 'face with raised eyebrow'],
  mikir: ['thinking'],
  malu: ['flushed', 'blush', 'shushing'],
  keren: ['sunglasses', 'cool'],
  tidur: ['sleeping', 'zzz'],
  ngantuk: ['sleepy', 'yawning'],
  sakit: ['sick', 'thermometer', 'nauseated', 'bandage'],
  cium: ['kiss'],
  peluk: ['hugging', 'people hugging'],
  jempol: ['thumbs up'],
  mantap: ['thumbs up', 'ok hand', 'hundred'],
  oke: ['ok hand', 'ok button', 'thumbs up'],
  tepuk: ['clapping'],
  doa: ['folded hands'],
  terima: ['folded hands'],
  kasih: ['folded hands', 'heart'],
  tangan: ['hand'],
  mata: ['eye'],
  kucing: ['cat'],
  anjing: ['dog'],
  burung: ['bird'],
  ikan: ['fish'],
  bunga: ['flower', 'blossom', 'rose', 'tulip'],
  pohon: ['tree'],
  makan: ['food', 'fork', 'plate'],
  makanan: ['food', 'rice', 'noodle', 'pizza'],
  minum: ['beverage', 'cup', 'glass'],
  kopi: ['coffee', 'hot beverage'],
  teh: ['teacup', 'tea'],
  nasi: ['rice'],
  mie: ['noodle', 'steaming bowl'],
  kue: ['cake', 'cookie'],
  buah: ['fruit', 'apple', 'banana', 'grapes'],
  bintang: ['star'],
  matahari: ['sun'],
  bulan: ['moon'],
  hujan: ['rain', 'umbrella'],
  awan: ['cloud'],
  petir: ['lightning', 'high voltage'],
  salju: ['snow'],
  uang: ['money', 'dollar', 'coin'],
  rumah: ['house', 'home'],
  mobil: ['car', 'automobile'],
  motor: ['motorcycle', 'motor scooter'],
  pesawat: ['airplane'],
  kapal: ['ship', 'boat'],
  bendera: ['flag'],
  indonesia: ['flag: indonesia'],
  pesta: ['party', 'confetti', 'balloon'],
  ulang: ['birthday'],
  tahun: ['birthday', 'calendar'],
  hadiah: ['gift', 'wrapped'],
  bola: ['ball', 'soccer'],
  musik: ['music', 'musical'],
  lagu: ['musical note', 'music'],
  buku: ['book'],
  sekolah: ['school', 'backpack'],
  kerja: ['office', 'briefcase', 'laptop'],
  komputer: ['computer', 'laptop'],
  telepon: ['telephone', 'mobile phone'],
  hp: ['mobile phone'],
  foto: ['camera'],
  bayi: ['baby'],
  anak: ['child', 'boy', 'girl'],
  laki: ['man', 'boy'],
  perempuan: ['woman', 'girl'],
  keluarga: ['family'],
  mati: ['skull', 'dead'],
  hantu: ['ghost'],
  benar: ['check mark'],
  salah: ['cross mark'],
  peringatan: ['warning'],
  jam: ['clock', 'watch'],
  kunci: ['key', 'locked'],
  lampu: ['light bulb'],
  selamat: ['party popper', 'clapping', 'trophy'],
  menang: ['trophy', 'medal'],
  panas: ['hot', 'fire'],
  dingin: ['cold', 'snowflake'],
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
}

/** Expands a query into the terms to look for, adding English words for known Indonesian ones. */
export function expandQuery(query: string): string[][] {
  const words = norm(query).split(/\s+/).filter(Boolean)
  return words.map((w) => [w, ...(ID_SYNONYMS[w] ?? [])])
}

/**
 * Scores emoji against a query. Every word in the query must match (as the
 * original word or one of its synonyms). Whole-word hits in the name score
 * highest, then prefix hits, then substrings in the name or slug.
 */
export function searchEmojis(items: readonly EmojiItem[], query: string, limit = 300): EmojiItem[] {
  const terms = expandQuery(query)
  if (!terms.length) return []
  const scored: { item: EmojiItem; score: number; i: number }[] = []
  items.forEach((item, i) => {
    const name = norm(item.name)
    const words = name.split(/[\s:_-]+/)
    let total = 0
    for (const alts of terms) {
      let best = 0
      for (const t of alts) {
        let s = 0
        if (name === t) s = 100
        else if (t.includes(' ') ? name.includes(t) : words.includes(t)) s = 60
        else if (words.some((w) => w.startsWith(t))) s = 35
        else if (name.includes(t) || item.slug.includes(t)) s = 15
        if (s && t !== alts[0]) s -= 5 // synonyms rank just below direct hits
        best = Math.max(best, s)
      }
      if (!best) return
      total += best
    }
    // Prefer shorter names (more specific) and the base ordering.
    scored.push({ item, score: total - name.length * 0.2, i })
  })
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((s) => s.item)
}

export const SKIN_TONES = [
  { id: '', label: 'Default', swatch: '✋' },
  { id: '\u{1F3FB}', label: 'Light', swatch: '✋🏻' },
  { id: '\u{1F3FC}', label: 'Medium-light', swatch: '✋🏼' },
  { id: '\u{1F3FD}', label: 'Medium', swatch: '✋🏽' },
  { id: '\u{1F3FE}', label: 'Medium-dark', swatch: '✋🏾' },
  { id: '\u{1F3FF}', label: 'Dark', swatch: '✋🏿' },
]

/**
 * Adds a skin-tone modifier after the first character of an emoji that
 * supports it, dropping a variation selector that would sit in between
 * (✌️ + 🏽 = ✌🏽). Works for single people and ZWJ sequences such as 🧑‍💻.
 */
export function withSkinTone(emoji: string, tone: string): string {
  if (!tone) return emoji
  const cps = Array.from(emoji)
  const rest = cps.slice(1)
  if (rest[0] === '️') rest.shift()
  return cps[0] + tone + rest.join('')
}

export function codepoints(emoji: string): string {
  return Array.from(emoji, (c) => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' ')
}

export function shortcode(slug: string): string {
  return `:${slug}:`
}

/** Moves an emoji to the front of the recent list, without duplicates, capped at `max`. */
export function pushRecent(list: readonly string[], emoji: string, max = 24): string[] {
  return [emoji, ...list.filter((e) => e !== emoji)].slice(0, max)
}
