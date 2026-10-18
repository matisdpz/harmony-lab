// Decodes the few MIDI channel messages the app reacts to, on any channel.
export type MidiEvent =
  | { type: 'on'; note: number; velocity: number }
  | { type: 'off'; note: number }
  | { type: 'pedal'; down: boolean }

export function decodeMidiMessage(data: ArrayLike<number>): MidiEvent | null {
  if (data.length < 3) return null
  const command = data[0] & 0xf0
  const [, a, b] = [data[0], data[1], data[2]]
  if (command === 0x90 && b > 0) return { type: 'on', note: a, velocity: b / 127 }
  if (command === 0x80 || (command === 0x90 && b === 0)) return { type: 'off', note: a }
  if (command === 0xb0 && a === 64) return { type: 'pedal', down: b >= 64 } // sustain pedal (CC 64)
  return null
}
