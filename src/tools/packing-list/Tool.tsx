import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const BASE_ITEMS = [
  // Essentials
  { name: 'Passport / ID', category: 'essentials', base: true, conditions: [] },
  { name: 'Phone & Charger', category: 'essentials', base: true, conditions: [] },
  { name: 'Wallet (Cash, Cards)', category: 'essentials', base: true, conditions: [] },
  { name: 'Travel Insurance', category: 'essentials', base: true, conditions: [] },
  { name: 'Medications', category: 'essentials', base: false, conditions: [] },
  { name: 'Glasses / Contacts', category: 'essentials', base: false, conditions: [] },

  // Clothing - base
  { name: 'Underwear', category: 'clothing', base: true, conditions: [], qtyMultiplier: 'days' },
  { name: 'Socks', category: 'clothing', base: true, conditions: [], qtyMultiplier: 'days' },
  { name: 'T-shirts / Tops', category: 'clothing', base: true, conditions: [], qtyMultiplier: 'days' },
  { name: 'Pants / Shorts', category: 'clothing', base: true, conditions: [], qtyMultiplier: 'daysHalf' },
  { name: 'Pajamas', category: 'clothing', base: true, conditions: [], qtyMultiplier: 'fixed2' },
  { name: 'Light Jacket', category: 'clothing', base: false, conditions: ['cold', 'rainy'] },
  { name: 'Heavy Coat', category: 'clothing', base: false, conditions: ['cold'] },
  { name: 'Rain Jacket / Umbrella', category: 'clothing', base: false, conditions: ['rainy'] },
  { name: 'Swimwear', category: 'clothing', base: false, conditions: ['beach', 'pool'] },
  { name: 'Formal Wear', category: 'clothing', base: false, conditions: ['formal'] },
  { name: 'Hiking Boots', category: 'clothing', base: false, conditions: ['hiking'] },
  { name: 'Sandals / Flip-flops', category: 'clothing', base: false, conditions: ['beach', 'hot'] },

  // Toiletries
  { name: 'Toothbrush & Toothpaste', category: 'toiletries', base: true, conditions: [] },
  { name: 'Deodorant', category: 'toiletries', base: true, conditions: [] },
  { name: 'Shampoo & Conditioner', category: 'toiletries', base: false, conditions: [] },
  { name: 'Body Wash / Soap', category: 'toiletries', base: false, conditions: [] },
  { name: 'Skincare', category: 'toiletries', base: false, conditions: [] },
  { name: 'Razor', category: 'toiletries', base: false, conditions: [] },
  { name: 'Hairbrush / Comb', category: 'toiletries', base: false, conditions: [] },
  { name: 'Sunscreen', category: 'toiletries', base: false, conditions: ['hot', 'beach', 'outdoor'] },
  { name: 'Hand Sanitizer', category: 'toiletries', base: false, conditions: [] },
  { name: 'Wet Wipes', category: 'toiletries', base: false, conditions: [] },

  // Electronics
  { name: 'Power Bank', category: 'electronics', base: true, conditions: [] },
  { name: 'Universal Adapter', category: 'electronics', base: false, conditions: ['international'] },
  { name: 'Camera', category: 'electronics', base: false, conditions: ['photography'] },
  { name: 'Headphones', category: 'electronics', base: false, conditions: [] },
  { name: 'Laptop / Tablet', category: 'electronics', base: false, conditions: ['work'] },
  { name: 'E-reader', category: 'electronics', base: false, conditions: ['reading'] },

  // Health & Safety
  { name: 'First Aid Kit', category: 'health', base: false, conditions: ['hiking', 'outdoor'] },
  { name: 'Insect Repellent', category: 'health', base: false, conditions: ['tropical', 'outdoor'] },
  { name: 'Motion Sickness Meds', category: 'health', base: false, conditions: ['boat', 'car'] },
  { name: 'Masks', category: 'health', base: false, conditions: [] },

  // Documents
  { name: 'Boarding Passes / Tickets', category: 'documents', base: true, conditions: [] },
  { name: 'Hotel Reservations', category: 'documents', base: true, conditions: [] },
  { name: 'Emergency Contacts', category: 'documents', base: false, conditions: [] },
  { name: 'Visa Documents', category: 'documents', base: false, conditions: ['international'] },

  // Misc
  { name: 'Reusable Water Bottle', category: 'misc', base: false, conditions: [] },
  { name: 'Snacks', category: 'misc', base: false, conditions: [] },
  { name: 'Book / Kindle', category: 'misc', base: false, conditions: ['reading'] },
  { name: 'Travel Pillow', category: 'misc', base: false, conditions: ['long-flight'] },
  { name: 'Eye Mask', category: 'misc', base: false, conditions: ['long-flight'] },
  { name: 'Earplugs', category: 'misc', base: false, conditions: ['long-flight'] },
  { name: 'Backpack / Daypack', category: 'misc', base: false, conditions: [] },
  { name: 'Ziplock Bags', category: 'misc', base: false, conditions: [] },
  { name: 'Laundry Bag', category: 'misc', base: false, conditions: [] },
]

const CATEGORIES = [
  { id: 'essentials', name: 'Essentials', icon: '⭐' },
  { id: 'clothing', name: 'Clothing', icon: '👕' },
  { id: 'toiletries', name: 'Toiletries', icon: '🧴' },
  { id: 'electronics', name: 'Electronics', icon: '📱' },
  { id: 'health', name: 'Health & Safety', icon: '🩹' },
  { id: 'documents', name: 'Documents', icon: '📄' },
  { id: 'misc', name: 'Miscellaneous', icon: '📦' },
]

export default function PackingList() {
  const [days, setDays] = useState(() => {
    const saved = localStorage.getItem('packing-list-days')
    return saved ? Number(saved) : 7
  })
  const [tripType, setTripType] = useState(() => {
    const saved = localStorage.getItem('packing-list-type')
    return saved || 'leisure'
  })
  const [weather, setWeather] = useState(() => {
    const saved = localStorage.getItem('packing-list-weather')
    return saved || 'mild'
  })
  const [activities, setActivities] = useState(() => {
    const saved = localStorage.getItem('packing-list-activities')
    return saved ? JSON.parse(saved) : []
  })
  const [customItems, setCustomItems] = useState(() => {
    const saved = localStorage.getItem('packing-list-custom')
    return saved ? JSON.parse(saved) : []
  })
  const [packedItems, setPackedItems] = useState(() => {
    const saved = localStorage.getItem('packing-list-packed')
    return saved ? JSON.parse(saved) : {}
  })

  useEffect(() => { try { localStorage.setItem('packing-list-days', String(days)) } catch {} }, [days])
  useEffect(() => { try { localStorage.setItem('packing-list-type', tripType) } catch {} }, [tripType])
  useEffect(() => { try { localStorage.setItem('packing-list-weather', weather) } catch {} }, [weather])
  useEffect(() => { try { localStorage.setItem('packing-list-activities', JSON.stringify(activities)) } catch {} }, [activities])
  useEffect(() => { try { localStorage.setItem('packing-list-custom', JSON.stringify(customItems)) } catch {} }, [customItems])
  useEffect(() => { try { localStorage.setItem('packing-list-packed', JSON.stringify(packedItems)) } catch {} }, [packedItems])

  const activeConditions = useMemo(() => {
    const conds = new Set<string>()
    if (weather === 'cold') conds.add('cold')
    if (weather === 'hot') conds.add('hot')
    if (weather === 'rainy') conds.add('rainy')
    if (weather === 'mild') conds.add('mild')
    if (tripType === 'international') conds.add('international')
    if (tripType === 'beach') conds.add('beach')
    if (tripType === 'business') conds.add('formal')
    if (tripType === 'adventure') conds.add('hiking')
    if (tripType === 'leisure') { conds.add('beach'); conds.add('pool') }
    activities.forEach(a => conds.add(a))
    if (days > 10) conds.add('long-flight')
    return conds
  }, [days, tripType, weather, activities])

  const getQty = (item: typeof BASE_ITEMS[0]) => {
    if (!item.qtyMultiplier) return 1
    switch (item.qtyMultiplier) {
      case 'days': return days
      case 'daysHalf': return Math.ceil(days / 2)
      case 'fixed2': return 2
      default: return 1
    }
  }

  const shouldInclude = (item: typeof BASE_ITEMS[0]) => {
    if (item.base) return true
    return item.conditions.some(c => activeConditions.has(c))
  }

  const groupedItems = useMemo(() => {
    const groups: Record<string, Array<{ item: typeof BASE_ITEMS[0]; qty: number; key: string }>> = {}
    BASE_ITEMS.filter(shouldInclude).forEach(item => {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push({ item, qty: getQty(item), key: `base-${item.name}` })
    })
    customItems.forEach((ci: any, i: number) => {
      if (!groups[ci.category]) groups[ci.category] = []
      groups[ci.category].push({ item: ci, qty: ci.qty || 1, key: `custom-${i}` })
    })
    return groups
  }, [activeConditions, customItems])

  const togglePacked = (key: string) => {
    setPackedItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const addCustomItem = () => {
    setCustomItems([...customItems, { name: '', category: 'misc', qty: 1 }])
  }

  const removeCustomItem = (index: number) => {
    setCustomItems(customItems.filter((_, i) => i !== index))
  }

  const updateCustomItem = (index: number, field: string, value: string | number) => {
    setCustomItems(customItems.map((ci, i) => i === index ? { ...ci, [field]: value } : ci))
  }

  const totalItems = Object.values(groupedItems).flat().length
  const packedCount = Object.values(groupedItems).flat().filter(i => packedItems[i.key]).length

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Packing List Generator</h3>
        <div className="stat"><b><Roll value={packedCount} /></b><span className="muted">/ {totalItems} packed</span></div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Trip Duration (days)</span>
          <input type="number" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Trip Type</span>
          <select value={tripType} onChange={e => setTripType(e.target.value)}>
            <option value="leisure">Leisure</option>
            <option value="business">Business</option>
            <option value="adventure">Adventure</option>
            <option value="beach">Beach</option>
            <option value="international">International</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Weather</span>
          <select value={weather} onChange={e => setWeather(e.target.value)}>
            <option value="hot">Hot</option>
            <option value="mild">Mild</option>
            <option value="cold">Cold</option>
            <option value="rainy">Rainy</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Activities</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {['hiking', 'beach', 'pool', 'photography', 'reading', 'work', 'formal', 'outdoor', 'tropical', 'boat', 'car'].map(a => (
              <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', background: 'var(--bg)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
                <input type="checkbox" checked={activities.includes(a)} onChange={e => setActivities(e.target.checked ? [...activities, a] : activities.filter(x => x !== a))} />
                {a}
              </label>
            ))}
          </div>
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Custom Items
          <button className="btn" onClick={addCustomItem} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>+ Add</button>
        </h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {customItems.map((ci: any, i) => (
            <div key={i} className="pop-row" style={{
              display: 'grid', gap: 8, padding: 10,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              gridTemplateColumns: '1fr 100px 80px auto',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 30}ms`,
            }}>
              <input type="text" placeholder="Item name" value={ci.name} onChange={e => updateCustomItem(i, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
              <select value={ci.category} onChange={e => updateCustomItem(i, 'category', e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <input type="number" min={1} value={ci.qty || 1} onChange={e => updateCustomItem(i, 'qty', Number(e.target.value))} style={{ width: 60 }} />
              <button className="btn" onClick={() => removeCustomItem(i)} style={{ color: 'var(--danger)', justifySelf: 'end' }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {CATEGORIES.map((cat, ci) => {
          const items = groupedItems[cat.id] || []
          if (items.length === 0) return null
          return (
            <details key={cat.id} defaultOpen style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <summary style={{ padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
                  <span style={{ fontWeight: 600 }}>{cat.name}</span>
                </div>
                <span className="muted">{items.length} items</span>
              </summary>
              <div style={{ padding: 12 }}>
                {items.map(({ item, qty, key }, i) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={packedItems[key]} onChange={() => togglePacked(key)} />
                    <span style={{ flex: 1, textDecoration: packedItems[key] ? 'line-through' : 'none', color: packedItems[key] ? 'var(--muted)' : 'var(--text)' }}>
                      {item.name} {qty > 1 && <span className="muted"> (×{qty})</span>}
                    </span>
                    {item.conditions.length > 0 && <span className="muted" style={{ fontSize: '0.7rem' }}>[{item.conditions.join(', ')}]</span>}
                  </label>
                ))}
              </div>
            </details>
          )
        })}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        List auto-generates based on trip details. Check items as you pack. Custom items supported. All data saved locally.
      </p>
    </div>
  )
}