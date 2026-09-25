import type { ToolMeta } from '../types'

export const meta: ToolMeta = {
  name: 'DNS Lookup',
  description: 'Look up A, AAAA, MX, TXT, NS, CAA and PTR records and check SPF, DMARC and DKIM for email delivery.',
  category: 'Network',
  keywords: ['dns', 'nslookup', 'dig', 'mx record', 'txt record', 'spf', 'dmarc', 'dkim', 'reverse dns', 'cek dns', 'cek domain'],
  symbol: 'Dn',
  icon: 'globe-grid',
  network:
    'The domain name you look up is sent to a public DNS-over-HTTPS resolver (Cloudflare or Google) straight from your browser.',
}
