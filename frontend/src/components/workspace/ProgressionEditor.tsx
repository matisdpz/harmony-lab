import { useState, type CSSProperties, type DragEvent } from 'react'
import { useProgressionPlayback } from '../../pages/usePlayback'
import type { PlaybackPattern } from '../../model/rhythm'
import { ChevronLeft, ChevronRight, Copy, Music, Play, Square, StepForward, Trash2 } from 'lucide-react'
import type { ChordAnalysisView } from '../../api/types'
import type { ChordSlot } from '../../model/workspace'
import { formatMusic } from '../../model/notes'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useSettings } from '../../state/SettingsProvider'
import { useAudio } from '../../audio/AudioProvider'
import { useConfirm } from '../../state/ConfirmProvider'
import { EmptyState, Spinner } from '../common/Status'
import { AddChordForm } from './AddChordForm'
import { MidiChordHint } from './MidiChordHint'
import styles from './ProgressionEditor.module.css'

/**
 * The progression drawn as one line of a lead sheet: one measure per chord, its width proportional to
 * the chord's beats, beat slashes on a staff, and the Roman numeral underneath.
 */
export function ProgressionEditor() {
  const workspace = useWorkspace()
  const audio = useAudio()
  const confirm = useConfirm()
  const { loop } = useSettings()
  const { content, state } = workspace
  const chords = content.chords
  const analysis = workspace.analysis.data
  const playingIndex = audio.isPlaying && audio.sequenceOwner === 'progression' ? audio.playingIndex : null
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const onDrop = (event: DragEvent, index: number) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain') || dragId
    if (id) {
      const from = chords.findIndex((c) => c.id === id)
      workspace.moveChord(id, from < index ? index - 1 : index)
    }
    setDragId(null)
    setDropIndex(null)
  }

  const clear = async () => {
    const ok = await confirm({
      title: 'Clear the progression?',
      message: `This removes all ${chords.length} chords. You can undo it with Ctrl+Z.`,
      confirmLabel: 'Clear',
      danger: true,
    })
    if (ok) workspace.clear()
  }

  return (
    <section className={styles.editor} aria-label="Chord progression">
      <div className={styles.toolbar}>
        <h2 className="panel-title">Progression</h2>
        <SelectionActions />
        <button type="button" className={`btn btn-ghost btn-sm ${styles.clear}`} onClick={() => void clear()} disabled={chords.length === 0}>
          <Trash2 size={14} aria-hidden /> Clear
        </button>
      </div>

      {chords.length === 0 ? (
        <EmptyState icon={<Music size={22} />} title="No chords yet"
                    action={<button type="button" className="btn" onClick={() => void workspace.loadExample()}>Load example (Am – F – C – G)</button>}>
          Add a chord below by typing a symbol such as <span className="score">Dm7</span> or <span className="score">G/B</span>,
          or start from the example progression.
        </EmptyState>
      ) : (
        <div className={styles.scroller}>
          <ol className={`${styles.strip} ${loop ? styles.looping : ''}`} onDragLeave={() => setDropIndex(null)}>
            {chords.map((chord, index) => (
              <li key={chord.id}
                  className={`${styles.slot} ${dropIndex === index ? styles.dropBefore : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropIndex(index)
                  }}
                  onDrop={(e) => onDrop(e, index)}>
                <Measure
                  chord={chord}
                  index={index}
                  tempo={content.tempoBpm}
                  analysis={analysis?.chords[index]?.symbol === chord.symbol ? analysis.chords[index] : undefined}
                  selected={chord.id === state.selectedId}
                  playing={playingIndex === index}
                  pending={workspace.pendingIds.has(chord.id)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', chord.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDragId(chord.id)
                  }}
                />
              </li>
            ))}
            <li className={`${styles.endDrop} ${dropIndex === chords.length ? styles.dropBefore : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropIndex(chords.length)
                }}
                onDrop={(e) => onDrop(e, chords.length)} aria-hidden />
          </ol>
        </div>
      )}

      <MidiChordHint />
      <AddChordForm />
    </section>
  )
}

/** Actions on the selected chord live in the toolbar, so selecting a measure never changes its size. */
function SelectionActions() {
  const workspace = useWorkspace()
  const audio = useAudio()
  const playback = useProgressionPlayback()
  const chord = workspace.selected
  const index = workspace.selectedIndex
  const count = workspace.content.chords.length
  if (!chord) return null
  return (
    <div className={styles.selection} role="group" aria-label={`Selected chord: ${chord.symbol}`}>
      <span className={styles.selectionName}>{formatMusic(chord.symbol)}</span>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => void audio.playChord(chord.voicing)} aria-label={`Play ${chord.symbol}`} title="Play chord">
        <Play size={14} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => playback.toggle(index)}
              aria-label={playback.playing ? 'Stop playback' : 'Play from this chord'} title={playback.playing ? 'Stop' : 'Play from this chord (Shift+Space)'}>
        {playback.playing ? <Square size={13} /> : <StepForward size={15} />}
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => workspace.moveChord(chord.id, index - 1)}
              disabled={index === 0} aria-label="Move left" title="Move left (Alt+←)">
        <ChevronLeft size={15} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => workspace.moveChord(chord.id, index + 1)}
              disabled={index === count - 1} aria-label="Move right" title="Move right (Alt+→)">
        <ChevronRight size={15} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => workspace.duplicateChord(chord.id)} aria-label="Duplicate chord" title="Duplicate">
        <Copy size={14} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => workspace.removeChord(chord.id)} aria-label="Remove chord" title="Remove">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

/** Short performance directions, written above the staff as in a score. */
const PATTERN_MARKS: Record<PlaybackPattern, string> = {
  BLOCK: '',
  ARPEGGIO_UP: 'arp. ↑',
  ARPEGGIO_DOWN: 'arp. ↓',
  ARPEGGIO_UP_DOWN: 'arp. ↕',
  ALBERTI: 'Alberti',
  REPEATED: 'rep.',
  BASS_CHORD: 'bass–chord',
}

function Measure({ chord, index, tempo, analysis, selected, playing, pending, onDragStart }: {
  chord: ChordSlot
  index: number
  tempo: number
  analysis?: ChordAnalysisView
  selected: boolean
  playing: boolean
  pending: boolean
  onDragStart: (e: DragEvent) => void
}) {
  const workspace = useWorkspace()
  const audio = useAudio()
  const { auditionOnSelect } = useSettings()
  const category = analysis?.category
  const beats = chord.durationBeats
  // --beats sets the measure width; --duration lets the playhead cross the measure in real time.
  const style = { '--beats': beats, '--duration': `${(beats * 60) / tempo}s` } as CSSProperties
  return (
    <div className={`${styles.measure} ${selected ? styles.selected : ''} ${playing ? styles.playing : ''}`}
         style={style} draggable onDragStart={onDragStart} data-testid="chord-card">
      <button type="button" className={styles.select} onClick={() => {
        workspace.select(chord.id)
        if (auditionOnSelect) void audio.playChord(chord.voicing)
      }}
              aria-pressed={selected} aria-label={`Chord ${index + 1}: ${chord.symbol}`} data-space-plays>
        <span className={styles.number}>{index + 1}</span>
        {chord.pattern !== 'BLOCK' && <span className={styles.direction}>{PATTERN_MARKS[chord.pattern]}</span>}
        <span className={styles.symbol}>{formatMusic(chord.symbol)}</span>
        <span className={styles.staff} aria-hidden>
          {Array.from({ length: beats }, (_, i) => <span key={i} className={styles.slash} />)}
          {playing && <span className={styles.playhead} />}
        </span>
        <span className={styles.beats}>{beats} beat{beats === 1 ? '' : 's'}</span>
        <span className={`${styles.roman} ${category && category !== 'DIATONIC' ? styles.chromatic : ''}`}>
          {analysis ? formatMusic(analysis.label) : ' '}
        </span>
        <span className={styles.notes}>{chord.notesFromBass.map(formatMusic).join(' ')}</span>
        {pending && <span className={styles.pending}><Spinner label="Updating" /></span>}
      </button>
    </div>
  )
}
