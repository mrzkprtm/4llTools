import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const NOTE_TO_NUM: Record<string, number> = {}
NOTES.forEach((n, i) => { NOTE_TO_NUM[n] = i })
FLAT_NOTES.forEach((n, i) => { NOTE_TO_NUM[n] = i })

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]

function getScaleNotes(root: number, isMinor: boolean): Set<number> {
  const scale = isMinor ? MINOR_SCALE : MAJOR_SCALE
  const set = new Set<number>()
  scale.forEach(i => set.add((root + i) % 12))
  return set
}

function parseChord(chord: string): { root: string; quality: string } | null {
  const match = chord.trim().match(/^([A-G][#b]?)(.+?)(?:\/|$)/)
  if (!match) return null
  return { root: match[1], quality: match[2] }
}

function chordToNotes(root: string, quality: string): number[] {
  const rootNum = NOTE_TO_NUM[root]
  if (rootNum === undefined) return []

  const base = [0, 4, 7] // major triad
  let notes = [...base]

  if (quality.startsWith('m') && !quality.startsWith('maj')) {
    notes[1] = 3 // minor third
  }
  if (quality.includes('7') && !quality.includes('maj7')) {
    notes.push(10) // minor 7th
  }
  if (quality.includes('maj7')) {
    notes.push(11) // major 7th
  }
  if (quality.includes('dim')) {
    notes[1] = 3; notes[2] = 6
    if (quality.includes('7')) notes.push(9)
  }
  if (quality.includes('aug')) {
    notes[2] = 8
  }
  if (quality.includes('sus2')) {
    notes[1] = 2
  }
  if (quality.includes('sus4')) {
    notes[1] = 5
  }
  if (quality.includes('6')) {
    notes.push(9)
  }
  if (quality.includes('9')) {
    notes.push(2)
  }

  return notes.map(n => (rootNum + n) % 12)
}

const SAMPLE_PROGRESSIONS = {
  'C Major (Pop)': 'C - Am - F - G',
  'G Major (Folk)': 'G - Em - C - D',
  'A Minor (Ballad)': 'Am - F - C - G',
  'E Minor (Rock)': 'Em - C - G - D',
  'F Major (Jazz)': 'F - Dm - Gm - C7',
  'D Major (Country)': 'D - A - Bm - G',
  'Bb Major (Blues)': 'Bb - Eb - F - Bb',
  '12-Bar Blues (E)': 'E7 - E7 - E7 - E7 - A7 - A7 - E7 - E7 - B7 - A7 - E7 - B7',
}

export default function KeyFinder() {
  const [input, setInput] = useState('')
  const [detectedKey, setDetectedKey] = useState<string | null>(null)
  const [useFlats, setUseFlats] = useState(false)

  const analyze = useMemo(() => {
    if (!input.trim()) return null

    const chords = input.split(/[\s,\n\-|]+/).filter(c => c.trim())
    const chordData = chords.map(c => {
      const parsed = parseChord(c)
      if (!parsed) return null
      const notes = chordToNotes(parsed.root, parsed.quality)
      return { chord: c, root: parsed.root, quality: parsed.quality, notes }
    }).filter(Boolean) as { chord: string; root: string; quality: string; notes: number[] }[]

    if (chordData.length === 0) return null

    // Score each possible key
    const scores: Record<string, { major: number; minor: number }> = {}
    NOTES.forEach((note, i) => {
      scores[note] = { major: 0, minor: 0 }
    })

    chordData.forEach(cd => {
      NOTES.forEach((note, i) => {
        const majorNotes = getScaleNotes(i, false)
        const minorNotes = getScaleNotes(i, true)

        let majorScore = 0, minorScore = 0
        cd.notes.forEach(n => {
          if (majorNotes.has(n)) majorScore++
          if (minorNotes.has(n)) minorScore++
        })

        // Weight by chord importance (I, IV, V get more weight)
        const rootNum = NOTE_TO_NUM[cd.root] ?? 0
        const interval = (rootNum - i + 12) % 12
        const weight = [0, 3, 4].includes(interval) ? 2 : 1 // I, IV, V

        scores[note].major += majorScore * weight
        scores[note].minor += minorScore * weight
      })
    })

    // Find best match
    let bestKey = '', bestScore = 0, bestMode = ''
    Object.entries(scores).forEach(([key, score]) => {
      if (score.major > bestScore) { bestScore = score.major; bestKey = key; bestMode = 'major' }
      if (score.minor > bestScore) { bestScore = score.minor; bestKey = key; bestMode = 'minor' }
    })

    // Get alternatives
    const alternatives = Object.entries(scores)
      .map(([key, score]) => ({ key, major: score.major, minor: score.minor }))
      .sort((a, b) => Math.max(b.major, b.minor) - Math.max(a.major, a.minor))
      .slice(1, 4)

    return { key: bestKey, mode: bestMode, score: bestScore, alternatives, chordData }
  }, [input])

  const keyDisplay = useMemo(() => {
    if (!analyze) return null
    return analyze.mode === 'major' ? analyze.key : analyze.key + 'm'
  }, [analyze])

  const relativeKey = useMemo(() => {
    if (!analyze) return null
    const rootNum = NOTE_TO_NUM[analyze.key] ?? 0
    if (analyze.mode === 'major') {
      const relMinor = (rootNum + 9) % 12
      return NOTES[relMinor] + 'm'
    } else {
      const relMajor = (rootNum + 3) % 12
      return NOTES[relMajor]
    }
  }, [analyze])

  const diatonicChords = useMemo(() => {
    if (!analyze) return []
    const rootNum = NOTE_TO_NUM[analyze.key] ?? 0
    const isMinor = analyze.mode === 'minor'
    const scale = isMinor ? MINOR_SCALE : MAJOR_SCALE
    const qualities = isMinor ? ['m', 'dim', '', 'm', 'm', '', ''] : ['', 'm', 'm', '', '', 'm', 'dim']
    const degrees = isMinor ? ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] : ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']

    return scale.map((interval, i) => {
      const note = NOTES[(rootNum + interval) % 12]
      return { degree: degrees[i], chord: note + qualities[i], notes: [(rootNum + interval) % 12, (rootNum + interval + 4 - (isMinor && i !== 2 ? 1 : 0)) % 12, (rootNum + interval + 7) % 12] }
    })
  }, [analyze])

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Key Finder</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Enter Chords (space/comma/newline separated)</span>
              <select value="" onChange={e => setInput(SAMPLE_PROGRESSIONS[e.target.value as keyof typeof SAMPLE_PROGRESSIONS] || '')} style={{ width: 200 }}>
                <option value="">Load Example...</option>
                {Object.entries(SAMPLE_PROGRESSIONS).map(([name, prog]) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={4}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.9rem', resize: 'vertical', width: '100%' }}
              placeholder="e.g., C Am F G | G Em C D | Am F C G"
            />
          </label>
        </div>

        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={useFlats} onChange={e => setUseFlats(e.target.checked)} />
            <span>Show flats (♭)</span>
          </label>
        </div>
      </div>

      {analyze && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
            <div className="muted" style={{ fontSize: '0.9rem', marginBottom: 8 }}>Detected Key</div>
            <div style={{ fontSize: '4rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
              {keyDisplay}
            </div>
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: '1rem', color: 'var(--ok)' }}>{analyze.mode.charAt(0).toUpperCase() + analyze.mode.slice(1)}</span>
              <span className="muted" style={{ marginLeft: 16 }}>Score: {analyze.score} chord-note matches</span>
            </div>
            {relativeKey && (
              <div className="muted" style={{ marginTop: 8 }}>Relative: {relativeKey}</div>
            )}
          </div>

          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
            <h4 style={{ margin: '0 0 12px' }}>Alternative Keys</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              {analyze.alternatives.map((alt, i) => (
                <div key={i} className="pop-row" style={{ padding: 8, background: 'var(--bg)', borderRadius: 4, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: `${i * 50}ms` }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{alt.key}</span>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>{alt.major > alt.minor ? 'Major' : 'Minor'}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{Math.max(alt.major, alt.minor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '200ms' }}>
            <h4 style={{ margin: '0 0 12px' }}>Diatonic Chords in {keyDisplay}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              {diatonicChords.map((dc, i) => (
                <div key={i} style={{ padding: 8, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--muted)' }}>{dc.degree}</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: '1.1rem' }}>{dc.chord}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '300ms' }}>
            <h4 style={{ margin: '0 0 12px' }}>Input Chord Analysis</h4>
            <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {analyze.chordData.map((cd, i) => (
                <div key={i} className="pop-row" style={{ padding: 8, background: 'var(--bg)', borderRadius: 4, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: `${i * 30}ms` }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{cd.chord}</span>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      Notes: {cd.notes.map(n => (useFlats ? FLAT_NOTES[n] : NOTES[n])).join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Enter chord progression (e.g., "C Am F G" or "G Em C D"). Tool analyzes chord tones against all 24 keys. Shows diatonic chords and alternatives.
      </p>
    </div>
  )
}