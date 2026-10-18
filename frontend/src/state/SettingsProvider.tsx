import { DEFAULT_INSTRUMENT, isInstrumentId, type InstrumentId } from '../audio/instruments'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type LabelMode = 'chord' | 'all' | 'none'
export type Theme = 'auto' | 'light' | 'dark'

export interface Settings {
  labelMode: LabelMode
  volumeDb: number
  loop: boolean
  /** 'auto' follows the operating system; the other two pin the palette. */
  theme: Theme
  /** The sound used for every playback. */
  instrument: InstrumentId
  /** Reconnect the MIDI keyboard on the next visit. */
  midiEnabled: boolean
  /** Clicking a measure also plays its chord. */
  auditionOnSelect: boolean
  /** One bar of clicks before an improvisation loop starts. */
  countIn: boolean
  /** A click on every beat during improvisation. */
  metronome: boolean
}

interface SettingsApi extends Settings {
  update: (changes: Partial<Settings>) => void
}

const STORAGE_KEY = 'harmony-lab.settings'
const DEFAULTS: Settings = { labelMode: 'chord', volumeDb: -8, loop: false, theme: 'auto', instrument: DEFAULT_INSTRUMENT, midiEnabled: false, auditionOnSelect: false, countIn: true, metronome: false }

const SettingsContext = createContext<SettingsApi | null>(null)

function load(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const saved = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
    return isInstrumentId(saved.instrument) ? saved : { ...saved, instrument: DEFAULT_INSTRUMENT, midiEnabled: false }
  } catch {
    return DEFAULTS // storage can be unavailable (private mode); settings then last for the session
  }
}

/** Per-browser display preferences. Project data is never stored here. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore: preferences are a convenience
    }
  }, [settings])

  // The CSS palette uses light-dark(); data-theme on <html> pins color-scheme, its absence follows the system.
  // index.html applies the same rule before React loads, so the page never flashes the wrong theme.
  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  const api = useMemo<SettingsApi>(() => ({
    ...settings,
    update: (changes) => setSettings((s) => ({ ...s, ...changes })),
  }), [settings])

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>')
  return context
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}
