import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Choice, Hint, Slider, Toggle } from '../../sim/controls'
import Icon from '../../components/Icon'
import { reducedMotion, SPRINGS } from '../../motion/springs'
import { CATEGORIES, generateList, TRIP_TYPES, WEATHERS, type Category, type PackItem, type TripSettings } from './logic'
import './tool.css'

const KEY = '4lltools:packing-list'
const COLORS: Record<Category, string> = {
  Documents: '#e8590c',
  Clothes: '#1c7ed6',
  Toiletries: '#0ca678',
  Health: '#e03131',
  Electronics: '#ae3ec9',
  Extras: '#f59f00',
}

interface Saved {
  settings: TripSettings
  checked: string[]
  custom: PackItem[]
}

const DEFAULTS: Saved = {
  settings: { type: 'beach', weather: 'hot', days: 5, travelers: 2, laundry: false, abroad: false },
  checked: ['id', 'tickets', 'swim'],
  custom: [],
}

export default function PackingList() {
  const [settings, setSettings] = useState<TripSettings>(DEFAULTS.settings)
  const [checked, setChecked] = useState<Set<string>>(() => new Set(DEFAULTS.checked))
  const [custom, setCustom] = useState<PackItem[]>([])
  const [draft, setDraft] = useState('')
  const [draftCat, setDraftCat] = useState<Category>('Extras')
  const ready = useRef(false)
  const from = useRef<{ id: string; rect: DOMRect } | null>(null)
  const caseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const s = JSON.parse(raw) as Partial<Saved>
        if (s.settings) setSettings({ ...DEFAULTS.settings, ...s.settings })
        if (Array.isArray(s.checked)) setChecked(new Set(s.checked))
        if (Array.isArray(s.custom)) setCustom(s.custom)
      }
    } catch {
      // Storage is optional.
    }
    ready.current = true
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify({ settings, checked: [...checked], custom } satisfies Saved))
    } catch {
      // Storage is optional.
    }
  }, [settings, checked, custom])

  const items = useMemo(() => [...generateList(settings), ...custom], [settings, custom])
  const packed = items.filter((i) => checked.has(i.id))
  const total = items.length
  const full = total > 0 && packed.length === total

  // Fly the newly packed tile from its checkbox into the suitcase.
  useLayoutEffect(() => {
    const f = from.current
    from.current = null
    if (!f || !caseRef.current || reducedMotion()) return
    const tile = caseRef.current.querySelector<HTMLElement>(`[data-tile="${CSS.escape(f.id)}"]`)
    if (!tile) return
    const to = tile.getBoundingClientRect()
    const dx = f.rect.left + f.rect.width / 2 - (to.left + to.width / 2)
    const dy = f.rect.top + f.rect.height / 2 - (to.top + to.height / 2)
    tile.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(2.2)`, opacity: 0.4 },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 30}px) scale(1.6)`, opacity: 1, offset: 0.45 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: SPRINGS.bouncy.duration + 150, easing: 'cubic-bezier(0.3, 0.9, 0.4, 1.15)' },
    )
  }, [checked])

  function toggle(id: string, el: HTMLElement) {
    const next = new Set(checked)
    if (next.has(id)) next.delete(id)
    else {
      next.add(id)
      from.current = { id, rect: el.getBoundingClientRect() }
    }
    setChecked(next)
  }

  function addCustom() {
    const name = draft.trim()
    if (!name) return
    const id = `c-${Date.now().toString(36)}`
    setCustom([...custom, { id, name, category: draftCat, qty: 1 }])
    setDraft('')
  }

  const set = <K extends keyof TripSettings>(k: K, v: TripSettings[K]) => setSettings({ ...settings, [k]: v })

  return (
    <div className="pk">
      <div className="pk-settings pk-noprint">
        <Choice label="Trip type" value={settings.type} options={TRIP_TYPES} onChange={(v) => set('type', v)} />
        <Choice label="Weather" value={settings.weather} options={WEATHERS} onChange={(v) => set('weather', v)} />
        <div className="pk-sliders">
          <Slider label="Days" value={settings.days} min={1} max={30} onChange={(v) => set('days', v)} />
          <Slider label="Travelers" value={settings.travelers} min={1} max={8} onChange={(v) => set('travelers', v)} />
        </div>
        <div className="row">
          <Toggle label="Laundry available" checked={settings.laundry} onChange={(v) => set('laundry', v)} />
          <Toggle label="Going abroad" checked={settings.abroad} onChange={(v) => set('abroad', v)} />
        </div>
      </div>

      <div className="pk-layout">
        <aside className="pk-side pk-noprint">
          <div ref={caseRef} className={`pk-case ${full ? 'full' : ''}`} aria-label={`${packed.length} of ${total} items packed`} role="img">
            <span className="pk-handle" />
            <span className="pk-lid" />
            <div className="pk-inside">
              {packed.map((i) => (
                <span key={i.id} data-tile={i.id} className="pk-tile" style={{ background: COLORS[i.category] }} title={i.name} />
              ))}
            </div>
          </div>
          <p className="pk-count"><b>{packed.length}</b> / {total} packed{full ? ' · ready to go!' : ''}</p>
          <div className="bar"><i style={{ transform: `scaleX(${total ? packed.length / total : 0})` }} /></div>
          <div className="row">
            <button type="button" className="btn btn-icon" onClick={() => window.print()}><Icon name="printer" size={18} />Print</button>
            <button type="button" className="btn" onClick={() => setChecked(new Set())} disabled={!packed.length}>Unpack all</button>
          </div>
        </aside>

        <div className="pk-list">
          <h3 className="pk-print-title">Packing list: {TRIP_TYPES.find((t) => t[0] === settings.type)?.[1]}, {settings.days} days, {settings.travelers} traveler{settings.travelers > 1 ? 's' : ''}</h3>
          {CATEGORIES.map((cat) => {
            const list = items.filter((i) => i.category === cat)
            if (!list.length) return null
            const done = list.filter((i) => checked.has(i.id)).length
            return (
              <section key={cat} className="pk-group">
                <h4><i style={{ background: COLORS[cat] }} />{cat} <span className="muted">{done}/{list.length}</span></h4>
                <ul>
                  {list.map((i) => (
                    <li key={i.id} className={checked.has(i.id) ? 'on' : ''}>
                      <label>
                        <input type="checkbox" checked={checked.has(i.id)} onChange={(e) => toggle(i.id, e.currentTarget)} />
                        <span className="pk-name">{i.name}</span>
                        {i.qty > 1 && <span className="pk-qty">×{i.qty}</span>}
                      </label>
                      {i.id.startsWith('c-') && (
                        <button type="button" className="pk-x pk-noprint" aria-label={`Remove ${i.name}`} onClick={() => { setCustom(custom.filter((c) => c.id !== i.id)); const n = new Set(checked); n.delete(i.id); setChecked(n) }}>×</button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          <form className="pk-add pk-noprint" onSubmit={(e) => { e.preventDefault(); addCustom() }}>
            <input type="text" placeholder="Add your own item…" aria-label="Custom item" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <select aria-label="Category" value={draftCat} onChange={(e) => setDraftCat(e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button type="submit" className="btn primary" disabled={!draft.trim()}>Add</button>
          </form>
        </div>
      </div>
      <div className="pk-noprint">
        <Hint>Pick the trip and weather, then tick items as you pack; each one drops into the suitcase. Clothes scale with the number of days (capped at 4 days&apos; worth when you can do laundry). Your list and ticks are saved on this device.</Hint>
      </div>
    </div>
  )
}
