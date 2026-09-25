import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'
import { breadcrumb, checkFields, generateTags, hostOf, lengthState, LIMITS, normalizeHandle, truncate, type LengthState, type MetaFields } from './tags'
import './tool.css'

const INITIAL: MetaFields = {
  title: 'Fresh Roast Coffee – Small-Batch Beans Delivered Weekly',
  description: 'Single-origin coffee roasted to order in Bandung and shipped within 48 hours. Choose a plan, pause anytime, and taste the difference fresh beans make.',
  url: 'https://freshroast.example.com/subscriptions',
  image: '',
  imageAlt: 'Bag of freshly roasted coffee beans next to a pour-over',
  siteName: 'Fresh Roast',
  twitterHandle: '@freshroast',
  twitterCard: 'summary_large_image',
  type: 'website',
  locale: 'en_US',
  themeColor: '#c2410c',
  author: '',
  index: true,
  follow: true,
}

type Preview = 'google' | 'facebook' | 'x' | 'whatsapp' | 'slack'
const PREVIEWS: { id: Preview; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'facebook', label: 'Facebook / LinkedIn' },
  { id: 'x', label: 'X' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'slack', label: 'Slack / Discord' },
]

const STATE_TEXT: Record<LengthState, string> = { empty: 'Empty', short: 'A bit short', good: 'Good length', long: 'Too long' }

function Counter({ text, limit }: { text: string; limit: { min: number; max: number } }) {
  const n = [...text.trim()].length
  const state = lengthState(text, limit)
  const ratio = Math.min(1, n / (limit.max * 1.25))
  const color = state === 'good' ? 'var(--ok)' : state === 'long' ? 'var(--danger)' : 'var(--accent)'
  return (
    <div className="og-counter" aria-live="polite">
      <div className="bar og-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${ratio})`, background: color }} />
        <span className="og-mark" style={{ left: `${(limit.max / (limit.max * 1.25)) * 100}%` }} />
      </div>
      <span className="og-count"><Roll>{String(n)}</Roll> / {limit.max}</span>
      <span key={state} className={`chip ${state === 'good' ? 'good' : state === 'long' ? 'bad' : ''} calm`}>{STATE_TEXT[state]}</span>
    </div>
  )
}

function Img({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState('')
  if (!src.trim() || failed === src) {
    return (
      <div className={`${className} og-noimg`} role="img" aria-label="No image">
        <span>{src.trim() ? 'Image could not load' : 'No og:image set'}</span>
      </div>
    )
  }
  return <img className={className} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)} />
}

export default function MetaTagGenerator() {
  const [f, setF] = useState<MetaFields>(INITIAL)
  const [preview, setPreview] = useState<Preview>('google')
  const set = <K extends keyof MetaFields>(k: K, v: MetaFields[K]) => setF((x) => ({ ...x, [k]: v }))

  const html = useMemo(() => generateTags(f), [f])
  const issues = useMemo(() => checkFields(f), [f])
  const host = hostOf(f.url) || 'example.com'
  const title = f.title.trim() || 'Page title'
  const desc = f.description.trim() || 'Your page description appears here.'
  const site = f.siteName.trim() || host

  const text = (id: keyof MetaFields, label: string, placeholder = '', type: 'text' | 'url' = 'text') => (
    <div>
      <label htmlFor={`og-${id}`}>{label}</label>
      <input id={`og-${id}`} type={type} value={f[id] as string} onChange={(e) => set(id, e.target.value as never)} placeholder={placeholder} />
    </div>
  )

  return (
    <div>
      <label htmlFor="og-title">Title</label>
      <input id="og-title" type="text" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Page title shown in search results" />
      <Counter text={f.title} limit={LIMITS.title} />

      <label htmlFor="og-description">Description</label>
      <textarea id="og-description" value={f.description} onChange={(e) => set('description', e.target.value)} style={{ minHeight: 84, fontFamily: 'var(--font)', fontSize: '0.95rem' }} placeholder="One or two sentences that make people click" />
      <Counter text={f.description} limit={LIMITS.description} />

      <div className="og-fields">
        {text('url', 'Page URL (canonical)', 'https://example.com/page', 'url')}
        {text('image', 'Image URL (1200 × 630)', 'https://example.com/og.png', 'url')}
        {text('imageAlt', 'Image alt text', 'Describe the image')}
        {text('siteName', 'Site name', 'Example')}
        {text('twitterHandle', 'X / Twitter handle', '@example')}
        {text('author', 'Author (optional)', 'Jane Doe')}
        <div>
          <label htmlFor="og-type">Type</label>
          <select id="og-type" value={f.type} onChange={(e) => set('type', e.target.value as MetaFields['type'])}>
            <option value="website">website</option>
            <option value="article">article</option>
            <option value="product">product</option>
            <option value="profile">profile</option>
            <option value="video.other">video</option>
          </select>
        </div>
        <div>
          <label htmlFor="og-card">X card</label>
          <select id="og-card" value={f.twitterCard} onChange={(e) => set('twitterCard', e.target.value as MetaFields['twitterCard'])}>
            <option value="summary_large_image">Large image</option>
            <option value="summary">Summary (small image)</option>
          </select>
        </div>
        <div>
          <label htmlFor="og-locale">Locale</label>
          <select id="og-locale" value={f.locale} onChange={(e) => set('locale', e.target.value)}>
            {['en_US', 'en_GB', 'id_ID', 'ms_MY', 'es_ES', 'pt_BR', 'fr_FR', 'de_DE', 'ja_JP', 'zh_CN', 'ko_KR', 'ar_AR'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="og-theme">Theme color</label>
          <div className="og-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(f.themeColor) ? f.themeColor : '#000000'} onChange={(e) => set('themeColor', e.target.value)} aria-label="Pick theme color" />
            <input id="og-theme" type="text" value={f.themeColor} onChange={(e) => set('themeColor', e.target.value)} placeholder="#ffffff" />
          </div>
        </div>
        <div className="og-robots">
          <span className="og-robots-label">Robots</span>
          <label><input type="checkbox" checked={f.index} onChange={(e) => set('index', e.target.checked)} /> index</label>
          <label><input type="checkbox" checked={f.follow} onChange={(e) => set('follow', e.target.checked)} /> follow</label>
        </div>
      </div>

      <h3 className="og-h">Preview</h3>
      <PillRow role="tablist" label="Preview" className="og-tabs">
        {PREVIEWS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={preview === p.id} className={`btn ${preview === p.id ? 'primary' : ''}`} onClick={() => setPreview(p.id)}>{p.label}</button>
        ))}
      </PillRow>
      <div className="og-stage" role="tabpanel" aria-label={`${PREVIEWS.find((p) => p.id === preview)?.label} preview`} key={preview}>
        {preview === 'google' && (
          <div className="og-google">
            <div className="og-g-site">
              <span className="og-g-fav" aria-hidden="true">{site.slice(0, 1).toUpperCase()}</span>
              <span>
                <span className="og-g-name">{site}</span>
                <span className="og-g-url">{breadcrumb(f.url || `https://${host}`)}</span>
              </span>
            </div>
            <div className="og-g-title">{truncate(title, 60)}</div>
            <div className="og-g-desc">{truncate(desc, 155)}</div>
          </div>
        )}
        {preview === 'facebook' && (
          <div className="og-fb">
            <Img src={f.image} alt={f.imageAlt} className="og-fb-img" />
            <div className="og-fb-body">
              <div className="og-fb-host">{host.toUpperCase()}</div>
              <div className="og-fb-title">{truncate(title, 88)}</div>
              <div className="og-fb-desc">{truncate(desc, 110)}</div>
            </div>
          </div>
        )}
        {preview === 'x' && (
          f.twitterCard === 'summary_large_image' ? (
            <div className="og-x">
              <div className="og-x-media">
                <Img src={f.image} alt={f.imageAlt} className="og-x-img" />
                <span className="og-x-title">{truncate(title, 70)}</span>
              </div>
              <div className="og-x-from">From {host}</div>
            </div>
          ) : (
            <div className="og-x og-x-sum">
              <Img src={f.image} alt={f.imageAlt} className="og-x-thumb" />
              <div className="og-x-body">
                <div className="og-x-from">{host}</div>
                <div className="og-x-stitle">{truncate(title, 70)}</div>
                <div className="og-x-desc">{truncate(desc, 120)}</div>
              </div>
            </div>
          )
        )}
        {preview === 'whatsapp' && (
          <div className="og-wa">
            <div className="og-wa-bubble">
              <div className="og-wa-card">
                <Img src={f.image} alt={f.imageAlt} className="og-wa-img" />
                <div className="og-wa-body">
                  <div className="og-wa-title">{truncate(title, 80)}</div>
                  <div className="og-wa-desc">{truncate(desc, 90)}</div>
                  <div className="og-wa-host">{host}</div>
                </div>
              </div>
              <span className="og-wa-link">{f.url || `https://${host}`}</span>
              <span className="og-wa-time">09:41 ✓✓</span>
            </div>
          </div>
        )}
        {preview === 'slack' && (
          <div className="og-slack">
            <div className="og-slack-site">{site}</div>
            <div className="og-slack-title">{truncate(title, 100)}</div>
            <div className="og-slack-desc">{truncate(desc, 200)}</div>
            <Img src={f.image} alt={f.imageAlt} className="og-slack-img" />
          </div>
        )}
      </div>
      <p className="muted" style={{ fontSize: '0.82rem' }}>Previews are close approximations; each platform trims text by pixel width and changes its layout from time to time. The image loads straight from the URL you enter.</p>

      {issues.length > 0 && (
        <ul className="og-issues">
          {issues.map((i, n) => (
            <li key={i} className="settle-in" style={{ animationDelay: `${n * 40}ms` }}>{i}</li>
          ))}
        </ul>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label htmlFor="og-out" style={{ margin: 0 }}>HTML for your &lt;head&gt;</label>
        <CopyButton text={html} />
      </div>
      <SettleOutput id="og-out" value={html} style={{ minHeight: 300 }} />
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Paste these tags inside <code>&lt;head&gt;</code>. All values are HTML-escaped. Use an absolute https:// image of at least 1200 × 630 px (under 5 MB) for crisp cards;
        after publishing, platforms cache previews, so use their debuggers to refresh them. Handle <code>{normalizeHandle(f.twitterHandle) || '@yoursite'}</code> is used for twitter:site and twitter:creator.
      </p>
    </div>
  )
}
