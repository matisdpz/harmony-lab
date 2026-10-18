import { formatMusic } from '../../model/notes'
import { toChordInput } from '../../model/workspace'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useKeyDetection } from '../workspace/useKeyDetection'
import styles from './KeyEstimate.module.css'

const CONFIDENCE_TEXT = { STRONG: 'Clear match', MODERATE: 'Plausible', WEAK: 'Uncertain' }

/** The three most likely major/minor keys (Krumhansl–Schmuckler), with their correlation and a way to apply one. */
export function KeyEstimate() {
  const workspace = useWorkspace()
  const { key } = workspace.content
  const detection = useKeyDetection(workspace.content.chords.map(toChordInput), 1)
  if (!detection) return null
  return (
    <section className={styles.section} aria-label="Key estimate">
      <div className={styles.heading}>
        <h2>Key estimate</h2>
        <span className="badge badge-heuristic" title="Statistical estimate, not a rule">Heuristic</span>
        <span className={styles.confidence}>{CONFIDENCE_TEXT[detection.confidence]}</span>
      </div>
      <p className={styles.explanation}>{formatMusic(detection.explanation)}</p>
      <ol className={styles.list}>
        {detection.candidates.map((c) => {
          const current = c.key.tonic === key.tonic && c.key.mode === key.mode
          return (
            <li key={c.label}>
              <span className={styles.label}>{formatMusic(c.label)}</span>
              <span className={styles.bar} aria-hidden><span style={{ width: `${Math.max(0, c.correlation) * 100}%` }} /></span>
              <span className={styles.value}>r = {c.correlation.toFixed(2)}</span>
              {current
                ? <span className={styles.current}>Current key</span>
                : <button type="button" className="btn btn-ghost btn-sm" onClick={() => workspace.setKey(c.key)}>Use</button>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
