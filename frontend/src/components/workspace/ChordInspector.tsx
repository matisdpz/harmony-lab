import { ArrowDown, ArrowUp, MousePointerClick, Play } from 'lucide-react'
import type { VoicingStyle } from '../../api/types'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { qualityById, useCatalog } from '../../state/CatalogProvider'
import { useAudio } from '../../audio/AudioProvider'
import { EmptyState } from '../common/Status'
import { FunctionBadge, CategoryBadge } from '../analysis/Badges'
import styles from './Inspector.module.css'

const INVERSION_LABELS = ['Root', '1st', '2nd', '3rd']
const STYLES: { id: VoicingStyle; label: string }[] = [
  { id: 'CLOSE', label: 'Close' },
  { id: 'OPEN', label: 'Open' },
  { id: 'DROP2', label: 'Drop 2' },
]
const DURATIONS = [1, 2, 3, 4, 6, 8]

export function ChordInspector() {
  const workspace = useWorkspace()
  const catalog = useCatalog()
  const audio = useAudio()
  const chord = workspace.selected

  if (!chord) {
    return (
      <section className={styles.section} aria-label="Selected chord">
        <EmptyState icon={<MousePointerClick size={20} />} title="No chord selected">
          Select a chord in the progression to inspect, edit and hear it.
        </EmptyState>
      </section>
    )
  }

  const analysis = workspace.analysis.data?.chords[workspace.selectedIndex]
  const matching = analysis && analysis.symbol === chord.symbol ? analysis : undefined
  const size = qualityById(catalog, chord.quality)?.size ?? chord.notes.length
  const pending = workspace.pendingIds.has(chord.id)

  return (
    <section className={styles.section} aria-label="Selected chord">
      <div className={styles.chordHeader}>
        <div>
          <h2 className={styles.symbol}>{chord.symbol}</h2>
          <p className={styles.sub}>{chord.qualityName}{chord.inversion > 0 ? ` · ${INVERSION_LABELS[chord.inversion]} inversion` : ''}</p>
        </div>
        <button type="button" className="btn" onClick={() => void audio.playChord(chord.voicing)} aria-label="Play selected chord">
          <Play size={14} aria-hidden /> Play
        </button>
      </div>

      {matching && (
        <div className={styles.analysis}>
          <div className={styles.badges}>
            <span className={`badge ${styles.roman}`}>{matching.label}</span>
            <CategoryBadge category={matching.category} />
            <FunctionBadge fn={matching.function} confident={matching.functionConfident} />
          </div>
          <p className={styles.explanation}>{matching.explanation}</p>
        </div>
      )}

      <table className={styles.tones}>
        <caption className="visually-hidden">Chord tones and intervals above the root</caption>
        <thead>
          <tr><th scope="col">Note</th><th scope="col">Interval</th><th scope="col">Semitones</th></tr>
        </thead>
        <tbody>
          {chord.intervals.map((interval) => (
            <tr key={interval.note} className={interval.note === chord.root ? styles.rootRow : undefined}>
              <td className="mono">{interval.note}</td>
              <td>{interval.fullName} <span className={styles.dim}>({interval.name})</span></td>
              <td className="mono">{interval.semitones}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className={styles.voicing}>
        <span className="field-label">Voicing</span>
        <span className="mono">{chord.voicingNotes.join('  ')}</span>
        <span className={`mono ${styles.dim}`}>MIDI {chord.voicing.join(', ')}</span>
      </p>

      <fieldset className={styles.editor} disabled={pending} aria-busy={pending}>
        <legend className="panel-title">Edit chord</legend>
        <div className={styles.row}>
          <label className="field">
            <span className="field-label">Root</span>
            <select className="select" aria-label="Root" value={chord.root} onChange={(e) => void workspace.editChord(chord.id, { root: e.target.value })}>
              {!catalog.roots.includes(chord.root) && <option value={chord.root}>{chord.root}</option>}
              {catalog.roots.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span className="field-label">Quality</span>
            <select className="select" aria-label="Quality" value={chord.quality} onChange={(e) => void workspace.editChord(chord.id, { quality: e.target.value })}>
              {catalog.qualities.map((q) => <option key={q.id} value={q.id}>{q.name}{q.suffix ? ` (${q.suffix})` : ''}</option>)}
            </select>
          </label>
        </div>

        <div className="field">
          <span className="field-label">Inversion</span>
          <div className="segmented" role="group" aria-label="Inversion">
            {INVERSION_LABELS.slice(0, size).map((label, i) => (
              <button key={label} type="button" aria-pressed={chord.inversion === i}
                      onClick={() => void workspace.editChord(chord.id, { inversion: i })}>{label}</button>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <div className="field">
            <span className="field-label">Voicing style</span>
            <div className="segmented" role="group" aria-label="Voicing style">
              {STYLES.map((s) => (
                <button key={s.id} type="button"
                        onClick={() => void workspace.editChord(chord.id, { style: s.id })}>{s.label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Octave</span>
            <div className="segmented" role="group" aria-label="Octave">
              <button type="button" onClick={() => workspace.shiftOctave(chord.id, -1)} aria-label="Octave down"><ArrowDown size={13} /></button>
              <button type="button" onClick={() => workspace.shiftOctave(chord.id, 1)} aria-label="Octave up"><ArrowUp size={13} /></button>
            </div>
          </div>
          <label className="field">
            <span className="field-label">Beats</span>
            <select className="select" aria-label="Beats" value={chord.durationBeats}
                    onChange={(e) => workspace.setDuration(chord.id, Number(e.target.value))}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>
      </fieldset>
    </section>
  )
}
