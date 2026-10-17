import type { ChordCategory, HarmonicFunction } from '../../api/types'

const CATEGORY_LABELS: Record<ChordCategory, string> = {
  DIATONIC: 'Diatonic',
  HARMONIC_MINOR: 'Harmonic minor',
  SECONDARY_DOMINANT: 'Secondary dominant',
  BORROWED: 'Borrowed',
  CHROMATIC: 'Outside the key',
}

export function CategoryBadge({ category }: { category: ChordCategory }) {
  return <span className={`badge ${category === 'DIATONIC' ? 'badge-ok' : category === 'CHROMATIC' ? 'badge-warning' : 'badge-heuristic'}`}>
    {CATEGORY_LABELS[category]}
  </span>
}

export function FunctionBadge({ fn, confident }: { fn: HarmonicFunction | null; confident: boolean }) {
  if (!fn) return <span className="badge" title="No conventional function can be assigned">Function: unclear</span>
  const name = fn.charAt(0) + fn.slice(1).toLowerCase()
  return (
    <span className="badge badge-tone" title={confident ? 'Conventional function label' : 'Tentative: depends on context'}>
      {name}{confident ? '' : '?'}
    </span>
  )
}

export function KindBadge({ kind }: { kind: 'FACT' | 'HEURISTIC' }) {
  return kind === 'FACT'
    ? <span className="badge badge-fact" title="Computed directly from the notes">Fact</span>
    : <span className="badge badge-heuristic" title="Stylistic convention; may not apply to every style">Heuristic</span>
}

export function categoryLabel(category: ChordCategory): string {
  return CATEGORY_LABELS[category]
}
