import type { Mode } from '../api/types'

/** Display names for key modes, grouped as in the key picker. */
export const MODE_GROUPS: { label: string; modes: { id: Mode; label: string }[] }[] = [
  {
    label: 'Major and minor',
    modes: [
      { id: 'MAJOR', label: 'Major' },
      { id: 'MINOR', label: 'Natural minor' },
      { id: 'HARMONIC_MINOR', label: 'Harmonic minor' },
      { id: 'MELODIC_MINOR', label: 'Melodic minor' },
    ],
  },
  {
    label: 'Modes',
    modes: [
      { id: 'DORIAN', label: 'Dorian' },
      { id: 'PHRYGIAN', label: 'Phrygian' },
      { id: 'LYDIAN', label: 'Lydian' },
      { id: 'MIXOLYDIAN', label: 'Mixolydian' },
      { id: 'LOCRIAN', label: 'Locrian' },
    ],
  },
]

export function modeLabel(mode: Mode): string {
  return MODE_GROUPS.flatMap((g) => g.modes).find((m) => m.id === mode)?.label ?? mode.toLowerCase()
}

/** The mode as it reads after a tonic: "A natural minor", "D Dorian". */
export function modePhrase(mode: Mode): string {
  const label = modeLabel(mode)
  return MODE_GROUPS[0].modes.some((m) => m.id === mode) ? label.toLowerCase() : label
}
