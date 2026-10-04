import type { BufferLike } from '../../audio/wav'

export interface AudioFacts {
  duration: number
  channels: number
  sampleRate: number
  samples: number
}

export function describeBuffer(b: BufferLike): AudioFacts {
  return {
    duration: Number.isFinite(b.duration) ? b.duration : b.length / b.sampleRate,
    channels: b.numberOfChannels,
    sampleRate: b.sampleRate,
    samples: b.length,
  }
}

export type OutFormat = 'mp3' | 'wav'

export function extForFormat(f: OutFormat): string {
  return f === 'mp3' ? '.mp3' : '.wav'
}

export function labelForFormat(f: OutFormat): string {
  return f === 'mp3' ? 'MP3 · 128 kbps' : 'WAV · 16-bit PCM'
}

export function estimateBytes(facts: AudioFacts, f: OutFormat): number {
  const ch = Math.min(2, facts.channels)
  if (f === 'mp3') return Math.round(facts.duration * 16000) + 4096
  return Math.round(facts.duration * facts.sampleRate * ch * 2) + 44
}
