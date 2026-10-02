import type { ToolMeta } from '../types'

export const meta: ToolMeta = {
  name: 'HTTP Status Code Reference',
  description: 'Look up any HTTP status code from 1xx to 5xx with causes, fixes and headers.',
  category: 'Network',
  keywords: ['http', 'status code', 'response code', '404', '500', '301', '429', 'error code', 'kode status', 'kode respon', 'kode error'],
  symbol: 'Hsc',
  icon: 'pulse',
  network:
    'The reference list works offline. The optional live check sends a request from your browser to the URL you enter.',
}
