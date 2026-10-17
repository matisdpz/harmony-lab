/**
 * Single audio engine for the whole page, built on Tone.js.
 *
 * - Tone.js is imported lazily on the first user gesture: browsers block audio until then, and this keeps
 *   ~300 kB out of the initial bundle.
 * - The engine is a module-level singleton so React re-renders (and StrictMode double effects) never
 *   create a second synth graph.
 * - Progressions are scheduled on Tone's Transport in ticks, so a tempo change applies immediately and
 *   all notes of a chord share one timestamp (they sound together).
 */
import type * as ToneNamespace from 'tone'

type Tone = typeof ToneNamespace

export interface SequenceStep {
  notes: number[]
  beats: number
}

export interface SequenceCallbacks {
  onStep: (index: number) => void
  onEnd: () => void
}

export type EngineStatus = 'idle' | 'starting' | 'ready' | 'error'

class AudioEngine {
  private tone: Tone | null = null
  private synth: ToneNamespace.PolySynth<ToneNamespace.FMSynth> | null = null
  private output: ToneNamespace.Volume | null = null
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
    const output = new Tone.Volume(this.volumeDb).toDestination()
    const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.18 }).connect(output)
    const filter = new Tone.Filter({ type: 'lowpass', frequency: 4200, rolloff: -12 }).connect(reverb)
    const compressor = new Tone.Compressor({ threshold: -18, ratio: 3 }).connect(filter)
    // A soft FM voice: sine carrier with a low modulation index approximates an electric-piano tone.
    const synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 1.6,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.004, decay: 1.4, sustain: 0.18, release: 1.3 },
      modulationEnvelope: { attack: 0.004, decay: 0.5, sustain: 0.1, release: 0.8 },
    }).connect(compressor)
    synth.maxPolyphony = 32
    this.tone = Tone
    this.synth = synth
    this.output = output
  }

  setVolume(db: number): void {
    this.volumeDb = db
    if (this.output) {
      this.output.volume.rampTo(db, 0.05)
    }
  }

  async playChord(notes: number[], seconds = 1.6): Promise<void> {
    await this.init()
    const { tone, synth } = this.ready()
    const now = tone.now() + 0.02
    synth.triggerAttackRelease(notes.map((n) => tone.Frequency(n, 'midi').toFrequency()), seconds, now, 0.75)
  }

  async playNote(midi: number, seconds = 0.9): Promise<void> {
    await this.init()
    const { tone, synth } = this.ready()
    synth.triggerAttackRelease(tone.Frequency(midi, 'midi').toFrequency(), seconds, tone.now() + 0.01, 0.8)
  }

  /** Plays the steps once (or looped). Any running sequence is stopped first. */
  async playSequence(steps: SequenceStep[], bpm: number, callbacks: SequenceCallbacks, loop = false): Promise<void> {
    await this.init()
    this.stop()
    const { tone, synth } = this.ready()
    if (steps.length === 0) {
      callbacks.onEnd()
      return
    }
    const transport = tone.getTransport()
    const ppq = transport.PPQ
    transport.bpm.value = bpm
    this.callbacks = callbacks

    let tick = 0
    steps.forEach((step, index) => {
      const startTick = tick
      const lengthTicks = step.beats * ppq
      const id = transport.schedule((time) => {
        // Duration is computed at trigger time so tempo changes during playback are respected.
        const seconds = tone.Ticks(lengthTicks).toSeconds() * 0.96
        synth.triggerAttackRelease(step.notes.map((n) => tone.Frequency(n, 'midi').toFrequency()), seconds, time, 0.72)
        tone.getDraw().schedule(() => this.callbacks?.onStep(index), time)
      }, `${startTick}i`)
      this.scheduledIds.push(id)
      tick += lengthTicks
    })
    const total = tick
    if (loop) {
      transport.loop = true
      transport.loopStart = 0
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
    if (!this.tone || !this.synth) {
      return
    }
    const transport = this.tone.getTransport()
    transport.stop()
    transport.loop = false
    this.scheduledIds.forEach((id) => transport.clear(id))
    this.scheduledIds = []
    transport.cancel(0)
    this.synth.releaseAll()
    this.callbacks = null
  }

  private ready(): { tone: Tone; synth: ToneNamespace.PolySynth<ToneNamespace.FMSynth> } {
    if (!this.tone || !this.synth) {
      throw new Error('Audio engine is not initialised')
    }
    return { tone: this.tone, synth: this.synth }
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
