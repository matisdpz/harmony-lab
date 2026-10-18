/**
 * Single audio engine for the whole page, built on Tone.js.
 *
 * - Tone.js is imported lazily on the first user gesture: browsers block audio until then, and this keeps
 *   ~300 kB out of the initial bundle.
 * - The engine is a module-level singleton so React re-renders (and StrictMode double effects) never
 *   create a second synth graph.
 * - Progressions are scheduled on Tone's Transport in ticks, so a tempo change applies immediately. Each
 *   chord is expanded into note events by its playback pattern (block, arpeggio...), see model/rhythm.ts.
 * - The sound (instrument) can be switched at any time; scheduled events use whichever voice is current
 *   when they fire.
 */
import type * as ToneNamespace from 'tone'
import { expandPattern, type PlaybackPattern } from '../model/rhythm'
import { createVoice, DEFAULT_INSTRUMENT, type InstrumentId, type Voice } from './instruments'

type Tone = typeof ToneNamespace

export interface SequenceStep {
  notes: number[]
  beats: number
  pattern?: PlaybackPattern
}

export interface SequenceCallbacks {
  onStep: (index: number) => void
  /** Called for every note event (e.g. each note of an arpeggio), for keyboard feedback. */
  onNotes?: (notes: number[]) => void
  /** During a count-in: beats left before the music starts (4, 3, 2, 1), then 0. */
  onCount?: (beatsLeft: number) => void
  onEnd: () => void
}

export interface SequenceOptions {
  loop?: boolean
  /** Beats of clicks before the first chord, played once even when looping. */
  countInBeats?: number
  /** A click on every beat while the music plays (accented on the first beat of each 4-beat bar). */
  metronome?: boolean
}

export type EngineStatus = 'idle' | 'starting' | 'ready' | 'error'

class AudioEngine {
  private tone: Tone | null = null
  private bus: ToneNamespace.InputNode | null = null
  private output: ToneNamespace.Volume | null = null
  private voice: Voice | null = null
  private click: ToneNamespace.Synth | null = null
  private instrument: InstrumentId = DEFAULT_INSTRUMENT
  private voicePromise: Promise<Voice> | null = null
  private initPromise: Promise<void> | null = null
  private scheduledIds: number[] = []
  private callbacks: SequenceCallbacks | null = null
  private volumeDb = -8

  /** Must be called from a user gesture (click/keypress) the first time. Safe to call repeatedly. */
  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.createGraph().catch((error: unknown) => {
        this.initPromise = null // allow a retry on the next gesture
        throw error instanceof Error ? error : new Error(String(error))
      })
    }
    return this.initPromise
  }

  private async createGraph(): Promise<void> {
    const Tone = await import('tone')
    await Tone.start()
    if (Tone.getContext().state !== 'running') {
      throw new Error('The browser did not allow audio to start.')
    }
    // Shared chain for every instrument: gentle compression, then a little room.
    const output = new Tone.Volume(this.volumeDb).toDestination()
    const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.18 }).connect(output)
    const compressor = new Tone.Compressor({ threshold: -18, ratio: 3 }).connect(reverb)
    // A short, dry sine blip for the count-in and metronome (kept out of the reverb so it stays precise).
    const click = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 } })
      .connect(new Tone.Volume(-10).connect(output))
    this.tone = Tone
    this.output = output
    this.bus = compressor
    this.click = click
    await this.loadVoice()
  }

  /** Builds the current instrument's voice once; concurrent callers share the same promise. */
  private loadVoice(): Promise<Voice> {
    if (!this.voicePromise) {
      const { tone, bus } = this.graph()
      const id = this.instrument
      this.voicePromise = createVoice(tone, id, bus).then((voice) => {
        if (id !== this.instrument) {
          voice.dispose() // the user switched again while this one was loading
          return this.loadVoice()
        }
        this.voice?.dispose()
        this.voice = voice
        return voice
      }).catch((error: unknown) => {
        this.voicePromise = null
        throw error instanceof Error ? error : new Error(String(error))
      })
    }
    return this.voicePromise
  }

  /** Switches the sound. Before audio has started this only records the choice. */
  async setInstrument(id: InstrumentId): Promise<void> {
    if (id === this.instrument) return
    this.instrument = id
    this.voicePromise = null
    if (this.tone) {
      this.voice?.releaseAll()
      await this.loadVoice()
    }
  }

  setVolume(db: number): void {
    this.volumeDb = db
    if (this.output) {
      this.output.volume.rampTo(db, 0.05)
    }
  }

  async playChord(notes: number[], seconds = 1.6): Promise<void> {
    await this.init()
    const voice = await this.loadVoice()
    const { tone } = this.graph()
    voice.play(this.frequencies(notes), seconds, tone.now() + 0.02, 0.75)
  }

  async playNote(midi: number, seconds = 0.9): Promise<void> {
    await this.init()
    const voice = await this.loadVoice()
    const { tone } = this.graph()
    voice.play(this.frequencies([midi]), seconds, tone.now() + 0.01, 0.8)
  }

  /** Starts a held note (from a MIDI keyboard). Velocity is 0-1. */
  async noteOn(midi: number, velocity: number): Promise<void> {
    await this.init()
    const voice = await this.loadVoice()
    const { tone } = this.graph()
    voice.attack(this.frequencies([midi])[0], tone.now(), velocity)
  }

  noteOff(midi: number): void {
    if (!this.tone || !this.voice) return
    this.voice.release(this.frequencies([midi])[0], this.tone.now())
  }

  /** Plays the steps once (or looped). Any running sequence is stopped first. */
  async playSequence(steps: SequenceStep[], bpm: number, callbacks: SequenceCallbacks, loopOrOptions: boolean | SequenceOptions = false): Promise<void> {
    const options: SequenceOptions = typeof loopOrOptions === 'boolean' ? { loop: loopOrOptions } : loopOrOptions
    const loop = options.loop ?? false
    const countIn = Math.max(0, Math.round(options.countInBeats ?? 0))
    await this.init()
    await this.loadVoice()
    this.stop()
    const { tone } = this.graph()
    if (steps.length === 0) {
      callbacks.onEnd()
      return
    }
    const transport = tone.getTransport()
    const ppq = transport.PPQ
    transport.bpm.value = bpm
    this.callbacks = callbacks

    const click = (atTick: number, accent: boolean, onBeat?: () => void) => {
      this.scheduledIds.push(transport.schedule((time) => {
        this.click?.triggerAttackRelease(accent ? 1760 : 1320, 0.03, time, accent ? 0.9 : 0.55)
        if (onBeat) tone.getDraw().schedule(onBeat, time)
      }, `${atTick}i`))
    }
    for (let beat = 0; beat < countIn; beat++) {
      click(beat * ppq, beat % 4 === 0, () => this.callbacks?.onCount?.(countIn - beat))
    }

    let tick = countIn * ppq
    steps.forEach((step, index) => {
      const stepTick = tick
      this.scheduledIds.push(transport.schedule((time) => {
        tone.getDraw().schedule(() => this.callbacks?.onStep(index), time)
      }, `${stepTick}i`))
      for (const event of expandPattern(step.notes, step.beats, step.pattern)) {
        const frequencies = this.frequencies(event.notes)
        const lengthTicks = Math.round(event.duration * ppq)
        this.scheduledIds.push(transport.schedule((time) => {
          // Duration is computed at trigger time so tempo changes during playback are respected.
          this.voice?.play(frequencies, tone.Ticks(lengthTicks).toSeconds(), time, event.velocity)
          tone.getDraw().schedule(() => this.callbacks?.onNotes?.(event.notes), time)
        }, `${stepTick + Math.round(event.start * ppq)}i`))
      }
      tick += step.beats * ppq
    })
    const total = tick
    if (countIn > 0) {
      this.scheduledIds.push(transport.schedule((time) => {
        tone.getDraw().schedule(() => this.callbacks?.onCount?.(0), time)
      }, `${countIn * ppq}i`))
    }
    if (options.metronome) {
      for (let at = countIn * ppq, beat = 0; at < total; at += ppq, beat++) click(at, beat % 4 === 0)
    }
    if (loop) {
      // The count-in sits before the loop region, so it is heard once.
      transport.loop = true
      transport.loopStart = `${countIn * ppq}i`
      transport.loopEnd = `${total}i`
    } else {
      transport.loop = false
      const endId = transport.schedule((time) => {
        tone.getDraw().schedule(() => {
          const cb = this.callbacks
          this.stop()
          cb?.onEnd()
        }, time)
      }, `${total}i`)
      this.scheduledIds.push(endId)
    }
    transport.position = 0
    transport.start('+0.05')
  }

  setTempo(bpm: number): void {
    if (this.tone) {
      this.tone.getTransport().bpm.rampTo(bpm, 0.05)
    }
  }

  /** Stops the transport, cancels scheduled events and releases sounding notes. Idempotent. */
  stop(): void {
    if (!this.tone) {
      return
    }
    const transport = this.tone.getTransport()
    transport.stop()
    transport.loop = false
    this.scheduledIds.forEach((id) => transport.clear(id))
    this.scheduledIds = []
    transport.cancel(0)
    this.voice?.releaseAll()
    this.callbacks = null
  }

  private frequencies(notes: number[]): number[] {
    const { tone } = this.graph()
    return notes.map((n) => tone.Frequency(n, 'midi').toFrequency())
  }

  private graph(): { tone: Tone; bus: ToneNamespace.InputNode } {
    if (!this.tone || !this.bus) {
      throw new Error('Audio engine is not initialised')
    }
    return { tone: this.tone, bus: this.bus }
  }
}

let engine: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!engine) {
    engine = new AudioEngine()
  }
  return engine
}

export type { AudioEngine }
