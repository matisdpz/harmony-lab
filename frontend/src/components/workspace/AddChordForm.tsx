import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useCatalog } from '../../state/CatalogProvider'
import { formatMusic } from '../../model/notes'
import styles from './AddChordForm.module.css'

/** Adds a chord after the selected one (or at the end), either from a typed symbol or from pickers. */
export function AddChordForm() {
  const workspace = useWorkspace()
  const catalog = useCatalog()
  const [symbol, setSymbol] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [root, setRoot] = useState('C')
  const [quality, setQuality] = useState('MAJOR')
  const insertAt = workspace.selectedIndex >= 0 ? workspace.selectedIndex + 1 : undefined

  const submitSymbol = async (event: FormEvent) => {
    event.preventDefault()
    const text = symbol.trim()
    if (!text) {
      setError('Type a chord symbol, for example Am, F#m7b5 or C/E.')
      return
    }
    if (workspace.content.chords.length >= 64) {
      setError('A progression can hold at most 64 chords.')
      return
    }
    setBusy(true)
    const failure = await workspace.addChordBySymbol(text, insertAt)
    setBusy(false)
    setError(failure)
    if (!failure) setSymbol('')
  }

  const addPicked = async () => {
    setBusy(true)
    const failure = await workspace.addChord(root, quality, insertAt)
    setBusy(false)
    setError(failure)
  }

  return (
    <form className={styles.form} onSubmit={(e) => void submitSymbol(e)} noValidate>
      <div className={styles.typed}>
        <div className="field">
          <label htmlFor="chord-symbol" className="field-label">Chord symbol</label>
          <div className={styles.inline}>
            <input id="chord-symbol" className={`input ${styles.symbolInput}`} placeholder="Dm7, G/B, Ebmaj7…" value={symbol}
                   onChange={(e) => {
                     setSymbol(e.target.value)
                     setError(null)
                   }}
                   aria-invalid={error !== null} aria-describedby={error ? 'chord-symbol-error' : undefined} autoComplete="off" />
            <button type="submit" className="btn" disabled={busy}>
              <Plus size={15} aria-hidden /> Add{insertAt !== undefined ? ' after selected' : ''}
            </button>
          </div>
          {error && <span id="chord-symbol-error" className="field-error" role="alert">{error}</span>}
        </div>
      </div>
      <div className={styles.picked} role="group" aria-labelledby="pick-chord-label">
        <span id="pick-chord-label" className="field-label">Or pick root and quality</span>
        <div className={styles.inline}>
          <select className="select" value={root} onChange={(e) => setRoot(e.target.value)} aria-label="Root for new chord">
            {catalog.roots.map((r) => <option key={r} value={r}>{formatMusic(r)}</option>)}
          </select>
          <select className={`select ${styles.quality}`} value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Quality for new chord">
            {catalog.qualities.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <button type="button" className="btn" onClick={() => void addPicked()} disabled={busy} aria-label="Add picked chord">
            <Plus size={15} aria-hidden /> Add
          </button>
        </div>
      </div>
    </form>
  )
}
