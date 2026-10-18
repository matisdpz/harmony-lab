import { useEffect } from 'react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { useAudio } from '../audio/AudioProvider'

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
}

/**
 * Workspace keyboard shortcuts. Editing shortcuts are ignored while typing in a form field;
 * Ctrl/Cmd+S (save) works everywhere.
 */
export function useWorkspaceShortcuts(togglePlay: (from?: number) => void) {
  const workspace = useWorkspace()
  const audio = useAudio()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (mod && key === 's') {
        event.preventDefault()
        void workspace.save()
        return
      }
      if (isTyping(event.target)) return
      const { chords } = workspace.content
      const index = workspace.selectedIndex
      const selected = workspace.selected

      if (mod && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) workspace.redo()
        else workspace.undo()
      } else if (mod && key === 'y') {
        event.preventDefault()
        workspace.redo()
      } else if (mod && key === 'd' && selected) {
        event.preventDefault()
        workspace.duplicateChord(selected.id)
      } else if (event.key === ' ' && !mod) {
        // Buttons also react to Space; only handle it when focus is not on a control, except on a measure,
        // where Space plays (as in a sequencer) instead of selecting the measure again.
        const target = event.target as HTMLElement | null
        if (target?.tagName === 'BUTTON' && target.dataset.spacePlays === undefined) return
        event.preventDefault()
        togglePlay(event.shiftKey && index >= 0 ? index : 0)
      } else if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && event.altKey) {
        if (chords.length === 0) return
        event.preventDefault()
        void workspace.transpose(event.key === 'ArrowUp' ? 1 : -1)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (chords.length === 0) return
        const delta = event.key === 'ArrowLeft' ? -1 : 1
        event.preventDefault()
        if (event.altKey && selected) {
          workspace.moveChord(selected.id, index + delta)
        } else {
          const next = index < 0 ? 0 : Math.max(0, Math.min(chords.length - 1, index + delta))
          workspace.select(chords[next].id)
        }
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
        event.preventDefault()
        workspace.removeChord(selected.id)
      } else if (event.key === 'Enter' && selected && (event.target as HTMLElement)?.tagName !== 'BUTTON') {
        void audio.playChord(selected.voicing)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [workspace, audio, togglePlay])
}
