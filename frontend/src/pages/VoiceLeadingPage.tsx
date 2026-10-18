import { useEffect, useMemo, useState } from 'react'
import { formatMusic, formatMusicProse } from '../model/notes'
import { Link } from 'react-router'
import { Check, Play, Spline, Wand2 } from 'lucide-react'
import type { OptimizeResponse, RankedVoicingView, VoiceLeadingResponse } from '../api/types'
import { theoryApi } from '../api/theory'
import { errorMessage, isAbort } from '../api/http'
import { toChordInput } from '../model/workspace'
import { useWorkspace } from '../state/WorkspaceProvider'
import { useAudio } from '../audio/AudioProvider'
import { useToast } from '../state/ToastProvider'
import { EmptyState, ErrorBanner, Spinner } from '../components/common/Status'
import { MotionDiagram } from '../components/analysis/MotionDiagram'
import styles from './Pages.module.css'
import vl from './VoiceLeadingPage.module.css'

export function VoiceLeadingPage() {
  const workspace = useWorkspace()
  const audio = useAudio()
  const { notify } = useToast()
  const { content } = workspace
  const chords = content.chords
  const [pairState, setPair] = useState(Math.max(0, workspace.selectedIndex - 1))
  const pair = Math.max(0, Math.min(pairState, chords.length - 2))
  const [allowInversions, setAllowInversions] = useState(true)
  const [fourVoices, setFourVoices] = useState(false)
  const [ranking, setRanking] = useState<VoiceLeadingResponse | null>(null)
  const [chosen, setChosen] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [optimized, setOptimized] = useState<OptimizeResponse | null>(null)
  const [optimizing, setOptimizing] = useState(false)

  const from = chords[pair]
  const to = chords[pair + 1]
  const requestKey = from && to ? JSON.stringify([from.voicing, toChordInput(to), allowInversions, fourVoices, content.register]) : null

  useEffect(() => {
    if (!requestKey || !from || !to) {
      setRanking(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    theoryApi.voiceLeading({ fromVoicing: from.voicing, fromChord: { ...toChordInput(from), voicing: undefined }, target: { ...toChordInput(to), voicing: undefined }, register: content.register, allowInversions, limit: 8, fourVoices }, controller.signal)
      .then((r) => {
        setRanking(r)
        setChosen(0)
        setError(null)
      })
      .catch((e: unknown) => !isAbort(e) && setError(errorMessage(e)))
      .finally(() => !controller.signal.aborted && setLoading(false))
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const currentMovement = useMemo(() => workspace.analysis.data?.transitions[pair]?.voiceLeading ?? null, [workspace.analysis.data, pair])
  const candidate: RankedVoicingView | undefined = ranking?.candidates[chosen]

  const optimizeAll = async () => {
    setOptimizing(true)
    try {
      setOptimized(await theoryApi.optimize({ chords: chords.map(toChordInput), register: content.register, allowInversions, keepFirstVoicing: true, fourVoices }))
    } catch (e) {
      notify('error', errorMessage(e))
    } finally {
      setOptimizing(false)
    }
  }

  if (chords.length < 2) {
    return (
      <div className={styles.page}>
        <header className={styles.pageHeader}><h1>Voice Leading Explorer</h1></header>
        <EmptyState icon={<Spline size={22} />} title="Add at least two chords" action={<Link className="btn" to="/">Go to the workspace</Link>}>
          Voice leading describes how the notes of one chord move to the next, so it needs two or more chords.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Voice Leading Explorer</h1>
          <p className={styles.lead}>Candidate voicings of the next chord are ranked by a deterministic movement cost. Audition them and apply the one you like.</p>
        </div>
      </header>

      <div className={vl.pairs} role="group" aria-label="Transition">
        {chords.slice(0, -1).map((c, i) => (
          <button key={c.id} type="button" className={vl.pair} aria-pressed={pair === i} onClick={() => setPair(i)}>
            <span>{i + 1}–{i + 2}</span> <strong>{formatMusic(c.symbol)} → {formatMusic(chords[i + 1].symbol)}</strong>
          </button>
        ))}
      </div>

      <div className={styles.controlsRow}>
        <label className={vl.toggle}>
          <input type="checkbox" checked={allowInversions} onChange={(e) => setAllowInversions(e.target.checked)} />
          Allow other inversions of {formatMusic(to?.symbol.split('/')[0] ?? '')}
        </label>
        <label className={vl.toggle} title="Triads get a fourth voice that doubles the root, as in chorale writing">
          <input type="checkbox" checked={fourVoices} onChange={(e) => setFourVoices(e.target.checked)} />
          Four voices (double the root of triads)
        </label>
        {loading && <Spinner label="Ranking voicings" />}
      </div>
      {error && <ErrorBanner message={error} />}

      {from && to && ranking && (
        <div className={styles.twoColumn}>
          <section className={styles.card} aria-label="Ranked voicings">
            <h2 className={styles.cardTitle}>Ranked voicings of <span className="score">{formatMusic(to.symbol.split('/')[0])}</span></h2>
            <p className={styles.dim}>Now: <span className="score">{to.voicingNotes.map(formatMusic).join(' ')}</span> {currentMovement ? `(${currentMovement.totalMovement} semitones of movement)` : ''}</p>
            <ol className={vl.ranking}>
              {ranking.candidates.map((c, i) => (
                <li key={c.chord.voicing.join(',')}>
                  <button type="button" className={vl.candidate} aria-pressed={chosen === i} onClick={() => setChosen(i)}>
                    <span className={vl.rank}>{c.rank}.</span>
                    <strong>{formatMusic(c.chord.symbol)}</strong>
                    <span className={vl.notes}>{c.chord.voicingNotes.map(formatMusic).join(' ')}</span>
                    <span className={vl.cost}>Cost {c.voiceLeading.cost}, {c.voiceLeading.totalMovement} semitones</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className={styles.dim}>Cost function: <span className="mono">{ranking.costFunction}</span></p>
          </section>

          {candidate && (
            <section className={styles.card} aria-label="Selected candidate">
              <div className={styles.cardHeader}>
                <h2 className={`${styles.cardTitle} score`}>{formatMusic(from.symbol)} → {formatMusic(candidate.chord.symbol)}</h2>
                <div className={styles.actions}>
                  <button type="button" className="btn btn-sm" onClick={() => void audio.playSequence(
                    [{ notes: from.voicing, beats: 2 }, { notes: candidate.chord.voicing, beats: 2 }], content.tempoBpm, { owner: 'vl-page' })}>
                    <Play size={13} aria-hidden /> Audition
                  </button>
                  <button type="button" className="btn btn-sm btn-primary"
                          disabled={candidate.chord.voicing.join() === to.voicing.join()}
                          onClick={() => {
                            workspace.replaceChord(to.id, candidate.chord)
                            notify('success', `Applied ${candidate.chord.voicingNotes.join(' ')} to chord ${pair + 2}.`)
                          }}>
                    <Check size={13} aria-hidden /> Apply to progression
                  </button>
                </div>
              </div>
              <MotionDiagram motions={candidate.voiceLeading.motions} />
              <ul className={vl.reasons}>{candidate.reasons.map((r) => <li key={r}>{formatMusicProse(r)}</li>)}</ul>
            </section>
          )}
        </div>
      )}

      <section className={`panel ${styles.card}`} aria-label="Optimise the whole progression">
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Optimise every voicing</h2>
            <p className={styles.lead}>A dynamic-programming search picks voicings for all chords at once so that the total cost is minimal (the first chord keeps its voicing).</p>
          </div>
          <button type="button" className="btn" onClick={() => void optimizeAll()} disabled={optimizing}>
            {optimizing ? <Spinner label="Optimising" /> : <><Wand2 size={14} aria-hidden /> Optimise</>}
          </button>
        </div>
        {optimized && (
          <>
            <p className={styles.lead}>
              Total movement: <strong>{optimized.totalMovement}</strong> semitones
              {workspace.analysis.data ? <> (currently {workspace.analysis.data.metrics.totalVoiceMovement})</> : null}.
            </p>
            <ol className={vl.optimized}>
              {optimized.chords.map((c, i) => <li key={i}><strong>{formatMusic(c.symbol)}</strong><span>{c.voicingNotes.map(formatMusic).join(' ')}</span></li>)}
            </ol>
            <div className={styles.actions}>
              <button type="button" className="btn btn-sm" onClick={() => void audio.playSequence(
                optimized.chords.map((c, i) => ({ notes: c.voicing, beats: chords[i]?.durationBeats ?? 4 })), content.tempoBpm, { owner: 'optimized' })}>
                <Play size={13} aria-hidden /> Play optimised
              </button>
              <button type="button" className="btn btn-sm btn-primary" disabled={optimized.chords.length !== chords.length} onClick={() => {
                workspace.replaceAllChords(optimized.chords)
                setOptimized(null)
                notify('success', 'Applied optimised voicings. Undo with Ctrl+Z.')
              }}>
                <Check size={13} aria-hidden /> Apply
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
