import { parseMidi, progressionToMidi, reduceForIdentification, segmentNotes } from './midiFile'

const PPQ = 480
const note = (midi: number, beat: number, beats: number) => ({ midi, ticks: beat * PPQ, durationTicks: beats * PPQ })

describe('MIDI export', () => {
  it('writes the tempo and every note of every chord, with its rhythm', () => {
    const bytes = progressionToMidi([
      { voicing: [57, 60, 64], beats: 4 },
      { voicing: [53, 57, 60], beats: 2, pattern: 'ARPEGGIO_UP' },
    ], 96, 'Test')
    const parsed = parseMidi(bytes)
    expect(parsed.bpm).toBe(96)
    expect(parsed.name).toBe('Test')
    const block = parsed.notes.filter((n) => n.ticks === 0).map((n) => n.midi).sort()
    expect(block).toEqual([57, 60, 64])
    const arpeggioStarts = parsed.notes.filter((n) => n.ticks >= 4 * PPQ).map((n) => [n.midi, n.ticks / PPQ])
    expect(arpeggioStarts).toEqual([[53, 4], [57, 4.5], [60, 5], [53, 5.5]])
  })
})

describe('segmentNotes', () => {
  it('merges beats holding the same notes into one chord', () => {
    const notes = [note(57, 0, 4), note(60, 0, 4), note(64, 0, 4), note(53, 4, 2), note(57, 4, 2), note(60, 4, 2)]
    expect(segmentNotes(notes, PPQ)).toEqual([{ notes: [57, 60, 64], beats: 4 }, { notes: [53, 57, 60], beats: 2 }])
  })

  it('round-trips an exported block progression', () => {
    const bytes = progressionToMidi([{ voicing: [57, 60, 64], beats: 4 }, { voicing: [55, 59, 62], beats: 2 }], 120, 'x')
    const { notes, ppq } = parseMidi(bytes)
    expect(segmentNotes(notes, ppq).map((s) => [s.notes, s.beats])).toEqual([[[57, 60, 64], 4], [[55, 59, 62], 2]])
  })

  it('ignores short passing notes and extends a chord over silent beats', () => {
    const notes = [note(48, 0, 2), note(52, 0, 2), note(55, 0, 2), { midi: 62, ticks: 0, durationTicks: PPQ / 4 }]
    expect(segmentNotes(notes, PPQ)).toEqual([{ notes: [48, 52, 55], beats: 2 }])
    expect(segmentNotes([note(48, 0, 1), note(52, 0, 1), note(48, 3, 1), note(52, 3, 1)], PPQ))
      .toEqual([{ notes: [48, 52], beats: 4 }])
  })

  it('recognises broken chords made of short notes, such as an Alberti bass', () => {
    const bytes = progressionToMidi([{ voicing: [48, 52, 55], beats: 2, pattern: 'ALBERTI' }, { voicing: [53, 57, 60], beats: 2 }], 100, 'x')
    const { notes, ppq } = parseMidi(bytes)
    expect(segmentNotes(notes, ppq)).toEqual([{ notes: [48, 52, 55], beats: 2 }, { notes: [53, 57, 60], beats: 2 }])
  })

  it('caps a segment at 16 beats', () => {
    const segments = segmentNotes([note(48, 0, 20), note(52, 0, 20)], PPQ)
    expect(segments.map((s) => s.beats)).toEqual([16, 4])
  })
})

describe('reduceForIdentification', () => {
  it('keeps the bass and one note per pitch class', () => {
    expect(reduceForIdentification([60, 48, 64, 55, 67, 72])).toEqual([48, 55, 64])
  })
})
