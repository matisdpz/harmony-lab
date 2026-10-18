import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, FileMusic, Upload } from 'lucide-react'
import { theoryApi } from '../../api/theory'
import { errorMessage } from '../../api/http'
import { MAX_TEMPO, MIN_TEMPO, emptyContent, toSlot } from '../../model/workspace'
import { progressionToMidi } from '../../model/midiFile'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useToast } from '../../state/ToastProvider'
import { useProjectSwitching } from '../layout/useOpenProject'
import { importMidi } from './midiImport'
import styles from './WorkspaceHeader.module.css'

/** Import and export of Standard MIDI Files, kept in one small menu so the header stays quiet. */
export function FileMenu() {
  const workspace = useWorkspace()
  const { notify } = useToast()
  const { confirmDiscard } = useProjectSwitching()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const { content } = workspace

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const exportMidi = () => {
    setOpen(false)
    const bytes = progressionToMidi(
      content.chords.map((c) => ({ voicing: c.voicing, beats: c.durationBeats, pattern: c.pattern })), content.tempoBpm, content.name)
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/midi' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${content.name.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') || 'progression'}.mid`
    link.click()
    URL.revokeObjectURL(url)
    notify('success', `Exported ${link.download}`)
  }

  const importFile = async (file: File) => {
    if (!(await confirmDiscard())) return
    setBusy(true)
    try {
      const result = await importMidi(await file.arrayBuffer(), file.name, content.key)
      const voiced = await theoryApi.optimize({ chords: result.chords, register: content.register, allowInversions: false, keepFirstVoicing: false })
      const tempoBpm = result.bpm === null ? content.tempoBpm : Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, result.bpm))
      workspace.loadContent({
        ...emptyContent(content.key),
        name: result.name,
        tempoBpm,
        register: content.register,
        chords: voiced.chords.map((chord, i) => toSlot(chord, undefined, result.chords[i].durationBeats)),
      })
      const notes = [
        result.unrecognisedBeats > 0 && `${result.unrecognisedBeats} beat${result.unrecognisedBeats === 1 ? '' : 's'} without a recognisable chord were added to the chord before`,
        result.truncated && 'only the first 64 chords were kept',
      ].filter(Boolean)
      notify('success', `Imported ${voiced.chords.length} chords from ${file.name}${notes.length ? ` (${notes.join('; ')})` : ''}. Check the key, then save.`)
    } catch (e) {
      notify('error', `Could not import ${file.name}: ${errorMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.menu} ref={root}>
      <button type="button" className="btn btn-ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
              disabled={busy}>
        <FileMusic size={15} aria-hidden /> {busy ? 'Importing…' : 'File'} <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className={styles.menuList} role="menu" aria-label="File">
          <button type="button" role="menuitem" onClick={() => {
            setOpen(false)
            fileInput.current?.click()
          }}>
            <Upload size={15} aria-hidden />
            <span>Import MIDI file…<small>Chords are recognised beat by beat</small></span>
          </button>
          <button type="button" role="menuitem" onClick={exportMidi} disabled={content.chords.length === 0}>
            <Download size={15} aria-hidden />
            <span>Export as MIDI<small>With each chord's rhythm, at {content.tempoBpm} BPM</small></span>
          </button>
        </div>
      )}
      <input ref={fileInput} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden aria-label="MIDI file to import"
             onChange={(e) => {
               const file = e.target.files?.[0]
               e.target.value = ''
               if (file) void importFile(file)
             }} />
    </div>
  )
}
