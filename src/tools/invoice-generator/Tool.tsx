import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Client {
  id: number
  name: string
  email: string
  address: string
  taxId: string
}

interface Item {
  id: number
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  discount: number
}

interface Invoice {
  id: number
  number: string
  date: string
  dueDate: string
  clientId: number
  items: Item[]
  notes: string
  terms: string
  status: 'draft' | 'sent' | 'paid' | 'overdue'
}

const TAX_RATES = [0, 0.05, 0.10, 0.11, 0.15, 0.20, 0.25]

export default function InvoiceGenerator() {
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('invoice-generator')
    return saved ? JSON.parse(saved) : []
  })
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('invoice-generator-clients')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Acme Corp', email: 'billing@acme.com', address: '123 Business Ave, City', taxId: 'TAX-001' },
      { id: 2, name: 'Global Inc', email: 'accounts@global.com', address: '456 Enterprise Blvd, Town', taxId: 'TAX-002' },
    ]
  })
  const [activeInvoiceId, setActiveInvoiceId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list')
  const [newClient, setNewClient] = useState({ name: '', email: '', address: '', taxId: '' })

  useEffect(() => {
    try { localStorage.setItem('invoice-generator', JSON.stringify(invoices)) } catch {}
  }, [invoices])
  useEffect(() => {
    try { localStorage.setItem('invoice-generator-clients', JSON.stringify(clients)) } catch {}
  }, [clients])

  const createInvoice = () => {
    const invoice: Invoice = {
      id: Date.now(),
      number: `INV-${String(invoices.length + 1).padStart(4, '0')}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      clientId: clients[0]?.id || 0,
      items: [{ id: 1, description: 'Service', quantity: 1, unitPrice: 0, taxRate: 0.11, discount: 0 }],
      notes: 'Thank you for your business!',
      terms: 'Payment due within 30 days.',
      status: 'draft',
    }
    setInvoices([...invoices, invoice])
    setActiveInvoiceId(invoice.id)
    setViewMode('editor')
  }

  const deleteInvoice = (id: number) => {
    setInvoices(invoices.filter(i => i.id !== id))
    if (activeInvoiceId === id) setActiveInvoiceId(null)
  }

  const duplicateInvoice = (id: number) => {
    const invoice = invoices.find(i => i.id === id)!
    const newInvoice: Invoice = {
      ...invoice,
      id: Date.now(),
      number: `INV-${String(invoices.length + 1).padStart(4, '0')}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'draft',
    }
    setInvoices([...invoices, newInvoice])
  }

  const addItem = (invoiceId: number) => {
    setInvoices(invoices.map(inv => inv.id === invoiceId ? {
      ...inv, items: [...inv.items, { id: Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 0.11, discount: 0 }]
    } : inv))
  }

  const removeItem = (invoiceId: number, itemId: number) => {
    setInvoices(invoices.map(inv => inv.id === invoiceId ? {
      ...inv, items: inv.items.filter(item => item.id !== itemId)
    } : inv))
  }

  const updateItem = (invoiceId: number, itemId: number, field: string, value: string | number) => {
    setInvoices(invoices.map(inv => inv.id === invoiceId ? {
      ...inv, items: inv.items.map(item => item.id === itemId ? { ...item, [field]: value } : item)
    } : inv))
  }

  const updateInvoice = (id: number, field: string, value: string | number) => {
    setInvoices(invoices.map(inv => inv.id === id ? { ...inv, [field]: value } : inv))
  }

  const addClient = () => {
    if (!newClient.name.trim()) return
    setClients([...clients, { ...newClient, id: Date.now() }])
    setNewClient({ name: '', email: '', address: '', taxId: '' })
  }

  const activeInvoice = invoices.find(i => i.id === activeInvoiceId)

  const calculateTotals = (items: Item[]) => {
    const subtotal = items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
      return sum + lineTotal
    }, 0)
    const tax = items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
      return sum + lineTotal * item.taxRate
    }, 0)
    return { subtotal, tax, total: subtotal + tax }
  }

  const fmt = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID')

  const exportPDF = (invoice: Invoice) => {
    // Simple text export for now
    const lines = [
      `INVOICE: ${invoice.number}`,
      `Date: ${invoice.date}`,
      `Due: ${invoice.dueDate}`,
      `Client: ${clients.find(c => c.id === invoice.clientId)?.name || ''}`,
      '',
      ...invoice.items.map((item, i) => `${i + 1}. ${item.description} x${item.quantity} @ ${item.unitPrice} = ${Math.round(item.quantity * item.unitPrice * (1 - item.discount / 100))}`),
      '',
      `Subtotal: ${fmt(calculateTotals(invoice.items).subtotal)}`,
      `Tax: ${fmt(calculateTotals(invoice.items).tax)}`,
      `Total: ${fmt(calculateTotals(invoice.items).total)}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.number}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (viewMode === 'list') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Invoice Generator</h3>
          <button className="btn" onClick={createInvoice}>+ New Invoice</button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {invoices.map((invoice, i) => {
            const totals = calculateTotals(invoice.items)
            const client = clients.find(c => c.id === invoice.clientId)
            return (
              <div key={invoice.id} className="pop-row" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16,
                background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 60}ms`,
              }}>
                <div>
                  <div className="row" style={{ gap: 12, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{invoice.number}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                      background: invoice.status === 'paid' ? 'var(--ok)20' : invoice.status === 'overdue' ? 'var(--danger)20' : invoice.status === 'sent' ? 'var(--accent)20' : 'var(--muted)20',
                      color: invoice.status === 'paid' ? 'var(--ok)' : invoice.status === 'overdue' ? 'var(--danger)' : invoice.status === 'sent' ? 'var(--accent)' : 'var(--muted)'
                    }}>
                      {invoice.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    {client?.name} • {invoice.items.length} items • Due: {invoice.dueDate}
                  </div>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: '1.2rem', color: 'var(--accent)' }}>{fmt(totals.total)}</span>
                  <button className="btn" onClick={() => { setActiveInvoiceId(invoice.id); setViewMode('editor') }}>Edit</button>
                  <button className="btn" onClick={() => duplicateInvoice(invoice.id)} style={{ background: 'var(--bg)' }}>Duplicate</button>
                  <button className="btn" onClick={() => exportPDF(invoice)}>Export</button>
                  <button className="btn" onClick={() => deleteInvoice(invoice.id)} style={{ color: 'var(--danger)' }}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Create invoices with line items, tax rates, and discounts. Manage clients and export invoices.
        </p>
      </div>
    )
  }

  if (viewMode === 'editor' && activeInvoice) {
    const totals = calculateTotals(activeInvoice.items)
    const client = clients.find(c => c.id === activeInvoice.clientId)

    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn" onClick={() => setViewMode('list')}>← Back to Invoices</button>
          <h3 style={{ margin: 0 }}>{activeInvoice.number}</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => exportPDF(activeInvoice)}>Export</button>
            <button className="btn" onClick={() => updateInvoice(activeInvoice.id, 'status', 'sent')}>Mark Sent</button>
            <button className="btn" onClick={() => updateInvoice(activeInvoice.id, 'status', 'paid')} style={{ background: 'var(--ok)' }}>Mark Paid</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <h4 style={{ margin: '0 0 12px' }}>Invoice Details</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Invoice Number</span>
                  <input type="text" value={activeInvoice.number} onChange={e => updateInvoice(activeInvoice.id, 'number', e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Date</span>
                  <input type="date" value={activeInvoice.date} onChange={e => updateInvoice(activeInvoice.id, 'date', e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px' }} />
                </label>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Due Date</span>
                  <input type="date" value={activeInvoice.dueDate} onChange={e => updateInvoice(activeInvoice.id, 'dueDate', e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Status</span>
                  <select value={activeInvoice.status} onChange={e => updateInvoice(activeInvoice.id, 'status', e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px' }}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="muted" style={{ fontSize: '0.75rem' }}>Client</span>
                <select value={activeInvoice.clientId} onChange={e => updateInvoice(activeInvoice.id, 'clientId', Number(e.target.value))} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px' }}>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <h4 style={{ margin: '0 0 12px' }}>Client Info</h4>
            {client ? (
              <div style={{ lineHeight: 1.8 }}>
                <div style={{ fontWeight: 600 }}>{client.name}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>{client.email}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>{client.address}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>Tax ID: {client.taxId}</div>
              </div>
            ) : (
              <p className="muted">No client selected</p>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Line Items
              <button className="btn" onClick={() => addItem(activeInvoice.id)} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>+ Add Item</button>
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', width: '50px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Description</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', width: '80px' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', width: '120px' }}>Unit Price</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', width: '80px' }}>Disc %</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', width: '100px' }}>Tax %</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', width: '120px' }}>Line Total</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvoice.items.map((item, i) => {
                    const lineTotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
                    return (
                      <tr key={item.id} style={{ animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: `${i * 40}ms` }}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                          <input type="text" value={item.description} onChange={e => updateItem(activeInvoice.id, item.id, 'description', e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500 }} />
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                          <input type="number" min={0} step={0.01} value={item.quantity} onChange={e => updateItem(activeInvoice.id, item.id, 'quantity', Number(e.target.value))} style={{ width: '100%', textAlign: 'right', background: 'transparent', border: 'none', color: 'var(--text)' }} />
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                          <input type="number" min={0} step={1000} value={item.unitPrice} onChange={e => updateItem(activeInvoice.id, item.id, 'unitPrice', Number(e.target.value))} style={{ width: '100%', textAlign: 'right', background: 'transparent', border: 'none', color: 'var(--text)' }} />
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                          <input type="number" min={0} max={100} step={0.1} value={item.discount} onChange={e => updateItem(activeInvoice.id, item.id, 'discount', Number(e.target.value))} style={{ width: '100%', textAlign: 'right', background: 'transparent', border: 'none', color: 'var(--text)' }} />
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                          <select value={item.taxRate} onChange={e => updateItem(activeInvoice.id, item.id, 'taxRate', Number(e.target.value))} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px', width: '100%' }}>
                            {TAX_RATES.map(r => <option key={r} value={r}>{(r * 100).toFixed(0)}%</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                          Rp{Math.round(lineTotal).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                          <button className="btn" onClick={() => removeItem(activeInvoice.id, item.id)} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.75rem' }}>×</button>
                        </td>
                      </tr>
                    )})}
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <td colSpan={6} style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>Subtotal</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)' }}>Rp{Math.round(activeInvoice.items.reduce((s, i) => s + i.quantity * i.unitPrice * (1 - i.discount / 100), 0)).toLocaleString('id-ID')}</td>
                    <td></td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <td colSpan={6} style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>Tax</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>Rp{Math.round(activeInvoice.items.reduce((s, i) => s + i.quantity * i.unitPrice * (1 - i.discount / 100) * i.taxRate, 0)).toLocaleString('id-ID')}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ padding: '12px', textAlign: 'right', fontWeight: 700, fontSize: '1.2rem' }}>TOTAL</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)', fontSize: '1.2rem', color: 'var(--accent)' }}>Rp{Math.round(activeInvoice.items.reduce((s, i) => s + i.quantity * i.unitPrice * (1 - i.discount / 100) * (1 + i.taxRate), 0)).toLocaleString('id-ID')}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button className="btn" onClick={() => addItem(activeInvoice.id)} style={{ marginTop: 12, justifySelf: 'start' }}>+ Add Another Item</button>
          </div>

          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <h4 style={{ margin: '0 0 12px' }}>Notes & Terms</h4>
            <textarea value={activeInvoice.notes} onChange={e => updateInvoice(activeInvoice.id, 'notes', e.target.value)} placeholder="Notes for client..." rows={3} style={{ width: '100%', marginBottom: 12 }} />
            <textarea value={activeInvoice.terms} onChange={e => updateInvoice(activeInvoice.id, 'terms', e.target.value)} placeholder="Payment terms..." rows={2} style={{ width: '100%' }} />
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
            Rp{Math.round(activeInvoice.items.reduce((s, i) => s + i.quantity * i.unitPrice * (1 - i.discount / 100) * (1 + i.taxRate), 0)).toLocaleString('id-ID')}
          </div>
        </div>
      </div>
    )
  }

  return null
}