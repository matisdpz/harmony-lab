import { decodeMidiMessage } from './midiMessage'

describe('decodeMidiMessage', () => {
  it('reads note on/off on any channel, treating velocity 0 as note off', () => {
    expect(decodeMidiMessage([0x90, 60, 127])).toEqual({ type: 'on', note: 60, velocity: 1 })
    expect(decodeMidiMessage([0x93, 64, 0])).toEqual({ type: 'off', note: 64 })
    expect(decodeMidiMessage([0x81, 67, 40])).toEqual({ type: 'off', note: 67 })
  })

  it('reads the sustain pedal and ignores everything else', () => {
    expect(decodeMidiMessage([0xb0, 64, 127])).toEqual({ type: 'pedal', down: true })
    expect(decodeMidiMessage([0xb0, 64, 0])).toEqual({ type: 'pedal', down: false })
    expect(decodeMidiMessage([0xb0, 7, 100])).toBeNull()
    expect(decodeMidiMessage([0xe0, 0, 64])).toBeNull()
    expect(decodeMidiMessage([0xf8])).toBeNull()
  })
})
