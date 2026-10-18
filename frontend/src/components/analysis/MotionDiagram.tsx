import { formatMusic } from '../../model/notes'
import type { MotionView } from '../../api/types'

/**
 * Two columns of notes (before/after) on a shared pitch axis, connected by one line per voice.
 * Held notes are blue, steps ink and leaps red (also dashed), so motion size is readable at a glance.
 */
export function MotionDiagram({ motions }: { motions: MotionView[] }) {
  if (motions.length === 0) return null
  const pitches = motions.flatMap((m) => [m.from, m.to])
  const min = Math.min(...pitches) - 2
  const max = Math.max(...pitches) + 2
  const height = Math.max(160, (max - min) * 9)
  const y = (midi: number) => height - ((midi - min) / (max - min)) * height
  const width = 320
  const left = 90
  const right = width - 90

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxHeight: 280 }} role="img"
         aria-label={`Voice motions: ${motions.map((m) => `${m.fromNote} to ${m.toNote}`).join(', ')}`}>
      {motions.map((m, i) => {
        const leap = Math.abs(m.semitones) > 5
        const color = m.semitones === 0 ? 'var(--blue)' : leap ? 'var(--red)' : 'var(--ink)'
        return (
          <g key={i}>
            <line x1={left} y1={y(m.from)} x2={right} y2={y(m.to)} stroke={color} strokeWidth={1.5} strokeDasharray={leap ? '5 4' : undefined} />
            <ellipse cx={left} cy={y(m.from)} rx={6} ry={4.2} transform={`rotate(-22 ${left} ${y(m.from)})`} fill={color} />
            <ellipse cx={right} cy={y(m.to)} rx={6} ry={4.2} transform={`rotate(-22 ${right} ${y(m.to)})`} fill={color} />
            <text x={left - 10} y={y(m.from) + 4} textAnchor="end" fontSize={14} fill="var(--ink-muted)" fontFamily="var(--font-score)">{formatMusic(m.fromNote)}</text>
            <text x={right + 10} y={y(m.to) + 4} fontSize={14} fill="var(--ink)" fontFamily="var(--font-score)">
              {formatMusic(m.toNote)} {m.semitones === 0 ? '' : `(${m.semitones > 0 ? '+' : ''}${m.semitones})`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
