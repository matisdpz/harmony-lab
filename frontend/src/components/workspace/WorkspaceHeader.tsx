import { useState } from 'react'
import { KeyPicker } from '../common/KeyPicker'
import { FileMenu } from './FileMenu'
import { KeyHint } from './KeyHint'
import { SoundPicker } from '../audio/SoundPicker'
import { ArrowDown, ArrowUp, Pause, Play, Redo2, Repeat, Save, Square, Undo2 } from 'lucide-react'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useSettings } from '../../state/SettingsProvider'
import { useAudio } from '../../audio/AudioProvider'
import { MAX_TEMPO, MIN_TEMPO } from '../../model/workspace'
import { Spinner } from '../common/Status'
import styles from './WorkspaceHeader.module.css'

export function validateTempo(text: string): string | null {
  if (!/^\d+$/.test(text.trim())) return 'Tempo must be a whole number'
  const value = Number(text)
  if (value < MIN_TEMPO || value > MAX_TEMPO) return `Tempo must be between ${MIN_TEMPO} and ${MAX_TEMPO} BPM`
  return null
}

export function WorkspaceHeader({ onTogglePlay }: { onTogglePlay: (from?: number) => void }) {
  const workspace = useWorkspace()
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
          <FileMenu />
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
          <KeyPicker value={content.key} onChange={(key) => workspace.setKey(key)} />
          <div className="field">
            <span className="field-label">Transpose</span>
            <div className="segmented" role="group" aria-label="Transpose">
              <button type="button" onClick={() => void workspace.transpose(-1)} disabled={content.chords.length === 0}
                      aria-label="Transpose down a semitone" title="Down a semitone (Alt+↓)"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => void workspace.transpose(1)} disabled={content.chords.length === 0}
                      aria-label="Transpose up a semitone" title="Up a semitone (Alt+↑)"><ArrowUp size={14} /></button>
            </div>
          </div>
          <label className="field">
            <span className="field-label">Tempo (BPM)</span>
            <input className={`input ${styles.tempo}`} inputMode="numeric" value={tempoText}
                   aria-invalid={tempoError !== null} aria-describedby={tempoError ? 'tempo-error' : undefined}
                   onChange={(e) => onTempoChange(e.target.value)}
                   onBlur={() => tempoError && setDraft({ tempo: content.tempoBpm, text: String(content.tempoBpm) })} />
          </label>
          <SoundPicker />
        </div>

        <div className={styles.transport}>
          <button type="button" className={`btn btn-primary ${styles.play}`} onClick={() => onTogglePlay()}
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
      <KeyHint />
      {tempoError && <p id="tempo-error" className="field-error" role="alert">{tempoError}</p>}
      {audio.error && <p className="field-error" role="alert">{audio.error}</p>}
    </header>
  )
}
