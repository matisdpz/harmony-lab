import { useState, type DragEvent } from 'react'
import { ChevronLeft, ChevronRight, Copy, Music, Play, Trash2 } from 'lucide-react'
import type { ChordAnalysisView } from '../../api/types'
import type { ChordSlot } from '../../model/workspace'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useAudio } from '../../audio/AudioProvider'
import { useConfirm } from '../../state/ConfirmProvider'
import { EmptyState, Spinner } from '../common/Status'
import { AddChordForm } from './AddChordForm'
import styles from './ProgressionEditor.module.css'

export function ProgressionEditor() {
  const workspace = useWorkspace()
  const audio = useAudio()
  const confirm = useConfirm()
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
        <div className={styles.hint}>
          <span className="kbd">←</span><span className="kbd">→</span> select · <span className="kbd">Alt</span>+arrows move ·
          <span className="kbd">Space</span> play
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void clear()} disabled={chords.length === 0}>
          <Trash2 size={13} aria-hidden /> Clear
        </button>
      </div>

      {chords.length === 0 ? (
        <EmptyState icon={<Music size={22} />} title="No chords yet"
                    action={<button type="button" className="btn" onClick={() => void workspace.loadExample()}>Load example (Am – F – C – G)</button>}>
          Add a chord below by typing a symbol such as <span className="mono">Dm7</span> or <span className="mono">G/B</span>,
          or start from the example progression.
        </EmptyState>
      ) : (
        <ol className={styles.strip} onDragLeave={() => setDropIndex(null)}>
          {chords.map((chord, index) => (
            <li key={chord.id}
                className={`${styles.slot} ${dropIndex === index ? styles.dropBefore : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropIndex(index)
                }}
                onDrop={(e) => onDrop(e, index)}>
              <ChordCard
                chord={chord}
                index={index}
                count={chords.length}
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
      )}

      <AddChordForm />
    </section>
  )
}

function ChordCard({ chord, index, count, analysis, selected, playing, pending, onDragStart }: {
  chord: ChordSlot
  index: number
  count: number
  analysis?: ChordAnalysisView
  selected: boolean
  playing: boolean
  pending: boolean
  onDragStart: (e: DragEvent) => void
}) {
  const workspace = useWorkspace()
  const audio = useAudio()
  const category = analysis?.category
  return (
    <div className={`${styles.card} ${selected ? styles.selected : ''} ${playing ? styles.playing : ''}`}
         draggable onDragStart={onDragStart} data-testid="chord-card">
      <button type="button" className={styles.select} onClick={() => workspace.select(chord.id)}
              aria-pressed={selected} aria-label={`Chord ${index + 1}: ${chord.symbol}`}>
        <span className={styles.index}>{index + 1}</span>
        <span className={styles.symbol}>{chord.symbol}</span>
        <span className={`${styles.roman} ${category && category !== 'DIATONIC' ? styles.chromatic : ''}`}>
          {analysis ? analysis.label : '·'}
        </span>
        <span className={styles.notes}>{chord.notesFromBass.join(' ')}</span>
        <span className={styles.beats}>{chord.durationBeats} beat{chord.durationBeats === 1 ? '' : 's'}</span>
        {pending && <span className={styles.pending}><Spinner label="Updating" /></span>}
      </button>
      {selected && (
        <div className={styles.cardActions}>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => void audio.playChord(chord.voicing)} aria-label={`Play ${chord.symbol}`}>
            <Play size={13} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => workspace.moveChord(chord.id, index - 1)}
                  disabled={index === 0} aria-label="Move left">
            <ChevronLeft size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => workspace.moveChord(chord.id, index + 1)}
                  disabled={index === count - 1} aria-label="Move right">
            <ChevronRight size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => workspace.duplicateChord(chord.id)} aria-label="Duplicate chord">
            <Copy size={13} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => workspace.removeChord(chord.id)} aria-label="Remove chord">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
