import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const CHORD_QUALITIES = [
  '', 'm', '7', 'm7', 'maj7', 'm7b5', 'dim', 'dim7', 'aug', 'sus2', 'sus4', '6', 'm6',
  '9', 'm9', '13', 'add9', '7sus4', '7#9', '7b9', '7#5', '7b5', 'maj9', 'm11', 'm13',
]

const NOTE_TO_NUM: Record<string, number> = {}
NOTES.forEach((n, i) => { NOTE_TO_NUM[n] = i })
FLAT_NOTES.forEach((n, i) => { NOTE_TO_NUM[n] = i })

function parseChord(chord: string): { root: string; quality: string; bass?: string } | null {
  const match = chord.match(/^([A-G][#b]?)(.+?)(?:\/([A-G][#b]?))?$/)
  if (!match) return null
  return { root: match[1], quality: match[2], bass: match[3] }
}

function transposeNote(note: string, semitones: number): string {
  const num = NOTE_TO_NUM[note]
  if (num === undefined) return note
  const newNum = (num + semitones + 120) % 12
  return NOTES[newNum]
}

function transposeChord(chord: string, semitones: number): string {
  const parsed = parseChord(chord.trim())
  if (!parsed) return chord
  const newRoot = transposeNote(parsed.root, semitones)
  let result = newRoot + parsed.quality
  if (parsed.bass) {
    result += '/' + transposeNote(parsed.bass, semitones)
  }
  return result
}

function getKeyChords(key: string): string[] {
  const keyNum = NOTE_TO_NUM[key]
  if (keyNum === undefined) return []
  const majorScale = [0, 2, 4, 5, 7, 9, 11]
  return majorScale.map(i => NOTES[(keyNum + i) % 12])
}

const COMMON_PROGRESSIONS = {
  'I-V-vi-IV': [0, 4, 5, 3],
  'ii-V-I': [1, 4, 0],
  'vi-IV-I-V': [5, 3, 0, 4],
  'I-vi-ii-V': [0, 5, 1, 4],
  'I-IV-V': [0, 3, 4],
  'I-V-vi-iii-IV-I-IV-V': [0, 4, 5, 2, 3, 0, 3, 4],
  'Andalusian Cadence': [5, 4, 3, 2], // i-VII-VI-V
}

export default function ChordTransposer() {
  const [inputText, setInputText] = useState(() => {
    try {
      const saved = localStorage.getItem('4lltools:chord-transposer')
      return saved || `C    Am    F    G
C    Am    F    G
F    G    Em    Am
F    G    C    C`
    } catch {
      return `C    Am    F    G
C    Am    F    G
F    G    Em    Am
F    G    C    C`
    }
  })
  const [semitones, setSemitones] = useState(0)
  const [fromKey, setFromKey] = useState('C')
  const [toKey, setToKey] = useState('C')
  const [useFlat, setUseFlat] = useState(false)
  const [showNashville, setShowNashville] = useState(false)
  const [capo, setCapo] = useState(0)

  useEffect(() => {
    try { localStorage.setItem('4lltools:chord-transposer', inputText) } catch {}
  }, [inputText])

  const semitonesFromKeys = useMemo(() => {
    const from = NOTE_TO_NUM[fromKey] ?? 0
    const to = NOTE_TO_NUM[toKey] ?? 0
    return (to - from + 12) % 12
  }, [fromKey, toKey])

  const effectiveSemitones = semitones + capo

  const transposeText = (text: string, semis: number) => {
    return text.split('\n').map(line => {
      return line.split(/(\s+)/).map(token => {
        if (token.trim() === '') return token
        const parsed = parseChord(token.trim())
        if (!parsed) return token
        const newRoot = transposeNote(parsed.root, semis)
        let result = newRoot + parsed.quality
        if (parsed.bass) {
          result += '/' + transposeNote(parsed.bass, semis)
        }
        return result + token.slice(token.trim().length)
      }).join('')
    }).join('\n')
  }

  const outputText = transposeText(inputText, effectiveSemitones)

  const nashvilleMap = useMemo(() => {
    const map: Record<string, string> = {}
    const keyChords = getKeyChords(toKey)
    keyChords.forEach((chord, i) => {
      const roman = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'][i]
      map[chord] = roman
    })
    return map
  }, [toKey])

  const toNashville = (text: string) => {
    return text.split('\n').map(line => {
      return line.split(/(\s+)/).map(token => {
        if (token.trim() === '') return token
        const parsed = parseChord(token.trim())
        if (!parsed) return token
        const nash = nashvilleMap[parsed.root + parsed.quality] || parsed.root + parsed.quality
        let result = nash
        if (parsed.bass) result += '/' + (nashvilleMap[parsed.bass] || parsed.bass)
        return result + token.slice(token.trim().length)
      }).join('')
    }).join('\n')
  }

  const nashvilleOutput = toNashville(outputText)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Chord Transposer</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>From Key</span>
            <select value={fromKey} onChange={e => setFromKey(e.target.value)}>
              {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>→</span>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>To Key</span>
            <select value={toKey} onChange={e => setToKey(e.target.value)}>
              {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className="muted" style={{ fontSize: '0.9rem' }}>
            = {semitonesFromKeys} semitone{semitonesFromKeys !== 1 ? 's' : ''} {semitonesFromKeys > 6 ? `(or -${12 - semitonesFromKeys})` : ''}
          </span>
        </div>

        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
            <span>Manual Shift (semitones)</span>
            <input type="number" min={-11} max={11} value={semitones} onChange={e => setSemitones(Number(e.target.value))} style={{ width: 80 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
            <span>Capo Fret</span>
            <input type="number" min={0} max={12} value={capo} onChange={e => setCapo(Number(e.target.value))} style={{ width: 80 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={useFlat} onChange={e => setUseFlat(e.target.checked)} />
            <span>Show flats (♭)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={showNashville} onChange={e => setShowNashville(e.target.checked)} />
            <span>Nashville Numbers</span>
          </label>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Input Chords</span>
              <button className="btn" onClick={() => copyToClipboard(inputText)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Copy</button>
            </div>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              rows={12}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.9rem', resize: 'vertical', width: '100%' }}
              placeholder="Enter chords (e.g., C Am F G / C Am F G)"
            />
          </label>
        </div>

        <div style={{ flex: 1, minWidth: 300 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Output ({toKey}) {capo > 0 && <span className="muted">(capo {capo})</span>}</span>
              <button className="btn" onClick={() => copyToClipboard(showNashville ? nashvilleOutput : outputText)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Copy</button>
            </div>
            <textarea
              value={showNashville ? nashvilleOutput : outputText}
              readOnly
              rows={12}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.9rem', resize: 'vertical', width: '100%' }}
            />
          </label>
        </div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ margin: '0 0 12px' }}>Quick Transpose</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
          {[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].map(s => (
            <button key={s} className="btn" onClick={() => setSemitones(s)} style={{
              background: semitones === s ? 'var(--accent)' : 'var(--bg)',
              color: semitones === s ? 'white' : 'var(--text)',
              border: semitones === s ? '2px solid var(--accent)' : '1px solid var(--border)',
            }}>
              {s > 0 ? '+' : ''}{s}
            </button>
          ))}
        </div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ margin: '0 0 12px' }}>Common Progressions in {toKey}</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {Object.entries(COMMON_PROGRESSIONS).map(([name, intervals]) => {
            const keyChords = getKeyChords(toKey)
            const chords = intervals.map(i => keyChords[i % 7] + (i >= 7 ? '7' : ''))
            return (
              <div key={name} style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{name}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>{chords.join(' - ')}</div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Paste chord charts (one per line or space-separated). Supports: C, Cm, C7, Cmaj7, C/G, etc. Capo adds semitones. Nashville numbers use target key.
      </p>
    </div>
  )
}