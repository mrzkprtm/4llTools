import type { ToolMeta } from '../types'

export const meta: ToolMeta = {
  name: 'CORS & Security Header Checker',
  description: 'Grade security headers like CSP and HSTS, and simulate whether CORS allows a request.',
  category: 'Network',
  keywords: ['cors', 'csp', 'hsts', 'security headers', 'preflight', 'access-control-allow-origin', 'x-frame-options', 'set-cookie', 'header keamanan', 'cek header', 'kebijakan cors'],
  symbol: 'Crs',
  icon: 'shield',
  network:
    'It sends a real request from your browser to the URL you enter, so that server sees the request. Nothing goes through 4llTools.',
}
