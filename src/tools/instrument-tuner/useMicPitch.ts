import { useEffect, useRef, useState } from 'react'
import { detectPitch, rms, type PitchOptions } from './pitch'

export type MicStatus = 'idle' | 'starting' | 'on' | 'denied' | 'unsupported' | 'error'

export interface PitchFrame {
  freq: number | null
  clarity: number
  level: number
  /** performance.now() of the reading. */
  time: number
}

export const MIC_MESSAGES: Partial<Record<MicStatus, string>> = {
  denied: 'Microphone access was blocked. Allow it in your browser’s site settings and try again.',
  unsupported: 'This browser can’t use the microphone here. Try a recent Chrome, Firefox or Safari over HTTPS.',
  error: 'The microphone could not be started. Check that no other app is using it.',
}

/**
 * Owns one AudioContext for the tool, opens the microphone only when `start()`
 * is called from a click, and reports a pitch reading every `everyMs`.
 * Stopping (or unmounting) releases the microphone.
 */
export function useMicPitch(onFrame: (f: PitchFrame) => void, opts: PitchOptions & { everyMs?: number } = {}) {
  const [status, setStatus] = useState<MicStatus>('idle')
  const ctx = useRef<AudioContext | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const raf = useRef(0)
  const cb = useRef(onFrame)
  cb.current = onFrame
  const o = useRef(opts)
  o.current = opts

  function audio(): AudioContext | null {
    try {
      ctx.current ??= new AudioContext()
      if (ctx.current.state === 'suspended') void ctx.current.resume()
      return ctx.current
    } catch {
      return null
    }
  }

  function release() {
    cancelAnimationFrame(raf.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('unsupported')
    const ac = audio()
    if (!ac) return setStatus('unsupported')
    setStatus('starting')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      stream.current = s
      const src = ac.createMediaStreamSource(s)
      const an = ac.createAnalyser()
      an.fftSize = 4096
      src.connect(an)
      const buf = new Float32Array(an.fftSize)
      let last = 0
      const loop = (now: number) => {
        raf.current = requestAnimationFrame(loop)
        if (now - last < (o.current.everyMs ?? 45)) return
        last = now
        an.getFloatTimeDomainData(buf)
        const p = detectPitch(buf, ac.sampleRate, o.current)
        cb.current({ freq: p?.freq ?? null, clarity: p?.clarity ?? 0, level: rms(buf), time: now })
      }
      raf.current = requestAnimationFrame(loop)
      setStatus('on')
    } catch (e) {
      const name = (e as { name?: string })?.name
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
    }
  }

  function stop() {
    release()
    setStatus('idle')
  }

  useEffect(
    () => () => {
      release()
      void ctx.current?.close()
    },
    [],
  )

  return { status, start, stop, audio }
}

/** A short plucked reference tone on the given context. */
export function pluck(ac: AudioContext | null, freq: number, dur = 1.6, gain = 0.25) {
  if (!ac) return
  const t = ac.currentTime
  const g = ac.createGain()
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(Math.min(8000, freq * 8), t)
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.5), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  lp.connect(g).connect(ac.destination)
  for (const [type, mult, vol] of [['sawtooth', 1, 0.5], ['triangle', 2, 0.3]] as const) {
    const osc = ac.createOscillator()
    const v = ac.createGain()
    osc.type = type
    osc.frequency.value = freq * mult
    v.gain.value = vol
    osc.connect(v).connect(lp)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }
}
