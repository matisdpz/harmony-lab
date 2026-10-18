import type { ChordInput, KeyDto } from '../../api/types'
import { theoryApi } from '../../api/theory'
import { MAX_SEGMENT_BEATS, parseMidi, reduceForIdentification, segmentNotes } from '../../model/midiFile'

export interface ImportResult {
  name: string
  bpm: number | null
  chords: ChordInput[]
  /** Beats whose notes did not form a supported chord; they were added to the chord before them. */
  unrecognisedBeats: number
  /** True when the file had more than 64 chords and the rest was left out. */
  truncated: boolean
}

export const MAX_IMPORTED_CHORDS = 64

/**
 * Turns a MIDI file into chords: the file is cut into segments (model/midiFile), each distinct note set
 * is identified by the theory engine, and unrecognised beats are merged into the previous chord.
 */
export async function importMidi(bytes: ArrayBuffer, fileName: string, key: KeyDto): Promise<ImportResult> {
  const parsed = parseMidi(bytes)
  const segments = segmentNotes(parsed.notes, parsed.ppq)
  if (segments.length === 0) throw new Error('The file contains no notes.')

  const cache = new Map<string, Promise<ChordInput | null>>()
  const identify = (notes: number[]) => {
    const reduced = reduceForIdentification(notes)
    const id = reduced.join(',')
    if (!cache.has(id)) {
      cache.set(id, theoryApi.identify(reduced, key).then((r) => {
        const chord = r.candidates[0]?.chord
        return chord ? { root: chord.root, quality: chord.quality, inversion: chord.inversion } : null
      }))
    }
    return cache.get(id)!
  }
  const identified = await Promise.all(segments.map((s) => identify(s.notes)))

  const chords: ChordInput[] = []
  let unrecognisedBeats = 0
  segments.forEach((segment, i) => {
    const chord = identified[i]
    const last = chords[chords.length - 1]
    if (!chord) {
      unrecognisedBeats += segment.beats
      if (last) last.durationBeats = Math.min(MAX_SEGMENT_BEATS, (last.durationBeats ?? 0) + segment.beats)
      return
    }
    const same = last && last.root === chord.root && last.quality === chord.quality && last.inversion === chord.inversion
    if (same && (last.durationBeats ?? 0) + segment.beats <= MAX_SEGMENT_BEATS) {
      last.durationBeats = (last.durationBeats ?? 0) + segment.beats
    } else {
      chords.push({ ...chord, durationBeats: segment.beats })
    }
  })
  if (chords.length === 0) throw new Error('No chord in this file could be recognised. Harmony Lab reads chords, not melodies.')

  const name = (parsed.name.trim() || fileName.replace(/\.midi?$/i, '')).slice(0, 100) || 'Imported MIDI'
  return {
    name,
    bpm: parsed.bpm,
    chords: chords.slice(0, MAX_IMPORTED_CHORDS),
    unrecognisedBeats,
    truncated: chords.length > MAX_IMPORTED_CHORDS,
  }
}
