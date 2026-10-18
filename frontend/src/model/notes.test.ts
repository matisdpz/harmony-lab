import { formatMusic, formatMusicProse } from './notes'

describe('formatMusic', () => {
  it.each([
    ['F#m7b5', 'F♯m7♭5'],
    ['Bbmaj7', 'B♭maj7'],
    ['Ebm7/Gb', 'E♭m7/G♭'],
    ['G7b9', 'G7♭9'],
    ['C7#9', 'C7♯9'],
    ['bVII', '♭VII'],
    ['V7/V', 'V7/V'],
    ['Bdim', 'Bdim'],
    ['Cadd9', 'Cadd9'],
    ['Ebb4', 'E𝄫4'],
    ['G#3', 'G♯3'],
    ['#viø7', '♯viø7'],
  ])('%s → %s', (input, expected) => {
    expect(formatMusic(input)).toBe(expected)
  })
})

describe('formatMusicProse', () => {
  it('converts accidentals but leaves words alone', () => {
    expect(formatMusicProse('G# is the raised seventh; b9 over G7. Absent Bb.')).toBe('G♯ is the raised seventh; ♭9 over G7. Absent B♭.')
    expect(formatMusicProse('A blue note (b5 of C major)')).toBe('A blue note (♭5 of C major)')
    expect(formatMusicProse('Am – F#m7b5 – F reads as i – #viø7 – VI. About Ebmaj7, Abdim.'))
      .toBe('Am – F♯m7♭5 – F reads as i – ♯viø7 – VI. About E♭maj7, A♭dim.')
    expect(formatMusicProse('Bbm and B minor; Cb, Dbb.')).toBe('B♭m and B minor; C♭, D𝄫.')
  })
})
