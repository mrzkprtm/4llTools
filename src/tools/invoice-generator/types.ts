import type { DiscountType, Item } from './logic'

export interface Invoice {
  from: string
  to: string
  number: string
  date: string
  due: string
  currency: string
  items: Item[]
  discountType: DiscountType
  discount: number
  taxLabel: string
  taxRate: number
  notes: string
  bank: string
  /** Logo as a data: URL (PNG or JPEG), or empty. */
  logo: string
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function sampleInvoice(): Invoice {
  const today = new Date()
  const due = new Date(today.getTime() + 14 * 86400000)
  return {
    from: 'Studio Rupa Digital\nJl. Kemang Raya No. 12\nJakarta Selatan 12730\nhello@studiorupa.id',
    to: 'PT Nusantara Kopi Sejahtera\nAttn: Finance Dept.\nJl. Braga No. 45, Bandung 40111',
    number: `INV-${today.getFullYear()}-014`,
    date: iso(today),
    due: iso(due),
    currency: 'IDR',
    items: [
      { id: 1, desc: 'Website redesign: discovery workshop and wireframes', qty: 1, price: 7500000 },
      { id: 2, desc: 'UI design, 8 page templates (desktop and mobile)', qty: 8, price: 1250000 },
      { id: 3, desc: 'Front-end development', qty: 40, price: 350000 },
    ],
    discountType: 'pct',
    discount: 5,
    taxLabel: 'PPN',
    taxRate: 11,
    notes: 'Thank you for your business! Payment within 14 days. Please include the invoice number in the transfer description.',
    bank: 'Bank Central Asia (BCA)\nAccount: 123 456 7890\nName: Studio Rupa Digital',
    logo: '',
  }
}
