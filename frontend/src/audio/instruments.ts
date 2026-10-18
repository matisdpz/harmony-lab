/**
 * The sounds the app can play with. The grand piano uses recorded samples (served from /samples/piano,
 * see the README there); the others are synthesised by Tone.js, so they cost no download.
 * Each voice has its own volume trim so switching sounds does not change the perceived loudness.
 */
import type * as ToneNamespace from 'tone'

type Tone = typeof ToneNamespace

export type InstrumentId = 'piano' | 'epiano' | 'organ' | 'pad' | 'pluck' | 'vibes'

export const INSTRUMENTS: { id: InstrumentId; label: string; description: string }[] = [
  { id: 'piano', label: 'Grand piano', description: 'Recorded concert grand (Salamander samples).' },
  { id: 'epiano', label: 'Electric piano', description: 'Soft FM tone with a bell-like attack.' },
  { id: 'organ', label: 'Organ', description: 'Drawbar-style tone that sustains as long as the chord.' },
  { id: 'pad', label: 'Warm pad', description: 'Slow, wide synth pad for sustained harmony.' },
  { id: 'pluck', label: 'Plucked strings', description: 'Short, guitar-like decay; clearest for arpeggios.' },
  { id: 'vibes', label: 'Vibraphone', description: 'Metallic bars with a gentle tremolo.' },
]

export const DEFAULT_INSTRUMENT: InstrumentId = 'piano'

export function isInstrumentId(value: unknown): value is InstrumentId {
  return INSTRUMENTS.some((i) => i.id === value)
}

/** What the engine needs from a sound. Frequencies are in Hz, times in seconds on the audio clock. */
export interface Voice {
  play(frequencies: number[], seconds: number, time: number, velocity: number): void
  /** Held notes (a MIDI keyboard): start now, stop on release. */
  attack(frequency: number, time: number, velocity: number): void
  release(frequency: number, time: number): void
  releaseAll(): void
  dispose(): void
}

// Salamander set published by Tone.js: one file every minor third. "#" is spelled "s" in file names.
const PIANO_NOTES = ['A0', 'C1', 'D#1', 'F#1', 'A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4',
  'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7', 'D#7', 'F#7', 'A7', 'C8']

export async function createVoice(Tone: Tone, id: InstrumentId, destination: ToneNamespace.InputNode): Promise<Voice> {
  switch (id) {
    case 'piano': {
      const trim = new Tone.Volume(-2).connect(destination)
      const urls = Object.fromEntries(PIANO_NOTES.map((n) => [n, `${n.replace('#', 's')}.mp3`]))
      const sampler = await new Promise<ToneNamespace.Sampler>((resolve, reject) => {
        const s = new Tone.Sampler({
          urls,
          baseUrl: `${import.meta.env.BASE_URL}samples/piano/`,
          release: 1.1,
          onload: () => resolve(s),
          onerror: (error) => reject(new Error(`Piano samples could not be loaded (${error.message}).`)),
        }).connect(trim)
      })
      return {
        play: (f, seconds, time, velocity) => sampler.triggerAttackRelease(f, seconds, time, velocity),
        attack: (f, time, velocity) => sampler.triggerAttack(f, time, velocity),
        release: (f, time) => sampler.triggerRelease(f, time),
        releaseAll: () => sampler.releaseAll(),
        dispose: () => {
          sampler.dispose()
          trim.dispose()
        },
      }
    }
    case 'epiano':
      return poly(Tone, destination, -1, new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 1.6,
        oscillator: { type: 'sine' },
        modulation: { type: 'triangle' },
        envelope: { attack: 0.004, decay: 1.4, sustain: 0.18, release: 1.3 },
        modulationEnvelope: { attack: 0.004, decay: 0.5, sustain: 0.1, release: 0.8 },
      }))
    case 'organ':
      return poly(Tone, destination, -11, new Tone.PolySynth(Tone.Synth, {
        // Fundamental plus a few harmonics, like pulling out a handful of drawbars.
        oscillator: { type: 'custom', partials: [1, 0.7, 0.4, 0.3, 0, 0.18, 0, 0.12] },
        envelope: { attack: 0.01, decay: 0.08, sustain: 0.9, release: 0.12 },
      }))
    case 'pad': {
      const filter = new Tone.Filter({ type: 'lowpass', frequency: 1500, rolloff: -24 }).connect(destination)
      const voice = poly(Tone, filter, -13, new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
        envelope: { attack: 0.45, decay: 0.4, sustain: 0.75, release: 2.2 },
      }))
      return { ...voice, dispose: () => { voice.dispose(); filter.dispose() } }
    }
    case 'pluck': {
      const filter = new Tone.Filter({ type: 'lowpass', frequency: 3200, rolloff: -12 }).connect(destination)
      const voice = poly(Tone, filter, -3, new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 0.5 },
      }))
      return { ...voice, dispose: () => { voice.dispose(); filter.dispose() } }
    }
    case 'vibes': {
      const tremolo = new Tone.Tremolo({ frequency: 5, depth: 0.28 }).connect(destination).start()
      const voice = poly(Tone, tremolo, -4, new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 4,
        modulationIndex: 1.1,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 2.6, sustain: 0, release: 1.6 },
        modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.3 },
      }))
      return { ...voice, dispose: () => { voice.dispose(); tremolo.dispose() } }
    }
  }
}

function poly<T extends ToneNamespace.PolySynth>(Tone: Tone, destination: ToneNamespace.InputNode, trimDb: number, synth: T): Voice {
  const trim = new Tone.Volume(trimDb).connect(destination)
  synth.maxPolyphony = 32
  synth.connect(trim)
  return {
    play: (f, seconds, time, velocity) => synth.triggerAttackRelease(f, seconds, time, velocity),
    attack: (f, time, velocity) => synth.triggerAttack(f, time, velocity),
    release: (f, time) => synth.triggerRelease(f, time),
    releaseAll: () => synth.releaseAll(),
    dispose: () => {
      synth.dispose()
      trim.dispose()
    },
  }
}
