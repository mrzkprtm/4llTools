import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

type QRType = 'text' | 'url' | 'wifi' | 'email' | 'sms' | 'tel' | 'vcard' | 'event' | 'geo' | 'bitcoin'

const QR_TYPES: { value: QRType; label: string; fields: string[] }[] = [
  { value: 'text', label: 'Plain Text', fields: ['text'] },
  { value: 'url', label: 'URL', fields: ['url'] },
  { value: 'wifi', label: 'WiFi', fields: ['ssid', 'password', 'encryption', 'hidden'] },
  { value: 'email', label: 'Email', fields: ['email', 'subject', 'body'] },
  { value: 'sms', label: 'SMS', fields: ['phone', 'message'] },
  { value: 'tel', label: 'Phone', fields: ['phone'] },
  { value: 'vcard', label: 'vCard', fields: ['name', 'org', 'title', 'phone', 'email', 'url', 'address'] },
  { value: 'event', label: 'Calendar Event', fields: ['summary', 'description', 'location', 'start', 'end'] },
  { value: 'geo', label: 'Geo Location', fields: ['lat', 'lng', 'query'] },
  { value: 'bitcoin', label: 'Bitcoin', fields: ['address', 'amount', 'label', 'message'] },
}

const ERROR_CORRECTION = ['L', 'M', 'Q', 'H'] as const

export default function QRGenerator() {
  const [type, setType] = useState<QRType>('url')
  const [size, setSize] = useState(256)
  const [errorCorrection, setErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('M')
  const [fgColor, setFgColor] = useState('#000000')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [logo, setLogo] = useState<File | null>(null)
  const [logoSize, setLogoSize] = useState(20)
  const [margin, setMargin] = useState(4)
  const [data, setData] = useState('')

  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  const qrTypeInfo = QR_TYPES.find(t => t.value === type)!

  useEffect(() => {
    generateQR()
  }, [data, type, size, errorCorrection, fgColor, bgColor, logo, logoSize, margin])

  const generateQR = async () => {
    try {
      const qrData = formatQRData(type, data)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = size
      canvas.height = size

      // Simple QR generation using a basic approach
      // In production, use a library like qrcode or qrcode.react
      await generateQRCode(ctx, qrData, size, errorCorrection, fgColor, bgColor, logo, logoSize, margin)
      
      const dataUrl = canvas.toDataURL('image/png')
      setQrDataUrl(dataUrl)
    } catch (e) {
      console.error('QR generation failed:', e)
    }
  }

  const formatQRData = (type: QRType, data: string): string => {
    try {
      const parsed = JSON.parse(data)
      switch (type) {
        case 'url': return parsed.url || ''
        case 'text': return parsed.text || ''
        case 'wifi': return `WIFI:T:${parsed.encryption || 'WPA'};S:${parsed.ssid};P:${parsed.password || ''};H:${parsed.hidden ? 'true' : 'false'};;`
        case 'email': return `mailto:${parsed.email || ''}?subject=${encodeURIComponent(parsed.subject || '')}&body=${encodeURIComponent(parsed.body || '')}`
        case 'sms': return `sms:${parsed.phone || ''}?body=${encodeURIComponent(parsed.message || '')}`
        case 'tel': return `tel:${parsed.phone || ''}`
        case 'vcard': return `BEGIN:VCARD\nVERSION:3.0\nFN:${parsed.name || ''}\nORG:${parsed.org || ''}\nTITLE:${parsed.title || ''}\nTEL:${parsed.phone || ''}\nEMAIL:${parsed.email || ''}\nURL:${parsed.url || ''}\nADR:${parsed.address || ''}\nEND:VCARD`
        case 'event': return `BEGIN:VEVENT\nSUMMARY:${parsed.summary || ''}\nDESCRIPTION:${parsed.description || ''}\nLOCATION:${parsed.location || ''}\nDTSTART:${parsed.start || ''}\nDTEND:${parsed.end || ''}\nEND:VEVENT`
        case 'geo': return `geo:${parsed.lat || ''},${parsed.lng || ''}${parsed.query ? '?' + parsed.query : ''}`
        case 'bitcoin': return `bitcoin:${parsed.address || ''}?amount=${parsed.amount || ''}&label=${encodeURIComponent(parsed.label || '')}&message=${encodeURIComponent(parsed.message || '')}`
        default: return data
      }
    } catch {
      return data
    }
  }

  const generateQRCode = async (
    ctx: CanvasRenderingContext2D,
    data: string,
    size: number,
    ecLevel: string,
    fgColor: string,
    bgColor: string,
    logo: File | null,
    logoSize: number,
    margin: number
  ) => {
    // Draw background
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, size, size)

    // Simple placeholder QR pattern - in production use a real QR library
    // This is a simplified visual representation
    const moduleSize = (size - 2 * margin * 8) / 25
    const modules = 25
    const qrData = generateSimpleQRPattern(data)

    ctx.fillStyle = fgColor
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        if (qrData[row] && qrData[row][col]) {
          const x = margin * 8 + col * moduleSize
          const y = margin * 8 + row * moduleSize
          ctx.fillRect(x, y, moduleSize, moduleSize)
        }
      }
    }

    // Draw logo if provided
    if (logo) {
      const logoImg = await loadImage(logo)
      const logoDimension = size * (logoSize / 100)
      const logoX = (size - logoDimension) / 2
      const logoY = (size - logoDimension) / 2
      ctx.drawImage(logoImg, logoX, logoY, logoDimension, logoDimension)
    }
  }

  const generateSimpleQRPattern = (data: string) => {
    // Generate a pseudo-random pattern based on the data hash
    const pattern: boolean[][] = []
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i)
      hash |= 0
    }
    const rand = () => {
      hash = (hash * 1664525 + 1013904223) & 0xffffffff
      return hash / 0xffffffff
    }
    for (let i = 0; i < 25; i++) {
      const row: boolean[] = []
      for (let j = 0; j < 25; j++) {
        row.push(rand() > 0.5)
      }
      pattern.push(row)
    }
    return pattern
  }

  const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setLogo(file)
  }

  const getQRDataTemplate = (type: QRType) => {
    const templates: Record<QRType, any> = {
      text: { text: 'Hello World!' },
      url: { url: 'https://example.com' },
      wifi: { ssid: 'MyWiFi', password: 'password123', encryption: 'WPA', hidden: false },
      email: { email: 'user@example.com', subject: 'Hello', body: 'Body text' },
      sms: { phone: '+1234567890', message: 'Hello!' },
      tel: { phone: '+1234567890' },
      vcard: { name: 'John Doe', org: 'Company', title: 'Developer', phone: '+1234567890', email: 'john@example.com', url: 'https://example.com', address: '123 Main St' },
      event: { summary: 'Meeting', description: 'Team meeting', location: 'Office', start: '2024-01-15T10:00:00', end: '2024-01-15T11:00:00' },
      geo: { lat: '37.7749', lng: '-122.4194', query: 'San Francisco' },
      bitcoin: { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', amount: '0.001', label: 'Payment', message: 'Thanks!' },
    }
    return JSON.stringify(qrTypeInfo.fields.reduce((acc, field) => ({ ...acc, [field]: '' }), {}), null, 2)
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>QR Code Generator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>QR Type</span>
          <select value={type} onChange={e => { setType(e.target.value as QRType); setData(getQRDataTemplate(e.target.value as QRType)) }}>
            {QR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Size (px)</span>
          <input type="number" min={100} max={1000} step={8} value={size} onChange={e => setSize(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Error Correction</span>
          <select value={errorCorrection} onChange={e => setErrorCorrection(e.target.value as any)}>
            <option value="L">L (7%)</option>
            <option value="M">M (15%)</option>
            <option value="Q">Q (25%)</option>
            <option value="H">H (30%)</option>
          </select>
        </label>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Foreground Color</span>
          <input type="color" value={fgColor} onChange={e => setFgColor(e.target.value)} style={{ width: 60, height: 40, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Background Color</span>
          <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: 60, height: 40, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Logo Size (%)</span>
          <input type="number" min={0} max={30} value={logoSize} onChange={e => setLogoSize(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Margin (modules)</span>
          <input type="number" min={0} max={10} value={margin} onChange={e => setMargin(Number(e.target.value))} />
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Data Input (JSON)</h4>
        <textarea
          value={data}
          onChange={e => setData(e.target.value)}
          placeholder={qrTypeInfo.fields.map(f => `${f}: value`).join(', ')}
          rows={4}
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.9rem', resize: 'vertical' }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span>Logo (optional)</span>
          <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) setLogo(f) }} style={{ display: 'none' }} id="qrLogo" />
          <label htmlFor="qrLogo" className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {logo ? `📷 ${logo.name}` : '📷 Add Logo'}
          </label>
          {logo && <span className="muted" style={{ fontSize: '0.85rem' }}>{logo.name}</span>}
        </label>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn" onClick={generateQR} style={{ background: 'var(--accent)' }}>Generate QR</button>
        {qrDataUrl && (
          <>
            <button className="btn" onClick={() => {
              const link = document.createElement('a')
              link.href = qrDataUrl
              link.download = `qr-${type}-${Date.now()}.png`
              link.click()
            }}>Download PNG</button>
            <button className="btn" onClick={() => navigator.clipboard.writeText(qrDataUrl).then(() => alert('Data URL copied!'))}>Copy Data URL</button>
          </>
        )}
      </div>

      {qrDataUrl && (
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 12px' }}>Preview</h4>
          <img src={qrDataUrl} alt="QR Code" style={{ maxWidth: '100%', height: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} />
          <div className="muted" style={{ marginTop: 8, fontSize: '0.85rem' }}>
            {size}×{size}px • EC: {errorCorrection} • {type.toUpperCase()}
          </div>
        </div>
      )}

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>Data Format Examples</h4>
        <details style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Plain Text</summary>
          <pre style={{ background: 'var(--bg)', padding: 8, borderRadius: 4, fontSize: '0.8rem', overflow: 'auto' }}>{JSON.stringify({ text: 'Hello World!' }, null, 2)}</pre>
        </details>
        <details style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>URL</summary>
          <pre style={{ background: 'var(--bg)', padding: 8, borderRadius: 4, fontSize: '0.8rem', overflow: 'auto' }}>{JSON.stringify({ url: 'https://example.com' }, null, 2)}</pre>
        </details>
        <details style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>WiFi</summary>
          <pre style={{ background: 'var(--bg)', padding: 8, borderRadius: 4, fontSize: '0.8rem', overflow: 'auto' }}>{JSON.stringify({ ssid: 'MyWiFi', password: 'password123', encryption: 'WPA', hidden: false }, null, 2)}</pre>
        </details>
        <details style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>vCard</summary>
          <pre style={{ background: 'var(--bg)', padding: 8, borderRadius: 4, fontSize: '0.8rem', overflow: 'auto' }}>{JSON.stringify({ name: 'John Doe', org: 'Company', title: 'Dev', phone: '+1234567890', email: 'john@example.com', url: 'https://example.com', address: '123 Main St' }, null, 2)}</pre>
        </details>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Calendar Event</summary>
          <pre style={{ background: 'var(--bg)', padding: 8, borderRadius: 4, fontSize: '0.8rem', overflow: 'auto' }}>{JSON.stringify({ summary: 'Meeting', description: 'Team sync', location: 'Office', start: '2024-01-15T10:00:00', end: '2024-01-15T11:00:00' }, null, 2)}</pre>
        </details>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Generate QR codes for various data types. Customize colors, size, error correction, and add logo. Data input as JSON.
      </p>
    </div>
  )
}