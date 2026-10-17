import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useCatalog } from '../../state/CatalogProvider'

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
    <div className="add-chord">
      <form onSubmit={(e) => void submitSymbol(e)} noValidate style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label htmlFor="chord-symbol" className="visually-hidden">Chord symbol</label>
          <input id="chord-symbol" className="input mono" placeholder="Add chord: Dm7, G/B, Ebmaj7…" value={symbol}
                 onChange={(e) => {
                   setSymbol(e.target.value)
                   setError(null)
                 }}
                 aria-invalid={error !== null} aria-describedby={error ? 'chord-symbol-error' : undefined} autoComplete="off" />
          {error && <span id="chord-symbol-error" className="field-error" role="alert">{error}</span>}
        </div>
        <button type="submit" className="btn" disabled={busy}>
          <Plus size={14} aria-hidden /> Add{insertAt !== undefined ? ' after selected' : ''}
        </button>
        <span style={{ color: 'var(--text-faint)', fontSize: 12, alignSelf: 'center' }}>or</span>
        <select className="select" value={root} onChange={(e) => setRoot(e.target.value)} aria-label="Root for new chord">
          {catalog.roots.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="select" value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Quality for new chord">
          {catalog.qualities.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => void addPicked()} disabled={busy} aria-label="Add picked chord">
          <Plus size={14} aria-hidden />
        </button>
      </form>
    </div>
  )
}
