import { useEffect, useMemo, useState } from 'react'
import { formatMusic, formatMusicProse } from '../../model/notes'
import { AlertTriangle, Check, Play, Square } from 'lucide-react'
import type { AlternativesResponse, ChordInput, KeyDto, MetricsView } from '../../api/types'
import { theoryApi } from '../../api/theory'
import { errorMessage, isAbort } from '../../api/http'
import { toChordInput } from '../../model/workspace'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useAudio } from '../../audio/AudioProvider'
import { useToast } from '../../state/ToastProvider'
import { EmptyState, ErrorBanner, Spinner } from '../common/Status'
import { KindBadge } from './Badges'
import styles from './AnalysisPanel.module.css'

type Tab = 'analysis' | 'alternatives' | 'compare'

export function AnalysisPanel() {
  const [tab, setTab] = useState<Tab>('analysis')
  const workspace = useWorkspace()
  const alternatives = useAlternatives(tab !== 'analysis')

  return (
    <section className={`panel ${styles.panel}`} aria-label="Progression analysis">
      <div className={styles.tabs} role="tablist" aria-label="Analysis views">
        {(['analysis', 'alternatives', 'compare'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`}
                  className={styles.tab} onClick={() => setTab(t)}>
            {t === 'analysis' ? 'Analysis' : t === 'alternatives' ? 'Alternative progressions' : 'Compare versions'}
          </button>
        ))}
        <span className={styles.tabStatus}>
          {(workspace.analysis.loading || alternatives.loading) && <Spinner label="Analysing" />}
        </span>
      </div>
      <div className={styles.body} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {workspace.content.chords.length === 0
          ? <EmptyState title="Nothing to analyse yet">Add chords to see Roman numerals, voice-leading facts and alternatives.</EmptyState>
          : tab === 'analysis' ? <AnalysisView />
            : tab === 'alternatives' ? <AlternativesView state={alternatives} />
              : <CompareView alternatives={alternatives.data} />}
      </div>
    </section>
  )
}

function AnalysisView() {
  const { analysis } = useWorkspace()
  if (analysis.error) return <ErrorBanner message={analysis.error} />
  if (!analysis.data) return <Spinner label="Analysing" />
  const data = analysis.data
  return (
    <div className={styles.analysis}>
      <p className={styles.summary}>{formatMusicProse(data.summary)}</p>
      <ul className={styles.observations}>
        {data.observations.map((o, i) => (
          <li key={i} className={o.severity === 'WARNING' ? styles.warning : ''}>
            <KindBadge kind={o.kind} />
            {o.severity === 'WARNING' && <AlertTriangle size={13} aria-label="warning" className={styles.warnIcon} />}
            <span>{formatMusicProse(o.message)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface AlternativesState {
  data: AlternativesResponse | null
  loading: boolean
  error: string | null
  retry: () => void
}

function useAlternatives(active: boolean): AlternativesState {
  const { content } = useWorkspace()
  const [data, setData] = useState<AlternativesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const input = useMemo(() => JSON.stringify({ key: content.key, register: content.register, chords: content.chords.map(toChordInput) }),
    [content.key, content.register, content.chords])

  useEffect(() => {
    if (!active || content.chords.length === 0) return
    const controller = new AbortController()
    setLoading(true)
    const timer = window.setTimeout(() => {
      theoryApi.alternatives(JSON.parse(input) as Parameters<typeof theoryApi.alternatives>[0], controller.signal)
        .then((response) => {
          setData(response)
          setError(null)
          setLoading(false)
        })
        .catch((e: unknown) => {
          if (isAbort(e)) return
          setError(errorMessage(e))
          setLoading(false)
        })
    }, 400)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [active, input, attempt, content.chords.length])

  return { data, loading, error, retry: () => setAttempt((a) => a + 1) }
}

function AlternativesView({ state }: { state: AlternativesState }) {
  const workspace = useWorkspace()
  const audio = useAudio()
  const { notify } = useToast()
  if (state.error) return <ErrorBanner message={state.error} onRetry={state.retry} />
  if (!state.data) return <Spinner label="Generating alternatives" />
  return (
    <div className={styles.alternatives}>
      <p className={styles.note}>
        Each alternative changes one thing: the voicings (dynamic-programming search) or a single chord chosen by the
        suggestion engine for an objective. Scores are heuristics, not judgements of quality.
      </p>
      <ul className={styles.altList}>
        {state.data.alternatives.map((alt, i) => {
          const owner = `alternative-${i}`
          const playing = audio.isPlaying && audio.sequenceOwner === owner
          return (
            <li key={alt.title} className={styles.alt}>
              <div className={styles.altHead}>
                <h3>{alt.title}</h3>
                <div className={styles.altActions}>
                  <button type="button" className="btn btn-sm" onClick={() => playing ? audio.stop()
                    : void audio.playSequence(alt.chords.map((c, j) => ({ notes: c.voicing, beats: workspace.content.chords[j]?.durationBeats ?? 4 })),
                      workspace.content.tempoBpm, { owner })}>
                    {playing ? <><Square size={12} aria-hidden /> Stop</> : <><Play size={12} aria-hidden /> Play</>}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => {
                    workspace.replaceAllChords(alt.chords)
                    notify('success', `Applied "${alt.title}". Undo with Ctrl+Z.`)
                  }}>
                    <Check size={12} aria-hidden /> Apply
                  </button>
                </div>
              </div>
              <ol className={styles.altChords}>
                {alt.chords.map((c, j) => (
                  <li key={j} className={alt.changedIndex === j ? styles.changed : ''}>{formatMusic(c.symbol)}</li>
                ))}
              </ol>
              <p className={styles.altDescription}>{formatMusicProse(alt.description)}</p>
              <p className={styles.altMetrics}>
                {alt.metrics.totalVoiceMovement} semitones of movement, {alt.metrics.diatonicCount} of {alt.metrics.chordCount} chords diatonic
                {alt.metrics.cadence ? `, ${alt.metrics.cadence}` : ''}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const ROWS: { label: string; value: (m: MetricsView) => string; better?: 'lower' | 'higher' }[] = [
  { label: 'Chords', value: (m) => String(m.chordCount) },
  { label: 'Diatonic chords', value: (m) => `${m.diatonicCount} / ${m.chordCount}` },
  { label: 'Distinct chords', value: (m) => String(m.distinctChords) },
  { label: 'Total voice movement (semitones)', value: (m) => String(m.totalVoiceMovement), better: 'lower' },
  { label: 'Average movement per transition', value: (m) => String(m.averageMovementPerTransition), better: 'lower' },
  { label: 'Stepwise voice motions', value: (m) => `${m.stepwiseMotions} / ${m.totalMotions}` },
  { label: 'Held notes', value: (m) => String(m.heldVoices) },
  { label: 'Common tones between neighbours', value: (m) => String(m.commonToneTotal) },
  { label: 'Parallel fifths / octaves', value: (m) => String(m.parallelPerfects), better: 'lower' },
  { label: 'Starts on tonic', value: (m) => (m.startsOnTonic ? 'yes' : 'no') },
  { label: 'Ends on tonic', value: (m) => (m.endsOnTonic ? 'yes' : 'no') },
  { label: 'Cadence', value: (m) => m.cadence ?? '—' },
]

function CompareView({ alternatives }: { alternatives: AlternativesResponse | null }) {
  const workspace = useWorkspace()
  const current = workspace.analysis.data?.metrics ?? alternatives?.current ?? null
  const saved = useSavedMetrics()
  const [altIndex, setAltIndex] = useState(0)
  const alt = alternatives?.alternatives[altIndex] ?? null

  if (!current) return <Spinner label="Analysing" />
  const columns: { title: string; metrics: MetricsView | null }[] = [{ title: 'Current', metrics: current }]
  if (saved.metrics) columns.push({ title: 'Last saved', metrics: saved.metrics })
  if (alt) columns.push({ title: alt.title, metrics: alt.metrics })

  return (
    <div className={styles.compare}>
      <div className={styles.compareControls}>
        <p className={styles.note}>
          Every number is measured from the chords and voicings. {saved.note}
        </p>
        {alternatives && (
          <label className="field">
            <span className="field-label">Compare with</span>
            <select className="select" aria-label="Compare with" value={altIndex} onChange={(e) => setAltIndex(Number(e.target.value))}>
              {alternatives.alternatives.map((a, i) => <option key={a.title} value={i}>{a.title}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th scope="col">Metric</th>{columns.map((c) => <th key={c.title} scope="col">{c.title}</th>)}</tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {columns.map((c) => <td key={c.title}>{c.metrics ? row.value(c.metrics) : '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Metrics of the last saved version, re-analysed from the saved snapshot (only when there are unsaved changes). */
function useSavedMetrics(): { metrics: MetricsView | null; note: string } {
  const workspace = useWorkspace()
  const { baseline, projectId } = workspace.state
  const [metrics, setMetrics] = useState<MetricsView | null>(null)
  const relevant = projectId !== null && workspace.dirty && baseline !== null

  useEffect(() => {
    if (!relevant || !baseline) {
      setMetrics(null)
      return
    }
    const saved = JSON.parse(baseline) as { key: KeyDto; chords: ChordInput[] }
    if (saved.chords.length === 0) {
      setMetrics(null)
      return
    }
    const controller = new AbortController()
    theoryApi.analyze(saved.key, saved.chords, controller.signal)
      .then((data) => setMetrics(data.metrics))
      .catch(() => setMetrics(null))
    return () => controller.abort()
  }, [relevant, baseline])

  const note = projectId === null ? 'Save the project to compare later edits with the saved version.'
    : !workspace.dirty ? 'The current progression is identical to the saved version.' : ''
  return { metrics: relevant ? metrics : null, note }
}
