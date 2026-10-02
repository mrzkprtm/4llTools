import { useState, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const NOTE_TO_NUM: Record<string, number> = {}
NOTES.forEach((n, i) => { NOTE_TO_NUM[n] = i })
FLAT_NOTES.forEach((n, i) => { NOTE_TO_NUM[n] = i })

const INTERVAL_NAMES = [
  'Perfect Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd',
  'Perfect 4th', 'Tritone (Aug 4th / Dim 5th)', 'Perfect 5th',
  'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Perfect Octave'
]

const INTERVAL_QUALITIES = {
  0: 'P', 1: 'm', 2: 'M', 3: 'm', 4: 'M', 5: 'P', 6: 'A4/d5', 7: 'P', 8: 'm', 9: 'M', 10: 'm', 11: 'M', 12: 'P'
}

const CONSONANCE = {
  0: 'Perfect', 1: 'Dissonant', 2: 'Dissonant', 3: 'Consonant', 4: 'Consonant',
  5: 'Perfect', 6: 'Dissonant', 7: 'Perfect', 8: 'Consonant', 9: 'Consonant',
  10: 'Dissonant', 11: 'Dissonant', 12: 'Perfect'
}

const INVERSION_MAP: Record<number, number> = {
  0: 0, 1: 11, 2: 10, 3: 9, 4: 8, 5: 7, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2, 11: 1, 12: 0
}

const INTERVAL_SYMBOLS = {
  0: 'P1', 1: 'm2', 2: 'M2', 3: 'm3', 4: 'M3', 5: 'P4', 6: 'A4/d5', 7: 'P5', 8: 'm6', 9: 'M6', 10: 'm7', 11: 'M7', 12: 'P8'
}

const EXAMPLE_SONGS: Record<number, string> = {
  0: 'Same note', 1: 'Jaws theme', 2: 'Happy Birthday', 3: 'Greensleeves', 4: 'When the Saints',
  5: 'Here Comes the Bride', 6: 'Maria (West Side Story)', 7: 'Twinkle Twinkle', 8: 'Entertainer', 9: 'My Bonnie',
  10: 'Somewhere (West Side Story)', 11: 'Take On Me', 12: 'Somewhere Over the Rainbow'
}

export default function IntervalCalculator() {
  const [note1, setNote1] = useState('C')
  const [note2, setNote2] = useState('E')
  const [note1Octave, setNote1Octave] = useState(4)
  const [note2Octave, setNote2Octave] = useState(4)
  const [useFlats, setUseFlats] = useState(false)

  const num1 = NOTE_TO_NUM[note1] ?? 0
  const num2 = NOTE_TO_NUM[note2] ?? 0

  const midi1 = (note1Octave + 1) * 12 + num1
  const midi2 = (note2Octave + 1) * 12 + num2

  const semitones = useMemo(() => Math.abs(midi2 - midi1), [midi1, midi2])
  const direction = midi2 >= midi1 ? 'ascending' : 'descending'
  const intervalName = INTERVAL_NAMES[semitones] || `${semitones} semitones`
  const quality = INTERVAL_QUALITIES[semitones as keyof typeof INTERVAL_QUALITIES] || '?'
  const consonance = CONSONANCE[semitones as keyof typeof CONSONANCE] || 'Unknown'
  const symbol = INTERVAL_SYMBOLS[semitones as keyof typeof INTERVAL_SYMBOLS] || '?'
  const inversion = INVERSION_MAP[semitones as keyof typeof INVERSION_MAP]
  const inversionName = INTERVAL_NAMES[inversion] || `${inversion} semitones`
  const inversionSymbol = INTERVAL_SYMBOLS[inversion as keyof typeof INTERVAL_SYMBOLS] || '?'
  const exampleSong = EXAMPLE_SONGS[semitones] || ''

  const noteNames = useFlats ? FLAT_NOTES : NOTES
  const note1Display = note1 + note1Octave
  const note2Display = note2 + note2Octave

  const frequency1 = 440 * Math.pow(2, (midi1 - 69) / 12)
  const frequency2 = 440 * Math.pow(2, (midi2 - 69) / 12)
  const ratio = frequency2 / frequency1

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Interval Calculator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Note 1</span>
            <div className="row" style={{ gap: 8 }}>
              <select value={note1} onChange={e => setNote1(e.target.value)} style={{ flex: 1 }}>
                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={note1Octave} onChange={e => setNote1Octave(Number(e.target.value))} style={{ width: 70 }}>
                {[2, 3, 4, 5, 6, 7].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </label>
        </div>

        <span style={{ fontSize: '2rem', color: 'var(--accent)' }}>→</span>

        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Note 2</span>
            <div className="row" style={{ gap: 8 }}>
              <select value={note2} onChange={e => setNote2(e.target.value)} style={{ flex: 1 }}>
                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={note2Octave} onChange={e => setNote2Octave(Number(e.target.value))} style={{ width: 70 }}>
                {[2, 3, 4, 5, 6, 7].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={useFlats} onChange={e => setUseFlats(e.target.checked)} />
          <span>Show flats (♭)</span>
        </label>
      </div>

      <div className="pop-row" style={{ padding: 20, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Note 1</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
              {noteNames[num1]}{note1Octave}
            </div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>{frequency1.toFixed(1)} Hz</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
              {symbol}
            </div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>{semitones} semitone{semitones !== 1 ? 's' : ''}</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Note 2</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>
              {noteNames[num2]}{note2Octave}
            </div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>{frequency2.toFixed(1)} Hz</div>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Interval Name</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{intervalName}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Quality</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{quality}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Consonance</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: consonance === 'Perfect' ? 'var(--ok)' : consonance === 'Consonant' ? 'var(--accent)' : 'var(--danger)' }}>
                {consonance}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Direction</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: direction === 'ascending' ? 'var(--ok)' : 'var(--accent)' }}>
                {direction}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Frequency Ratio</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                {ratio.toFixed(3)}:1
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <h4 style={{ margin: '0 0 12px' }}>Inversion</h4>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Inverted Interval</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>
                {inversionSymbol}
              </div>
              <div style={{ fontSize: '1rem', color: 'var(--muted)' }}>{inversionName}</div>
            </div>
            <div style={{ fontSize: '2rem', color: 'var(--muted)' }}>=</div>
            <div style={{ textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Semitones</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                {inversion}
              </div>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
              {direction === 'ascending' ? 'Ascending becomes descending' : 'Descending becomes ascending'}
            </div>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Famous Example</h4>
          <div style={{ textAlign: 'center' }}>
            {exampleSong ? (
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent)' }}>
                {exampleSong}
              </div>
            ) : (
              <p className="muted">No common example for this interval</p>
            )}
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '200ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>All Intervals from {noteNames[num1]}{note1Octave}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            {NOTES.map((target, i) => {
              const targetMidi = (note1Octave + 1) * 12 + i
              const semi = Math.abs(targetMidi - midi1)
              if (semi > 12) return null
              const isCurrent = target === note2 && note2Octave === note1Octave
              return (
                <button
                  key={target}
                  className="btn"
                  onClick={() => { setNote2(target); setNote2Octave(note1Octave) }}
                  disabled={isCurrent}
                  style={{
                    padding: '8px', textAlign: 'center',
                    background: isCurrent ? 'var(--accent)' : semi === 0 ? 'var(--ok)' : 'var(--bg)',
                    color: isCurrent ? 'white' : semi === 0 ? 'white' : 'var(--text)',
                    border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{noteNames[i]}</div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>{INTERVAL_SYMBOLS[semi as keyof typeof INTERVAL_SYMBOLS] || semi}</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Select two notes to calculate the interval. Shows semitone distance, quality, consonance, inversion, and famous song examples.
      </p>
    </div>
  )
}