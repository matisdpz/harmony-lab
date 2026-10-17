// Presentation helpers for the keyboard. Music theory (spelling, chord tones) comes from the backend;
// these only name keys that are not part of a chord.

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK = new Set([1, 3, 6, 8, 10])

export function isBlackKey(midi: number): boolean {
  return BLACK.has(((midi % 12) + 12) % 12)
}

/** Scientific pitch notation with sharps (C4 = MIDI 60). */
export function midiName(midi: number): string {
  return `${SHARP_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

/** Shifts the octave number of a spelled note such as "Eb4" by a number of octaves. */
export function shiftNoteOctave(note: string, octaves: number): string {
  const match = /^(.*?)(-?\d+)$/.exec(note)
  return match ? `${match[1]}${Number(match[2]) + octaves}` : note
}

export function stripOctave(note: string): string {
  return note.replace(/-?\d+$/, '')
}
