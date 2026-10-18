import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import type { ChordView } from '../../api/types'
import { theoryApi } from '../../api/theory'
import { formatMusic, midiName } from '../../model/notes'
import { useMidi } from '../../state/MidiProvider'
import { useWorkspace } from '../../state/WorkspaceProvider'
import styles from './ProgressionEditor.module.css'

type Heard = { notes: number[]; chord: ChordView | null }

/**
 * When a chord is held on a MIDI keyboard, names it and offers to add it. The last chord stays on
 * screen after the keys are released, so there is time to click "Add".
 */
export function MidiChordHint() {
  const midi = useMidi()
  const workspace = useWorkspace()
  const [heard, setHeard] = useState<Heard | null>(null)
  const held = midi.heldNotes
  const heldKey = held.join(',')
  const key = workspace.content.key

  useEffect(() => {
    if (held.length < 2) return
    let current = true
    // Wait until the hand has settled on the chord before asking the server.
    const timer = window.setTimeout(() => {
      theoryApi.identify(held.slice(0, 8), key)
        .then((r) => current && setHeard({ notes: held, chord: r.candidates[0]?.chord ?? null }))
        .catch(() => current && setHeard({ notes: held, chord: null }))
    }, 180)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldKey, key.tonic, key.mode])

  if (midi.status !== 'on' || !heard) return null
  const insertAt = workspace.selectedIndex >= 0 ? workspace.selectedIndex + 1 : undefined
  const names = heard.notes.map((n) => formatMusic(midiName(n))).join(' ')
  return (
    <div className={styles.midiHint} role="status">
      {heard.chord ? (
        <>
          <span>Playing <strong className="score">{formatMusic(heard.chord.symbol)}</strong></span>
          <span className={styles.midiNotes}>{names}</span>
          <button type="button" className="btn btn-sm" onClick={() => {
            const chord = heard.chord!
            void workspace.addChord(chord.root, chord.quality, insertAt, chord.inversion)
            setHeard(null)
          }}>
            <Plus size={14} aria-hidden /> Add {formatMusic(heard.chord.symbol)}
          </button>
        </>
      ) : (
        <span>Playing {names}: not a chord Harmony Lab knows.</span>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHeard(null)}>Dismiss</button>
    </div>
  )
}
