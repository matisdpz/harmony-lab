import { useState } from 'react'
import { Pause, Play, Redo2, Repeat, Save, Square, Undo2 } from 'lucide-react'
import type { Mode } from '../../api/types'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useCatalog } from '../../state/CatalogProvider'
import { useSettings } from '../../state/SettingsProvider'
import { useAudio } from '../../audio/AudioProvider'
import { MAX_TEMPO, MIN_TEMPO } from '../../model/workspace'
import { formatMusic } from '../../model/notes'
import { Spinner } from '../common/Status'
import styles from './WorkspaceHeader.module.css'

export function validateTempo(text: string): string | null {
  if (!/^\d+$/.test(text.trim())) return 'Tempo must be a whole number'
  const value = Number(text)
  if (value < MIN_TEMPO || value > MAX_TEMPO) return `Tempo must be between ${MIN_TEMPO} and ${MAX_TEMPO} BPM`
  return null
}

export function WorkspaceHeader({ onTogglePlay }: { onTogglePlay: () => void }) {
  const workspace = useWorkspace()
  const catalog = useCatalog()
  const audio = useAudio()
  const settings = useSettings()
  const { content, state, dirty } = workspace
  // The draft remembers which tempo it was typed against, so external changes (undo, loading a
  // project) replace it, while an invalid draft stays visible until it is fixed.
  const [draft, setDraft] = useState({ tempo: content.tempoBpm, text: String(content.tempoBpm) })
  const tempoText = draft.tempo === content.tempoBpm ? draft.text : String(content.tempoBpm)
  const tempoError = validateTempo(tempoText)
  const playing = audio.isPlaying && audio.sequenceOwner === 'progression'

  const onTempoChange = (text: string) => {
    if (validateTempo(text) === null) {
      setDraft({ tempo: Number(text), text })
      workspace.setTempo(Number(text))
      audio.setTempo(Number(text))
    } else {
      setDraft({ tempo: content.tempoBpm, text })
    }
  }

  const setMode = (mode: Mode) => {
    const tonics = catalog.keyTonics[mode]
    workspace.setKey({ mode, tonic: tonics.includes(content.key.tonic) ? content.key.tonic : tonics[0] })
  }

  const status = state.projectId === null
    ? (content.chords.length > 0 || dirty ? 'Not saved yet' : 'New project')
    : dirty ? 'Unsaved changes' : 'All changes saved'

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div className={styles.titleBlock}>
          <label htmlFor="project-name" className="visually-hidden">Project name</label>
          <input
            id="project-name"
            className={styles.title}
            value={content.name}
            maxLength={100}
            onChange={(e) => workspace.setName(e.target.value)}
            aria-invalid={content.name.trim() === ''}
            placeholder="Project name"
          />
          <span className={`${styles.status} ${dirty ? styles.dirty : ''}`} aria-live="polite">
            {dirty && <span className={styles.dot} aria-hidden />}
            {status}
          </span>
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn btn-ghost btn-icon" onClick={workspace.undo} disabled={state.past.length === 0}
                  aria-label="Undo" title="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={workspace.redo} disabled={state.future.length === 0}
                  aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={16} />
          </button>
          <button type="button" className="btn" onClick={() => void workspace.save()}
                  disabled={workspace.saving || (!dirty && state.projectId !== null)} title="Save (Ctrl+S)">
            {workspace.saving ? <Spinner label="Saving" /> : <><Save size={15} aria-hidden /> Save</>}
          </button>
        </div>
      </div>

      {workspace.conflict && (
        <div className={styles.conflict} role="alert">
          <span>{workspace.conflict.message}</span>
          <div className={styles.conflictActions}>
            <button type="button" className="btn btn-sm" onClick={() => void workspace.reloadSaved()}>Load saved version</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void workspace.saveAsCopy()}>Save mine as a copy</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={workspace.dismissConflict}>Dismiss</button>
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <div className={styles.group}>
          <label className="field">
            <span className="field-label">Key</span>
            <select className="select" value={content.key.tonic} aria-label="Key tonic"
                    onChange={(e) => workspace.setKey({ ...content.key, tonic: e.target.value })}>
              {catalog.keyTonics[content.key.mode].map((t) => <option key={t} value={t}>{formatMusic(t)}</option>)}
            </select>
          </label>
          <div className="field">
            <span className="field-label">Scale</span>
            <div className="segmented" role="group" aria-label="Scale">
              <button type="button" aria-pressed={content.key.mode === 'MAJOR'} onClick={() => setMode('MAJOR')}>Major</button>
              <button type="button" aria-pressed={content.key.mode === 'MINOR'} onClick={() => setMode('MINOR')}>Natural minor</button>
            </div>
          </div>
          <label className="field">
            <span className="field-label">Tempo (BPM)</span>
            <input className={`input ${styles.tempo}`} inputMode="numeric" value={tempoText}
                   aria-invalid={tempoError !== null} aria-describedby={tempoError ? 'tempo-error' : undefined}
                   onChange={(e) => onTempoChange(e.target.value)}
                   onBlur={() => tempoError && setDraft({ tempo: content.tempoBpm, text: String(content.tempoBpm) })} />
          </label>
        </div>

        <div className={styles.transport}>
          <button type="button" className={`btn btn-primary ${styles.play}`} onClick={onTogglePlay}
                  disabled={content.chords.length === 0} title="Play / stop (Space)">
            {playing ? <><Square size={14} aria-hidden /> Stop</> : <><Play size={14} aria-hidden /> Play</>}
          </button>
          <button type="button" className="btn btn-ghost btn-icon" aria-pressed={settings.loop}
                  onClick={() => settings.update({ loop: !settings.loop })} aria-label="Loop playback" title="Loop">
            <Repeat size={15} className={settings.loop ? styles.on : undefined} />
          </button>
          <span className={styles.position} aria-live="off">
            {playing && audio.playingIndex !== null
              ? <><Pause size={12} aria-hidden className={styles.on} /> Chord {audio.playingIndex + 1} of {content.chords.length}</>
              : `${content.chords.length} chord${content.chords.length === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>
      {tempoError && <p id="tempo-error" className="field-error" role="alert">{tempoError}</p>}
      {audio.error && <p className="field-error" role="alert">{audio.error}</p>}
    </header>
  )
}
