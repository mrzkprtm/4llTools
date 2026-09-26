/** Due date and gestational age. Dates are 'YYYY-MM-DD' handled as UTC day numbers. */

const DAY = 86400000
export const dayNum = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / DAY)
}
export const isoOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)

export type Basis = 'lmp' | 'conception' | 'ivf'

export interface Input {
  basis: Basis
  /** LMP (HPHT), conception or embryo transfer date. */
  date: string
  /** Average cycle length in days (LMP only). */
  cycle?: number
  /** Embryo age at transfer in days, 3 or 5 (IVF only). */
  embryoDays?: number
}

/** Day number of the "LMP-equivalent" start of pregnancy that the dating is based on. */
export function startDay(input: Input): number {
  const d = dayNum(input.date)
  if (input.basis === 'lmp') return d + ((input.cycle ?? 28) - 28)
  if (input.basis === 'conception') return d - 14
  return d - 14 - (input.embryoDays ?? 5)
}

/** Estimated due date (HPL): Naegele's rule, LMP + 280 days, shifted for cycles other than 28 days. */
export function dueDate(input: Input): string {
  return isoOf(startDay(input) + 280)
}

export interface Progress {
  gaDays: number
  weeks: number
  days: number
  trimester: 1 | 2 | 3
  daysLeft: number
  fraction: number
  conception: string
}

export function progress(input: Input, today: string): Progress {
  const s = startDay(input)
  const gaDays = dayNum(today) - s
  const weeks = Math.floor(gaDays / 7)
  return {
    gaDays,
    weeks,
    days: ((gaDays % 7) + 7) % 7,
    trimester: weeks < 14 ? 1 : weeks < 28 ? 2 : 3,
    daysLeft: s + 280 - dayNum(today),
    fraction: Math.max(0, Math.min(1, gaDays / 280)),
    conception: isoOf(s + 14),
  }
}

/** The date a given gestational week starts. */
export function weekStart(input: Input, week: number): string {
  return isoOf(startDay(input) + week * 7)
}

export interface Size {
  week: number
  fruit: string
  id: string
  emoji: string
  /** Approximate length in cm (crown–rump to week 19, crown–heel from week 20). */
  cm: number
  /** Approximate weight in grams. */
  g: number
  note?: string
}

type Row = [number, string, string, string, number, number, string?]
const ROWS: Row[] = [
  [4, 'Poppy seed', 'biji selasih', '•', 0.1, 0, 'Implantation; a pregnancy test may turn positive.'],
  [5, 'Sesame seed', 'biji wijen', '•', 0.2, 0, 'The heart starts to form.'],
  [6, 'Lentil', 'kacang hijau', '🫘', 0.6, 0, 'A heartbeat may be seen on ultrasound.'],
  [7, 'Blueberry', 'blueberry', '🫐', 1.3, 1],
  [8, 'Raspberry', 'raspberry', '🍇', 1.6, 1, 'Fingers and toes begin.'],
  [9, 'Cherry', 'ceri', '🍒', 2.3, 2],
  [10, 'Strawberry', 'stroberi', '🍓', 3.1, 4, 'Now called a fetus.'],
  [11, 'Lime', 'jeruk nipis', '🍋', 4.1, 7],
  [12, 'Plum', 'plum', '🍑', 5.4, 14, 'Reflexes start; the end of the first trimester is near.'],
  [13, 'Lemon', 'lemon', '🍋', 7.4, 23],
  [14, 'Peach', 'persik', '🍑', 8.7, 43, 'Second trimester begins.'],
  [15, 'Apple', 'apel', '🍎', 10.1, 70],
  [16, 'Avocado', 'alpukat', '🥑', 11.6, 100],
  [17, 'Pear', 'pir', '🍐', 13, 140],
  [18, 'Bell pepper', 'paprika', '🫑', 14.2, 190, 'Many parents feel the first kicks around now.'],
  [19, 'Mango', 'mangga', '🥭', 15.3, 240],
  [20, 'Banana', 'pisang', '🍌', 25.6, 300, 'Halfway there.'],
  [21, 'Carrot', 'wortel', '🥕', 26.7, 360],
  [22, 'Corn cob', 'jagung', '🌽', 27.8, 430],
  [23, 'Grapefruit', 'jeruk bali', '🍊', 28.9, 501],
  [24, 'Papaya (small)', 'pepaya kecil', '🥭', 30, 600, 'Often considered the start of viability with intensive care.'],
  [25, 'Cauliflower', 'kembang kol', '🥦', 34.6, 660],
  [26, 'Lettuce', 'selada', '🥬', 35.6, 760, 'Eyes begin to open.'],
  [27, 'Eggplant', 'terong', '🍆', 36.6, 875],
  [28, 'Eggplant (large)', 'terong besar', '🍆', 37.6, 1005, 'Third trimester begins.'],
  [29, 'Butternut squash', 'labu', '🎃', 38.6, 1153],
  [30, 'Cabbage', 'kubis', '🥬', 39.9, 1319],
  [31, 'Coconut', 'kelapa', '🥥', 41.1, 1502],
  [32, 'Jicama', 'bengkuang', '🥔', 42.4, 1702],
  [33, 'Pineapple', 'nanas', '🍍', 43.7, 1918],
  [34, 'Cantaloupe', 'melon', '🍈', 45, 2146],
  [35, 'Honeydew melon', 'melon madu', '🍈', 46.2, 2383],
  [36, 'Papaya', 'pepaya', '🥭', 47.4, 2622],
  [37, 'Winter melon', 'beligu', '🍈', 48.6, 2859, 'Early term from 37 weeks.'],
  [38, 'Pumpkin', 'labu kuning', '🎃', 49.8, 3083],
  [39, 'Small watermelon', 'semangka kecil', '🍉', 50.7, 3288, 'Full term from 39 weeks.'],
  [40, 'Watermelon', 'semangka', '🍉', 51.2, 3462, 'Due date. Only a few babies arrive exactly today.'],
]

export const SIZES: Size[] = ROWS.map(([week, fruit, id, emoji, cm, g, note]) => ({ week, fruit, id, emoji, cm, g, note }))

export function sizeFor(week: number): Size {
  return SIZES[Math.max(0, Math.min(SIZES.length - 1, week - 4))]
}

export interface Checkup {
  from: number
  to: number
  title: string
  detail: string
}

/** Typical antenatal care in Indonesia (Buku KIA: at least 6 visits). General guidance only. */
export const CHECKUPS: Checkup[] = [
  { from: 4, to: 12, title: 'First antenatal visit (K1)', detail: 'Confirm the pregnancy, get the Buku KIA, blood pressure, weight, and blood tests (Hb, blood type, HIV, syphilis, hepatitis B).' },
  { from: 6, to: 12, title: 'First-trimester ultrasound (USG)', detail: 'Checks the heartbeat, number of babies and dates the pregnancy.' },
  { from: 4, to: 40, title: 'Tetanus (Td) immunization', detail: 'Given according to your immunization status; ask your midwife or doctor.' },
  { from: 11, to: 14, title: 'Optional nuchal scan', detail: 'Some clinics offer screening for chromosomal conditions.' },
  { from: 14, to: 27, title: 'Second-trimester visit', detail: 'Growth, blood pressure, iron and folic acid supplements.' },
  { from: 18, to: 22, title: 'Anomaly ultrasound', detail: 'A detailed scan of the baby’s organs; the sex may be visible.' },
  { from: 24, to: 28, title: 'Blood sugar screening', detail: 'Tests for gestational diabetes.' },
  { from: 28, to: 40, title: 'Third-trimester visits (3×)', detail: 'Baby’s position, movements, blood pressure; plan where to give birth.' },
  { from: 32, to: 36, title: 'Third-trimester ultrasound', detail: 'Checks growth, position and the placenta.' },
  { from: 36, to: 40, title: 'Birth preparation', detail: 'Pack a bag, arrange transport, and keep your BPJS card and Buku KIA ready.' },
]
