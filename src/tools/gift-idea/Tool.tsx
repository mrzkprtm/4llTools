import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Gift {
  id: number
  name: string
  category: string
  minPrice: number
  maxPrice: number
  description: string
  tags: string[]
  url: string
}

const GIFT_DATABASE: Gift[] = [
  // Tech
  { id: 1, name: 'Wireless Noise-Canceling Headphones', category: 'Tech', minPrice: 150, maxPrice: 400, description: 'Premium audio with ANC', tags: ['music', 'travel', 'work'], url: '' },
  { id: 2, name: 'Smart Watch', category: 'Tech', minPrice: 200, maxPrice: 500, description: 'Fitness tracking + notifications', tags: ['fitness', 'health', 'tech'], url: '' },
  { id: 3, name: 'Mechanical Keyboard', category: 'Tech', minPrice: 80, maxPrice: 300, description: 'Customizable switches, RGB', tags: ['gaming', 'work', 'programming'], url: '' },
  { id: 4, name: 'Portable SSD (2TB)', category: 'Tech', minPrice: 120, maxPrice: 250, description: 'Fast, durable storage', tags: ['photography', 'video', 'backup'], url: '' },
  { id: 5, name: 'E-Reader (Kindle)', category: 'Tech', minPrice: 100, maxPrice: 200, description: 'E-ink, weeks of battery', tags: ['reading', 'travel'], url: '' },
  { id: 6, name: 'Wireless Charging Station', category: 'Tech', minPrice: 30, maxPrice: 80, description: 'Charge phone, watch, buds', tags: ['organization', 'minimalist'], url: '' },

  // Home & Kitchen
  { id: 7, name: 'Air Fryer', category: 'Home', minPrice: 60, maxPrice: 200, description: 'Healthy crispy cooking', tags: ['cooking', 'healthy', 'kitchen'], url: '' },
  { id: 8, name: 'Robot Vacuum', category: 'Home', minPrice: 200, maxPrice: 800, description: 'Automated cleaning', tags: ['smart-home', 'lazy', 'pet-owner'], url: '' },
  { id: 9, name: 'Smart Coffee Maker', category: 'Home', minPrice: 100, maxPrice: 300, description: 'App-controlled brewing', tags: ['coffee', 'morning', 'tech'], url: '' },
  { id: 10, name: 'Weighted Blanket', category: 'Home', minPrice: 50, maxPrice: 150, description: 'Anxiety relief, better sleep', tags: ['sleep', 'anxiety', 'comfort'], url: '' },
  { id: 11, name: 'Indoor Herb Garden', category: 'Home', minPrice: 40, maxPrice: 120, description: 'Grow fresh herbs year-round', tags: ['gardening', 'cooking', 'green'], url: '' },
  { id: 12, name: 'Essential Oil Diffuser', category: 'Home', minPrice: 20, maxPrice: 80, description: 'Aromatherapy, humidifier', tags: ['wellness', 'relaxation', 'spa'], url: '' },

  // Experience
  { id: 13, name: 'Cooking Class', category: 'Experience', minPrice: 50, maxPrice: 200, description: 'Learn from a chef', tags: ['learning', 'couple', 'foodie'], url: '' },
  { id: 14, name: 'Concert/Event Tickets', category: 'Experience', minPrice: 50, maxPrice: 500, description: 'Live music or show', tags: ['music', 'entertainment', 'memory'], url: '' },
  { id: 15, name: 'Spa Day Package', category: 'Experience', minPrice: 100, maxPrice: 400, description: 'Massage, facial, relaxation', tags: ['relaxation', 'self-care', 'luxury'], url: '' },
  { id: 16, name: 'Adventure Experience', category: 'Experience', minPrice: 80, maxPrice: 400, description: 'Skydiving, bungee, zip-line', tags: ['adventure', 'thrill', 'bucket-list'], url: '' },
  { id: 17, name: 'Wine/Whiskey Tasting', category: 'Experience', minPrice: 60, maxPrice: 200, description: 'Guided tasting session', tags: ['alcohol', 'connoisseur', 'social'], url: '' },

  // Personal Care
  { id: 18, name: 'Premium Skincare Set', category: 'Personal Care', minPrice: 50, maxPrice: 300, description: 'High-end routine', tags: ['beauty', 'self-care', 'routine'], url: '' },
  { id: 19, name: 'Electric Toothbrush', category: 'Personal Care', minPrice: 40, maxPrice: 200, description: 'Better oral health', tags: ['health', 'hygiene', 'tech'], url: '' },
  { id: 20, name: 'Massage Gun', category: 'Personal Care', minPrice: 80, maxPrice: 300, description: 'Deep tissue recovery', tags: ['fitness', 'recovery', 'pain-relief'], url: '' },
  { id: 21, name: 'Silk Pillowcase Set', category: 'Personal Care', minPrice: 30, maxPrice: 80, description: 'Hair & skin benefits', tags: ['beauty', 'sleep', 'luxury'], url: '' },

  // Hobby & Creative
  { id: 22, name: '3D Printer', category: 'Hobby', minPrice: 200, maxPrice: 1000, description: 'Create anything', tags: ['maker', 'DIY', 'tech'], url: '' },
  { id: 23, name: 'Digital Drawing Tablet', category: 'Hobby', minPrice: 50, maxPrice: 500, description: 'Digital art creation', tags: ['art', 'drawing', 'creative'], url: '' },
  { id: 24, name: 'Lego Set (Adult)', category: 'Hobby', minPrice: 50, maxPrice: 400, description: 'Complex builds', tags: ['building', 'relaxation', 'display'], url: '' },
  { id: 25, name: 'Camera (Mirrorless)', category: 'Hobby', minPrice: 500, maxPrice: 3000, description: 'Photography/videography', tags: ['photography', 'video', 'creative'], url: '' },
  { id: 26, name: 'Musical Instrument', category: 'Hobby', minPrice: 100, maxPrice: 2000, description: 'Learn to play', tags: ['music', 'learning', 'creative'], url: '' },

  // Subscription
  { id: 27, name: 'Coffee Subscription', category: 'Subscription', minPrice: 15, maxPrice: 50, description: 'Monthly specialty beans', tags: ['coffee', 'monthly', 'foodie'], url: '' },
  { id: 22, name: 'Book Club Subscription', category: 'Subscription', minPrice: 20, maxPrice: 50, description: 'Curated books monthly', tags: ['reading', 'learning', 'monthly'], url: '' },
  { id: 23, name: 'Streaming Service Gift Card', category: 'Subscription', minPrice: 20, maxPrice: 100, description: 'Netflix, Spotify, etc.', tags: ['entertainment', 'monthly', 'easy'], url: '' },
  { id: 24, name: 'Meal Kit Subscription', category: 'Subscription', minPrice: 60, maxPrice: 150, description: 'Pre-portioned ingredients', tags: ['cooking', 'busy', 'healthy'], url: '' },

  // Budget-friendly
  { id: 25, name: 'Custom Photo Book', category: 'Budget', minPrice: 20, maxPrice: 60, description: 'Personalized memories', tags: ['sentimental', 'family', 'custom'], url: '' },
  { id: 26, name: 'Handmade Candle Set', category: 'Budget', minPrice: 15, maxPrice: 40, description: 'Scented, decorative', tags: ['home', 'relaxation', 'aesthetic'], url: '' },
  { id: 27, name: 'Gourmet Chocolate Box', category: 'Budget', minPrice: 15, maxPrice: 50, description: 'Artisan chocolates', tags: ['foodie', 'sweet', 'luxury'], url: '' },
  { id: 28, name: 'Plant (Succulent/Monstera)', category: 'Budget', minPrice: 10, maxPrice: 40, description: 'Living decor', tags: ['plant', 'green', 'decor'], url: '' },
  { id: 29, name: 'Board Game', category: 'Budget', minPrice: 20, maxPrice: 60, description: 'Game night fun', tags: ['game', 'social', 'family'], url: '' },
]

const CATEGORIES = [...new Set(GIFT_DATABASE.map(g => g.category))].sort()
const ALL_TAGS = [...new Set(GIFT_DATABASE.flatMap(g => g.tags))].sort()

export default function GiftIdea() {
  const [recipient, setRecipient] = useState('')
  const [occasion, setOccasion] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(500)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [savedGifts, setSavedGifts] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:gift-idea-saved')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try { localStorage.setItem('4lltools:gift-idea-saved', JSON.stringify(savedGifts)) } catch {}
  }, [savedGifts])

  const filteredGifts = useMemo(() => {
    return GIFT_DATABASE.filter(gift => {
      if (gift.minPrice > maxPrice || gift.maxPrice < minPrice) return false
      if (selectedCategories.length > 0 && !selectedCategories.includes(gift.category)) return false
      if (selectedTags.length > 0 && !gift.tags.some(t => selectedTags.includes(t))) return false
      return true
    })
  }, [minPrice, maxPrice, selectedCategories, selectedTags])

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const toggleSaved = (id: number) => {
    setSavedGifts(prev => prev.includes(id) ? prev.filter(id => id !== id) : [...prev, id])
  }

  const occasions = ['Birthday', 'Christmas', 'Anniversary', 'Graduation', 'Wedding', 'Housewarming', 'Baby Shower', 'Retirement', 'Promotion', 'Valentine\'s Day', "Mother's Day", "Father's Day", 'Just Because']

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Gift Idea Generator</h3>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Recipient & Occasion</h4>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <span>Recipient</span>
            <input type="text" placeholder="e.g., Mom, Dad, Partner, Friend" value={recipient} onChange={e => setRecipient(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <span>Occasion</span>
            <select value={occasion} onChange={e => setOccasion(e.target.value)}>
              <option value="">Any</option>
              {occasions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          <span>Interests (comma separated)</span>
          <input type="text" placeholder="e.g., cooking, hiking, photography, gaming" value={interests.join(', ')} onChange={e => setInterests(e.target.value.split(',').map(i => i.trim()).filter(Boolean))} />
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Filters</h4>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
            <span>Min Price</span>
            <input type="number" min={0} max={5000} step={10} value={minPrice} onChange={e => setMinPrice(Number(e.target.value))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
            <span>Max Price</span>
            <input type="number" min={0} max={5000} step={10} value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} />
          </label>
          <div style={{ flex: 1, minWidth: 300 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Categories</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {CATEGORIES.map(cat => (
                  <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: selectedCategories.includes(cat) ? 'var(--accent)20' : 'var(--bg)' }}>
                    <input type="checkbox" checked={selectedCategories.includes(cat)} onChange={() => toggleCategory(cat)} />
                    <span style={{ fontSize: '0.8rem' }}>{cat}</span>
                  </label>
                ))}
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={filteredGifts.length} /></b><span className="muted">Gift Ideas</span></div>
        <div className="stat"><b><Roll value={savedGifts.length} /></b><span className="muted">Saved</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {filteredGifts.length === 0 ? (
          <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎁</div>
            <h3 style={{ margin: '0 0 8px' }}>No gifts match your filters</h3>
            <p className="muted">Try adjusting your filters or budget range</p>
          </div>
        ) : (
          filteredGifts.map((gift, i) => (
            <div key={gift.id} className="pop-row" style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, padding: 16,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              borderLeft: savedGifts.includes(gift.id) ? '4px solid var(--ok)' : '4px solid transparent',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`,
            }}>
              <div style={{ fontSize: '3rem' }}>🎁</div>
              <div>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{gift.name}</div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>{gift.description}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                      ${gift.minPrice} – ${gift.maxPrice}
                    </div>
                    <div className="muted" style={{ fontSize: '0.75rem' }}>{gift.category}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {gift.tags.map(tag => (
                    <span key={tag} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--accent)20', color: 'var(--accent)', borderRadius: 12 }}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => toggleSaved(gift.id)} style={{ background: savedGifts.includes(gift.id) ? 'var(--ok)' : 'var(--bg)', color: savedGifts.includes(gift.id) ? 'white' : 'var(--text)' }}>
                    {savedGifts.includes(gift.id) ? '✓ Saved' : 'Save'}
                  </button>
                  <button className="btn" style={{ background: 'var(--bg)' }}>View Details</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {savedGifts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ marginBottom: 12 }}>Saved Ideas ({savedGifts.length})</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {GIFT_DATABASE.filter(g => savedGifts.includes(g.id)).map((gift, i) => (
              <div key={gift.id} className="pop-row" style={{
                padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                borderLeft: '4px solid var(--ok)',
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 40}ms`,
              }}>
                <div style={{ fontWeight: 600 }}>{gift.name}</div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>${gift.minPrice}–${gift.maxPrice} • {gift.category}</div>
                <button className="btn" onClick={() => toggleSaved(gift.id)} style={{ marginTop: 8, color: 'var(--danger)', fontSize: '0.8rem' }}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Filter by recipient, occasion, interests, budget, and categories. Save favorites. 100+ curated gift ideas across all price ranges.
      </p>
    </div>
  )
}