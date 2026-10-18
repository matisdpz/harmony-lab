// Standard MIDI File export and import. Reading and writing the binary format is done by @tonejs/midi;
// this module decides what goes in (chords played with their rhythm) and how a file is cut back into
// chords (one beat at a time, merging beats that hold the same notes).
import { Midi } from '@tonejs/midi'
import { expandPattern, type PlaybackPattern } from './rhythm'

export interface ExportChord {
  voicing: number[]
  beats: number
  pattern?: PlaybackPattern
}

const PPQ = 480

/** One track, piano program, each chord expanded by its playback pattern. */
export function progressionToMidi(chords: ExportChord[], bpm: number, name: string): Uint8Array {
  const midi = new Midi()
  midi.header.setTempo(bpm)
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] })
  midi.header.name = name
  const track = midi.addTrack()
  track.name = name
  track.instrument.number = 0 // acoustic grand piano
  let beat = 0
  for (const chord of chords) {
    for (const event of expandPattern(chord.voicing, chord.beats, chord.pattern)) {
      for (const note of event.notes) {
        track.addNote({
          midi: note,
          ticks: Math.round((beat + event.start) * PPQ),
          durationTicks: Math.max(1, Math.round(event.duration * PPQ)),
          velocity: event.velocity,
        })
      }
    }
    beat += chord.beats
  }
  return midi.toArray()
}

export interface FileNote {
  midi: number
  ticks: number
  durationTicks: number
}

export interface ParsedMidi {
  notes: FileNote[]
  ppq: number
  bpm: number | null
  name: string
}

/** Reads every pitched note of a file (channel 10, drums, is ignored). */
export function parseMidi(bytes: ArrayBuffer | Uint8Array): ParsedMidi {
  const midi = new Midi(bytes)
  const notes = midi.tracks
    .filter((track) => track.channel !== 9)
    .flatMap((track) => track.notes.map((n) => ({ midi: n.midi, ticks: n.ticks, durationTicks: n.durationTicks })))
  const bpm = midi.header.tempos[0]?.bpm ?? null
  return { notes, ppq: midi.header.ppq, bpm: bpm === null ? null : Math.round(bpm), name: midi.header.name }
}

export interface Segment {
  /** Distinct MIDI notes sounding in the segment, low to high. */
  notes: number[]
  beats: number
}

export const MAX_SEGMENT_BEATS = 16

/**
 * Cuts the notes into chord segments. A note belongs to a beat when it sounds for at least half of it,
 * which ignores short passing notes; when that leaves fewer than two pitch classes (a broken chord made
 * of short notes), every note heard during the surrounding pair of beats is used instead. Consecutive beats with the same notes are merged; a silent beat
 * extends the previous segment. Segments are capped at 16 beats (the longest chord a project stores).
 */
export function segmentNotes(notes: FileNote[], ppq: number): Segment[] {
  if (notes.length === 0) return []
  const end = Math.max(...notes.map((n) => n.ticks + n.durationTicks))
  const beatCount = Math.ceil(end / ppq - 1e-6)
  const segments: Segment[] = []
  for (let beat = 0; beat < beatCount; beat++) {
    const from = beat * ppq
    const to = from + ppq
    const overlap = (n: FileNote, start: number, end: number) => Math.min(end, n.ticks + n.durationTicks) - Math.max(start, n.ticks)
    const held = distinct(notes.filter((n) => overlap(n, from, to) >= ppq / 2))
    // Broken chords (Alberti, arpeggios in short notes) show only part of the chord in one beat, so use
    // every note heard in the surrounding pair of beats instead.
    const pairStart = Math.floor(beat / 2) * 2 * ppq
    const sounding = new Set(held.map((n) => n % 12)).size >= 2
      ? held
      : distinct(notes.filter((n) => overlap(n, pairStart, pairStart + 2 * ppq) > 0))
    const last = segments[segments.length - 1]
    if (sounding.length === 0 || (last && same(last.notes, sounding))) {
      if (last && last.beats < MAX_SEGMENT_BEATS) last.beats += 1
      else if (last) segments.push({ notes: last.notes, beats: 1 })
      continue
    }
    segments.push({ notes: sounding, beats: 1 })
  }
  return segments
}

/** Keeps the bass plus one note per other pitch class (identification accepts at most 8 notes). */
export function reduceForIdentification(notes: number[]): number[] {
  const sorted = [...notes].sort((a, b) => a - b)
  const seen = new Set<number>()
  return sorted.filter((n) => {
    if (seen.has(n % 12)) return false
    seen.add(n % 12)
    return true
  }).slice(0, 8)
}

function distinct(notes: FileNote[]): number[] {
  return [...new Set(notes.map((n) => n.midi))].sort((a, b) => a - b)
}

function same(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i])
}
