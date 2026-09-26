import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Icon from '../../components/Icon'
import { Hint } from '../../sim/controls'
import { CURRENCIES, type Item } from './logic'
import Preview from './Preview'
import { sampleInvoice, type Invoice } from './types'
import './tool.css'

const KEY = '4lltools:invoice-generator'
const TAX_PRESETS: [string, string, number][] = [
  ['PPN 11%', 'PPN', 11],
  ['PPN 12%', 'PPN', 12],
  ['No tax', '', 0],
]

interface Store {
  current: Invoice
  drafts: Invoice[]
}

function save(s: Store) {
  try {
    const json = JSON.stringify(s)
    // Drop logos from the saved copy when it would get too big for storage.
    localStorage.setItem(KEY, json.length < 1_500_000 ? json : JSON.stringify({ current: { ...s.current, logo: '' }, drafts: s.drafts.map((d) => ({ ...d, logo: '' })) }))
  } catch {
    // Storage is optional.
  }
}

export default function InvoiceGenerator() {
  const [inv, setInv] = useState<Invoice>(sampleInvoice)
  const [drafts, setDrafts] = useState<Invoice[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const ready = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const s = JSON.parse(raw) as Store
        if (s.current?.items) setInv({ ...sampleInvoice(), ...s.current })
        if (Array.isArray(s.drafts)) setDrafts(s.drafts)
      }
    } catch {
      // Fall back to the sample.
    }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    const id = setTimeout(() => save({ current: inv, drafts }), 400)
    return () => clearTimeout(id)
  }, [inv, drafts])

  const set = <K extends keyof Invoice>(k: K, v: Invoice[K]) => setInv((p) => ({ ...p, [k]: v }))
  const setItem = (id: number, patch: Partial<Item>) => set('items', inv.items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const text = (k: 'from' | 'to' | 'number' | 'date' | 'due' | 'notes' | 'bank' | 'taxLabel') => ({ value: inv[k], onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value) })

  function addItem() {
    const id = Math.max(0, ...inv.items.map((i) => i.id)) + 1
    set('items', [...inv.items, { id, desc: '', qty: 1, price: 0 }])
  }

  function onLogo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!/^image\/(png|jpeg)$/.test(f.type)) return setMsg('Please pick a PNG or JPEG image for the logo.')
    if (f.size > 1_000_000) return setMsg('That logo is over 1 MB. Please use a smaller image.')
    const r = new FileReader()
    r.onload = () => set('logo', String(r.result))
    r.readAsDataURL(f)
    setMsg('')
  }

  async function download() {
    setBusy(true)
    setMsg('')
    try {
      const { buildPdf } = await import('./pdf')
      const bytes = await buildPdf(inv)
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${inv.number.replace(/[^\w.-]+/g, '_') || 'invoice'}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      setMsg('Could not build the PDF. Please try again.')
    }
    setBusy(false)
  }

  function saveDraft() {
    setDrafts((d) => [inv, ...d.filter((x) => x.number !== inv.number)].slice(0, 12))
    setMsg(`Saved draft ${inv.number}.`)
  }

  function newInvoice() {
    const base = sampleInvoice()
    const n = inv.number.match(/^(.*?)(\d+)$/)
    setInv({ ...base, from: inv.from, bank: inv.bank, logo: inv.logo, currency: inv.currency, taxLabel: inv.taxLabel, taxRate: inv.taxRate, to: '', notes: inv.notes, items: [{ id: 1, desc: '', qty: 1, price: 0 }], discount: 0, number: n ? n[1] + String(Number(n[2]) + 1).padStart(n[2].length, '0') : `${inv.number}-2` })
  }

  const step = CURRENCIES[inv.currency]?.decimals ? 0.01 : 1000

  return (
    <div>
      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={() => void download()} disabled={busy}>
          <Icon name="file" size={18} /> {busy ? 'Building…' : 'Download PDF'}
        </button>
        <button type="button" className="btn" onClick={saveDraft}>Save draft</button>
        <button type="button" className="btn" onClick={newInvoice}>New invoice</button>
        {drafts.length > 0 && (
          <select className="iv-drafts" aria-label="Open a saved draft" value="" onChange={(e) => { const d = drafts[Number(e.target.value)]; if (d) setInv(d) }}>
            <option value="">Open draft…</option>
            {drafts.map((d, i) => <option key={i} value={i}>{d.number} · {d.to.split('\n')[0] || 'No client'}</option>)}
          </select>
        )}
      </div>
      {msg && <p className="muted iv-msg" key={msg}>{msg}</p>}

      <div className="iv-layout">
        <div className="iv-form">
          <div className="iv-g2">
            <label>Your business<textarea rows={4} {...text('from')} /></label>
            <label>Client<textarea rows={4} {...text('to')} /></label>
          </div>
          <div className="iv-g3">
            <label>Invoice no.<input type="text" {...text('number')} /></label>
            <label>Date<input type="date" {...text('date')} /></label>
            <label>Due<input type="date" {...text('due')} /></label>
          </div>
          <label>Currency
            <select value={inv.currency} onChange={(e) => set('currency', e.target.value)}>
              {Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c} ({CURRENCIES[c].symbol})</option>)}
            </select>
          </label>

          <h3 className="iv-h">Line items</h3>
          <ul className="iv-items">
            {inv.items.map((it) => (
              <li key={it.id} className="iv-item">
                <input type="text" aria-label="Description" placeholder="Description" value={it.desc} onChange={(e) => setItem(it.id, { desc: e.target.value })} />
                <input type="number" aria-label="Quantity" min={0} step="any" value={it.qty} onChange={(e) => setItem(it.id, { qty: Number(e.target.value) })} />
                <input type="number" aria-label="Unit price" min={0} step={step} value={it.price} onChange={(e) => setItem(it.id, { price: Number(e.target.value) })} />
                <button type="button" className="iv-x" aria-label="Remove line" onClick={() => set('items', inv.items.filter((x) => x.id !== it.id))}>×</button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn" onClick={addItem}>+ Add line</button>

          <div className="iv-g2">
            <label>Discount
              <span className="iv-inline">
                <input type="number" min={0} step="any" value={inv.discount} onChange={(e) => set('discount', Number(e.target.value))} />
                <select aria-label="Discount type" value={inv.discountType} onChange={(e) => set('discountType', e.target.value as Invoice['discountType'])}>
                  <option value="pct">%</option>
                  <option value="fixed">{CURRENCIES[inv.currency]?.symbol}</option>
                </select>
              </span>
            </label>
            <label>Tax
              <span className="iv-inline">
                <input type="text" aria-label="Tax name" placeholder="Tax" {...text('taxLabel')} />
                <input type="number" aria-label="Tax %" min={0} max={100} step="any" value={inv.taxRate} onChange={(e) => set('taxRate', Number(e.target.value))} />
              </span>
            </label>
          </div>
          <div className="row">
            {TAX_PRESETS.map(([name, label, rate]) => (
              <button key={name} type="button" className={`btn iv-chip ${inv.taxRate === rate && (rate === 0 || inv.taxLabel === label) ? 'primary' : ''}`} onClick={() => setInv((p) => ({ ...p, taxLabel: label, taxRate: rate }))}>{name}</button>
            ))}
          </div>
          <p className="muted iv-small">Since 2025 most goods and services pay PPN 12% on a base (DPP) of 11/12 of the price, which works out to 11% of the price.</p>
          <label>Payment details<textarea rows={3} {...text('bank')} /></label>
          <label>Notes<textarea rows={3} {...text('notes')} /></label>
          <label>Logo (PNG or JPEG, optional)<input type="file" accept="image/png,image/jpeg" onChange={onLogo} /></label>
          {inv.logo && <button type="button" className="btn" onClick={() => set('logo', '')}>Remove logo</button>}
        </div>
        <div className="iv-previewWrap">
          <Preview inv={inv} />
        </div>
      </div>
      <Hint>Edit the form and the paper on the right updates as you type. Drafts save in this browser automatically; Download PDF makes an A4 file you can send.</Hint>
    </div>
  )
}
