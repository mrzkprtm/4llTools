import { describe, expect, it } from 'vitest'
import * as metro from './metronome/logic'
import * as pitch from './instrument-tuner/pitch'
import * as noise from './ambient-noise/noise'
import { rng } from '../sim/math'
import * as piano from './piano-keyboard/logic'
import * as drums from './drum-machine/logic'
import * as chords from './chord-finder/logic'
import * as tapper from './bpm-tapper/logic'
import * as ear from './ear-training/logic'

describe('metronome', () => {
  it('names tempos', () => {
    expect(metro.tempoName(50)).toBe('Largo')
    expect(metro.tempoName(120)).toBe('Allegro')
    expect(metro.tempoName(190)).toBe('Presto')
  })

  it('schedules evenly spaced ticks with accents and subdivisions', () => {
    const s = { bpm: 120, beats: 4, groups: [4], subdivision: 2 as const, accentFirst: true }
    const { ticks, cursor } = metro.schedule({ next: 1, index: 0 }, 3, s)
    expect(ticks).toHaveLength(8)
    expect(ticks[1].time - ticks[0].time).toBeCloseTo(0.25)
    expect(ticks.map((t) => t.level).slice(0, 3)).toEqual(['bar', 'sub', 'beat'])
    expect(cursor.next).toBeCloseTo(3)
    // Continuing from the cursor picks up the next bar.
    const more = metro.schedule(cursor, 3.1, s)
    expect(more.ticks[0].level).toBe('bar')
  })

  it('accents 7/8 groups and estimates tap tempo', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((b) => metro.accentOf(b, [2, 2, 3], true))).toEqual(['bar', 'beat', 'group', 'beat', 'group', 'beat', 'beat'])
    expect(metro.tapBpm([0, 500, 1000, 1500])).toBe(120)
    expect(metro.tapBpm([0, 5000])).toBeNull()
  })
})

describe('instrument-tuner', () => {
  it('detects the pitch of synthesized tones', () => {
    for (const f of [82.41, 196, 440, 659.3]) {
      const p = pitch.detectPitch(pitch.synth(f, 44100, 4096, [1, 0.5, 0.3]), 44100)
      expect(p).not.toBeNull()
      expect(Math.abs(pitch.centsBetween(p!.freq, f))).toBeLessThan(3)
    }
    // Low bass E1 needs the long window.
    const low = pitch.detectPitch(pitch.synth(41.2, 48000, 4096), 48000)
    expect(Math.abs(pitch.centsBetween(low!.freq, 41.2))).toBeLessThan(5)
    expect(pitch.detectPitch(new Float32Array(4096), 44100)).toBeNull()
  })

  it('maps frequencies to notes, cents and strings', () => {
    const n = pitch.freqToNote(446)
    expect(n.name + n.octave).toBe('A4')
    expect(n.cents).toBeCloseTo(23.45, 1)
    expect(pitch.freqToNote(432, 432).cents).toBeCloseTo(0)
    expect(pitch.noteName(40)).toBe('E2')
    expect(pitch.nearestString(112, pitch.INSTRUMENTS[0].strings)).toBe(1)
  })
})

describe('ambient-noise', () => {
  it('makes bounded noise whose spectrum tilts from white to pink to brown', () => {
    const n = 44100
    const w = noise.whiteNoise(n, rng(1))
    const p = noise.pinkNoise(n, rng(2))
    const b = noise.brownNoise(n, rng(3))
    for (const buf of [w, p, b]) expect(Math.max(...buf.map(Math.abs))).toBeLessThanOrEqual(1)
    const [bw, bp, bb] = [w, p, b].map(noise.brightness)
    expect(bw).toBeGreaterThan(1.8)
    expect(bp).toBeLessThan(bw / 2)
    expect(bb).toBeLessThan(bp / 5)
  })

  it('fades the sleep timer out only at the end', () => {
    expect(noise.sleepGain(0, 600)).toBe(1)
    expect(noise.sleepGain(570, 600)).toBe(1)
    expect(noise.sleepGain(585, 600)).toBeCloseTo(0.25)
    expect(noise.sleepGain(700, 600)).toBe(0)
    for (let t = 0; t < 20; t += 0.7) expect(noise.swell(t)).toBeGreaterThanOrEqual(0)
  })
})

describe('piano-keyboard', () => {
  it('builds scale and chord note sets', () => {
    expect(piano.spell(9, piano.SCALES.minor.steps)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
    expect(piano.spell(5, piano.SCALES.major.steps)).toContain('B♭')
    expect([...piano.pitchClasses(7, piano.CHORDS['7'].steps)]).toEqual([7, 11, 2, 5])
    expect(piano.spell(0, piano.SCALES.blues.steps)).toEqual(['C', 'E♭', 'F', 'G♭', 'G', 'B♭'])
  })

  it('maps computer keys and lays out octaves', () => {
    expect(piano.keyToMidi('a', 60)).toBe(60)
    expect(piano.keyToMidi('W', 60)).toBe(61)
    expect(piano.keyToMidi('k', 60)).toBe(72)
    expect(piano.keyToMidi('q', 60)).toBeNull()
    const keys = piano.layout(4, 2)
    expect(keys).toHaveLength(25)
    expect(keys.filter((k) => !k.black)).toHaveLength(15)
    expect(piano.noteName(keys[0].midi)).toBe('C4')
  })
})

describe('drum-machine', () => {
  it('spaces steps as 16ths and delays off-beats with swing', () => {
    const { steps, cursor } = drums.dueSteps({ next: 0, step: 14 }, 0.5, 120, 50)
    expect(steps.map((s) => s.step)).toEqual([14, 15, 0, 1])
    expect(steps[1].time).toBeCloseTo(0.125)
    expect(cursor).toEqual({ next: 0.5, step: 2 })
    expect(drums.swingOffset(0, 120, 66)).toBe(0)
    expect(drums.swingOffset(1, 120, 75)).toBeCloseTo(0.0625)
    const swung = drums.dueSteps({ next: 0, step: 0 }, 0.2, 120, 75).steps
    expect(swung[1].time).toBeCloseTo(0.1875)
  })

  it('round-trips patterns through the share code and rejects junk', () => {
    const pattern = drums.randomPattern(rng(7))
    const code = drums.encode({ pattern, bpm: 124, swing: 58 })
    expect(code).toMatch(/^v1-124-58-[0-9a-f]{32}$/)
    expect(drums.decode('#' + code)).toEqual({ pattern, bpm: 124, swing: 58 })
    expect(drums.decode('v1-999-58-' + '0'.repeat(32))).toBeNull()
    expect(drums.decode('hello')).toBeNull()
  })
})

describe('chord-finder', () => {
  it('spells chords and finds a valid voicing for every root and type', () => {
    expect(chords.chordNotes(9, 'm7')).toEqual(['A', 'C', 'E', 'G'])
    expect(chords.chordNotes(7, '7')).toEqual(['G', 'B', 'D', 'F'])
    for (let r = 0; r < 12; r++)
      for (const q of Object.keys(chords.QUALITIES) as chords.Quality[]) {
        const list = chords.voicings(r, q)
        expect(list.length, chords.chordName(r, q)).toBeGreaterThan(0)
        for (const v of list) expect(chords.isValid(v, r, q)).toBe(true)
      }
  })

  it('moves E and A barre shapes up the neck', () => {
    expect(chords.barreShape(5, '', 'E')!.frets).toEqual([1, 3, 3, 2, 1, 1])
    expect(chords.barreShape(5, '', 'E')!.barre).toEqual({ fret: 1, from: 0, to: 5 })
    expect(chords.barreShape(11, 'm', 'A')!.frets).toEqual([-1, 2, 4, 4, 3, 2])
  })

  it('transposes chord sheets but leaves lyrics alone', () => {
    expect(chords.transposeText('C G Am F', 2)).toBe('D A Bm G')
    expect(chords.transposeText('| Dm7 | G7sus4 | C/E |', -2)).toBe('| Cm7 | F7sus4 | Bb/D |')
    expect(chords.transposeText('A little love song', 3)).toBe('A little love song')
  })
})

describe('bpm-tapper', () => {
  it('estimates tempo and ignores a stray tap', () => {
    const steady = [0, 500, 1000, 1500, 2000, 2500]
    expect(tapper.estimateBpm(steady)!.bpm).toBeCloseTo(120)
    expect(tapper.estimateBpm(steady)!.stability).toBeCloseTo(1)
    // A double tap (150 ms) is rejected.
    const stray = [0, 500, 1000, 1150, 1500, 2000, 2500]
    const e = tapper.estimateBpm(stray)!
    expect(e.rejected.length).toBeGreaterThan(0)
    expect(Math.abs(e.bpm - 120)).toBeLessThan(3)
    // A skipped beat counts as two.
    expect(tapper.estimateBpm([0, 500, 1000, 2000, 2500, 3000])!.bpm).toBeCloseTo(120)
  })

  it('starts fresh after a pause and rates steadiness', () => {
    expect(tapper.addTap([0, 500], 900)).toEqual([0, 500, 900])
    expect(tapper.addTap([0, 500], 3000)).toEqual([3000])
    const shaky = tapper.estimateBpm([0, 450, 990, 1460, 2020, 2500])!
    expect(shaky.stability).toBeLessThan(0.5)
    expect(tapper.estimateBpm([0])).toBeNull()
  })
})

describe('ear-training', () => {
  it('names intervals', () => {
    expect(ear.intervalName(7)).toBe('Perfect 5th')
    expect(ear.intervalName(-3)).toBe('Minor 3rd')
    expect(ear.intervalName(12)).toBe('Octave')
    expect(ear.intervalName(16)).toBe('Major 3rd')
  })

  it('generates questions only from the chosen pool, in range and never repeating back to back', () => {
    const rand = rng(11)
    let prev: string | undefined
    for (let i = 0; i < 200; i++) {
      const q = ear.makeQuestion('interval', ['M3', 'P5', 'P8'], 'mixed', rand, prev)
      expect(['M3', 'P5', 'P8']).toContain(q.item.id)
      expect(q.item.id).not.toBe(prev)
      expect(Math.abs(q.notes[1] - q.notes[0])).toBe(q.item.steps[1])
      expect(Math.min(...q.notes)).toBeGreaterThanOrEqual(48)
      expect(Math.max(...q.notes)).toBeLessThanOrEqual(84)
      if (q.direction === 'down') expect(q.notes[0]).toBeGreaterThan(q.notes[1])
      prev = q.item.id
    }
    const c = ear.makeQuestion('chord', ['dim'], 'up', rand)
    expect(c.harmonic).toBe(true)
    expect(c.notes.map((n) => n - c.notes[0])).toEqual([0, 3, 6])
    const st = ear.record(ear.record({}, 'P5', true), 'P5', false)
    expect(ear.accuracy(st)).toBe(0.5)
  })
})
