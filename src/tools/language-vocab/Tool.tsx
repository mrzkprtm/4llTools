import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Word {
  id: number
  term: string
  translation: string
  example: string
  pronunciation: string
  tags: string[]
  mastery: number
  lastReviewed: number
}

const SAMPLE_WORDS: Word[] = [
  { id: 1, term: 'Makan', translation: 'To eat', example: 'Saya makan nasi', pronunciation: 'ma-kan', tags: ['verb', 'basic'], mastery: 80, lastReviewed: Date.now() - 86400000 },
  { id: 2, term: 'Minum', translation: 'To drink', example: 'Dia minum air', pronunciation: 'mi-num', tags: ['verb', 'basic'], mastery: 60, lastReviewed: Date.now() - 172800000 },
  { id: 3, term: 'Rumah', translation: 'House', example: 'Rumah saya besar', pronunciation: 'ru-mah', tags: ['noun', 'basic'], mastery: 90, lastReviewed: Date.now() - 43200000 },
  { id: 4, term: 'Sekolah', translation: 'School', example: 'Anak pergi ke sekolah', pronunciation: 'se-ko-lah', tags: ['noun', 'basic'], mastery: 70, lastReviewed: Date.now() - 259200000 },
  { id: 5, term: 'Cepat', translation: 'Fast', example: 'Dia lari cepat', pronunciation: 'ce-pat', tags: ['adjective', 'basic'], mastery: 50, lastReviewed: Date.now() - 345600000 },
]

const LANGUAGES = [
  { code: 'id-en', name: 'Indonesian → English', flag: '🇮🇩🇺🇸' },
  { code: 'en-id', name: 'English → Indonesian', flag: '🇺🇸🇮🇩' },
  { code: 'en-es', name: 'English → Spanish', flag: '🇺🇸🇪🇸' },
  { code: 'en-fr', name: 'English → French', flag: '🇺🇸🇫🇷' },
  { code: 'en-ja', name: 'English → Japanese', flag: '🇺🇸🇯🇵' },
  { code: 'en-ko', name: 'English → Korean', flag: '🇺🇸🇰🇷' },
  { code: 'en-zh', name: 'English → Chinese', flag: '🇺🇸🇨🇳' },
]

export default function LanguageVocab() {
  const [words, setWords] = useState<Word[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:language-vocab')
      return saved ? JSON.parse(saved) : SAMPLE_WORDS
    } catch {
      return SAMPLE_WORDS
    }
  })
  const [language, setLanguage] = useState('id-en')
  const [filterTag, setFilterTag] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'mastery' | 'term' | 'lastReviewed'>('mastery')
  const [newWord, setNewWord] = useState({ term: '', translation: '', example: '', pronunciation: '', tags: '' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ term: '', translation: '', example: '', pronunciation: '', tags: '' })

  useEffect(() => {
    try { localStorage.setItem('4lltools:language-vocab', JSON.stringify(words)) } catch {}
  }, [words])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    words.forEach(w => w.tags.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [words])

  const addWord = () => {
    if (!newWord.term.trim() || !newWord.translation.trim()) return
    setWords([...words, {
      id: Date.now(),
      term: newWord.term,
      translation: newWord.translation,
      example: newWord.example,
      pronunciation: newWord.pronunciation,
      tags: newWord.tags.split(',').map(t => t.trim()).filter(Boolean),
      mastery: 0,
      lastReviewed: 0,
    }])
    setNewWord({ term: '', translation: '', example: '', pronunciation: '', tags: '' })
  }

  const startEdit = (word: Word) => {
    setEditingId(word.id)
    setEditForm({
      term: word.term,
      translation: word.translation,
      example: word.example,
      pronunciation: word.pronunciation,
      tags: word.tags.join(', '),
    })
  }

  const saveEdit = () => {
    if (!editingId) return
    setWords(words.map(w => w.id === editingId ? {
      ...w,
      term: editForm.term,
      translation: editForm.translation,
      example: editForm.example,
      pronunciation: editForm.pronunciation,
      tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
    } : w))
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const deleteWord = (id: number) => {
    setWords(words.filter(w => w.id !== id))
  }

  const reviewWord = (id: number, correct: boolean) => {
    setWords(words.map(w => {
      if (w.id !== id) return w
      let mastery = w.mastery
      if (correct) mastery = Math.min(100, mastery + 20)
      else mastery = Math.max(0, mastery - 15)
      return { ...w, mastery, lastReviewed: Date.now() }
    }))
  }

  const exportCSV = () => {
    const headers = ['Term', 'Translation', 'Example', 'Pronunciation', 'Tags', 'Mastery', 'Last Reviewed']
    const rows = words.map(w => [
      w.term, w.translation, w.example, w.pronunciation,
      w.tags.join(';'), w.mastery.toString(),
      w.lastReviewed ? new Date(w.lastReviewed).toISOString() : 'Never'
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vocab-${language}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredWords = useMemo(() => {
    return words
      .filter(w => !filterTag || w.tags.includes(filterTag))
      .filter(w => w.term.toLowerCase().includes(search.toLowerCase()) || w.translation.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'mastery') return a.mastery - b.mastery
        if (sortBy === 'term') return a.term.localeCompare(b.term)
        return b.lastReviewed - a.lastReviewed
      })
  }, [words, filterTag, search, sortBy])

  const avgMastery = words.length > 0 ? Math.round(words.reduce((s, w) => s + w.mastery, 0) / words.length) : 0

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Language Vocabulary Builder</h3>
        <div className="row" style={{ gap: 8 }}>
          <select value={language} onChange={e => setLanguage(e.target.value)} style={{ width: 200 }}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
          </select>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={words.length} /></b><span className="muted">Total Words</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={avgMastery} />%</b><span className="muted">Avg Mastery</span></div>
        <div className="stat"><b><Roll value={words.filter(w => w.mastery >= 80).length} /></b><span className="muted">Mastered (≥80%)</span></div>
        <div className="stat"><b><Roll value={words.filter(w => w.mastery === 0).length} /></b><span className="muted">New (0%)</span></div>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">All Tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ minWidth: 150 }}>
            <option value="mastery">Sort: Mastery (low first)</option>
            <option value="term">Sort: A-Z</option>
            <option value="lastReviewed">Sort: Recent First</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ margin: '0 0 12px' }}>Add New Word</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="Term" value={newWord.term} onChange={e => setNewWord({ ...newWord, term: e.target.value })} style={{ flex: 1 }} />
            <input type="text" placeholder="Translation" value={newWord.translation} onChange={e => setNewWord({ ...newWord, translation: e.target.value })} style={{ flex: 1 }} />
          </div>
          <input type="text" placeholder="Example sentence" value={newWord.example} onChange={e => setNewWord({ ...newWord, example: e.target.value })} />
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="Pronunciation (IPA or guide)" value={newWord.pronunciation} onChange={e => setNewWord({ ...newWord, pronunciation: e.target.value })} style={{ flex: 1 }} />
            <input type="text" placeholder="Tags (comma separated)" value={newWord.tags} onChange={e => setNewWord({ ...newWord, tags: e.target.value })} style={{ flex: 1 }} />
          </div>
          <button className="btn" onClick={addWord} style={{ justifySelf: 'start' }}>Add Word</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {filteredWords.map((word, i) => (
          <div key={word.id} className="pop-row" style={{
            display: 'grid', gap: 8, padding: 12,
            background: editingId === word.id ? 'var(--accent)10' : 'var(--bg)',
            border: editingId === word.id ? '2px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 30}ms`,
          }}>
            {editingId === word.id ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div className="row" style={{ gap: 8 }}>
                  <input type="text" value={editForm.term} onChange={e => setEditForm({ ...editForm, term: e.target.value })} style={{ flex: 1 }} />
                  <input type="text" value={editForm.translation} onChange={e => setEditForm({ ...editForm, translation: e.target.value })} style={{ flex: 1 }} />
                </div>
                <input type="text" value={editForm.example} onChange={e => setEditForm({ ...editForm, example: e.target.value })} placeholder="Example" />
                <div className="row" style={{ gap: 8 }}>
                  <input type="text" value={editForm.pronunciation} onChange={e => setEditForm({ ...editForm, pronunciation: e.target.value })} placeholder="Pronunciation" style={{ flex: 1 }} />
                  <input type="text" value={editForm.tags} onChange={e => setEditForm({ ...editForm, tags: e.target.value })} placeholder="Tags" style={{ flex: 1 }} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" onClick={saveEdit}>Save</button>
                  <button className="btn" onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{word.term}</div>
                    {word.pronunciation && <div className="muted" style={{ fontSize: '0.85rem', fontFamily: 'var(--mono)' }}>/{word.pronunciation}/</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 200, color: 'var(--accent)' }}>
                    <div style={{ fontWeight: 500 }}>{word.translation}</div>
                  </div>
                  {word.example && <div className="muted" style={{ flex: 1, minWidth: 200, fontSize: '0.85rem', fontStyle: 'italic' }}>"{word.example}"</div>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {word.tags.map(t => (
                      <span key={t} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--accent)20', color: 'var(--accent)', borderRadius: 12 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn" onClick={() => startEdit(word)} style={{ padding: '4px 12px', fontSize: '0.75rem' }}>Edit</button>
                    <button className="btn" onClick={() => deleteWord(word.id)} style={{ padding: '4px 12px', fontSize: '0.75rem', color: 'var(--danger)' }}>Delete</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>Mastery</span>
                  <div style={{ height: 8, background: 'var(--sunken)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${word.mastery}%`, height: '100%',
                      background: word.mastery >= 80 ? 'var(--ok)' : word.mastery >= 50 ? 'var(--accent)' : 'var(--danger)',
                      borderRadius: 4, transition: 'width 0.3s'
                    }} />
                  </div>
                  <span style={{ fontWeight: 600, color: word.mastery >= 80 ? 'var(--ok)' : word.mastery >= 50 ? 'var(--accent)' : 'var(--danger)', minWidth: 40 }}>
                    {word.mastery}%
                  </span>
                </div>

                <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => reviewWord(word.id, false)} style={{ background: 'var(--danger)', padding: '4px 12px', fontSize: '0.75rem' }}>Forgot (0)</button>
                  <button className="btn" onClick={() => reviewWord(word.id, true)} style={{ background: 'var(--ok)', padding: '4px 12px', fontSize: '0.75rem' }}>Remembered (1)</button>
                  {word.lastReviewed > 0 && <span className="muted" style={{ fontSize: '0.75rem' }}>Last: {new Date(word.lastReviewed).toLocaleDateString('id-ID')}</span>}
                </div>
              </>
            )}
          </div>
        ))}
        {filteredWords.length === 0 && (
          <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <p className="muted">No words match your filters. Add some words or adjust filters.</p>
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Build vocabulary with translations, examples, and pronunciation. Track mastery with spaced review. Export to CSV.
      </p>
    </div>
  )
}