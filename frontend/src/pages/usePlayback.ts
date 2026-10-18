import { useCallback } from 'react'
import { useAudio } from '../audio/AudioProvider'
import { useSettings } from '../state/SettingsProvider'
import { useWorkspace } from '../state/WorkspaceProvider'

/** Play/stop for the whole progression, shared by the transport button and the Space shortcut. */
export function useProgressionPlayback() {
  const audio = useAudio()
  const workspace = useWorkspace()
  const { loop } = useSettings()
  const playing = audio.isPlaying && audio.sequenceOwner === 'progression'

  /** Plays from the start, or from a given chord (e.g. the selected one); stops when already playing. */
  const toggle = useCallback((from = 0) => {
    if (playing) {
      audio.stop()
      return
    }
    const chords = workspace.content.chords.slice(Math.max(0, from))
    if (chords.length === 0) return
    void audio.playSequence(chords.map((c) => ({ notes: c.voicing, beats: c.durationBeats, pattern: c.pattern })), workspace.content.tempoBpm,
      { loop, owner: 'progression', firstIndex: Math.max(0, from) })
  }, [playing, audio, workspace.content.chords, workspace.content.tempoBpm, loop])

  return { playing, toggle }
}
