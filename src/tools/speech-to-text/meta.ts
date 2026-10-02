import type { ToolMeta } from '../types'

export const meta: ToolMeta = {
  name: 'Speech to Text',
  description: 'Dictate and transcribe speech to text live in many languages, then copy or download it.',
  category: 'Text',
  keywords: ['speech to text', 'dictation', 'voice typing', 'transcribe', 'voice recognition', 'suara ke teks', 'dikte', 'transkripsi', 'ketik suara'],
  symbol: 'Stt',
  icon: 'microphone',
  network:
    'Your browser sends the audio to its own speech service (Google in Chrome, Apple in Safari) to turn it into text. 4llTools never receives it.',
}
