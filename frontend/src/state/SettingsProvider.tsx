import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type LabelMode = 'chord' | 'all' | 'none'

export interface Settings {
  labelMode: LabelMode
  volumeDb: number
  loop: boolean
}

interface SettingsApi extends Settings {
  update: (changes: Partial<Settings>) => void
}

const STORAGE_KEY = 'harmony-lab.settings'
const DEFAULTS: Settings = { labelMode: 'chord', volumeDb: -8, loop: false }

const SettingsContext = createContext<SettingsApi | null>(null)

function load(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS
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
