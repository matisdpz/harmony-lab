import { useEffect, useMemo, useState } from 'react'
import { Lightbulb, Play, Replace } from 'lucide-react'
import type { Objective, SuggestionResponse } from '../../api/types'
import { theoryApi } from '../../api/theory'
import { errorMessage, isAbort } from '../../api/http'
import { toChordInput } from '../../model/workspace'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useCatalog } from '../../state/CatalogProvider'
import { useAudio } from '../../audio/AudioProvider'
import { useToast } from '../../state/ToastProvider'
import { EmptyState, ErrorBanner, Spinner } from '../common/Status'
import { CategoryBadge } from '../analysis/Badges'
import styles from './Inspector.module.css'

const SHORT_LABELS: Record<Objective, string> = {
  SMOOTH_VOICE_LEADING: 'Smooth',
  STRONGER_RESOLUTION: 'Resolve',
  DIATONIC_ALTERNATIVES: 'Diatonic',
  HARMONIC_COLOR: 'Colour',
}

export function SuggestionsPanel() {
  const workspace = useWorkspace()
  const catalog = useCatalog()
  const audio = useAudio()
  const { notify } = useToast()
  const [objective, setObjective] = useState<Objective>('SMOOTH_VOICE_LEADING')
  const [result, setResult] = useState<SuggestionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { content, selectedIndex, selected } = workspace

  // The request depends on the key, the register and the selected chord's neighbours.
  const requestKey = useMemo(() => {
    if (selectedIndex < 0) return null
    return JSON.stringify({
      key: content.key,
      register: content.register,
      chords: content.chords.map(toChordInput),
      selectedIndex,
      objective,
    })
  }, [content.key, content.register, content.chords, selectedIndex, objective])

  useEffect(() => {
    if (!requestKey) {
      setResult(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => {
      const body = JSON.parse(requestKey) as Parameters<typeof theoryApi.suggestions>[0]
      theoryApi.suggestions({ ...body, limit: 6 }, controller.signal)
        .then((data) => {
          setResult(data)
          setLoading(false)
        })
        .catch((e: unknown) => {
          if (isAbort(e)) return
          setError(errorMessage(e))
          setLoading(false)
        })
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [requestKey, attempt])

  const objectiveInfo = catalog.objectives.find((o) => o.id === objective)

  return (
    <section className={styles.section} aria-label="Suggestions">
      <div className={styles.heading}>
        <h2 className="panel-title">Suggestions</h2>
        {loading && <Spinner label="Ranking" />}
      </div>
      <div className="segmented" role="group" aria-label="Suggestion objective">
        {catalog.objectives.map((o) => (
          <button key={o.id} type="button" aria-pressed={objective === o.id} onClick={() => setObjective(o.id)} title={o.description}>
            {SHORT_LABELS[o.id]}
          </button>
        ))}
      </div>
      {objectiveInfo && <p className={styles.note}>{objectiveInfo.description}</p>}

      {!selected && <p className={styles.note}>Select a chord to see alternatives for it.</p>}
      {error && <ErrorBanner message={error} onRetry={() => setAttempt((a) => a + 1)} />}

      {selected && result && !error && (
        result.suggestions.length === 0 ? (
          <EmptyState icon={<Lightbulb size={18} />} title="No strong suggestion">{result.message}</EmptyState>
        ) : (
          <>
            <ul className={styles.list}>
              {result.suggestions.map((s) => (
                <li key={`${s.chord.symbol}-${s.chord.voicing.join('.')}`} className={styles.item}>
                  <div className={styles.itemHead}>
                    <span className={styles.itemSymbol}>{s.chord.symbol}</span>
                    <span className={styles.itemRoman}>{s.romanLabel}</span>
                    <div className={styles.itemActions}>
                      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => void audio.playChord(s.chord.voicing)}
                              aria-label={`Audition ${s.chord.symbol}`}>
                        <Play size={13} />
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => {
                        workspace.replaceChord(selected.id, s.chord)
                        notify('success', `Replaced ${selected.symbol} with ${s.chord.symbol}. Undo with Ctrl+Z.`)
                      }} aria-label={`Replace with ${s.chord.symbol}`}>
                        <Replace size={13} aria-hidden /> Use
                      </button>
                    </div>
                  </div>
                  <div className={styles.score} title={Object.entries(s.breakdown).map(([k, v]) => `${k}: ${v}`).join(', ')}>
                    <CategoryBadge category={s.category} />
                    <span className={styles.scoreBar} aria-hidden><span className={styles.scoreFill} style={{ width: `${s.score}%` }} /></span>
                    <span className="mono">{s.score}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.chord.notesFromBass.join(' ')}</span>
                  <ul className={styles.reasons}>
                    {s.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
            <p className={styles.note}>{result.message}</p>
          </>
        )
      )}
    </section>
  )
}
