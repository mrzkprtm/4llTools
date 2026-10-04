import type { BufferLike } from './wav'

export function makeBuffer(channels: number[][], sampleRate = 8000): BufferLike {
  const length = channels[0]?.length ?? 0
  const data = channels.map((c) => Float32Array.from(c))
  return {
    numberOfChannels: data.length,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (i: number) => data[i],
  }
}
