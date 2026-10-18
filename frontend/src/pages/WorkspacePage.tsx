import { useWorkspace } from '../state/WorkspaceProvider'
import { useAudio } from '../audio/AudioProvider'
import { WorkspaceHeader } from '../components/workspace/WorkspaceHeader'
import { ProgressionEditor } from '../components/workspace/ProgressionEditor'
import { ChordInspector } from '../components/workspace/ChordInspector'
import { SuggestionsPanel } from '../components/workspace/SuggestionsPanel'
import { VoiceLeadingSummary } from '../components/workspace/VoiceLeadingSummary'
import { AnalysisPanel } from '../components/analysis/AnalysisPanel'
import { KeyboardPanel, chordHighlights } from '../components/keyboard/KeyboardPanel'
import { formatMusic } from '../model/notes'
import { Spinner } from '../components/common/Status'
import { useProgressionPlayback } from './usePlayback'
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts'
import styles from './WorkspacePage.module.css'

export function WorkspacePage() {
  const workspace = useWorkspace()
  const audio = useAudio()
  const playback = useProgressionPlayback()
  useWorkspaceShortcuts(playback.toggle)

  // During playback the keyboard follows the sounding chord; otherwise it shows the selection.
  const playingChord = playback.playing && audio.playingIndex !== null ? workspace.content.chords[audio.playingIndex] : null
  const shown = playingChord ?? workspace.selected

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <WorkspaceHeader onTogglePlay={playback.toggle} />
      </div>
      <div className={styles.main}>
        {workspace.initializing ? <Spinner label="Loading example progression" /> : <ProgressionEditor />}
        <KeyboardPanel
          highlights={chordHighlights(shown)}
          follow={shown?.voicing}
          title={shown ? <><span className="score">{formatMusic(shown.symbol)}</span> <span className={styles.keyboardNotes}>{shown.voicingNotes.map(formatMusic).join(' ')}</span></> : 'Keyboard'}
          label="Piano keyboard showing the selected chord"
        />
        <AnalysisPanel />
      </div>
      <aside className={styles.inspector} aria-label="Inspector">
        <ChordInspector />
        <VoiceLeadingSummary />
        <SuggestionsPanel />
      </aside>
    </div>
  )
}
