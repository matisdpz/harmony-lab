import { Link } from 'react-router'
import { AudioWaveform } from 'lucide-react'
import { useWorkspace } from '../state/WorkspaceProvider'
import { CategoryBadge, FunctionBadge, KindBadge } from '../components/analysis/Badges'
import { EmptyState, ErrorBanner, Spinner } from '../components/common/Status'
import styles from './Pages.module.css'

export function AnalyzerPage() {
  const { analysis, content } = useWorkspace()
  const data = analysis.data

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Progression Analyzer</h1>
          <p className={styles.lead}>
            "{content.name}" in {content.key.tonic} {content.key.mode === 'MAJOR' ? 'major' : 'natural minor'}. Facts are computed from the notes;
            heuristics apply stylistic conventions and are labelled as such.
          </p>
        </div>
        {analysis.loading && <Spinner label="Analysing" />}
      </header>

      {content.chords.length === 0 && (
        <EmptyState icon={<AudioWaveform size={22} />} title="The progression is empty"
                    action={<Link className="btn" to="/">Go to the workspace</Link>}>
          Add chords in the workspace to analyse them here.
        </EmptyState>
      )}
      {analysis.error && <ErrorBanner message={analysis.error} />}

      {data && content.chords.length > 0 && (
        <>
          <section className={`panel ${styles.card}`}>
            <p>{data.summary}</p>
            <div className={styles.metricsGrid}>
              <Metric value={`${data.metrics.diatonicCount}/${data.metrics.chordCount}`} label="diatonic chords" />
              <Metric value={data.metrics.totalVoiceMovement} label="semitones of voice movement" />
              <Metric value={data.metrics.averageMovementPerTransition} label="avg movement / transition" />
              <Metric value={`${data.metrics.stepwiseMotions}/${data.metrics.totalMotions}`} label="stepwise voice motions" />
              <Metric value={data.metrics.commonToneTotal} label="common tones (all transitions)" />
              <Metric value={data.metrics.cadence ?? '—'} label="cadence at the end" />
            </div>
          </section>

          <section className={styles.section} aria-label="Chord-by-chord analysis">
            <h2 className={styles.sectionTitle}>Chords</h2>
            <div className={`panel ${styles.tableWrap}`}>
              <table className={styles.table} style={{ margin: 12, width: 'calc(100% - 24px)' }}>
                <thead>
                  <tr><th scope="col">#</th><th scope="col">Chord</th><th scope="col">Numeral</th><th scope="col">Relation</th><th scope="col">Function</th><th scope="col">Outside the scale</th><th scope="col">Explanation</th></tr>
                </thead>
                <tbody>
                  {data.chords.map((c) => (
                    <tr key={c.index}>
                      <td className="mono">{c.index + 1}</td>
                      <td><strong>{c.symbol}</strong></td>
                      <td className={`mono ${c.category === 'DIATONIC' ? styles.diatonicLabel : styles.chromatic}`}>{c.label}</td>
                      <td><CategoryBadge category={c.category} /></td>
                      <td><FunctionBadge fn={c.function} confident={c.functionConfident} /></td>
                      <td className="mono">{c.notesOutsideScale.join(', ') || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', minWidth: 260 }}>{c.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {data.transitions.length > 0 && (
            <section className={styles.section} aria-label="Transitions">
              <h2 className={styles.sectionTitle}>Transitions</h2>
              <div className={`panel ${styles.tableWrap}`}>
                <table className={styles.table} style={{ margin: 12, width: 'calc(100% - 24px)' }}>
                  <thead>
                    <tr><th scope="col">Move</th><th scope="col">Root motion</th><th scope="col">Common tones</th><th scope="col">Functional label</th><th scope="col">Movement</th><th scope="col">Held</th><th scope="col">Steps</th><th scope="col">Parallel 5/8</th></tr>
                  </thead>
                  <tbody>
                    {data.transitions.map((t) => (
                      <tr key={t.fromIndex}>
                        <td className="mono">{data.chords[t.fromIndex].symbol} → {data.chords[t.toIndex].symbol}</td>
                        <td>{t.rootMotion}</td>
                        <td className="mono">{t.commonTones.join(', ') || '—'}</td>
                        <td>{t.functionalLabel ?? '—'}</td>
                        <td className="mono">{t.voiceLeading?.totalMovement ?? '—'}</td>
                        <td className="mono">{t.voiceLeading?.heldVoices ?? '—'}</td>
                        <td className="mono">{t.voiceLeading?.stepwiseVoices ?? '—'}</td>
                        <td className="mono">{t.voiceLeading?.parallelPerfects ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className={styles.twoColumn}>
            {(['FACT', 'HEURISTIC'] as const).map((kind) => (
              <section key={kind} className={`panel ${styles.card}`} aria-label={kind === 'FACT' ? 'Facts' : 'Heuristic observations'}>
                <h2 className={styles.cardTitle}>{kind === 'FACT' ? 'Facts' : 'Heuristic observations'}</h2>
                <ul className={styles.observations}>
                  {data.observations.filter((o) => o.kind === kind).map((o, i) => (
                    <li key={i} className={o.severity === 'WARNING' ? styles.warn : ''}><KindBadge kind={o.kind} /><span>{o.message}</span></li>
                  ))}
                  {data.observations.every((o) => o.kind !== kind) && <li className={styles.dim}>None for this progression.</li>}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className={`panel ${styles.metric}`}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  )
}
