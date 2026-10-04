import { useState } from 'react'
import Icon from '../../components/Icon'
import { PAGE_H, PAGE_W, addressLines, headerLayout } from './letterhead'

export default function LetterheadMaker() {
  const [company, setCompany] = useState('Analytical Engines')
  const [tagline, setTagline] = useState('Runtimes that respect your time')
  const [address, setAddress] = useState('12 Bridge Street\nLondon EC1 1AA\nhello@example.com')
  const [accent, setAccent] = useState('#1d4ed8')

  const lines = addressLines(address)
  const layout = headerLayout(PAGE_W, PAGE_H, 64, Math.max(1, lines.length))
  const accentColor = /^#[0-9a-f]{3,8}$/i.test(accent) ? accent : '#1d4ed8'
  const ruleThickness = Math.max(2, Math.round(PAGE_H * 0.0035))

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="lh-company">Company name</label>
          <input id="lh-company" type="text" value={company} maxLength={60} onChange={(e) => setCompany(e.target.value)} />

          <label htmlFor="lh-tagline">Tagline</label>
          <input id="lh-tagline" type="text" value={tagline} maxLength={90} onChange={(e) => setTagline(e.target.value)} />

          <label htmlFor="lh-address">Address — one line each, shown top right</label>
          <textarea id="lh-address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ minHeight: 96 }} />

          <label htmlFor="lh-accent">Accent color</label>
          <input id="lh-accent" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} />

          <div className="stats">
            <div className="stat"><b>{lines.length}</b>Address line{lines.length === 1 ? '' : 's'}</div>
            <div className="stat"><b>{layout.width}</b>Content width (px)</div>
            <div className="stat"><b>{layout.bodyTop}</b>Letter starts at (px)</div>
          </div>

          <div className="row">
            <button type="button" className="btn primary btn-icon" onClick={() => window.print()}><Icon name="printer" size={18} /> Print</button>
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            Print on plain paper to use the sheet straight away, or choose “Save as PDF” in the print dialog to keep a blank letterhead.
            Everything is styled with plain SVG and CSS on this page — no images or fonts are loaded.
          </p>
        </div>

        <div>
          <h3 className="eyebrow">Preview · A4 at 96 dpi</h3>
          <svg
            viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
            style={{ display: 'block', width: '100%', height: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
            role="img"
            aria-label={`Letterhead preview for ${company || 'your company'}`}
          >
            <text x={layout.x} y={layout.nameY} fontSize={layout.nameSize} fontWeight="700" fill={accentColor} fontFamily="Georgia, 'Times New Roman', serif">
              {company || 'Your company'}
            </text>
            {tagline.trim() && (
              <text x={layout.x} y={layout.taglineY} fontSize={layout.taglineSize} fill="#5a5a66" fontFamily="system-ui, sans-serif">
                {tagline}
              </text>
            )}
            {lines.map((line, i) => (
              <text
                key={`${i}-${line}`}
                x={layout.x + layout.width}
                y={layout.addressY + i * layout.lineHeight}
                fontSize={layout.addressSize}
                fill="#5a5a66"
                textAnchor="end"
                fontFamily="system-ui, sans-serif"
              >
                {line}
              </text>
            ))}
            <rect x={layout.x} y={layout.ruleY} width={layout.width} height={ruleThickness} fill={accentColor} />

            <text x={layout.x} y={layout.bodyTop + layout.bodySize} fontSize={layout.bodySize} fill="#1b1b1f" fontFamily="system-ui, sans-serif">
              Dear reader,
            </text>
            <text x={layout.x} y={layout.bodyTop + layout.bodySize * 3} fontSize={layout.bodySize} fill="#6b6b75" fontFamily="system-ui, sans-serif">
              Your letter text starts here, below the rule.
            </text>
            <text x={layout.x} y={PAGE_H - 64} fontSize={layout.addressSize * 0.85} fill="#9a9aa3" fontFamily="system-ui, sans-serif">
              {lines[0] ? `${company} · ${lines[0]}` : company}
            </text>
          </svg>
        </div>
      </div>
    </div>
  )
}
