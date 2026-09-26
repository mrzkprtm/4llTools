export type Lang = 'en' | 'id'

const EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
const ID = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']

export function numberEn(n: number): string {
  if (n <= 20) return EN[n]
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty'][Math.floor(n / 10)]
  return n % 10 ? `${tens}-${EN[n % 10]}` : tens
}

export function numberId(n: number): string {
  if (n < 12) return ID[n]
  if (n < 20) return `${ID[n - 10]} belas`
  const tens = `${ID[Math.floor(n / 10)]} puluh`
  return n % 10 ? `${tens} ${ID[n % 10]}` : tens
}

const h12 = (h: number) => h % 12 || 12

/**
 * The time in words, the way people say it aloud.
 * English: "quarter past three", "twenty-five to four", "seven minutes past three".
 * Indonesian: "jam tiga lewat seperempat", "jam setengah empat" (3:30 is "half to four"),
 * "jam empat kurang seperempat", "jam tiga lewat sepuluh menit".
 */
export function timeToWords(hour: number, minute: number, lang: Lang): string {
  const h = h12(hour)
  const next = h12(hour + 1)
  const m = ((minute % 60) + 60) % 60
  if (lang === 'en') {
    const H = numberEn(h)
    const N = numberEn(next)
    const mins = (k: number) => (k % 5 ? `${numberEn(k)} minute${k === 1 ? '' : 's'}` : numberEn(k))
    if (m === 0) return `${H} o'clock`
    if (m === 15) return `quarter past ${H}`
    if (m === 30) return `half past ${H}`
    if (m === 45) return `quarter to ${N}`
    return m < 30 ? `${mins(m)} past ${H}` : `${mins(60 - m)} to ${N}`
  }
  const H = numberId(h)
  const N = numberId(next)
  if (m === 0) return `jam ${H} tepat`
  if (m === 15) return `jam ${H} lewat seperempat`
  if (m === 30) return `jam setengah ${N}`
  if (m === 45) return `jam ${N} kurang seperempat`
  return m < 30 ? `jam ${H} lewat ${numberId(m)} menit` : `jam ${N} kurang ${numberId(60 - m)} menit`
}

/** Part of the day for a 24-hour clock hour. */
export function dayPart(hour: number, lang: Lang): string {
  const h = ((hour % 24) + 24) % 24
  if (lang === 'en') return h < 5 ? 'at night' : h < 12 ? 'in the morning' : h < 17 ? 'in the afternoon' : h < 21 ? 'in the evening' : 'at night'
  return h < 4 ? 'dini hari' : h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam'
}

/** "3:05 PM" or "15:05". */
export function digital(total: number, h24: boolean): string {
  const t = ((total % 1440) + 1440) % 1440
  const h = Math.floor(t / 60)
  const m = String(t % 60).padStart(2, '0')
  return h24 ? `${String(h).padStart(2, '0')}:${m}` : `${h12(h)}:${m} ${h < 12 ? 'AM' : 'PM'}`
}

/** Shortest signed change from a to b on a circle of size `size`. */
export function wrapDelta(a: number, b: number, size: number): number {
  let d = (((b - a) % size) + size) % size
  if (d > size / 2) d -= size
  return d
}

/**
 * Dragging the minute hand to `angle` degrees (0 = 12 o'clock). Returns the new
 * unbounded total minutes: crossing 12 moves the hour forward or back.
 */
export function dragMinute(total: number, angle: number): number {
  const minute = Math.round(angle / 6) % 60
  return total + wrapDelta(((total % 60) + 60) % 60, minute, 60)
}

/** Dragging the hour hand to `angle` degrees. The minute hand follows. */
export function dragHour(total: number, angle: number): number {
  const target = Math.round((angle / 360) * 720) % 720
  return total + wrapDelta(((total % 720) + 720) % 720, target, 720)
}

export type Level = 'hour' | 'half' | 'quarter' | 'five' | 'minute'
const STEP: Record<Level, number> = { hour: 60, half: 30, quarter: 15, five: 5, minute: 1 }

/** A random time of day (in minutes since midnight) rounded to the level's step. */
export function randomTime(level: Level, random: () => number = Math.random): number {
  const step = STEP[level]
  return Math.floor(random() * (1440 / step)) * step
}

/** Up to `count` different times near `answer` (same 12-hour face), for multiple choice. */
export function nearbyTimes(answer: number, level: Level, count: number, random: () => number = Math.random): number[] {
  const step = STEP[level]
  const out = new Set<number>([answer])
  const tries = [step, -step, 60, -60, 2 * step, 180, -120, 300, 3 * step]
  for (const d of tries.sort(() => random() - 0.5)) {
    if (out.size >= count) break
    out.add((((answer + d) % 1440) + 1440) % 1440)
  }
  return [...out].sort(() => random() - 0.5)
}
