import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Song {
  id: number
  title: string
  artist: string
  key: string
  bpm: number
  duration: number
  notes: string
}

interface Setlist {
  id: number
  name: string
  date: string
  venue: string
  songs: Song[]
  created: string
}

export default function SetlistManager() {
  const [setlists, setSetlists] = useState<Setlist[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:setlist-manager')
      return saved ? JSON.parse(saved) : [
        {
          id: 1,
          name: 'Friday Night Gig',
          date: new Date().toISOString().split('T')[0],
          venue: 'The Blue Note',
          created: new Date().toISOString(),
          songs: [
            { id: 1, title: 'Sweet Child o\' Mine', artist: 'Guns N\' Roses', key: 'D', bpm: 125, duration: 235, notes: 'Open with main riff' },
            { id: 2, title: 'Wonderwall', artist: 'Oasis', key: 'Em', bpm: 87, duration: 258, notes: 'Acoustic intro' },
            { id: 3, title: 'Bohemian Rhapsody', artist: 'Queen', key: 'Bb', bpm: 72, duration: 354, notes: 'Piano solo section' },
          ],
        },
      ]
    } catch {
      return [
        {
          id: 1,
          name: 'Friday Night Gig',
          date: new Date().toISOString().split('T')[0],
          venue: 'The Blue Note',
          created: new Date().toISOString(),
          songs: [
            { id: 1, title: 'Sweet Child o\' Mine', artist: 'Guns N\' Roses', key: 'D', bpm: 125, duration: 235, notes: 'Open with main riff' },
            { id: 2, title: 'Wonderwall', artist: 'Oasis', key: 'Em', bpm: 87, duration: 258, notes: 'Acoustic intro' },
            { id: 3, title: 'Bohemian Rhapsody', artist: 'Queen', key: 'Bb', bpm: 72, duration: 354, notes: 'Piano solo section' },
          ],
        },
      ]
    }
  })
  const [activeSetlistId, setActiveSetlistId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'performance'>('list')
  const [newSetlistName, setNewSetlistName] = useState('')
  const [newSong, setNewSong] = useState({ title: '', artist: '', key: 'C', bpm: 120, duration: 180, notes: '' })
  const [editingSongId, setEditingSongId] = useState<number | null>(null)

  useEffect(() => {
    try { localStorage.setItem('4lltools:setlist-manager', JSON.stringify(setlists)) } catch {}
  }, [setlists])

  const activeSetlist = setlists.find(s => s.id === activeSetlistId)

  const createSetlist = () => {
    if (!newSetlistName.trim()) return
    const sl: Setlist = {
      id: Date.now(),
      name: newSetlistName,
      date: new Date().toISOString().split('T')[0],
      venue: '',
      songs: [],
      created: new Date().toISOString(),
    }
    setSetlists([...setlists, sl])
    setActiveSetlistId(sl.id)
    setViewMode('editor')
    setNewSetlistName('')
  }

  const deleteSetlist = (id: number) => {
    setSetlists(setlists.filter(s => s.id !== id))
    if (activeSetlistId === id) setActiveSetlistId(null)
  }

  const addSong = () => {
    if (!activeSetlist || !newSong.title.trim()) return
    setSetlists(setlists.map(s => s.id === activeSetlistId ? {
      ...s, songs: [...s.songs, { ...newSong, id: Date.now() }]
    } : s))
    setNewSong({ title: '', artist: '', key: 'C', bpm: 120, duration: 180, notes: '' })
  }

  const removeSong = (setlistId: number, songId: number) => {
    setSetlists(setlists.map(s => s.id === setlistId ? { ...s, songs: s.songs.filter(sg => sg.id !== songId) } : s))
  }

  const updateSong = (setlistId: number, songId: number, field: string, value: string | number) => {
    setSetlists(setlists.map(s => s.id === setlistId ? {
      ...s, songs: s.songs.map(sg => sg.id === songId ? { ...sg, [field]: value } : sg)
    } : s))
  }

  const moveSong = (setlistId: number, songId: number, direction: 'up' | 'down') => {
    setSetlists(setlists.map(s => {
      if (s.id !== setlistId) return s
      const idx = s.songs.findIndex(sg => sg.id === songId)
      if (idx === -1) return s
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= s.songs.length) return s
      const newSongs = [...s.songs]
      ;[newSongs[idx], newSongs[newIdx]] = [newSongs[newIdx], newSongs[idx]]
      return { ...s, songs: newSongs }
    }))
  }

  const totalDuration = activeSetlist?.songs.reduce((sum, s) => sum + s.duration, 0) || 0
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const exportSetlist = (setlist: Setlist) => {
    const lines = [
      `Setlist: ${setlist.name}`,
      `Date: ${setlist.date}`,
      `Venue: ${setlist.venue}`,
      `Total Duration: ${formatTime(setlist.songs.reduce((sum, s) => sum + s.duration, 0))}`,
      '',
      ...setlist.songs.map((s, i) => `${i + 1}. ${s.title} - ${s.artist} (${s.key}, ${s.bpm} BPM, ${formatTime(s.duration)})${s.notes ? ' - ' + s.notes : ''}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${setlist.name.replace(/\s+/g, '-')}-setlist.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (viewMode === 'list') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Setlist Manager</h3>
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="New setlist name" value={newSetlistName} onChange={e => setNewSetlistName(e.target.value)} style={{ width: 200 }} />
            <button className="btn" onClick={createSetlist}>Create Setlist</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {setlists.map((setlist, i) => (
            <div key={setlist.id} className="pop-row" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 60}ms`,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{setlist.name}</div>
                <div className="muted" style={{ fontSize: '0.85rem', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>{setlist.date}</span>
                  <span>{setlist.venue || 'No venue'}</span>
                  <span>{setlist.songs.length} songs</span>
                  <span>{formatTime(setlist.songs.reduce((sum, s) => sum + s.duration, 0))}</span>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={() => { setActiveSetlistId(setlist.id); setViewMode('performance') }}>Perform</button>
                <button className="btn" onClick={() => { setActiveSetlistId(setlist.id); setViewMode('editor') }}>Edit</button>
                <button className="btn" onClick={() => exportSetlist(setlist)}>Export</button>
                <button className="btn" onClick={() => deleteSetlist(setlist.id)} style={{ color: 'var(--danger)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Create setlists for gigs. Add songs with key, BPM, duration, and notes. Performance mode shows large text for stage visibility.
        </p>
      </div>
    )
  }

  if (viewMode === 'editor') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn" onClick={() => setViewMode('list')}>← Back to Setlists</button>
          <h3 style={{ margin: 0 }}>{activeSetlist?.name}</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => { setActiveSetlistId(activeSetlist!.id); setViewMode('performance') }}>Performance Mode</button>
            <button className="btn" onClick={() => exportSetlist(activeSetlist!)}>Export</button>
          </div>
        </div>

        <div style={{ marginBottom: 16, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Setlist Info</h4>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Date</span>
              <input type="date" value={activeSetlist?.date || ''} onChange={e => setSetlists(setlists.map(s => s.id === activeSetlistId ? { ...s, date: e.target.value } : s))} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Venue</span>
              <input type="text" value={activeSetlist?.venue || ''} onChange={e => setSetlists(setlists.map(s => s.id === activeSetlistId ? { ...s, venue: e.target.value } : s))} placeholder="Venue name" />
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 16, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Add New Song</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" placeholder="Title" value={newSong.title} onChange={e => setNewSong({ ...newSong, title: e.target.value })} style={{ flex: 1 }} />
              <input type="text" placeholder="Artist" value={newSong.artist} onChange={e => setNewSong({ ...newSong, artist: e.target.value })} style={{ flex: 1 }} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" placeholder="Key (e.g., C, Am, F#m)" value={newSong.key} onChange={e => setNewSong({ ...newSong, key: e.target.value })} style={{ width: 100 }} />
              <input type="number" min={30} max={300} placeholder="BPM" value={newSong.bpm} onChange={e => setNewSong({ ...newSong, bpm: Number(e.target.value) })} style={{ width: 100 }} />
              <input type="number" min={1} max={600} placeholder="Duration (seconds)" value={newSong.duration} onChange={e => setNewSong({ ...newSong, duration: Number(e.target.value) })} style={{ width: 150 }} />
            </div>
            <textarea placeholder="Notes (capo, tuning, cues, etc.)" value={newSong.notes} onChange={e => setNewSong({ ...newSong, notes: e.target.value })} rows={2} style={{ width: '100%' }} />
            <button className="btn" onClick={addSong} style={{ justifySelf: 'start' }}>Add Song</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {activeSetlist?.songs.map((song, i) => (
            <details key={song.id} defaultOpen={editingSongId === song.id} style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <summary style={{ padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 12, alignItems: 'center', flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', minWidth: 40 }}>{i + 1}.</span>
                  <input type="text" value={song.title} onChange={e => updateSong(activeSetlistId!, song.id, 'title', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '1rem', minWidth: 200 }} />
                  <span className="muted" style={{ fontSize: '0.9rem' }}>{song.artist}</span>
                  <span style={{ fontFamily: 'var(--mono)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 4, fontSize: '0.85rem' }}>{song.key}</span>
                  <span className="muted">{song.bpm} BPM</span>
                  <span className="muted">{formatTime(song.duration)}</span>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn" onClick={() => moveSong(activeSetlistId!, song.id, 'up')} disabled={i === 0} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>↑</button>
                  <button className="btn" onClick={() => moveSong(activeSetlistId!, song.id, 'down')} disabled={i === (activeSetlist?.songs.length || 1) - 1} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>↓</button>
                  <button className="btn" onClick={() => setEditingSongId(editingSongId === song.id ? null : song.id)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>{editingSongId === song.id ? 'Hide' : 'Edit'}</button>
                  <button className="btn" onClick={() => removeSong(activeSetlistId!, song.id)} style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}>Delete</button>
                </div>
              </summary>
              {editingSongId === song.id && (
                <div style={{ padding: 16, display: 'grid', gap: 12 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <input type="text" value={song.title} onChange={e => updateSong(activeSetlistId!, song.id, 'title', e.target.value)} placeholder="Title" style={{ flex: 1 }} />
                    <input type="text" value={song.artist} onChange={e => updateSong(activeSetlistId!, song.id, 'artist', e.target.value)} placeholder="Artist" style={{ flex: 1 }} />
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <input type="text" value={song.key} onChange={e => updateSong(activeSetlistId!, song.id, 'key', e.target.value)} placeholder="Key" style={{ width: 100 }} />
                    <input type="number" min={30} max={300} value={song.bpm} onChange={e => updateSong(activeSetlistId!, song.id, 'bpm', Number(e.target.value))} placeholder="BPM" style={{ width: 100 }} />
                    <input type="number" min={1} max={600} value={song.duration} onChange={e => updateSong(activeSetlistId!, song.id, 'duration', Number(e.target.value))} placeholder="Duration (sec)" style={{ width: 150 }} />
                  </div>
                  <textarea value={song.notes} onChange={e => updateSong(activeSetlistId!, song.id, 'notes', e.target.value)} placeholder="Notes" rows={2} style={{ width: '100%' }} />
                </div>
              )}
            </details>
          ))}
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600 }}>Total Duration: </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                {formatTime(activeSetlist?.songs.reduce((sum, s) => sum + s.duration, 0) || 0)}
              </span>
            </div>
            <div className="muted">
              {activeSetlist?.songs.length || 0} songs
            </div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Drag not implemented - use ↑/↓ buttons to reorder. Edit songs inline. Export as text file for band members.
        </p>
      </div>
    )
  }

  if (viewMode === 'performance') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, background: 'var(--sunken)', borderBottom: '1px solid var(--border)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '2rem' }}>{activeSetlist?.name}</h2>
            <button className="btn" onClick={() => setViewMode('editor')}>Exit Performance</button>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>{activeSetlist?.date} • {activeSetlist?.venue} • {activeSetlist?.songs.length} songs • {formatTime(totalDuration)}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {activeSetlist?.songs.map((song, i) => (
            <div key={song.id} style={{
              padding: 24, marginBottom: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              borderLeft: `8px solid ${i % 2 === 0 ? 'var(--accent)' : 'var(--ok)'}`,
            }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{i + 1}. {song.title}</div>
                  <div style={{ fontSize: '1.2rem', color: 'var(--muted)', marginTop: 4 }}>{song.artist}</div>
                </div>
                <div className="row" style={{ gap: 24, alignItems: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)', background: 'var(--bg)', padding: '8px 16px', borderRadius: 8 }}>
                    {song.key}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--ok)' }}>
                    {song.bpm} BPM
                  </div>
                  <div style={{ fontSize: '1.5rem', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                    {formatTime(song.duration)}
                  </div>
                </div>
              </div>
              {song.notes && (
                <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--accent)' }}>
                  <div style={{ fontSize: '1.1rem', lineHeight: 1.6 }}>{song.notes}</div>
                </div>
              )}
            </div>
          ))}
          {activeSetlist?.songs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎵</div>
              <h3>No songs in this setlist</h3>
              <p>Go to Editor mode to add songs</p>
            </div>
          )}
        </div>

        <div style={{ padding: 16, background: 'var(--sunken)', borderTop: '1px solid var(--border)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
              Total: {formatTime(totalDuration)}
            </div>
            <button className="btn" onClick={() => setViewMode('editor')}>Exit Performance Mode</button>
          </div>
        </div>
      </div>
    )
  }

  return null
}