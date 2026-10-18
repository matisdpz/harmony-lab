// Playback patterns: how a chord's notes are spread over its beats. Pure functions, so the rhythm can be
// tested without audio and reused by playback and MIDI export.

export type PlaybackPattern =
  | 'BLOCK' | 'ARPEGGIO_UP' | 'ARPEGGIO_DOWN' | 'ARPEGGIO_UP_DOWN' | 'ALBERTI' | 'REPEATED' | 'BASS_CHORD'

export const PATTERNS: { id: PlaybackPattern; label: string; description: string }[] = [
  { id: 'BLOCK', label: 'Block', description: 'All notes together, held for the whole chord.' },
  { id: 'ARPEGGIO_UP', label: 'Arpeggio up', description: 'One note per eighth, from the bass up, letting notes ring.' },
  { id: 'ARPEGGIO_DOWN', label: 'Arpeggio down', description: 'One note per eighth, from the top down.' },
  { id: 'ARPEGGIO_UP_DOWN', label: 'Arpeggio up and down', description: 'Up then back down, without repeating the outer notes.' },
  { id: 'ALBERTI', label: 'Alberti bass', description: 'Low, high, middle, high in eighths, as in Classical accompaniment.' },
  { id: 'REPEATED', label: 'Repeated', description: 'The whole chord on every beat.' },
  { id: 'BASS_CHORD', label: 'Bass and chord', description: 'Bass note on strong beats, the upper notes in between.' },
]

/** One thing to play: notes starting together. Times are in beats from the start of the chord. */
export interface NoteEvent {
  notes: number[]
  start: number
  duration: number
  velocity: number
}

const EIGHTH = 0.5

export function expandPattern(voicing: readonly number[], beats: number, pattern: PlaybackPattern = 'BLOCK'): NoteEvent[] {
  const notes = [...voicing].sort((a, b) => a - b)
  if (notes.length === 0 || beats <= 0) return []
  const block: NoteEvent[] = [{ notes, start: 0, duration: beats * 0.96, velocity: 0.72 }]
  if (notes.length === 1 && pattern !== 'REPEATED') return block

  switch (pattern) {
    case 'BLOCK':
      return block
    case 'ARPEGGIO_UP':
      return broken(notes, beats, true)
    case 'ARPEGGIO_DOWN':
      return broken([...notes].reverse(), beats, true)
    case 'ARPEGGIO_UP_DOWN':
      return broken([...notes, ...notes.slice(1, -1).reverse()], beats, true)
    case 'ALBERTI': {
      if (notes.length < 3) return broken(notes, beats, true)
      const low = notes[0]
      const high = notes[notes.length - 1]
      const middle = notes[Math.floor(notes.length / 2)]
      return broken([low, high, middle, high], beats, false)
    }
    case 'REPEATED':
      return Array.from({ length: Math.ceil(beats) }, (_, beat) => ({
        notes, start: beat, duration: Math.min(1, beats - beat) * 0.85, velocity: beat === 0 ? 0.72 : 0.6,
      }))
    case 'BASS_CHORD': {
      const bass = [notes[0]]
      const upper = notes.slice(1)
      if (beats < 2) {
        return [
          { notes: bass, start: 0, duration: beats / 2 * 0.95, velocity: 0.72 },
          { notes: upper, start: beats / 2, duration: beats / 2 * 0.9, velocity: 0.58 },
        ]
      }
      return Array.from({ length: Math.ceil(beats) }, (_, beat) => beat % 2 === 0
        ? { notes: bass, start: beat, duration: 0.95, velocity: 0.72 }
        : { notes: upper, start: beat, duration: Math.min(1, beats - beat) * 0.8, velocity: 0.58 })
    }
  }
}

/** One note per eighth, cycling through `order`. `ring` lets each note sound until the chord ends. */
function broken(order: number[], beats: number, ring: boolean): NoteEvent[] {
  const count = Math.max(1, Math.floor(beats / EIGHTH))
  return Array.from({ length: count }, (_, i) => {
    const start = i * EIGHTH
    return {
      notes: [order[i % order.length]],
      start,
      duration: ring ? (beats - start) * 0.96 : EIGHTH * 0.92,
      velocity: i % order.length === 0 ? 0.7 : 0.6,
    }
  })
}
