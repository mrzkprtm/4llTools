import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import { FIELDS, TEMPLATES, composeLetter, emptyFields, fileNameFor, findTemplate, paragraphs, sampleFields, type LetterFields } from './letter'

const MULTILINE: (keyof LetterFields)[] = ['opening', 'achievement', 'skills']

export default function CoverLetterBuilder() {
  const [fields, setFields] = useState<LetterFields>(emptyFields)
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id)
  const [saved, setSaved] = useState(false)

  const letter = composeLetter(fields, templateId)
  const template = findTemplate(templateId)
  const set = (key: keyof LetterFields, value: string) => setFields((f) => ({ ...f, [key]: value }))

  function download() {
    const blob = new Blob([letter], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileNameFor(fields)
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <div>
      <label htmlFor="cl-template">Template</label>
      <select id="cl-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
        {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.description}</option>)}
      </select>

      <div className="two-col">
        <div>
          <div className="row" style={{ marginTop: 0 }}>
            <button type="button" className="btn" onClick={() => setFields(sampleFields)}>Fill with an example</button>
            <button type="button" className="btn" onClick={() => setFields(emptyFields)} disabled={JSON.stringify(fields) === JSON.stringify(emptyFields)}>Clear</button>
          </div>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`cl-${f.key}`}>{f.label}</label>
              {MULTILINE.includes(f.key)
                ? <textarea id={`cl-${f.key}`} value={fields[f.key]} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} style={{ minHeight: 62 }} />
                : <input id={`cl-${f.key}`} type="text" value={fields[f.key]} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />}
            </div>
          ))}
        </div>

        <div>
          <h3 className="eyebrow">Live preview · {template.name}</h3>
          <div
            style={{ background: '#fff', color: '#1b1b1f', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '26px 24px', lineHeight: 1.6, minHeight: 320 }}
            aria-live="polite"
          >
            <p className="muted" style={{ margin: '0 0 12px', color: '#7a6a55', fontSize: '0.8rem' }}>{paragraphs(letter).length} paragraphs · {letter.trim().split(/\s+/).length} words</p>
            <div style={{ whiteSpace: 'pre-wrap' }}>{letter}</div>
          </div>

          <div className="row">
            <button type="button" className="btn primary btn-icon" onClick={() => { window.print(); setSaved(true); window.setTimeout(() => setSaved(false), 2000) }}><Icon name="printer" size={18} /> Print</button>
            <button type="button" className={`btn btn-icon ${saved ? 'is-done' : ''}`} onClick={download}><Icon name="save" size={18} /> Download .txt</button>
            <CopyButton text={letter} label="Copy letter" />
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            Use “Print” and pick “Save as PDF” in the dialog to get a PDF. Everything is assembled in your browser; your details are never uploaded.
          </p>
        </div>
      </div>
    </div>
  )
}
