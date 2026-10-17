import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getAudioEngine, type EngineStatus, type SequenceStep } from './audioEngine'

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
  playSequence: (steps: SequenceStep[], bpm: number, options?: { loop?: boolean; owner?: string }) => Promise<void>
  /** Which UI element started the current sequence (e.g. "progression" or "alternative-2"). */
  sequenceOwner: string | null
  setTempo: (bpm: number) => void
  setVolume: (db: number) => void
  stop: () => void
}

const AudioContext = createContext<AudioApi | null>(null)

export function AudioProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<EngineStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [soundingNotes, setSoundingNotes] = useState<number[]>([])
  const [sequenceOwner, setSequenceOwner] = useState<string | null>(null)
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
  }, [])

  const api = useMemo<AudioApi>(() => ({
    status,
    error,
    playingIndex,
    isPlaying,
    soundingNotes,
    sequenceOwner,
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
            setPlayingIndex(index)
            setSoundingNotes(stepsRef.current[index]?.notes ?? [])
          },
          onEnd: () => {
            setIsPlaying(false)
            setPlayingIndex(null)
            setSequenceOwner(null)
            setSoundingNotes([])
          },
        }, options?.loop ?? false)
      } catch (e) {
        setIsPlaying(false)
        setSequenceOwner(null)
        throw e
      }
    }),
    setTempo: (bpm) => getAudioEngine().setTempo(bpm),
    setVolume: (db) => getAudioEngine().setVolume(db),
    stop,
  }), [status, error, playingIndex, isPlaying, soundingNotes, sequenceOwner, run, flash, stop])

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
