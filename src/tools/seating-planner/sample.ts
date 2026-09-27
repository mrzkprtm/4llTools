import type { Guest, Rule, Seating, Table } from './logic'

/** Parses "Name, Group" lines (tabs and semicolons work too). */
export function parseGuests(text: string): Guest[] {
  const seen = new Set<string>()
  const out: Guest[] = []
  for (const line of text.split(/\r?\n/)) {
    const [name, group = ''] = line.split(/\s*[,;\t]\s*/).map((s) => s.trim())
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push({ id: out.length + 1, name, group })
  }
  return out
}

const LIST = `Rina Putri, Bride family
Ibu Sulastri, Bride family
Pak Hadi, Bride family
Dimas Putra, Bride family
Tante Sri, Bride family
Om Budi, Groom family
Ibu Wati, Groom family
Pak Joko, Groom family
Sinta Dewi, Groom family
Kevin Tan, Groom family
Andi Saputra, Friends
Nadia Rahma, Friends
Fikri Hasan, Friends
Maya Sari, Friends
Yudi Prasetyo, Friends
Lia Kurnia, Friends
Pak Arief, Colleagues
Bu Ratna, Colleagues
Sandra Lim, Colleagues
Bayu Aji, Colleagues
Citra Ayu, Colleagues
Gilang R., Colleagues`

const guests = parseGuests(LIST)
const id = (n: string) => guests.find((g) => g.name === n)!.id

const tables: Table[] = [
  { id: 1, name: 'Family A', shape: 'round', seats: 6, x: 150, y: 150 },
  { id: 2, name: 'Family B', shape: 'round', seats: 6, x: 150, y: 410 },
  { id: 3, name: 'Friends', shape: 'rect', seats: 8, x: 470, y: 130 },
  { id: 4, name: 'Office', shape: 'round', seats: 7, x: 460, y: 400 },
  { id: 5, name: 'Mixed', shape: 'round', seats: 6, x: 760, y: 280 },
]

const rules: Rule[] = [
  { a: id('Rina Putri'), b: id('Andi Saputra'), kind: 'together' },
  { a: id('Om Budi'), b: id('Tante Sri'), kind: 'apart' },
  { a: id('Kevin Tan'), b: id('Sandra Lim'), kind: 'together' },
]

const seating: Seating = { '1:0': id('Ibu Sulastri'), '1:1': id('Pak Hadi'), '1:2': id('Tante Sri'), '1:3': id('Om Budi'), '3:0': id('Nadia Rahma'), '3:1': id('Fikri Hasan') }

export const SAMPLE = { tables, guests, rules, seating }
