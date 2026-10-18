import type { KeyDto, Mode } from '../../api/types'
import { useCatalog } from '../../state/CatalogProvider'
import { MODE_GROUPS } from '../../model/modes'
import { formatMusic } from '../../model/notes'

/**
 * Tonic and mode of a key. Changing the mode keeps the tonic when that key exists in the new mode,
 * otherwise picks the first available tonic (e.g. there is no G# major, but there is G# minor).
 */
export function KeyPicker({ value, onChange, tonicLabel = 'Key' }: {
  value: KeyDto
  onChange: (key: KeyDto, modeChanged: boolean) => void
  tonicLabel?: string
}) {
  const catalog = useCatalog()
  const tonics = catalog.keyTonics[value.mode] ?? []
  return (
    <>
      <label className="field">
        <span className="field-label">{tonicLabel}</span>
        <select className="select" aria-label="Key tonic" value={value.tonic}
                onChange={(e) => onChange({ ...value, tonic: e.target.value }, false)}>
          {tonics.map((t) => <option key={t} value={t}>{formatMusic(t)}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Mode</span>
        <select className="select" aria-label="Mode" value={value.mode}
                onChange={(e) => {
                  const mode = e.target.value as Mode
                  const available = catalog.keyTonics[mode] ?? []
                  onChange({ mode, tonic: available.includes(value.tonic) ? value.tonic : available[0] }, true)
                }}>
          {MODE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.modes.filter((m) => catalog.keyTonics[m.id]).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
    </>
  )
}
