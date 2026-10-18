import { formatMusic } from '../../model/notes'
import type { QualityInfo } from '../../api/types'

const FAMILIES: { id: string; label: string }[] = [
  { id: 'TRIAD', label: 'Triads' },
  { id: 'SEVENTH', label: 'Sevenths' },
  { id: 'SIXTH', label: 'Sixths' },
  { id: 'SUSPENDED', label: 'Suspended' },
  { id: 'ADDED', label: 'Added notes' },
  { id: 'EXTENDED', label: 'Extended (9, 11, 13)' },
  { id: 'ALTERED', label: 'Altered dominants' },
]

/** Chord qualities grouped by family, so a long list stays easy to scan. */
export function QualityOptions({ qualities, withSuffix = true }: { qualities: QualityInfo[]; withSuffix?: boolean }) {
  const known = new Set(FAMILIES.map((f) => f.id))
  const groups = [...FAMILIES, { id: 'OTHER', label: 'Other' }]
    .map((family) => ({
      ...family,
      items: qualities.filter((q) => (family.id === 'OTHER' ? !known.has(q.family) : q.family === family.id)),
    }))
    .filter((group) => group.items.length > 0)
  return (
    <>
      {groups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.items.map((q) => (
            <option key={q.id} value={q.id}>{q.name}{withSuffix && q.suffix ? ` (${formatMusic(q.suffix)})` : ''}</option>
          ))}
        </optgroup>
      ))}
    </>
  )
}
