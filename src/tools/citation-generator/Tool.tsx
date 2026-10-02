import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

type SourceType = 'book' | 'journal' | 'website' | 'conference' | 'thesis' | 'report' | 'newspaper' | 'video'

const SOURCE_TYPES: { value: SourceType; label: string; fields: string[] }[] = [
  { value: 'book', label: 'Book', fields: ['authors', 'year', 'title', 'edition', 'publisher', 'doi', 'url'] },
  { value: 'journal', label: 'Journal Article', fields: ['authors', 'year', 'title', 'journal', 'volume', 'issue', 'pages', 'doi', 'url'] },
  { value: 'website', label: 'Website', fields: ['authors', 'year', 'title', 'siteName', 'url', 'accessDate'] },
  { value: 'conference', label: 'Conference Paper', fields: ['authors', 'year', 'title', 'conference', 'location', 'pages', 'doi', 'url'] },
  { value: 'thesis', label: 'Thesis/Dissertation', fields: ['authors', 'year', 'title', 'degree', 'institution', 'url'] },
  { value: 'report', label: 'Report', fields: ['authors', 'year', 'title', 'institution', 'reportNumber', 'url'] },
  { value: 'newspaper', label: 'Newspaper Article', fields: ['authors', 'year', 'month', 'day', 'title', 'newspaper', 'pages', 'url'] },
  { value: 'video', label: 'Video', fields: ['authors', 'year', 'title', 'platform', 'url', 'timestamp'] },
]

const STYLES = [
  { id: 'apa', name: 'APA 7th', desc: 'Author-Date (Social Sciences)' },
  { id: 'mla', name: 'MLA 9th', desc: 'Author-Page (Humanities)' },
  { id: 'chicago', name: 'Chicago 17th', desc: 'Notes-Bibliography (History)' },
  { id: 'harvard', name: 'Harvard', desc: 'Author-Date (UK/Australia)' },
  { id: 'ieee', name: 'IEEE', desc: 'Numeric (Engineering/CS)' },
]

interface Source {
  id: number
  type: SourceType
  data: Record<string, string>
}

export default function CitationGenerator() {
  const [sources, setSources] = useState<Source[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:citation-generator')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [style, setStyle] = useState('apa')
  const [sourceType, setSourceType] = useState<SourceType>('book')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    try { localStorage.setItem('4lltools:citation-generator', JSON.stringify(sources)) } catch {}
  }, [sources])

  const currentFields = SOURCE_TYPES.find(t => t.value === sourceType)?.fields || []

  useEffect(() => {
    const defaults: Record<string, string> = {}
    currentFields.forEach(f => defaults[f] = '')
    setFormData(defaults)
  }, [sourceType])

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addSource = () => {
    if (!formData.authors?.trim() || !formData.title?.trim()) return
    setSources([...sources, { id: Date.now(), type: sourceType, data: { ...formData } }])
    currentFields.forEach(f => setFormData(prev => ({ ...prev, [f]: '' })))
  }

  const updateSource = (id: number, field: string, value: string) => {
    setSources(sources.map(s => s.id === id ? { ...s, data: { ...s.data, [field]: value } } : s))
  }

  const deleteSource = (id: number) => {
    setSources(sources.filter(s => s.id !== id))
  }

  const startEdit = (source: Source) => {
    setEditingId(source.id)
    setSourceType(source.type)
    setFormData({ ...source.data })
  }

  const saveEdit = () => {
    if (!editingId) return
    setSources(sources.map(s => s.id === editingId ? { ...s, type: sourceType, data: { ...formData } } : s))
    setEditingId(null)
    currentFields.forEach(f => setFormData(prev => ({ ...prev, [f]: '' })))
  }

  const cancelEdit = () => {
    setEditingId(null)
    currentFields.forEach(f => setFormData(prev => ({ ...prev, [f]: '' })))
  }

  const formatCitation = (source: Source, styleId: string): string => {
    const d = source.data
    const authors = d.authors?.split(';').map(a => a.trim()).filter(Boolean) || []
    const formatAuthors = (style: string, max: number = 20) => {
      if (authors.length === 0) return ''
      if (style === 'apa') {
        if (authors.length === 1) return `${authors[0]}.`
        if (authors.length <= max) return authors.map(a => {
          const parts = a.split(' ')
          const last = parts.pop()!
          const first = parts.join(' ')
          return `${last}, ${first.charAt(0)}.`
        }).join(', ') + '.'
        return authors.slice(0, max).map(a => {
          const parts = a.split(' ')
          const last = parts.pop()!
          const first = parts.join(' ')
          return `${last}, ${first.charAt(0)}.`
        }).join(', ') + ', ...'
      }
      if (style === 'mla') {
        if (authors.length === 1) {
          const parts = authors[0].split(' ')
          const last = parts.pop()!
          const first = parts.join(' ')
          return `${last}, ${first}.`
        }
        if (authors.length === 2) {
          const a1 = authors[0].split(' '); const l1 = a1.pop()!; const f1 = a1.join(' ')
          const a2 = authors[1].split(' '); const l2 = a2.pop()!; const f2 = a2.join(' ')
          return `${l1}, ${f1}, and ${f2} ${l2}.`
        }
        return `${authors[0].split(' ').pop()}, ${authors[0].split(' ')[0]} et al.`
      }
      if (style === 'chicago') {
        if (authors.length === 1) {
          const parts = authors[0].split(' ')
          const last = parts.pop()!
          const first = parts.join(' ')
          return `${last}, ${first}.`
        }
        return authors.map(a => {
          const parts = a.split(' ')
          const last = parts.pop()!
          const first = parts.join(' ')
          return `${last}, ${first}`
        }).join(', ') + '.'
      }
      if (style === 'harvard') {
        if (authors.length === 1) return `${authors[0].split(' ').pop()}, ${authors[0].split(' ')[0].charAt(0)}.`
        return authors.map(a => `${a.split(' ').pop()}, ${a.split(' ')[0].charAt(0)}.`).join(' ')
      }
      if (style === 'ieee') {
        return authors.slice(0, 6).map((a, i) => {
          const parts = a.split(' ')
          const first = parts[0].charAt(0)
          const last = parts.pop()!
          return `[${i+1}] ${first}. ${last}`
        }).join(', ') + (authors.length > 6 ? ', et al.' : '')
      }
      return authors.join(', ')
    }

    const year = d.year || 'n.d.'

    switch (styleId) {
      case 'apa': {
        let cite = `${formatAuthors('apa')} (${year}). `
        if (source.type === 'book') {
          cite += `<em>${d.title}</em>`
          if (d.edition) cite += ` (${d.edition} ed.)`
          cite += `. ${d.publisher || ''}`
          if (d.doi) cite += `. https://doi.org/${d.doi}`
          else if (d.url) cite += `. ${d.url}`
        } else if (source.type === 'journal') {
          cite += `${d.title}. <em>${d.journal}</em>`
          if (d.volume) cite += `, ${d.volume}`
          if (d.issue) cite += `(${d.issue})`
          if (d.pages) cite += `, ${d.pages}.`
          if (d.doi) cite += ` https://doi.org/${d.doi}`
          else if (d.url) cite += `. ${d.url}`
        } else if (source.type === 'website') {
          cite += `${d.title}. <em>${d.siteName || 'Website'}</em>.`
          if (d.url) cite += ` ${d.url}`
          if (d.accessDate) cite += ` Accessed ${d.accessDate}`
        }
        return cite + '.'
      }
      case 'mla': {
        let cite = `${formatAuthors('mla')} `
        if (source.type === 'book') {
          cite += `<em>${d.title}</em>`
          if (d.edition) cite += `, ${d.edition} ed.`
          cite += `, ${d.publisher || ''}, ${year}.`
        } else if (source.type === 'journal') {
          cite += `"${d.title}." <em>${d.journal}</em>`
          if (d.volume) cite += `, vol. ${d.volume}`
          if (d.issue) cite += `, no. ${d.issue}`
          cite += `, ${year}, pp. ${d.pages || ''}.`
          if (d.doi) cite += ` DOI: ${d.doi}.`
          else if (d.url) cite += ` ${d.url}.`
        } else if (source.type === 'website') {
          cite += `"${d.title}." <em>${d.siteName || 'Website'}</em>, ${year}.`
          if (d.url) cite += ` ${d.url}.`
          if (d.accessDate) cite += ` Accessed ${d.accessDate}.`
        }
        return cite
      }
      case 'chicago': {
        let cite = `${formatAuthors('chicago')} `
        if (source.type === 'book') {
          cite += `<em>${d.title}</em>`
          if (d.edition) cite += `, ${d.edition} ed.`
          cite += `. ${d.publisher || ''}, ${year}.`
          if (d.doi) cite += ` https://doi.org/${d.doi}.`
        } else if (source.type === 'journal') {
          cite += `"${d.title}." <em>${d.journal}</em>`
          if (d.volume) cite += ` ${d.volume}`
          if (d.issue) cite += `, no. ${d.issue}`
          cite += ` (${year}): ${d.pages || ''}.`
          if (d.doi) cite += ` https://doi.org/${d.doi}.`
        } else if (source.type === 'website') {
          cite += `"${d.title}." <em>${d.siteName || 'Website'}</em>.`
          if (d.url) cite += ` ${d.url}.`
          if (d.accessDate) cite += ` Accessed ${d.accessDate}.`
        }
        return cite
      }
      case 'harvard': {
        let cite = `${formatAuthors('harvard')} ${year} `
        if (source.type === 'book') {
          cite += `<em>${d.title}</em>`
          if (d.edition) cite += ` (${d.edition} ed.)`
          cite += `. ${d.publisher || ''}.`
          if (d.doi) cite += ` Available at: https://doi.org/${d.doi} (Accessed: ${d.accessDate || 'today'})`
        } else if (source.type === 'journal') {
          cite += `"${d.title}", <em>${d.journal}</em>`
          if (d.volume) cite += ` ${d.volume}`
          if (d.issue) cite += `(${d.issue})`
          cite += `, pp. ${d.pages || ''}.`
          if (d.doi) cite += ` Available at: https://doi.org/${d.doi}`
        }
        return cite
      }
      case 'ieee': {
        let cite = `${formatAuthors('ieee')}, `
        if (source.type === 'book') {
          cite += `<em>${d.title}</em>`
          if (d.edition) cite += `, ${d.edition} ed.`
          cite += `. ${d.publisher || ''}, ${year}.`
        } else if (source.type === 'journal') {
          cite += `"${d.title}," <em>${d.journal}</em>`
          if (d.volume) cite += `, vol. ${d.volume}`
          if (d.issue) cite += `, no. ${d.issue}`
          cite += `, pp. ${d.pages || ''}, ${year}.`
        } else if (source.type === 'website') {
          cite += `"${d.title}," <em>${d.siteName || 'Website'}</em>, ${year}.`
          if (d.url) cite += ` [Online]. Available: ${d.url}`
        }
        return cite
      }
      default: return ''
    }
  }

  const copyAll = () => {
    const text = sources.map(s => formatCitation(s, style)).join('\n\n')
    navigator.clipboard.writeText(text)
  }

  const exportBib = () => {
    // Simple BibTeX export
    const entries = sources.map((s, i) => {
      const d = s.data
      const typeMap: Record<SourceType, string> = { book: 'book', journal: 'article', website: 'misc', conference: 'inproceedings', thesis: 'phdthesis', report: 'techreport', newspaper: 'article', video: 'misc' }
      const year = d.year || 'n.d.'
      const key = d.authors?.split(' ')[0]?.toLowerCase() + year + i
      let entry = `@${typeMap[s.type]}{${key},\n`
      entry += `  author = {${d.authors || ''}},\n`
      entry += `  title = {${d.title || ''}},\n`
      entry += `  year = {${year}},\n`
      if (d.journal) entry += `  journal = {${d.journal}},\n`
      if (d.volume) entry += `  volume = {${d.volume}},\n`
      if (d.issue) entry += `  number = {${d.issue}},\n`
      if (d.pages) entry += `  pages = {${d.pages}},\n`
      if (d.publisher) entry += `  publisher = {${d.publisher}},\n`
      if (d.doi) entry += `  doi = {${d.doi}},\n`
      if (d.url) entry += `  url = {${d.url}},\n`
      entry += `}`
      return entry
    })
    const blob = new Blob([entries.join('\n\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'references.bib'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Citation Generator</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={copyAll}>Copy All</button>
          <button className="btn" onClick={exportBib}>Export BibTeX</button>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Citation Style</span>
            <select value={style} onChange={e => setStyle(e.target.value)}>
              {STYLES.map(s => <option key={s.id} value={s.id}>{s.name} — {s.desc}</option>)}
            </select>
          </label>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Source Type</span>
            <select value={sourceType} onChange={e => setSourceType(e.target.value as SourceType)}>
              {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <details style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }} open>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{editingId ? 'Edit Source' : 'Add New Source'}</summary>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {currentFields.map(field => {
            const labels: Record<string, string> = {
              authors: 'Authors (semicolon separated)',
              year: 'Year',
              title: 'Title',
              edition: 'Edition',
              publisher: 'Publisher',
              doi: 'DOI',
              url: 'URL',
              journal: 'Journal Name',
              volume: 'Volume',
              issue: 'Issue',
              pages: 'Pages',
              siteName: 'Website Name',
              accessDate: 'Access Date (YYYY-MM-DD)',
              conference: 'Conference Name',
              location: 'Location',
              degree: 'Degree Type',
              institution: 'Institution',
              reportNumber: 'Report Number',
              month: 'Month',
              day: 'Day',
              newspaper: 'Newspaper Name',
              platform: 'Platform (YouTube, etc.)',
              timestamp: 'Timestamp (e.g., 1:23)',
            }
            return (
              <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label>{labels[field] || field}</label>
                <input type="text" value={formData[field] || ''} onChange={e => handleChange(field, e.target.value)} placeholder={labels[field] || field} />
              </div>
            )
          })}
          <div className="row" style={{ gap: 8 }}>
            {editingId ? (
              <>
                <button className="btn" onClick={saveEdit}>Save Changes</button>
                <button className="btn" onClick={cancelEdit}>Cancel</button>
              </>
            ) : (
              <button className="btn" onClick={addSource}>Add Source</button>
            )}
          </div>
        </div>
      </details>

      <div style={{ display: 'grid', gap: 12 }}>
        {sources.length === 0 ? (
          <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <p className="muted">No sources added yet. Fill the form above to add your first source.</p>
          </div>
        ) : (
          sources.map((source, i) => (
            <div key={source.id} className="pop-row" style={{
              padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`,
            }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
                    background: 'var(--accent)20', color: 'var(--accent)'
                  }}>
                    {SOURCE_TYPES.find(t => t.value === source.type)?.label}
                  </span>
                  <span className="muted" style={{ marginLeft: 8 }}>{source.data.year || 'n.d.'}</span>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn" onClick={() => startEdit(source)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Edit</button>
                  <button className="btn" onClick={() => deleteSource(source.id)} style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--danger)' }}>Delete</button>
                </div>
              </div>
              <div dangerouslySetInnerHTML={{ __html: formatCitation(source, style) }} style={{ lineHeight: 1.6, fontSize: '0.95rem' }} />
            </div>
          ))
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Supports APA 7, MLA 9, Chicago 17, Harvard, IEEE. Separate multiple authors with semicolons. Export to clipboard or BibTeX.
      </p>
    </div>
  )
}