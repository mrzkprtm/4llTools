/** Seeded fake data generation for the Mock Data Generator. */

export type FieldType =
  | 'id'
  | 'uuid'
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'username'
  | 'company'
  | 'jobTitle'
  | 'street'
  | 'city'
  | 'country'
  | 'postalCode'
  | 'latitude'
  | 'longitude'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'url'
  | 'ipv4'
  | 'color'
  | 'sentence'
  | 'pick'
  | 'status'

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: 'id', label: 'ID (sequence)' },
  { type: 'uuid', label: 'UUID' },
  { type: 'firstName', label: 'First name' },
  { type: 'lastName', label: 'Last name' },
  { type: 'fullName', label: 'Full name' },
  { type: 'email', label: 'Email' },
  { type: 'phone', label: 'Phone' },
  { type: 'username', label: 'Username' },
  { type: 'company', label: 'Company' },
  { type: 'jobTitle', label: 'Job title' },
  { type: 'street', label: 'Street address' },
  { type: 'city', label: 'City' },
  { type: 'country', label: 'Country' },
  { type: 'postalCode', label: 'Postal code' },
  { type: 'latitude', label: 'Latitude' },
  { type: 'longitude', label: 'Longitude' },
  { type: 'integer', label: 'Integer (min–max)' },
  { type: 'decimal', label: 'Decimal (min–max)' },
  { type: 'boolean', label: 'Boolean' },
  { type: 'date', label: 'Date (range)' },
  { type: 'datetime', label: 'Datetime (ISO)' },
  { type: 'url', label: 'URL' },
  { type: 'ipv4', label: 'IPv4 address' },
  { type: 'color', label: 'Color hex' },
  { type: 'sentence', label: 'Lorem sentence' },
  { type: 'pick', label: 'Pick from list' },
  { type: 'status', label: 'Status enum' },
]

export interface Field {
  id: number
  name: string
  type: FieldType
  /** integer/decimal bounds */
  min?: number
  max?: number
  /** date range, YYYY-MM-DD */
  from?: string
  to?: string
  /** comma-separated list for "pick" */
  list?: string
}

export const FIRST_NAMES = [
  'Budi', 'Siti', 'Agus', 'Dewi', 'Rizky', 'Putri', 'Andi', 'Ayu', 'Fajar', 'Nur', 'Wahyu', 'Intan', 'Bayu', 'Rina', 'Dimas', 'Sari',
  'Eko', 'Lestari', 'Hendra', 'Maya', 'Yusuf', 'Fitri', 'Arif', 'Indah', 'Made', 'Ketut', 'Kadek', 'Nyoman',
  'James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Sophia', 'Lucas', 'Mia', 'Ethan', 'Chloe', 'Mateo', 'Lucia', 'Hiroshi', 'Yuki',
  'Wei', 'Mei', 'Arjun', 'Priya', 'Omar', 'Fatima', 'Lukas', 'Anna', 'Pierre', 'Camille', 'Diego', 'Sofia',
]
export const LAST_NAMES = [
  'Santoso', 'Wijaya', 'Saputra', 'Pratama', 'Hidayat', 'Kusuma', 'Siregar', 'Nasution', 'Lubis', 'Simanjuntak', 'Gunawan',
  'Setiawan', 'Rahman', 'Hakim', 'Wibowo', 'Susanto', 'Halim', 'Tanjung', 'Harahap', 'Purnomo', 'Utami', 'Permana',
  'Smith', 'Johnson', 'Brown', 'Garcia', 'Miller', 'Davis', 'Martin', 'Müller', 'Rossi', 'Dubois', 'Tanaka', 'Suzuki',
  'Kim', 'Park', 'Chen', 'Wang', 'Singh', 'Patel', 'Silva', 'Novak', "O'Brien", 'Nguyen', 'Khan', 'Andersen',
]
export const CITIES: [string, string, number, number][] = [
  // [city, country, lat, lng]
  ['Jakarta', 'Indonesia', -6.2, 106.82], ['Surabaya', 'Indonesia', -7.25, 112.75], ['Bandung', 'Indonesia', -6.91, 107.61],
  ['Medan', 'Indonesia', 3.59, 98.67], ['Yogyakarta', 'Indonesia', -7.8, 110.36], ['Semarang', 'Indonesia', -6.97, 110.42],
  ['Makassar', 'Indonesia', -5.15, 119.43], ['Denpasar', 'Indonesia', -8.65, 115.22], ['Palembang', 'Indonesia', -2.98, 104.76],
  ['Malang', 'Indonesia', -7.98, 112.63], ['Balikpapan', 'Indonesia', -1.27, 116.83], ['Manado', 'Indonesia', 1.47, 124.84],
  ['Singapore', 'Singapore', 1.35, 103.82], ['Kuala Lumpur', 'Malaysia', 3.14, 101.69], ['Bangkok', 'Thailand', 13.76, 100.5],
  ['Tokyo', 'Japan', 35.68, 139.69], ['Seoul', 'South Korea', 37.57, 126.98], ['Sydney', 'Australia', -33.87, 151.21],
  ['London', 'United Kingdom', 51.51, -0.13], ['Berlin', 'Germany', 52.52, 13.4], ['Paris', 'France', 48.86, 2.35],
  ['Amsterdam', 'Netherlands', 52.37, 4.9], ['New York', 'United States', 40.71, -74.01], ['San Francisco', 'United States', 37.77, -122.42],
  ['Toronto', 'Canada', 43.65, -79.38], ['São Paulo', 'Brazil', -23.55, -46.63], ['Mumbai', 'India', 19.08, 72.88], ['Dubai', 'United Arab Emirates', 25.2, 55.27],
]
const STREETS = [
  'Jl. Sudirman', 'Jl. Thamrin', 'Jl. Gatot Subroto', 'Jl. Diponegoro', 'Jl. Merdeka', 'Jl. Pemuda', 'Jl. Ahmad Yani', 'Jl. Gajah Mada',
  'Jl. Malioboro', 'Jl. Asia Afrika', 'Main Street', 'Oak Avenue', 'Maple Road', 'High Street', 'Park Lane', 'Sunset Boulevard', 'Church Road', 'Lake View Drive',
]
const COMPANY_A = ['Nusantara', 'Maju', 'Sinar', 'Global', 'Cahaya', 'Bintang', 'Garuda', 'Samudra', 'Blue', 'Bright', 'Pioneer', 'Summit', 'Nova', 'Apex', 'Delta', 'Harbor']
const COMPANY_B = ['Teknologi', 'Digital', 'Sejahtera', 'Solutions', 'Labs', 'Systems', 'Logistics', 'Media', 'Foods', 'Energy', 'Capital', 'Works']
const COMPANY_C = ['PT', 'CV', 'Inc.', 'Ltd.', 'Group', 'Tbk']
const JOBS = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer', 'Data Analyst', 'Product Manager', 'UI/UX Designer', 'DevOps Engineer',
  'QA Engineer', 'Marketing Manager', 'Sales Executive', 'Accountant', 'HR Specialist', 'Customer Support', 'Project Manager', 'CTO', 'Staf Administrasi',
]
const DOMAINS = ['gmail.com', 'yahoo.co.id', 'outlook.com', 'example.com', 'mail.id', 'proton.me']
const TLDS = ['com', 'co.id', 'id', 'io', 'net', 'org', 'dev']
const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat'.split(' ')
const STATUSES = ['active', 'inactive', 'pending', 'suspended', 'archived']

/** Turns any seed text into a 32-bit number (FNV-1a). */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: a small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Row = Record<string, string | number | boolean>

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export class Generator {
  private rnd: () => number
  constructor(seed: string) {
    this.rnd = mulberry32(hashSeed(seed))
  }
  float(): number {
    return this.rnd()
  }
  int(min: number, max: number): number {
    if (max < min) [min, max] = [max, min]
    return Math.floor(this.rnd() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min)
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rnd() * list.length)]
  }
  uuid(): string {
    const hex = Array.from({ length: 32 }, () => this.int(0, 15).toString(16))
    hex[12] = '4'
    hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
    const h = hex.join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  }

  /** Generates one row. Name-related fields in the same row stay consistent (email matches the name). */
  row(fields: Field[], index: number): Row {
    const first = this.pick(FIRST_NAMES)
    const last = this.pick(LAST_NAMES)
    const place = this.pick(CITIES)
    const out: Row = {}
    for (const f of fields) out[f.name] = this.value(f, index, { first, last, place })
    return out
  }

  private value(f: Field, index: number, ctx: { first: string; last: string; place: (typeof CITIES)[number] }): string | number | boolean {
    const { first, last, place } = ctx
    switch (f.type) {
      case 'id':
        return (f.min ?? 1) + index
      case 'uuid':
        return this.uuid()
      case 'firstName':
        return first
      case 'lastName':
        return last
      case 'fullName':
        return `${first} ${last}`
      case 'email': {
        const sep = this.pick(['.', '_', ''])
        const num = this.rnd() < 0.4 ? String(this.int(1, 99)) : ''
        return `${slugify(first)}${sep}${slugify(last)}${num}@${this.pick(DOMAINS)}`
      }
      case 'phone':
        return place[1] === 'Indonesia'
          ? `+62 8${this.int(11, 99)}-${this.int(1000, 9999)}-${this.int(1000, 9999)}`
          : `+1 ${this.int(201, 989)}-${this.int(200, 999)}-${this.int(1000, 9999)}`
      case 'username':
        return `${slugify(first)}${this.pick(['_', '.', ''])}${slugify(last).slice(0, 4)}${this.int(1, 999)}`
      case 'company': {
        const name = `${this.pick(COMPANY_A)} ${this.pick(COMPANY_B)}`
        const suffix = this.pick(COMPANY_C)
        return suffix === 'PT' || suffix === 'CV' ? `${suffix} ${name}` : `${name} ${suffix}`
      }
      case 'jobTitle':
        return this.pick(JOBS)
      case 'street': {
        const street = this.pick(STREETS)
        return street.startsWith('Jl.') ? `${street} No. ${this.int(1, 250)}` : `${this.int(1, 9999)} ${street}`
      }
      case 'city':
        return place[0]
      case 'country':
        return place[1]
      case 'postalCode':
        return String(this.int(10000, 99999))
      case 'latitude':
        return Number((place[2] + (this.rnd() - 0.5) * 0.2).toFixed(6))
      case 'longitude':
        return Number((place[3] + (this.rnd() - 0.5) * 0.2).toFixed(6))
      case 'integer':
        return this.int(f.min ?? 0, f.max ?? 1000)
      case 'decimal': {
        const min = f.min ?? 0
        const max = f.max ?? 1000
        return Number((min + this.rnd() * (max - min)).toFixed(2))
      }
      case 'boolean':
        return this.rnd() < 0.5
      case 'date':
      case 'datetime': {
        const fromMs = Date.parse(f.from || '2020-01-01') || Date.UTC(2020, 0, 1)
        const toMs = Date.parse(f.to || '2026-12-31') || Date.UTC(2026, 11, 31)
        const lo = Math.min(fromMs, toMs)
        const hi = Math.max(fromMs, toMs) + (f.type === 'date' ? 0 : 86_399_000)
        const iso = new Date(lo + Math.floor(this.rnd() * (hi - lo + 1))).toISOString()
        return f.type === 'date' ? iso.slice(0, 10) : iso.replace(/\.\d{3}Z$/, 'Z')
      }
      case 'url':
        return `https://www.${slugify(this.pick(COMPANY_A))}${slugify(this.pick(COMPANY_B))}.${this.pick(TLDS)}`
      case 'ipv4':
        return `${this.int(1, 223)}.${this.int(0, 255)}.${this.int(0, 255)}.${this.int(1, 254)}`
      case 'color':
        return `#${this.int(0, 0xffffff).toString(16).padStart(6, '0')}`
      case 'sentence': {
        const words = Array.from({ length: this.int(6, 12) }, () => this.pick(LOREM))
        const s = words.join(' ')
        return `${s[0].toUpperCase()}${s.slice(1)}.`
      }
      case 'pick': {
        const items = (f.list ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        return items.length ? this.pick(items) : ''
      }
      case 'status':
        return this.pick(STATUSES)
    }
  }
}

export function generateRows(fields: Field[], count: number, seed: string): Row[] {
  const g = new Generator(seed)
  return Array.from({ length: count }, (_, i) => g.row(fields, i))
}

/** Generates rows in chunks, yielding to the browser between chunks so the page stays responsive. */
export async function generateRowsAsync(
  fields: Field[],
  count: number,
  seed: string,
  onProgress?: (done: number) => void,
  isCancelled?: () => boolean,
): Promise<Row[] | null> {
  const g = new Generator(seed)
  const rows: Row[] = []
  const chunk = 1000
  for (let i = 0; i < count; i++) {
    rows.push(g.row(fields, i))
    if ((i + 1) % chunk === 0 && i + 1 < count) {
      onProgress?.(i + 1)
      await new Promise((r) => setTimeout(r, 0))
      if (isCancelled?.()) return null
    }
  }
  onProgress?.(count)
  return rows
}

export function toJSON(rows: Row[]): string {
  return JSON.stringify(rows, null, 2)
}

export function csvCell(v: string | number | boolean): string {
  const s = String(v)
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(fields: Field[], rows: Row[]): string {
  const lines = [fields.map((f) => csvCell(f.name)).join(',')]
  for (const r of rows) lines.push(fields.map((f) => csvCell(r[f.name] ?? '')).join(','))
  return lines.join('\r\n') + '\r\n'
}

export type SqlDialect = 'standard' | 'mysql'

export function sqlIdent(name: string, dialect: SqlDialect = 'standard'): string {
  return dialect === 'mysql' ? `\`${name.replace(/`/g, '``')}\`` : `"${name.replace(/"/g, '""')}"`
}

export function sqlValue(v: string | number | boolean, dialect: SqlDialect = 'standard'): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  let s = v.replace(/'/g, "''")
  if (dialect === 'mysql') s = s.replace(/\\/g, '\\\\')
  return `'${s}'`
}

export function toSQL(table: string, fields: Field[], rows: Row[], batchSize = 500, dialect: SqlDialect = 'standard'): string {
  const cols = fields.map((f) => sqlIdent(f.name, dialect)).join(', ')
  const t = table
    .split('.')
    .map((p) => sqlIdent(p.trim() || 'mock_data', dialect))
    .join('.')
  const out: string[] = []
  for (let i = 0; i < rows.length; i += batchSize) {
    const values = rows
      .slice(i, i + batchSize)
      .map((r) => `  (${fields.map((f) => sqlValue(r[f.name] ?? '', dialect)).join(', ')})`)
      .join(',\n')
    out.push(`INSERT INTO ${t} (${cols}) VALUES\n${values};`)
  }
  return out.join('\n\n') + (out.length ? '\n' : '')
}
