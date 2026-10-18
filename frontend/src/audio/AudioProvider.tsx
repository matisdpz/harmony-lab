import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getAudioEngine, type EngineStatus, type SequenceStep } from './audioEngine'
import type { InstrumentId } from './instruments'
import { useSettings } from '../state/SettingsProvider'

interface AudioApi {
  status: EngineStatus
  error: string | null
  /** Index of the step currently sounding during sequence playback, or null. */
  playingIndex: number | null
  isPlaying: boolean
  /** MIDI notes currently highlighted as "sounding" (for keyboard feedback). */
  soundingNotes: number[]
  playChord: (notes: number[]) => Promise<void>
  playNote: (midi: number) => Promise<void>
  /** `firstIndex` is the progression index of the first step, when playback starts mid-progression. */
  playSequence: (steps: SequenceStep[], bpm: number, options?: {
    loop?: boolean; owner?: string; firstIndex?: number; countInBeats?: number; metronome?: boolean
  }) => Promise<void>
  /** Beats left in a count-in (4, 3, 2, 1), or null when not counting in. */
  countIn: number | null
  /** Which UI element started the current sequence (e.g. "progression" or "alternative-2"). */
  sequenceOwner: string | null
  setTempo: (bpm: number) => void
  setVolume: (db: number) => void
  /** The current sound; changing it is remembered in this browser. */
  instrument: InstrumentId
  setInstrument: (id: InstrumentId) => void
  /** True while a sound is being prepared (e.g. piano samples downloading). */
  instrumentLoading: boolean
  stop: () => void
}

const AudioContext = createContext<AudioApi | null>(null)

export function AudioProvider({ children }: { children: ReactNode }) {
  const settings = useSettings()
  // The sound the engine has finished preparing; while it differs from the chosen one, the new sound is loading.
  const [loadedInstrument, setLoadedInstrument] = useState<InstrumentId | null>(null)
  const [status, setStatus] = useState<EngineStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [soundingNotes, setSoundingNotes] = useState<number[]>([])
  const [sequenceOwner, setSequenceOwner] = useState<string | null>(null)
  const [countIn, setCountIn] = useState<number | null>(null)
  const stepsRef = useRef<SequenceStep[]>([])
  const flashTimer = useRef<number | undefined>(undefined)

  const run = useCallback(async (action: () => Promise<void>) => {
    if (status !== 'ready') setStatus('starting')
    try {
      await action()
      setStatus('ready')
      setError(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('error')
      // Reported through `status`/`error` (shown in the transport bar) rather than rethrown,
      // so callers can fire-and-forget from click handlers.
      setError(`Audio could not start: ${message}`)
    }
  }, [status])

  const flash = useCallback((notes: number[], ms: number) => {
    window.clearTimeout(flashTimer.current)
    setSoundingNotes(notes)
    flashTimer.current = window.setTimeout(() => setSoundingNotes([]), ms)
  }, [])

  const stop = useCallback(() => {
    getAudioEngine().stop()
    setIsPlaying(false)
    setPlayingIndex(null)
    setSequenceOwner(null)
    setSoundingNotes([])
    setCountIn(null)
  }, [])

  const api = useMemo<AudioApi>(() => ({
    status,
    error,
    playingIndex,
    isPlaying,
    soundingNotes,
    sequenceOwner,
    countIn,
    playChord: (notes) => run(async () => {
      await getAudioEngine().playChord(notes)
      flash(notes, 900)
    }),
    playNote: (midi) => run(async () => {
      await getAudioEngine().playNote(midi)
      flash([midi], 400)
    }),
    playSequence: (steps, bpm, options) => run(async () => {
      stepsRef.current = steps
      setSequenceOwner(options?.owner ?? null)
      setIsPlaying(true)
      try {
        await getAudioEngine().playSequence(steps, bpm, {
          onStep: (index) => {
            setPlayingIndex(index + (options?.firstIndex ?? 0))
          },
          // Show what is actually sounding: the whole chord, or one note at a time in an arpeggio.
          onNotes: (notes) => setSoundingNotes(notes),
          onCount: (beatsLeft) => setCountIn(beatsLeft > 0 ? beatsLeft : null),
          onEnd: () => {
            setIsPlaying(false)
            setPlayingIndex(null)
            setSequenceOwner(null)
            setSoundingNotes([])
          },
        }, { loop: options?.loop ?? false, countInBeats: options?.countInBeats, metronome: options?.metronome })
      } catch (e) {
        setIsPlaying(false)
        setSequenceOwner(null)
        throw e
      }
    }),
    setTempo: (bpm) => getAudioEngine().setTempo(bpm),
    setVolume: (db) => getAudioEngine().setVolume(db),
    instrument: settings.instrument,
    setInstrument: (id) => settings.update({ instrument: id }),
    instrumentLoading: loadedInstrument !== settings.instrument,
    stop,
  }), [status, error, playingIndex, isPlaying, soundingNotes, sequenceOwner, countIn, run, flash, stop, settings, loadedInstrument])

  // Keep the engine in line with the saved preferences. Before the first click this only records them;
  // afterwards a new sound is built (the piano downloads its samples once).
  const { instrument, volumeDb } = settings
  useEffect(() => {
    getAudioEngine().setVolume(volumeDb)
  }, [volumeDb])
  useEffect(() => {
    let current = true
    getAudioEngine().setInstrument(instrument)
      .then(() => current && setError(null))
      .catch((e: unknown) => current && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => current && setLoadedInstrument(instrument))
    return () => {
      current = false
    }
  }, [instrument])

  // Stop playback when the provider unmounts (e.g. tests, hot reload). The engine itself is kept.
  useEffect(() => () => {
    window.clearTimeout(flashTimer.current)
    getAudioEngine().stop()
  }, [])

  return <AudioContext.Provider value={api}>{children}</AudioContext.Provider>
}

export function useAudio(): AudioApi {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used inside <AudioProvider>')
  }
  return context
}
