import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { TEMPLATES, borderInset, describe, fileNameFor, formatDate, layoutFields, type TemplateId } from './certificate'

const W = 1600
const H = 1131

interface Options {
  template: TemplateId
  recipient: string
  course: string
  date: string
  signatory: string
  accent: string
}

const FONT = 'Georgia, "Times New Roman", serif'

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = '400') {
  ctx.font = `${weight} ${size}px ${FONT}`
}

/** Largest size that keeps `text` inside `max` width. */
function fitText(ctx: CanvasRenderingContext2D, text: string, size: number, max: number, weight = '400'): number {
  let s = size
  setFont(ctx, s, weight)
  while (s > 10 && ctx.measureText(text).width > max) {
    s -= 1
    setFont(ctx, s, weight)
  }
  return s
}

function draw(ctx: CanvasRenderingContext2D, o: Options) {
  const template = TEMPLATES.find((t) => t.id === o.template) ?? TEMPLATES[0]
  const accent = /^#[0-9a-f]{3,8}$/i.test(o.accent) ? o.accent : '#0f766e'
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#fffdf7'
  ctx.fillRect(0, 0, W, H)

  const inset = borderInset(W, H)
  ctx.strokeStyle = accent
  ctx.lineWidth = Math.round(W * 0.005)
  ctx.strokeRect(inset, inset, W - 2 * inset, H - 2 * inset)
  ctx.lineWidth = Math.max(1, Math.round(W * 0.0012))
  const inner = inset + Math.round(W * 0.012)
  ctx.strokeRect(inner, inner, W - 2 * inner, H - 2 * inner)

  const slots = layoutFields(W, H, 5)
  const room = W - 2 * inner - Math.round(W * 0.08)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = accent
  const heading = template.heading
  setFont(ctx, slots[0].size * 1.9, '700')
  ctx.fillText(heading, W / 2, slots[0].y)

  ctx.fillStyle = '#3f3a33'
  const lead = template.lead
  setFont(ctx, slots[1].size)
  ctx.fillText(lead, W / 2, slots[1].y)

  ctx.fillStyle = '#141210'
  const recipient = o.recipient.trim() || 'Recipient name'
  const nameSize = fitText(ctx, recipient, slots[2].size, room, '700')
  setFont(ctx, nameSize, '700')
  ctx.fillText(recipient, W / 2, slots[2].y)
  ctx.strokeStyle = accent
  ctx.lineWidth = Math.max(1, Math.round(W * 0.0015))
  ctx.beginPath()
  ctx.moveTo(W / 2 - Math.min(room, 620) / 2, slots[2].y + nameSize * 0.78)
  ctx.lineTo(W / 2 + Math.min(room, 620) / 2, slots[2].y + nameSize * 0.78)
  ctx.stroke()

  ctx.fillStyle = '#3f3a33'
  const body = describe(template, o.course)
  setFont(ctx, slots[3].size)
  ctx.fillText(body, W / 2, slots[3].y)

  const rowY = slots[4].y
  const half = Math.round(W * 0.13)
  ctx.fillStyle = '#3f3a33'
  ctx.fillText(o.date.trim() || formatDate(new Date()), W * 0.25, rowY)
  ctx.fillText(o.signatory.trim() || 'Your name', W * 0.75, rowY)
  ctx.strokeStyle = '#a8a094'
  ctx.lineWidth = 1
  for (const x of [W * 0.25, W * 0.75]) {
    ctx.beginPath()
    ctx.moveTo(x - half, rowY + 26)
    ctx.lineTo(x + half, rowY + 26)
    ctx.stroke()
  }
  setFont(ctx, Math.round(slots[4].size * 0.78))
  ctx.fillStyle = '#7a736a'
  ctx.fillText('Date', W * 0.25, rowY + 52)
  ctx.fillText(template.signLabel, W * 0.75, rowY + 52)
}

export default function CertificateMaker() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [opts, setOpts] = useState<Options>({
    template: 'award',
    recipient: '',
    course: '',
    date: formatDate(new Date()),
    signatory: '',
    accent: '#0f766e',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (ctx) draw(ctx, opts)
  }, [opts])

  const set = <K extends keyof Options>(key: K, value: Options[K]) => setOpts((o) => ({ ...o, [key]: value }))

  function savePng() {
    canvas.current?.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileNameFor(opts.recipient)
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    }, 'image/png')
  }

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="cm-template">Template</label>
          <select id="cm-template" value={opts.template} onChange={(e) => set('template', e.target.value as TemplateId)}>
            {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.heading}</option>)}
          </select>

          <label htmlFor="cm-recipient">Recipient</label>
          <input id="cm-recipient" type="text" value={opts.recipient} maxLength={60} placeholder="Ada Lovelace" onChange={(e) => set('recipient', e.target.value)} />

          <label htmlFor="cm-course">Course or award title</label>
          <input id="cm-course" type="text" value={opts.course} maxLength={80} placeholder="Rust for Beginners" onChange={(e) => set('course', e.target.value)} />

          <label htmlFor="cm-date">Date</label>
          <input id="cm-date" type="text" value={opts.date} maxLength={40} onChange={(e) => set('date', e.target.value)} />

          <label htmlFor="cm-sign">Signed by</label>
          <input id="cm-sign" type="text" value={opts.signatory} maxLength={50} placeholder="Grace Hopper" onChange={(e) => set('signatory', e.target.value)} />

          <label htmlFor="cm-accent">Accent color</label>
          <input id="cm-accent" type="color" value={opts.accent} onChange={(e) => set('accent', e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} />
        </div>

        <div>
          <canvas
            ref={canvas}
            width={W}
            height={H}
            style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
            aria-label="Certificate preview"
          />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>Exported at {W} × {H} pixels, landscape.</p>
        </div>
      </div>

      <div className="row">
        <button type="button" className={`btn primary btn-icon ${saved ? 'is-done' : ''}`} onClick={savePng}>
          <Icon name="save" size={18} /> {saved ? 'Saved!' : 'Download PNG'}
        </button>
        <button type="button" className="btn btn-icon" onClick={() => window.print()}><Icon name="printer" size={18} /> Print</button>
      </div>

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        The certificate is drawn on a canvas in your browser, so you can keep filling the form and download again as often as you like.
        Empty fields fall back to the example text shown in the preview. Nothing is uploaded, and no fonts or images are fetched from the internet.
      </p>
    </div>
  )
}
