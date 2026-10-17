import type { Catalog, VoicedChord } from '../api/types'

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function pc(note: string): number {
  const base = NOTE_PC[note[0]]
  const acc = note.slice(1).replace(/\d+$/, '')
  return (base + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12
}

/** Builds a chord as the backend would return it (test data only; no theory is computed here). */
export function voiced(symbol: string, root: string, quality: string, notes: string[], voicingNotes: string[], voicing: number[], inversion = 0): VoicedChord {
  return {
    symbol,
    root,
    quality,
    qualityName: quality.toLowerCase(),
    inversion,
    bass: notes[inversion],
    notes,
    notesFromBass: [...notes.slice(inversion), ...notes.slice(0, inversion)],
    pitchClasses: [...new Set(notes.map(pc))].sort((a, b) => a - b),
    intervals: notes.map((note, i) => ({ note, name: i === 0 ? 'P1' : `I${i}`, fullName: i === 0 ? 'perfect unison' : `interval ${i}`, semitones: (pc(note) - pc(root) + 12) % 12 })),
    voicing,
    voicingNotes,
    durationBeats: null,
  }
}

export const AM = voiced('Am', 'A', 'MINOR', ['A', 'C', 'E'], ['A3', 'C4', 'E4'], [57, 60, 64])
export const F = voiced('F/A', 'F', 'MAJOR', ['F', 'A', 'C'], ['A3', 'C4', 'F4'], [57, 60, 65], 1)
export const C = voiced('C/G', 'C', 'MAJOR', ['C', 'E', 'G'], ['G3', 'C4', 'E4'], [55, 60, 64], 2)
export const G = voiced('G', 'G', 'MAJOR', ['G', 'B', 'D'], ['G3', 'B3', 'D4'], [55, 59, 62])
export const AM7 = voiced('Am7', 'A', 'MINOR7', ['A', 'C', 'E', 'G'], ['A3', 'C4', 'E4', 'G4'], [57, 60, 64, 67])
export const DM = voiced('Dm', 'D', 'MINOR', ['D', 'F', 'A'], ['D4', 'F4', 'A4'], [62, 65, 69])

export const CATALOG: Catalog = {
  qualities: [
    { id: 'MAJOR', name: 'Major triad', suffix: '', family: 'TRIAD', intervals: ['P1', 'M3', 'P5'], size: 3 },
    { id: 'MINOR', name: 'Minor triad', suffix: 'm', family: 'TRIAD', intervals: ['P1', 'm3', 'P5'], size: 3 },
    { id: 'MINOR7', name: 'Minor seventh', suffix: 'm7', family: 'SEVENTH', intervals: ['P1', 'm3', 'P5', 'm7'], size: 4 },
    { id: 'DOMINANT7', name: 'Dominant seventh', suffix: '7', family: 'SEVENTH', intervals: ['P1', 'M3', 'P5', 'm7'], size: 4 },
  ],
  roots: ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  keyTonics: { MAJOR: ['C', 'G', 'D', 'F'], MINOR: ['A', 'E', 'D'] },
  objectives: [
    { id: 'SMOOTH_VOICE_LEADING', label: 'Smooth voice leading', description: 'smooth' },
    { id: 'STRONGER_RESOLUTION', label: 'Stronger tonal resolution', description: 'resolve' },
    { id: 'DIATONIC_ALTERNATIVES', label: 'Diatonic alternatives', description: 'diatonic' },
    { id: 'HARMONIC_COLOR', label: 'More harmonic colour', description: 'colour' },
  ],
  voicingStyles: ['CLOSE', 'OPEN', 'DROP2'],
  defaultRegister: { low: 45, high: 79 },
  pitchConvention: 'C4 = MIDI 60',
}
