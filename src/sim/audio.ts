let audio: AudioContext | null = null

/** A short beep. Sound is optional, so failures are ignored. */
export function tone(freq: number, ms = 60, type: OscillatorType = 'sine', volume = 0.05) {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = type
    osc.frequency.value = freq
    osc.connect(gain).connect(audio.destination)
    const t = audio.currentTime
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
    osc.start(t)
    osc.stop(t + ms / 1000 + 0.01)
  } catch {
    // Sound is optional.
  }
}

export function audioContext(): AudioContext | null {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    return audio
  } catch {
    return null
  }
}
