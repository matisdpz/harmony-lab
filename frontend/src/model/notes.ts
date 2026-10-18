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

// Display only: the API and inputs keep ASCII spelling ("Eb", "F#m7b5"); the UI shows real accidentals.
const ACCIDENTALS: Record<string, string> = { bb: '𝄫', b: '♭', '##': '𝄪', '#': '♯' }

/** Chord symbols, note names and Roman numerals: "F#m7b5" → "F♯m7♭5", "bVII" → "♭VII". */
export function formatMusic(text: string): string {
  return text
    .replace(/([A-G])(bb|##|b|#)/g, (_, letter: string, acc: string) => letter + ACCIDENTALS[acc])
    .replace(/(^|[^A-Za-z])b(?=[IViv])/g, '$1♭')
    .replace(/#(?=[IViv])/g, '♯')
    .replace(/b(?=\d)/g, '♭')
    .replace(/#(?=\d)/g, '♯')
}

/**
 * Running text: converts accidentals in note names, chord symbols ("F#m7b5", "Ebmaj7") and numerals
 * ("#viø7"), but never inside ordinary words ("Absent", "About").
 */
export function formatMusicProse(text: string): string {
  return text.replace(/(^|[^A-Za-z])([A-G](?:bb|##|b|#)?|[#b](?=[IViv\d]))([^\s,.;:)]*)/g,
    (match, before: string, head: string, rest: string) => {
      const token = head + rest
      // A chord symbol, note or numeral: letter + optional accidental, then only chord-suffix characters.
      const symbol = /^(?:[A-G](?:bb|##|b|#)?|[#b])(?:m|maj|min|dim|aug|sus|add|ø|°|[IViv]+|[\d#b+/()A-G-])*$/
      return symbol.test(token) && /[#b]/.test(token) ? before + formatMusic(token) : match
    })
}
