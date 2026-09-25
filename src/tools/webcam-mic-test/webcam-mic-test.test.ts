import { describe, expect, it } from 'vitest'
import { audioConstraints, dbToMeter, describeMediaError, describeVideo, levelToDb, resolutionName, rms, videoConstraints } from './media'

describe('webcam and mic helpers', () => {
  it('measures level in dBFS', () => {
    expect(rms([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5)
    expect(levelToDb(1)).toBe(0)
    expect(levelToDb(0.5)).toBeCloseTo(-6.02, 2)
    expect(levelToDb(0)).toBe(-100)
    expect(dbToMeter(-30)).toBeCloseTo(0.5)
    expect(dbToMeter(-90)).toBe(0)
    expect(dbToMeter(3)).toBe(1)
  })

  it('builds camera and microphone constraints', () => {
    expect(videoConstraints('', 'hd')).toEqual({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' }, audio: false })
    const v = videoConstraints('cam-1', 'fhd', 60).video as MediaTrackConstraints
    expect(v.deviceId).toEqual({ exact: 'cam-1' })
    expect(v.facingMode).toBeUndefined()
    expect(audioConstraints('mic', false).audio).toMatchObject({ deviceId: { exact: 'mic' }, echoCancellation: false })
  })

  it('explains permission and device errors', () => {
    expect(describeMediaError({ name: 'NotAllowedError' }, 'camera')).toMatch(/blocked/)
    expect(describeMediaError({ name: 'NotReadableError' }, 'microphone')).toMatch(/busy/)
    expect(describeMediaError(new Error('boom'), 'camera')).toBe('Could not start the camera: boom')
  })

  it('describes track settings', () => {
    expect(describeVideo({ width: 1280, height: 720, frameRate: 29.97 })).toBe('1280×720 · 30 fps')
    expect(describeVideo({})).toBe('Unknown size')
    expect(resolutionName(1920, 1080)).toBe('1080p')
    expect(resolutionName(720, 1280)).toBe('720p')
  })
})
