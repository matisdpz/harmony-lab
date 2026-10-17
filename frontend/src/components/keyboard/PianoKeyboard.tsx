import { memo } from 'react'
import { isBlackKey, midiName } from '../../model/notes'
import type { LabelMode } from '../../state/SettingsProvider'
import styles from './PianoKeyboard.module.css'

export interface KeyHighlight {
  role: 'root' | 'tone'
  /** Spelled note (e.g. "Eb4") from the chord; shown on the key. */
  label?: string
}

interface PianoKeyboardProps {
  low: number
  high: number
  highlights?: ReadonlyMap<number, KeyHighlight>
  /** Notes currently sounding (playback feedback). */
  sounding?: readonly number[]
  labelMode?: LabelMode
  onKeyPress?: (midi: number) => void
  label: string
}

/** Extends a range outward so it starts and ends on white keys. */
function whiteBounds(low: number, high: number): [number, number] {
  let lo = low
  let hi = high
  while (isBlackKey(lo)) lo -= 1
  while (isBlackKey(hi)) hi += 1
  return [lo, hi]
}

/**
 * An interactive keyboard drawn with positioned buttons. Highlighting is purely data-driven: the parent
 * passes the MIDI notes of the chord voicing computed by the backend.
 */
export const PianoKeyboard = memo(function PianoKeyboard({
  low, high, highlights, sounding = [], labelMode = 'chord', onKeyPress, label,
}: PianoKeyboardProps) {
  const [lo, hi] = whiteBounds(low, high)
  const whites: number[] = []
  for (let m = lo; m <= hi; m++) if (!isBlackKey(m)) whites.push(m)
  const whiteWidth = 100 / whites.length
  const soundingSet = new Set(sounding)

  const keys = []
  let whiteIndex = 0
  for (let midi = lo; midi <= hi; midi++) {
    const black = isBlackKey(midi)
    const highlight = highlights?.get(midi)
    const name = midiName(midi)
    let text: string | null = null
    if (labelMode !== 'none' && highlight?.label) text = highlight.label
    else if (labelMode === 'all') text = name
    else if (labelMode === 'chord' && !black && midi % 12 === 0) text = name

    const position = black
      ? { left: `${whiteIndex * whiteWidth - whiteWidth * 0.31}%`, width: `${whiteWidth * 0.62}%` }
      : { left: `${whiteIndex * whiteWidth}%`, width: `${whiteWidth}%` }
    const description = highlight ? `${highlight.label ?? name}, ${highlight.role === 'root' ? 'chord root' : 'chord tone'}` : name

    keys.push(
      <button
        key={midi}
        type="button"
        className={[
          styles.key,
          black ? styles.black : styles.white,
          highlight ? styles[highlight.role] : '',
          soundingSet.has(midi) ? styles.sounding : '',
          text && highlight ? styles.labelled : '',
        ].join(' ')}
        style={position}
        data-midi={midi}
        data-highlight={highlight?.role ?? 'none'}
        aria-label={description}
        onClick={onKeyPress ? () => onKeyPress(midi) : undefined}
        tabIndex={onKeyPress ? 0 : -1}
      >
        {text && <span className={styles.label}>{text}</span>}
      </button>,
    )
    if (!black) whiteIndex += 1
  }

  return (
    <div className={styles.keyboard} role="group" aria-label={label}>
      {keys}
    </div>
  )
})
