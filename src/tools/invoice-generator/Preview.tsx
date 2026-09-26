import Roll from '../../motion/Roll'
import { computeTotals, formatMoney, lineAmount } from './logic'
import type { Invoice } from './types'

/** The live A4-style paper preview. */
export default function Preview({ inv }: { inv: Invoice }) {
  const t = computeTotals(inv.items, inv.discountType, inv.discount, inv.taxRate, inv.currency)
  const m = (v: number) => formatMoney(v, inv.currency)
  const [fromName, ...fromRest] = inv.from.split('\n')
  const [toName, ...toRest] = inv.to.split('\n')
  return (
    <div className="iv-paper" aria-label="Invoice preview">
      <div className="iv-top">
        <div className="iv-title">INVOICE</div>
        {inv.logo && <img className="iv-logo" src={inv.logo} alt="Logo" />}
      </div>
      <div className="iv-parties">
        <div>
          <small>From</small>
          <b>{fromName}</b>
          {fromRest.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div>
          <small>Bill to</small>
          <b>{toName}</b>
          {toRest.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div className="iv-meta">
          <div><small>No.</small> <b>{inv.number}</b></div>
          <div><small>Date</small> {inv.date}</div>
          <div><small>Due</small> {inv.due}</div>
        </div>
      </div>
      <table className="iv-table">
        <thead>
          <tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {inv.items.map((it) => (
            <tr key={it.id} className="iv-row">
              <td>{it.desc || '—'}</td>
              <td>{it.qty}</td>
              <td>{m(it.price)}</td>
              <td>{m(lineAmount(it, inv.currency))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="iv-totals">
        <div><span>Subtotal</span><Roll>{m(t.subtotal)}</Roll></div>
        {t.discount > 0 && <div className="iv-in"><span>Discount{inv.discountType === 'pct' ? ` (${inv.discount}%)` : ''}</span><Roll>{`-${m(t.discount)}`}</Roll></div>}
        {inv.taxRate > 0 && <div className="iv-in"><span>{inv.taxLabel || 'Tax'} ({inv.taxRate}%)</span><Roll>{m(t.tax)}</Roll></div>}
        <div className="iv-grand"><span>Total</span><Roll>{m(t.total)}</Roll></div>
      </div>
      {inv.bank.trim() && (
        <div className="iv-note">
          <small>Payment details</small>
          <p>{inv.bank}</p>
        </div>
      )}
      {inv.notes.trim() && (
        <div className="iv-note">
          <small>Notes</small>
          <p>{inv.notes}</p>
        </div>
      )}
    </div>
  )
}
