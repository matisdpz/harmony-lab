import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { VoicedChord } from '../../api/types'
import { useAudio } from '../../audio/AudioProvider'
import { useSettings } from '../../state/SettingsProvider'
import { stripOctave } from '../../model/notes'
import { PianoKeyboard, type KeyHighlight } from './PianoKeyboard'
import styles from './KeyboardPanel.module.css'

/** Highlights for a voiced chord: root vs other chord tones, labelled with the chord's own spelling. */
export function chordHighlights(chord: Pick<VoicedChord, 'voicing' | 'voicingNotes' | 'root'> | null): Map<number, KeyHighlight> {
  const map = new Map<number, KeyHighlight>()
  if (!chord) return map
  chord.voicing.forEach((midi, i) => {
    const label = chord.voicingNotes[i]
    map.set(midi, { role: stripOctave(label) === chord.root ? 'root' : 'tone', label })
  })
  return map
}

interface KeyboardPanelProps {
  highlights: Map<number, KeyHighlight>
  title?: ReactNode
  /** Extra toolbar content (e.g. legend or actions). */
  actions?: ReactNode
  onKeyPress?: (midi: number) => void
  /** Notes to keep in view; the range follows them when they leave the visible octaves. */
  follow?: readonly number[]
  label?: string
}

const OCTAVE_OPTIONS = [2, 3, 4, 5]

export function KeyboardPanel({ highlights, title, actions, onKeyPress, follow, label = 'Piano keyboard' }: KeyboardPanelProps) {
  const audio = useAudio()
  const { labelMode } = useSettings()
  // Phones get two octaves so keys stay tappable; wider screens start with four (C2-B5).
  const narrow = typeof window !== 'undefined' && window.innerWidth < 700
  const [startOctave, setStartOctave] = useState(narrow ? 3 : 2) // C3 = MIDI 48, C2 = MIDI 36
  const [octaves, setOctaves] = useState(narrow ? 2 : 4)
  const low = (startOctave + 1) * 12
  const high = low + octaves * 12 - 1

  // Keep the chord visible: if the followed notes leave the range, move the range (not the notes).
  const followKey = follow?.join(',') ?? ''
  useEffect(() => {
    if (!follow || follow.length === 0) return
    const min = Math.min(...follow)
    const max = Math.max(...follow)
    if (min >= low && max <= high) return
    const span = octaves * 12
    const centredLow = Math.floor((min + max) / 2 - span / 2)
    const octave = Math.max(0, Math.min(7 - octaves + 1, Math.round(centredLow / 12) - 1))
    setStartOctave(octave)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followKey, octaves])

  const outOfRange = [...highlights.keys()].filter((m) => m < low || m > high).length

  return (
    <section className={styles.panel} aria-label={label}>
      <div className={styles.toolbar}>
        <div className={styles.title}>{title}</div>
        <div className={styles.legend} aria-hidden>
          <span className={styles.swatchRoot} /> Root
          <span className={styles.swatchTone} /> Chord tone
        </div>
        <div className={styles.controls}>
          {actions}
          <div className={styles.range}>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setStartOctave((o) => Math.max(0, o - 1))}
                    disabled={startOctave === 0} aria-label="Shift keyboard down an octave">
              <ChevronLeft size={15} />
            </button>
            <span className="mono" aria-live="polite">C{startOctave}–B{startOctave + octaves - 1}</span>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setStartOctave((o) => Math.min(8 - octaves, o + 1))}
                    disabled={startOctave >= 8 - octaves} aria-label="Shift keyboard up an octave">
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="segmented" role="group" aria-label="Visible octaves">
            {OCTAVE_OPTIONS.map((n) => (
              <button key={n} type="button" aria-pressed={octaves === n}
                      onClick={() => {
                        setOctaves(n)
                        setStartOctave((o) => Math.min(o, 8 - n))
                      }}>
                {n} oct
              </button>
            ))}
          </div>
        </div>
      </div>
      {outOfRange > 0 && (
        <p className={styles.notice} role="status">
          {outOfRange} chord note{outOfRange > 1 ? 's are' : ' is'} outside the visible range.
        </p>
      )}
      <PianoKeyboard
        low={low}
        high={high}
        highlights={highlights}
        sounding={audio.soundingNotes}
        labelMode={labelMode}
        onKeyPress={onKeyPress ?? ((midi) => void audio.playNote(midi))}
        label={label}
      />
    </section>
  )
}
