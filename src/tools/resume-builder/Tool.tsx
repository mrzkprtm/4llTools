import { useState, type ReactNode } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import { contactLine, emptyResume, fileNameFor, formatDateRange, reorderSection, sampleResume, splitSkills, toPlainText, type Contact, type Entry, type ResumeData } from './resume'

type SectionKey = 'experience' | 'education'

interface SectionConfig {
  key: SectionKey
  label: string
  titleLabel: string
  orgLabel: string
}

const SECTIONS: SectionConfig[] = [
  { key: 'experience', label: 'Experience', titleLabel: 'Job title', orgLabel: 'Company' },
  { key: 'education', label: 'Education', titleLabel: 'Degree', orgLabel: 'School' },
]

const CONTACT_FIELDS: { key: keyof Contact; label: string; placeholder: string }[] = [
  { key: 'name', label: 'Full name', placeholder: 'Ada Lovelace' },
  { key: 'title', label: 'Headline', placeholder: 'Software Engineer' },
  { key: 'email', label: 'Email', placeholder: 'ada@example.com' },
  { key: 'phone', label: 'Phone', placeholder: '+44 20 7946 0958' },
  { key: 'location', label: 'Location', placeholder: 'London, UK' },
  { key: 'website', label: 'Website', placeholder: 'ada.example.com' },
]

let nextId = 1
const blankEntry = (): Entry => ({ id: `e${nextId++}`, title: '', org: '', start: '', end: '', details: '' })

function Section({
  children,
  heading,
}: {
  children: ReactNode
  heading: string
}) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a6a55' }}>{heading}</h3>
      {children}
    </section>
  )
}

export default function ResumeBuilder() {
  const [data, setData] = useState<ResumeData>(emptyResume)
  const text = toPlainText(data)

  const setContact = (key: keyof Contact, value: string) =>
    setData((d) => ({ ...d, contact: { ...d.contact, [key]: value } }))
  const setList = (key: SectionKey, list: Entry[]) => setData((d) => ({ ...d, [key]: list }))
  const patch = (key: SectionKey, id: string, field: keyof Entry, value: string) =>
    setData((d) => ({ ...d, [key]: d[key].map((e) => (e.id === id ? { ...e, [field]: value } : e)) }))

  function download() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileNameFor(data)
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const skills = splitSkills(data.skills)
  const filled = data.experience.length + data.education.length

  return (
    <div>
      <div className="row" style={{ marginTop: 0 }}>
        <button type="button" className="btn" onClick={() => setData(sampleResume)}><Icon name="note-text" size={18} /> Load example</button>
        <button type="button" className="btn" onClick={() => setData(emptyResume)} disabled={text === ''}>Clear all</button>
        <span className="muted" style={{ fontSize: '0.85rem' }}>{filled} entr{filled === 1 ? 'y' : 'ies'} · {skills.length} skill{skills.length === 1 ? '' : 's'}</span>
      </div>

      <div className="two-col">
        <div>
          <h3 className="eyebrow">Your details</h3>
          {CONTACT_FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`rb-${f.key}`}>{f.label}</label>
              <input id={`rb-${f.key}`} type="text" value={data.contact[f.key]} placeholder={f.placeholder} onChange={(e) => setContact(f.key, e.target.value)} />
            </div>
          ))}

          <label htmlFor="rb-summary">Summary</label>
          <textarea id="rb-summary" value={data.summary} onChange={(e) => setData((d) => ({ ...d, summary: e.target.value }))} placeholder="Two lines about what you do best." style={{ minHeight: 90 }} />

          {SECTIONS.map((s) => (
            <div key={s.key}>
              <h3 className="eyebrow" style={{ marginTop: 22 }}>{s.label}</h3>
              {data[s.key].map((entry, i) => (
                <div className="panel" key={entry.id} style={{ padding: 12, marginBottom: 10 }}>
                  <label htmlFor={`${s.key}-${entry.id}-title`}>{s.titleLabel}</label>
                  <input id={`${s.key}-${entry.id}-title`} type="text" value={entry.title} onChange={(e) => patch(s.key, entry.id, 'title', e.target.value)} />
                  <label htmlFor={`${s.key}-${entry.id}-org`}>{s.orgLabel}</label>
                  <input id={`${s.key}-${entry.id}-org`} type="text" value={entry.org} onChange={(e) => patch(s.key, entry.id, 'org', e.target.value)} />
                  <div className="row" style={{ margin: '8px 0' }}>
                    <span style={{ flex: '1 1 120px' }}>
                      <label htmlFor={`${s.key}-${entry.id}-start`} style={{ marginTop: 0 }}>From</label>
                      <input id={`${s.key}-${entry.id}-start`} type="text" value={entry.start} placeholder="2020-03" onChange={(e) => patch(s.key, entry.id, 'start', e.target.value)} />
                    </span>
                    <span style={{ flex: '1 1 120px' }}>
                      <label htmlFor={`${s.key}-${entry.id}-end`} style={{ marginTop: 0 }}>To (blank or “present”)</label>
                      <input id={`${s.key}-${entry.id}-end`} type="text" value={entry.end} placeholder="2023-06" onChange={(e) => patch(s.key, entry.id, 'end', e.target.value)} />
                    </span>
                  </div>
                  <label htmlFor={`${s.key}-${entry.id}-details`}>Highlights (one per line)</label>
                  <textarea id={`${s.key}-${entry.id}-details`} value={entry.details} onChange={(e) => patch(s.key, entry.id, 'details', e.target.value)} style={{ minHeight: 70 }} />
                  <div className="row" style={{ margin: '8px 0 0' }}>
                    <button type="button" className="btn" onClick={() => setList(s.key, reorderSection(data[s.key], entry.id, -1))} disabled={i === 0} aria-label={`Move ${s.label} entry ${i + 1} up`}>↑</button>
                    <button type="button" className="btn" onClick={() => setList(s.key, reorderSection(data[s.key], entry.id, 1))} disabled={i === data[s.key].length - 1} aria-label={`Move ${s.label} entry ${i + 1} down`}>↓</button>
                    <button type="button" className="btn" onClick={() => setList(s.key, data[s.key].filter((x) => x.id !== entry.id))} aria-label={`Remove ${s.label} entry ${i + 1}`}>Remove</button>
                    <span className="muted" style={{ fontSize: '0.82rem' }}>{formatDateRange(entry.start, entry.end) || 'No dates yet'}</span>
                  </div>
                </div>
              ))}
              <div className="row">
                <button type="button" className="btn btn-icon" onClick={() => setList(s.key, [...data[s.key], blankEntry()])}><Icon name="plus" size={18} /> Add {s.label.toLowerCase()}</button>
              </div>
            </div>
          ))}

          <label htmlFor="rb-skills">Skills (comma separated)</label>
          <textarea id="rb-skills" value={data.skills} onChange={(e) => setData((d) => ({ ...d, skills: e.target.value }))} placeholder="TypeScript, SQL, testing" style={{ minHeight: 70 }} />
        </div>

        <div>
          <h3 className="eyebrow">Live preview</h3>
          <div style={{ background: '#fff', color: '#1b1b1f', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '26px 24px', lineHeight: 1.5 }}>
            <h2 style={{ margin: 0, fontSize: '1.55rem', letterSpacing: '-0.02em' }}>{data.contact.name.trim() || 'Your name'}</h2>
            {data.contact.title.trim() && <p style={{ margin: '2px 0 0', color: '#5a5a66' }}>{data.contact.title}</p>}
            {contactLine(data) && <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: '#5a5a66' }}>{contactLine(data)}</p>}
            {data.summary.trim() && (
              <Section heading="Summary">
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{data.summary.trim()}</p>
              </Section>
            )}
            {SECTIONS.map((s) => {
              const entries = data[s.key].filter((e) => e.title.trim() || e.org.trim() || e.details.trim())
              if (!entries.length) return null
              return (
                <Section heading={s.label} key={s.key}>
                  {entries.map((e) => (
                    <div key={e.id} style={{ marginBottom: 10 }}>
                      <p style={{ margin: 0, fontWeight: 650 }}>
                        {[e.title.trim(), e.org.trim()].filter(Boolean).join(' — ')}
                        {formatDateRange(e.start, e.end) && <span style={{ fontWeight: 400, color: '#5a5a66' }}> ({formatDateRange(e.start, e.end)})</span>}
                      </p>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                        {e.details.split('\n').map((d) => d.trim()).filter(Boolean).map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  ))}
                </Section>
              )
            })}
            {skills.length > 0 && (
              <Section heading="Skills">
                <p style={{ margin: 0 }}>{skills.join(' · ')}</p>
              </Section>
            )}
          </div>

          <div className="row">
            <button type="button" className="btn primary btn-icon" onClick={() => window.print()}><Icon name="printer" size={18} /> Print / save as PDF</button>
            <button type="button" className="btn btn-icon" onClick={download} disabled={!text}><Icon name="save" size={18} /> Download .txt</button>
            <CopyButton text={text} />
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            In the print dialog choose “Save as PDF” to keep a PDF copy. Your details never leave this page — nothing is uploaded or stored.
          </p>
        </div>
      </div>
    </div>
  )
}
