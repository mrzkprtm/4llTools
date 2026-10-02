import { useState, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const NOTE_TO_NUM: Record<string, number> = {}
NOTES.forEach((n, i) => { NOTE_TO_NUM[n] = i })
FLAT_NOTES.forEach((n, i) => { NOTE_TO_NUM[n] = i })

const SCALES = [
  // Major & Minor
  { name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11], category: 'Major/Minor' },
  { name: 'Natural Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10], category: 'Major/Minor' },
  { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11], category: 'Major/Minor' },
  { name: 'Melodic Minor (ascending)', intervals: [0, 2, 3, 5, 7, 9, 11], category: 'Major/Minor' },
  { name: 'Melodic Minor (descending)', intervals: [0, 2, 3, 5, 7, 8, 10], category: 'Major/Minor' },

  // Modes
  { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], category: 'Modes' },
  { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], category: 'Modes' },
  { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], category: 'Modes' },
  { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], category: 'Modes' },
  { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], category: 'Modes' },

  // Pentatonic
  { name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9], category: 'Pentatonic' },
  { name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10], category: 'Pentatonic' },
  { name: 'Egyptian', intervals: [0, 2, 5, 7, 10], category: 'Pentatonic' },
  { name: 'Blues Major', intervals: [0, 2, 3, 4, 7, 9], category: 'Pentatonic' },
  { name: 'Blues Minor', intervals: [0, 3, 5, 6, 7, 10], category: 'Pentatonic' },

  // Blues & Jazz
  { name: 'Blues Scale', intervals: [0, 3, 5, 6, 7, 10], category: 'Blues/Jazz' },
  { name: 'Major Blues', intervals: [0, 2, 3, 4, 7, 9], category: 'Blues/Jazz' },
  { name: 'Bebop Dominant', intervals: [0, 2, 4, 5, 7, 9, 10, 11], category: 'Blues/Jazz' },
  { name: 'Bebop Major', intervals: [0, 2, 4, 5, 7, 8, 9, 11], category: 'Blues/Jazz' },
  { name: 'Bebop Minor', intervals: [0, 2, 3, 5, 7, 8, 9, 10], category: 'Blues/Jazz' },
  { name: 'Whole Tone', intervals: [0, 2, 4, 6, 8, 10], category: 'Blues/Jazz' },
  { name: 'Diminished (Half-Whole)', intervals: [0, 1, 3, 4, 6, 7, 9, 10], category: 'Blues/Jazz' },
  { name: 'Diminished (Whole-Half)', intervals: [0, 2, 3, 5, 6, 8, 9, 11], category: 'Blues/Jazz' },

  // Exotic
  { name: 'Hirajoshi', intervals: [0, 2, 3, 7, 8], category: 'Exotic' },
  { name: 'In Sen', intervals: [0, 1, 5, 7, 8], category: 'Exotic' },
  { name: 'Iwato', intervals: [0, 1, 5, 6, 10], category: 'Exotic' },
  { name: 'Kumoi', intervals: [0, 2, 3, 7, 9], category: 'Exotic' },
  { name: 'Miyako-bushi', intervals: [0, 1, 5, 6, 7], category: 'Exotic' },
  { name: 'Ritsu', intervals: [0, 2, 5, 7, 9], category: 'Exotic' },
  { name: 'Hungarian Minor', intervals: [0, 2, 3, 6, 7, 8, 11], category: 'Exotic' },
  { name: 'Hungarian Major', intervals: [0, 3, 4, 6, 7, 9, 10], category: 'Exotic' },
  { name: 'Double Harmonic (Byzantine)', intervals: [0, 1, 4, 5, 7, 8, 11], category: 'Exotic' },
  { name: 'Persian', intervals: [0, 1, 4, 5, 6, 8, 11], category: 'Exotic' },
  { name: 'Arabic (Hijaz)', intervals: [0, 1, 4, 5, 7, 8, 10], category: 'Exotic' },
  { name: 'Enigmatic', intervals: [0, 1, 4, 6, 8, 10, 11], category: 'Exotic' },
  { name: 'Neapolitan Major', intervals: [0, 1, 3, 5, 7, 9, 11], category: 'Exotic' },
  { name: 'Neapolitan Minor', intervals: [0, 1, 3, 5, 7, 8, 11], category: 'Exotic' },
]

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export default function ScaleFinder() {
  const [root, setRoot] = useState('C')
  const [scale, setScale] = useState(SCALES[0])
  const [useFlats, setUseFlats] = useState(false)
  const [showGuitar, setShowGuitar] = useState(true)
  const [tuning, setTuning] = useState('EADGBE')
  const [startFret, setStartFret] = useState(0)

  const noteNames = useMemo(() => {
    if (!useFlats) return NOTE_NAMES
    return ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
  }, [useFlats])

  const rootNum = NOTE_TO_NUM[root] ?? 0
  const scaleNotes = scale.intervals.map(i => (rootNum + i) % 12)
  const scaleNoteNames = scaleNotes.map(n => noteNames[n])

  const fretboard = useMemo(() => {
    const strings = tuning.split('').reverse()
    const stringNotes = strings.map(s => NOTE_TO_NUM[s] ?? 0)
    const maxFret = startFret + 15

    return stringNotes.map((openNote, stringIdx) => {
      const frets = []
      for (let f = startFret; f <= maxFret; f++) {
        const note = (openNote + f) % 12
        const isInScale = scaleNotes.includes(note)
        const isRoot = note === scaleNotes[0]
        const degree = scaleNotes.indexOf(note)
        frets.push({ fret: f, note: noteNames[note], inScale: isInScale, isRoot, degree })
      }
      return { string: strings[stringIdx], openNote: noteNames[openNote], frets }
    })
  }, [tuning, startFret, scaleNotes, useFlats])

  const pianoKeys = useMemo(() => {
    const keys = []
    for (let octave = 2; octave <= 5; octave++) {
      for (let i = 0; i < 12; i++) {
        const midi = (octave + 1) * 12 + i
        const note = i
        const isInScale = scaleNotes.includes(note)
        const isRoot = note === scaleNotes[0]
        const isBlack = [1, 3, 6, 8, 10].includes(i)
        keys.push({ midi, note: noteNames[note], octave, isInScale, isRoot, isBlack, degree: scaleNotes.indexOf(note) })
      }
    }
    return keys
  }, [scaleNotes, useFlats])

  const degrees = ['R', '♭2', '2', '♭3', '3', '4', '♭5/#4', '5', '♭6', '6', '♭7', '7']

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Scale Finder</h3>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Root</span>
            <select value={root} onChange={e => setRoot(e.target.value)}>
              {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 250 }}>
            <span>Scale</span>
            <select value={scale.name} onChange={e => setScale(SCALES.find(s => s.name === e.target.value)!)}>
              {SCALES.map(s => <option key={s.name} value={s.name}>{s.category}: {s.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={useFlats} onChange={e => setUseFlats(e.target.checked)} />
            <span>Flats (♭)</span>
          </label>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b>{scale.name}</b><span className="muted">Scale</span></div>
        <div className="stat"><b>{scale.intervals.length}</b><span className="muted">Notes</span></div>
        <div className="stat"><b>{scale.category}</b><span className="muted">Category</span></div>
        <div className="stat"><b>{root} {scale.name.split(' ')[0]}</b><span className="muted">Full Name</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <h4 style={{ margin: '0 0 12px' }}>Scale Notes & Degrees</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
            {scale.intervals.map((interval, i) => {
              const note = (rootNum + interval) % 12
              const degreeNames = ['R', '♭2', '2', '♭3', '3', '4', '♭5/#4', '5', '♭6', '6', '♭7', '7']
              return (
                <div key={i} style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem', fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                    {noteNames[note % 12]}
                  </div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>Degree: {degreeNames[interval]}</div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>Interval: {interval}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Piano Keyboard (C2–B5)</h4>
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', padding: '8px 0' }}>
            {['white', 'black'].map(layer => (
              <div key={layer} style={{ display: 'flex', position: 'absolute', top: layer === 'black' ? 0 : 40, left: 0, right: 0, height: layer === 'black' ? 40 : 60, pointerEvents: 'none' }}>
                {pianoKeys.map((key, i) => {
                  if (key.isBlack !== (layer === 'black')) return null
                  return (
                    <div key={key.midi} style={{
                      flex: 1, maxWidth: layer === 'black' ? 30 : 40, margin: layer === 'black' ? '0 8px' : 0,
                      background: key.isInScale ? (key.isRoot ? 'var(--ok)' : 'var(--accent)') : (key.isBlack ? '#222' : '#fff'),
                      border: key.isInScale ? '2px solid var(--ok)' : (key.isBlack ? '1px solid #111' : '1px solid var(--border)'),
                      borderRadius: layer === 'black' ? '0 0 4px 4px' : '0 0 8px 8px',
                      height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                      padding: layer === 'black' ? 0 : '4px', color: key.isInScale ? 'white' : (key.isBlack ? '#fff' : 'var(--text)'),
                      fontSize: layer === 'black' ? '0.6rem' : '0.7rem', fontWeight: 600,
                    }}>
                      {layer === 'white' && <span>{key.note}{key.octave}</span>}
                      {key.isInScale && <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>{['R','b2','2','b3','3','4','b5','5','b6','6','b7','7'][((NOTE_TO_NUM[key.note] ?? 0) - rootNum + 12) % 12]}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
            <div style={{ height: 100, position: 'relative' }} />
          </div>
        </div>

        {showGuitar && (
          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '200ms' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>Guitar Fretboard ({tuning})</h4>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="muted" style={{ fontSize: '0.7rem' }}>Start Fret</span>
                  <input type="number" min={0} max={12} value={startFret} onChange={e => setStartFret(Number(e.target.value))} style={{ width: 70 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="muted" style={{ fontSize: '0.7rem' }}>Tuning</span>
                  <select value={tuning} onChange={e => setTuning(e.target.value)} style={{ width: 120 }}>
                    <option value="EADGBE">Standard (EADGBE)</option>
                    <option value="DADGBE">Drop D</option>
                    <option value="DGCFAD">D Standard</option>
                    <option value="CGCFAD">Drop C</option>
                    <option value="EBGDAE">Nashville</option>
                  </select>
                </label>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px 8px', borderBottom: '2px solid var(--border)', textAlign: 'right' }}>Str</th>
                    <th style={{ padding: '4px 8px', borderBottom: '2px solid var(--border)' }}>Open</th>
                    {Array.from({ length: 15 }, (_, i) => startFret + i).map(f => (
                      <th key={f} style={{ padding: '4px 6px', borderBottom: '2px solid var(--border)', textAlign: 'center' }}>{f === 0 ? '🎸' : f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fretboard.map((str, si) => (
                    <tr key={si} style={{ animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: `${si * 60}ms` }}>
                      <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border)', textAlign: 'right', fontWeight: 600, color: 'var(--muted)' }}>{str.string}</td>
                      <td style={{ padding: '4px 8px', borderRight: '1px solid var(--border)', textAlign: 'center', background: scaleNotes.includes(NOTE_TO_NUM[str.openNote]) ? 'var(--ok)20' : 'transparent' }}>
                        {str.openNote}
                      </td>
                      {str.frets.map((fr, fi) => (
                        <td key={fi} style={{
                          padding: '4px 6px', borderRight: '1px solid var(--border)', textAlign: 'center', minWidth: 32,
                          background: fr.inScale ? (fr.isRoot ? 'var(--ok)30' : 'var(--accent)20') : 'transparent',
                          color: fr.inScale ? (fr.isRoot ? 'var(--ok)' : 'var(--accent)') : 'var(--muted)',
                          fontWeight: fr.inScale ? 700 : 400,
                        }}>
                          {fr.inScale ? (fr.degree >= 0 ? ['R','♭2','2','♭3','3','4','♭5','5','♭6','6','♭7','7'][scale.intervals[fr.degree]] : fr.note) : ''}
                          {fr.isRoot && <span style={{ fontSize: '0.5rem', color: 'var(--ok)' }}>●</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Select root and scale. Piano shows C2–B5 (4 octaves). Guitar fretboard supports custom tunings and start fret. Notes in scale highlighted.
      </p>
    </div>
  )
}