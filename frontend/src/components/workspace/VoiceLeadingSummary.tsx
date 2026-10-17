import { useState } from 'react'
import { Check, Play, Spline } from 'lucide-react'
import type { RankedVoicingView } from '../../api/types'
import { theoryApi } from '../../api/theory'
import { errorMessage } from '../../api/http'
import { toChordInput } from '../../model/workspace'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useAudio } from '../../audio/AudioProvider'
import { ErrorBanner, Spinner } from '../common/Status'
import styles from './Inspector.module.css'

/** Voice leading into the selected chord from the previous one, plus ranked smoother voicings. */
export function VoiceLeadingSummary() {
  const workspace = useWorkspace()
  const audio = useAudio()
  const [candidates, setCandidates] = useState<{ forKey: string; items: RankedVoicingView[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { selected, selectedIndex, content } = workspace
  const previous = selectedIndex > 0 ? content.chords[selectedIndex - 1] : null
  const transition = workspace.analysis.data?.transitions[selectedIndex - 1]
  const key = selected && previous ? `${previous.voicing.join(',')}>${selected.symbol}` : ''

  if (!selected) return null

  const find = async () => {
    if (!previous) return
    setLoading(true)
    setError(null)
    try {
      const response = await theoryApi.voiceLeading({
        fromVoicing: previous.voicing,
        fromChord: { ...toChordInput(previous), voicing: undefined },
        target: { ...toChordInput(selected), voicing: undefined },
        register: content.register,
        allowInversions: true,
        limit: 4,
      })
      setCandidates({ forKey: key, items: response.candidates })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const shown = candidates?.forKey === key ? candidates.items : null
  const vl = transition?.voiceLeading && transition.toIndex === selectedIndex ? transition.voiceLeading : null

  return (
    <section className={styles.section} aria-label="Voice leading">
      <div className={styles.heading}>
        <h2 className="panel-title">Voice leading</h2>
        {loading && <Spinner label="Searching" />}
      </div>
      {!previous ? (
        <p className={styles.note}>This is the first chord, so there is no incoming voice leading. Select a later chord to compare.</p>
      ) : (
        <>
          <p className={styles.note}>From <strong>{previous.symbol}</strong> to <strong>{selected.symbol}</strong>{transition ? ` — root motion: ${transition.rootMotion}` : ''}.</p>
          {vl && (
            <>
              <div className={styles.metrics}>
                <div className={styles.metric}><span className={styles.metricValue}>{vl.totalMovement}</span><span className={styles.metricLabel}>semitones moved</span></div>
                <div className={styles.metric}><span className={styles.metricValue}>{vl.heldVoices}</span><span className={styles.metricLabel}>held notes</span></div>
                <div className={styles.metric}><span className={styles.metricValue}>{vl.stepwiseVoices}</span><span className={styles.metricLabel}>steps (≤2)</span></div>
              </div>
              <div className={styles.motions} aria-label="Voice motions">
                {vl.motions.map((m, i) => (
                  <span key={i} className={`${styles.motion} ${m.semitones === 0 ? styles.held : Math.abs(m.semitones) > 5 ? styles.leap : ''}`}>
                    {m.fromNote}→{m.toNote} <span className={styles.dim}>{m.semitones > 0 ? '+' : ''}{m.semitones}</span>
                  </span>
                ))}
              </div>
              {vl.parallelPerfects > 0 && <p className={styles.note}>⚠ Parallel fifths/octaves in this voicing (a classical-style heuristic).</p>}
            </>
          )}
          <button type="button" className="btn" onClick={() => void find()} disabled={loading}>
            <Spline size={14} aria-hidden /> Find smoother voicings
          </button>
          {error && <ErrorBanner message={error} onRetry={() => void find()} />}
          {shown && (
            <ul className={styles.list}>
              {shown.map((c) => {
                const current = c.chord.voicing.join(',') === selected.voicing.join(',')
                return (
                  <li key={c.chord.voicing.join(',')} className={styles.item}>
                    <div className={styles.itemHead}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>#{c.rank}</span>
                      <span className={styles.itemSymbol}>{c.chord.symbol}</span>
                      <span className="mono" style={{ fontSize: 12 }}>{c.chord.voicingNotes.join(' ')}</span>
                      <div className={styles.itemActions}>
                        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Audition ${previous.symbol} then ${c.chord.symbol}`}
                                onClick={() => void audio.playSequence([{ notes: previous.voicing, beats: 2 }, { notes: c.chord.voicing, beats: 2 }], content.tempoBpm, { owner: 'vl-preview' })}>
                          <Play size={13} />
                        </button>
                        <button type="button" className="btn btn-sm" disabled={current}
                                onClick={() => workspace.replaceChord(selected.id, c.chord)}>
                          {current ? <><Check size={13} aria-hidden /> Current</> : 'Apply'}
                        </button>
                      </div>
                    </div>
                    <div className={styles.score}>cost <span className="mono">{c.voiceLeading.cost}</span> · moved <span className="mono">{c.voiceLeading.totalMovement}</span> semitones</div>
                    <ul className={styles.reasons}>{c.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
