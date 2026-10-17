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

  const toggle = useCallback(() => {
    if (playing) {
      audio.stop()
      return
    }
    const chords = workspace.content.chords
    if (chords.length === 0) return
    void audio.playSequence(chords.map((c) => ({ notes: c.voicing, beats: c.durationBeats })), workspace.content.tempoBpm,
      { loop, owner: 'progression' })
  }, [playing, audio, workspace.content.chords, workspace.content.tempoBpm, loop])

  return { playing, toggle }
}
