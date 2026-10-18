import { useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import { formatMusic } from '../../model/notes'
import { toChordInput } from '../../model/workspace'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useKeyDetection } from './useKeyDetection'
import styles from './WorkspaceHeader.module.css'

/**
 * A quiet hint when the chords sound like another major or minor key than the one chosen. It never changes
 * the key by itself, and stays hidden for modal keys (the detector only knows major and minor).
 */
export function KeyHint() {
  const workspace = useWorkspace()
  const { content } = workspace
  const detection = useKeyDetection(content.chords.map(toChordInput))
  const [dismissed, setDismissed] = useState<string | null>(null)
  const best = detection?.candidates[0]
  const tonal = content.key.mode === 'MAJOR' || content.key.mode === 'MINOR'
  if (!detection || !best || !tonal || detection.confidence === 'WEAK') return null
  if (best.key.tonic === content.key.tonic && best.key.mode === content.key.mode) return null
  if (dismissed === best.label) return null
  return (
    <p className={styles.keyHint} title={detection.explanation}>
      <Lightbulb size={14} aria-hidden />
      <span>These chords sound like <strong>{formatMusic(best.label)}</strong>
        {detection.confidence === 'MODERATE' ? ' (plausible)' : ''}.</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => workspace.setKey(best.key)}>
        Use {formatMusic(best.label)}
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setDismissed(best.label)} aria-label="Dismiss key suggestion">
        <X size={14} />
      </button>
    </p>
  )
}
