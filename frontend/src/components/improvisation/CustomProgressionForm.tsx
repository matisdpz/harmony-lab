import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import type { KeyDto } from '../../api/types'
import { theoryApi } from '../../api/theory'
import { ApiError, errorMessage } from '../../api/http'
import { splitSymbols, type CustomProgression } from './customProgressions'
import styles from './Improvisation.module.css'

const MAX_CHORDS = 32

/** Creates a progression from typed chord symbols; the server validates every symbol before it is saved. */
export function CustomProgressionForm({ keyDto, onCreated }: { keyDto: KeyDto; onCreated: (p: CustomProgression) => void }) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const symbols = splitSymbols(text)
    if (symbols.length === 0) {
      setError('Type at least one chord, for example: Am F C G')
      return
    }
    if (symbols.length > MAX_CHORDS) {
      setError(`A loop can hold at most ${MAX_CHORDS} chords.`)
      return
    }
    setBusy(true)
    try {
      await theoryApi.improvisation({ key: keyDto, symbols })
      onCreated({ id: `custom-${Date.now()}`, name: name.trim() || symbols.join(' – '), symbols })
      setName('')
      setText('')
      setError(null)
    } catch (e) {
      const field = e instanceof ApiError ? e.fieldErrors[0] : undefined
      const index = field ? /symbols\[(\d+)]/.exec(field.field) : null
      setError(index && field ? `Chord ${Number(index[1]) + 1} (${symbols[Number(index[1])]}): ${field.message}` : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.customForm} onSubmit={(e) => void submit(e)} noValidate>
      <h3 className="panel-title">New progression</h3>
      <label className="field">
        <span className="field-label">Name (optional)</span>
        <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Chords</span>
        <input className="input mono" value={text} placeholder="Am F C G" autoComplete="off"
               aria-invalid={error !== null} aria-describedby={error ? 'custom-error' : undefined}
               onChange={(e) => {
                 setText(e.target.value)
                 setError(null)
               }} />
      </label>
      {error && <span id="custom-error" className="field-error" role="alert">{error}</span>}
      <button type="submit" className="btn" disabled={busy}><Plus size={14} aria-hidden /> Create</button>
    </form>
  )
}
