import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import MorphText from '../../motion/MorphText'
import { useSettled } from '../../motion/useSettled'
import { slugify } from './slug'

export default function SlugGenerator() {
  const [text, setText] = useState('')
  const [sep, setSep] = useState('-')
  const [lower, setLower] = useState(true)
  const slug = slugify(text, sep, lower)
  const settled = useSettled(slug, 500)

  return (
    <div>
      <label htmlFor="slug-in">Title</label>
      <input id="slug-in" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Cara Membuat Kopi Susu Enak & Murah!" />
      <div className="row">
        <select value={sep} onChange={(e) => setSep(e.target.value)} style={{ width: 'auto' }} aria-label="Separator">
          <option value="-">Hyphen (-)</option>
          <option value="_">Underscore (_)</option>
        </select>
        <label style={{ fontWeight: 400, margin: 0 }}>
          <input type="checkbox" checked={lower} onChange={(e) => setLower(e.target.checked)} /> Lowercase
        </label>
      </div>
      <label>Slug</label>
      <div className="output" style={{ minHeight: 42 }}>
        <span key={settled} className={settled ? 'sweep-under' : undefined}>
          <MorphText text={slug.slice(0, 60)} stagger={2} />
          {slug.length > 60 && <span style={{ color: '#b45309' }} title="Long slugs get cut off in search results">{slug.slice(60)}</span>}
        </span>
      </div>
      <div className="row"><CopyButton text={slug} /></div>
    </div>
  )
}
