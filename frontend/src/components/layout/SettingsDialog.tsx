import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useSettings, type LabelMode, type Theme } from '../../state/SettingsProvider'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useAudio } from '../../audio/AudioProvider'
import { midiName } from '../../model/notes'
import styles from './SettingsDialog.module.css'

const LABEL_MODES: { id: LabelMode; label: string }[] = [
  { id: 'chord', label: 'Chord notes + C' },
  { id: 'all', label: 'All keys' },
  { id: 'none', label: 'None' },
]

const THEMES: { id: Theme; label: string }[] = [
  { id: 'auto', label: 'Match system' },
  { id: 'light', label: 'Day' },
  { id: 'dark', label: 'Night' },
]

const REGISTER_LOWS = [33, 36, 40, 43, 45, 48, 52, 55]
const REGISTER_HIGHS = [67, 72, 76, 79, 81, 84, 88, 91]

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const workspace = useWorkspace()
  const audio = useAudio()
  const closeButton = useRef<HTMLButtonElement>(null)
  const { register } = workspace.content

  useEffect(() => {
    closeButton.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 id="settings-title">Settings</h2>
          <button ref={closeButton} type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close settings">
            <X size={16} />
          </button>
        </header>

        <section className={styles.section}>
          <h3 className="panel-title">Display (this browser)</h3>
          <div className="field">
            <span className="field-label">Theme</span>
            <div className="segmented" role="group" aria-label="Theme">
              {THEMES.map((theme) => (
                <button key={theme.id} type="button" aria-pressed={settings.theme === theme.id}
                        onClick={() => settings.update({ theme: theme.id })}>
                  {theme.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Keyboard labels</span>
            <div className="segmented" role="group" aria-label="Keyboard labels">
              {LABEL_MODES.map((mode) => (
                <button key={mode.id} type="button" aria-pressed={settings.labelMode === mode.id}
                        onClick={() => settings.update({ labelMode: mode.id })}>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Clicking a measure</span>
            <div className="segmented" role="group" aria-label="Clicking a measure">
              <button type="button" aria-pressed={!settings.auditionOnSelect} onClick={() => settings.update({ auditionOnSelect: false })}>
                Selects it
              </button>
              <button type="button" aria-pressed={settings.auditionOnSelect} onClick={() => settings.update({ auditionOnSelect: true })}>
                Selects and plays it
              </button>
            </div>
          </div>
          <label className="field">
            <span className="field-label">Volume ({settings.volumeDb} dB)</span>
            <input type="range" min={-30} max={0} step={1} value={settings.volumeDb}
                   onChange={(e) => {
                     const db = Number(e.target.value)
                     settings.update({ volumeDb: db })
                     audio.setVolume(db)
                   }} />
          </label>
        </section>

        <section className={styles.section}>
          <h3 className="panel-title">Voicing register (saved with the project)</h3>
          <p className={styles.hint}>
            New chords, voice-leading candidates and suggestions are placed between these notes. Middle C is C4.
          </p>
          <div className={styles.row}>
            <label className="field">
              <span className="field-label">Lowest note</span>
              <select className="select" aria-label="Lowest note" value={register.low}
                      onChange={(e) => workspace.setRegister({ ...register, low: Number(e.target.value) })}>
                {REGISTER_LOWS.filter((n) => n <= register.high - 12).map((n) => <option key={n} value={n}>{midiName(n)}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Highest note</span>
              <select className="select" aria-label="Highest note" value={register.high}
                      onChange={(e) => workspace.setRegister({ ...register, high: Number(e.target.value) })}>
                {REGISTER_HIGHS.filter((n) => n >= register.low + 12).map((n) => <option key={n} value={n}>{midiName(n)}</option>)}
              </select>
            </label>
          </div>
        </section>
      </div>
    </div>
  )
}
