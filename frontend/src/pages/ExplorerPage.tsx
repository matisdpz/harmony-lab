import { useEffect, useMemo, useState } from 'react'
import { Plus, Play, ScanSearch, X } from 'lucide-react'
import type { ChordDetails, IdentifyResponse, KeyDto, KeyView, Mode } from '../api/types'
import { theoryApi } from '../api/theory'
import { errorMessage, isAbort } from '../api/http'
import { useCatalog } from '../state/CatalogProvider'
import { useWorkspace } from '../state/WorkspaceProvider'
import { useAudio } from '../audio/AudioProvider'
import { useToast } from '../state/ToastProvider'
import { KeyboardPanel, chordHighlights } from '../components/keyboard/KeyboardPanel'
import type { KeyHighlight } from '../components/keyboard/PianoKeyboard'
import { CategoryBadge, FunctionBadge } from '../components/analysis/Badges'
import { ErrorBanner, Spinner } from '../components/common/Status'
import { formatMusic, formatMusicProse, midiName } from '../model/notes'
import styles from './Pages.module.css'

const INVERSION_NAMES = ['Root position', 'First inversion', 'Second inversion', 'Third inversion']

export function ExplorerPage() {
  const catalog = useCatalog()
  const workspace = useWorkspace()
  const audio = useAudio()
  const { notify } = useToast()
  const [root, setRoot] = useState('C')
  const [quality, setQuality] = useState('MAJOR7')
  const [inversion, setInversion] = useState(0)
  const [key, setKey] = useState<KeyDto>(workspace.content.key)
  const [details, setDetails] = useState<ChordDetails | null>(null)
  const [keyView, setKeyView] = useState<KeyView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [identifyMode, setIdentifyMode] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const [identified, setIdentified] = useState<IdentifyResponse | null>(null)

  const size = catalog.qualities.find((q) => q.id === quality)?.size ?? 3
  const safeInversion = Math.min(inversion, size - 1)

  useEffect(() => {
    const controller = new AbortController()
    theoryApi.resolveChord({ root, quality, inversion: safeInversion, key, register: workspace.content.register }, controller.signal)
      .then((d) => {
        setDetails(d)
        setError(null)
      })
      .catch((e: unknown) => !isAbort(e) && setError(errorMessage(e)))
    return () => controller.abort()
  }, [root, quality, safeInversion, key, workspace.content.register])

  useEffect(() => {
    const controller = new AbortController()
    theoryApi.key(key, controller.signal).then(setKeyView).catch((e: unknown) => !isAbort(e) && setError(errorMessage(e)))
    return () => controller.abort()
  }, [key])

  const chord = details?.chord ?? null
  const highlights = useMemo(() => {
    if (!identifyMode) return chordHighlights(chord)
    return new Map<number, KeyHighlight>(picked.map((m) => [m, { role: 'tone', label: midiName(m) }]))
  }, [identifyMode, chord, picked])

  const explore = (r: string, q: string, inv = 0) => {
    setRoot(r)
    setQuality(q)
    setInversion(inv)
    setIdentifyMode(false)
  }

  const identify = async () => {
    try {
      setIdentified(await theoryApi.identify(picked, key))
    } catch (e) {
      notify('error', errorMessage(e))
    }
  }

  const setMode = (mode: Mode) => {
    const tonics = catalog.keyTonics[mode]
    setKey({ mode, tonic: tonics.includes(key.tonic) ? key.tonic : tonics[0] })
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Chord Explorer</h1>
          <p className={styles.lead}>Build any supported chord, inspect its intervals and inversions, and see how it relates to a key.</p>
        </div>
      </header>

      <div className={styles.controlsRow}>
        <label className="field">
          <span className="field-label">Root</span>
          <select className="select" aria-label="Root" value={root} onChange={(e) => setRoot(e.target.value)}>
            {catalog.roots.map((r) => <option key={r} value={r}>{formatMusic(r)}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Quality</span>
          <select className="select" aria-label="Quality" value={quality} onChange={(e) => setQuality(e.target.value)}>
            {catalog.qualities.map((q) => <option key={q.id} value={q.id}>{q.name}{q.suffix ? ` (${q.suffix})` : ''}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Key context</span>
          <select className="select" value={key.tonic} onChange={(e) => setKey({ ...key, tonic: e.target.value })} aria-label="Key tonic">
            {catalog.keyTonics[key.mode].map((t) => <option key={t} value={t}>{formatMusic(t)}</option>)}
          </select>
        </label>
        <div className="field">
          <span className="field-label">Scale</span>
          <div className="segmented" role="group" aria-label="Scale">
            <button type="button" aria-pressed={key.mode === 'MAJOR'} onClick={() => setMode('MAJOR')}>Major</button>
            <button type="button" aria-pressed={key.mode === 'MINOR'} onClick={() => setMode('MINOR')}>Minor</button>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className={styles.twoColumn}>
        <section className={`panel ${styles.card}`} aria-label="Chord details">
          {!chord ? <Spinner /> : (
            <>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.bigSymbol}>{formatMusic(chord.symbol)}</h2>
                  <p className={styles.lead}>{chord.qualityName}: <span className="score">{chord.notes.map(formatMusic).join(' ')}</span></p>
                </div>
                <div className={styles.actions}>
                  <button type="button" className="btn" onClick={() => void audio.playChord(chord.voicing)}><Play size={14} aria-hidden /> Play</button>
                  <button type="button" className="btn btn-primary" onClick={() => {
                    workspace.insertChord(chord, workspace.selectedIndex >= 0 ? workspace.selectedIndex + 1 : undefined)
                    notify('success', `Added ${chord.symbol} to "${workspace.content.name}"`)
                  }}>
                    <Plus size={14} aria-hidden /> Add to progression
                  </button>
                </div>
              </div>

              <h3 className="panel-title">Interval structure</h3>
              <div className={styles.ladder} aria-hidden>
                {Array.from({ length: 15 }, (_, s) => {
                  const tone = chord.intervals.find((i) => i.semitones === s)
                  return <span key={s} className={tone ? (s === 0 ? styles.ladderRoot : styles.ladderTone) : ''}>{tone ? formatMusic(tone.name) : ''}</span>
                })}
              </div>
              <table className={styles.table}>
                <thead><tr><th scope="col">Tone</th><th scope="col">Interval above root</th><th scope="col">Semitones</th></tr></thead>
                <tbody>
                  {chord.intervals.map((i) => (
                    <tr key={i.note}><td className={styles.noteCell}>{formatMusic(i.note)}</td><td>{i.fullName} <span className={styles.dim}>({i.name})</span></td><td>{i.semitones}</td></tr>
                  ))}
                </tbody>
              </table>

              <h3 className="panel-title">Inversions</h3>
              <ul className={styles.inversions}>
                {details?.inversions.map((inv) => (
                  <li key={inv.inversion}>
                    <button type="button" className={`${styles.inversion} ${inv.inversion === safeInversion ? styles.inversionActive : ''}`}
                            aria-pressed={inv.inversion === safeInversion}
                            onClick={() => {
                              setInversion(inv.inversion)
                              void audio.playChord(inv.voicing)
                            }}>
                      <span className={styles.inversionSymbol}>{formatMusic(inv.symbol)}</span>
                      <span className={styles.dim}>{INVERSION_NAMES[inv.inversion]}</span>
                      <span>{inv.voicingNotes.map(formatMusic).join(' ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={`panel ${styles.card}`} aria-label="Relationship to the key">
          <h2 className={styles.cardTitle}>In {formatMusic(keyView?.label ?? `${key.tonic} ${key.mode.toLowerCase()}`)}</h2>
          {details?.relation && (
            <div className={styles.relation}>
              <div className={styles.badgeRow}>
                <span className={styles.romanLabel}>{formatMusic(details.relation.label)}</span>
                <CategoryBadge category={details.relation.category} />
                <FunctionBadge fn={details.relation.function} confident={details.relation.functionConfident} />
              </div>
              <p className={styles.lead}>{formatMusicProse(details.relation.explanation)}</p>
            </div>
          )}
          {keyView && (
            <>
              <p className={styles.dim}>Scale: <span className="score">{keyView.scale.map(formatMusic).join(' ')}</span>, {formatMusicProse(keyView.signatureText)}</p>
              <h3 className="panel-title">Diatonic chords</h3>
              <div className={styles.diatonic}>
                {[keyView.triads, keyView.sevenths].map((row, r) => (
                  <div key={r} className={styles.diatonicRow}>
                    {row.map((d) => (
                      <button key={d.chord.symbol} type="button" className={styles.diatonicChord}
                              onClick={() => explore(d.chord.root, d.chord.quality)}
                              aria-label={`Explore ${d.chord.symbol} (${d.roman})`}>
                        <span className={styles.diatonicRoman}>{formatMusic(d.roman)}</span>
                        <strong>{formatMusic(d.chord.symbol)}</strong>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <KeyboardPanel
        highlights={highlights}
        follow={identifyMode ? undefined : chord?.voicing}
        title={identifyMode ? 'Click keys to choose notes' : chord ? <span className="score">{formatMusic(chord.symbol)}</span> : undefined}
        onKeyPress={identifyMode ? (midi) => {
          setIdentified(null)
          setPicked((p) => (p.includes(midi) ? p.filter((m) => m !== midi) : [...p, midi].slice(-8)))
          void audio.playNote(midi)
        } : undefined}
        actions={
          <button type="button" className={`btn btn-sm ${identifyMode ? 'btn-primary' : ''}`} aria-pressed={identifyMode}
                  onClick={() => {
                    setIdentifyMode((m) => !m)
                    setPicked([])
                    setIdentified(null)
                  }}>
            <ScanSearch size={13} aria-hidden /> Identify from keys
          </button>
        }
        label="Explorer keyboard"
      />

      {identifyMode && (
        <section className={`panel ${styles.card}`} aria-label="Chord identification">
          <div className={styles.cardHeader}>
            <p className={styles.lead}>
              Selected: <span className="score">{picked.length ? [...picked].sort((a, b) => a - b).map((m) => formatMusic(midiName(m))).join(' ') : 'none'}</span>
            </p>
            <div className={styles.actions}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked([])} disabled={!picked.length}><X size={13} aria-hidden /> Clear</button>
              <button type="button" className="btn btn-sm" onClick={() => void identify()} disabled={!picked.length}>Identify</button>
            </div>
          </div>
          {identified && (
            <>
              <p className={styles.dim}>{identified.message}</p>
              <ul className={styles.candidates}>
                {identified.candidates.map((c) => (
                  <li key={c.chord.symbol}>
                    <button type="button" className={styles.diatonicChord} onClick={() => explore(c.chord.root, c.chord.quality, c.chord.inversion)}>
                      <strong>{formatMusic(c.chord.symbol)}</strong>
                      <span className={styles.dim}>{formatMusicProse(c.explanation)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  )
}
