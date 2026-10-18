import { expandPattern } from './rhythm'

const C_MAJOR = [64, 60, 67] // deliberately unsorted

const notesOf = (pattern: Parameters<typeof expandPattern>[2], beats = 2) =>
  expandPattern(C_MAJOR, beats, pattern).map((e) => e.notes.join('+'))

describe('expandPattern', () => {
  it('plays a block chord as one event held for the whole chord', () => {
    const events = expandPattern(C_MAJOR, 4, 'BLOCK')
    expect(events).toHaveLength(1)
    expect(events[0].notes).toEqual([60, 64, 67])
    expect(events[0].duration).toBeLessThanOrEqual(4)
  })

  it('arpeggiates in eighths and lets the notes ring to the end of the chord', () => {
    const events = expandPattern(C_MAJOR, 2, 'ARPEGGIO_UP')
    expect(events.map((e) => e.notes[0])).toEqual([60, 64, 67, 60])
    expect(events.map((e) => e.start)).toEqual([0, 0.5, 1, 1.5])
    events.forEach((e) => expect(e.start + e.duration).toBeLessThanOrEqual(2))
  })

  it('goes down, and up-and-down without repeating the outer notes', () => {
    expect(notesOf('ARPEGGIO_DOWN')).toEqual(['67', '64', '60', '67'])
    expect(notesOf('ARPEGGIO_UP_DOWN', 3)).toEqual(['60', '64', '67', '64', '60', '64'])
  })

  it('plays the Alberti figure low, high, middle, high', () => {
    expect(notesOf('ALBERTI')).toEqual(['60', '67', '64', '67'])
    expect(expandPattern([48, 55, 60, 64], 1, 'ALBERTI').map((e) => e.notes[0])).toEqual([48, 64])
  })

  it('repeats the chord on every beat and alternates bass and chord', () => {
    expect(notesOf('REPEATED', 3)).toEqual(['60+64+67', '60+64+67', '60+64+67'])
    expect(notesOf('BASS_CHORD', 4)).toEqual(['60', '64+67', '60', '64+67'])
    expect(notesOf('BASS_CHORD', 1)).toEqual(['60', '64+67'])
  })

  it('never schedules anything past the end of the chord', () => {
    for (const pattern of ['BLOCK', 'ARPEGGIO_UP', 'ARPEGGIO_DOWN', 'ARPEGGIO_UP_DOWN', 'ALBERTI', 'REPEATED', 'BASS_CHORD'] as const) {
      for (const beats of [1, 2, 3, 4, 6]) {
        expandPattern(C_MAJOR, beats, pattern).forEach((e) => expect(e.start + e.duration).toBeLessThanOrEqual(beats + 1e-9))
      }
    }
  })

  it('handles empty and single-note voicings', () => {
    expect(expandPattern([], 4, 'ALBERTI')).toEqual([])
    expect(expandPattern([60], 2, 'ARPEGGIO_UP')).toHaveLength(1)
  })
})
