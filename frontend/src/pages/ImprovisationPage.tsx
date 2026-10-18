import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Keyboard, Play, Square, Trash2 } from 'lucide-react'
import type { ChordInput, ImprovisationResponse, KeyDto, Mode, PresetView } from '../api/types'
import { theoryApi } from '../api/theory'
import { errorMessage, isAbort } from '../api/http'
import { useCatalog } from '../state/CatalogProvider'
import { useWorkspace } from '../state/WorkspaceProvider'
import { useAudio } from '../audio/AudioProvider'
import { KeyboardPanel, chordHighlights } from '../components/keyboard/KeyboardPanel'
import type { KeyHighlight } from '../components/keyboard/PianoKeyboard'
import { ErrorBanner, Spinner } from '../components/common/Status'
import { validateTempo } from '../components/workspace/WorkspaceHeader'
import { CustomProgressionForm } from '../components/improvisation/CustomProgressionForm'
import { NoteGuide } from '../components/improvisation/NoteGuide'
import { loadCustomProgressions, saveCustomProgressions, type CustomProgression } from '../components/improvisation/customProgressions'
import { useComputerKeyboard } from '../components/improvisation/useComputerKeyboard'
import { formatMusic, formatMusicProse, midiName } from '../model/notes'
import styles from './Pages.module.css'
import own from '../components/improvisation/Improvisation.module.css'

type Source = { kind: 'preset'; id: string } | { kind: 'custom'; id: string } | { kind: 'workspace' }

const OWNER = 'improvisation'
const ROLE_TO_HIGHLIGHT = { ROOT: 'root', CHORD_TONE: 'tone', SCALE: 'scale', TENSION: 'tension' } as const

export function ImprovisationPage() {
  const catalog = useCatalog()
  const workspace = useWorkspace()
  const audio = useAudio()
  const [key, setKey] = useState<KeyDto>(workspace.content.key)
  const [presets, setPresets] = useState<PresetView[]>([])
  const [custom, setCustom] = useState<CustomProgression[]>(loadCustomProgressions)
  const [source, setSource] = useState<Source | null>(null)
  const [data, setData] = useState<ImprovisationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const [tempoText, setTempoText] = useState(String(workspace.content.tempoBpm))
  const tempoError = validateTempo(tempoText)
  const tempo = tempoError ? workspace.content.tempoBpm : Number(tempoText)
  const playing = audio.isPlaying && audio.sequenceOwner === OWNER

  useEffect(() => {
    const controller = new AbortController()
    theoryApi.presets(key, controller.signal)
      .then((list) => {
        setPresets(list)
        setSource((s) => s ?? (list[0] ? { kind: 'preset', id: list[0].id } : null))
      })
      .catch((e: unknown) => !isAbort(e) && setError(errorMessage(e)))
    return () => controller.abort()
  }, [key])

  // The request that produces the guide for the chosen progression in the chosen key.
  const request = useMemo(() => {
    if (!source) return null
    if (source.kind === 'preset') {
      const preset = presets.find((p) => p.id === source.id)
      if (!preset) return null
      const chords: ChordInput[] = preset.chords.map((c) => ({
        root: c.root, quality: c.quality, inversion: c.inversion, voicing: c.voicing, durationBeats: c.durationBeats ?? 4,
      }))
      return { key, chords, description: preset.description }
    }
    if (source.kind === 'custom') {
      const progression = custom.find((p) => p.id === source.id)
      return progression ? { key, symbols: progression.symbols, description: `Your progression: ${progression.symbols.join(' ')}` } : null
    }
    const chords = workspace.content.chords.map((c) => ({
      root: c.root, quality: c.quality, inversion: c.inversion, voicing: c.voicing, durationBeats: c.durationBeats,
    }))
    return chords.length ? { key, chords, description: `The progression open in the workspace ("${workspace.content.name}").` } : null
  }, [source, presets, custom, key, workspace.content.chords, workspace.content.name])

  const requestKey = request ? JSON.stringify(request) : null
  useEffect(() => {
    if (!requestKey) return
    const { description: _description, ...body } = JSON.parse(requestKey) as { description: string; key: KeyDto; chords?: ChordInput[]; symbols?: string[] }
    const controller = new AbortController()
    setLoading(true)
    theoryApi.improvisation(body, controller.signal)
      .then((response) => {
        setData(response)
        setError(null)
        setSelected(0)
      })
      .catch((e: unknown) => !isAbort(e) && setError(errorMessage(e)))
      .finally(() => !controller.signal.aborted && setLoading(false))
    return () => controller.abort()
  }, [requestKey])

  // A new progression or key invalidates a running loop; leaving the page stops it too.
  const { stop } = audio
  useEffect(() => () => stop(), [requestKey, stop])

  const playNote = useCallback((midi: number) => void audio.playNote(midi), [audio])
  const base = useComputerKeyboard(playNote, data !== null)

  const togglePlay = useCallback(() => {
    if (playing) {
      audio.stop()
    } else if (data) {
      void audio.playSequence(data.chords.map((c) => ({ notes: c.chord.voicing, beats: c.chord.durationBeats ?? 4 })), tempo,
        { loop: true, owner: OWNER })
    }
  }, [playing, audio, data, tempo])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement
      if (event.key === ' ' && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName)) {
        event.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay])

  const count = data?.chords.length ?? 0
  const current = playing && audio.playingIndex !== null ? audio.playingIndex : Math.min(selected, Math.max(0, count - 1))
  const currentChord = data?.chords[current]
  const nextChord = count > 1 ? data?.chords[(current + 1) % count] : undefined

  const guideHighlights = useMemo(() => {
    const map = new Map<number, KeyHighlight>()
    currentChord?.guide.forEach((n) => map.set(n.pitchClass, { role: ROLE_TO_HIGHLIGHT[n.role], label: n.note }))
    return map
  }, [currentChord])

  const setMode = (mode: Mode) => {
    const tonics = catalog.keyTonics[mode]
    setKey({ mode, tonic: tonics.includes(key.tonic) ? key.tonic : tonics[0] })
    setSource((s) => (s?.kind === 'preset' ? null : s)) // presets depend on the mode
  }

  const updateCustom = (list: CustomProgression[]) => {
    setCustom(list)
    saveCustomProgressions(list)
  }

  return (
    <div className={styles.page} style={{ maxWidth: 1400 }}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Improvisation</h1>
          <p className={styles.lead}>
            Loop a progression and improvise over it. The keyboard shows, for the chord that is sounding, the chord tones,
            the safe notes and the tension notes (red) that are expressive but should resolve.
          </p>
        </div>
      </header>

      <div className={own.layout}>
        <aside className={own.sidebar} aria-label="Progressions">
          <div className={styles.controlsRow}>
            <label className="field">
              <span className="field-label">Key</span>
              <select className="select" aria-label="Key tonic" value={key.tonic} onChange={(e) => setKey({ ...key, tonic: e.target.value })}>
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

          <h2 className="panel-title">Preset progressions</h2>
          <ul className={own.sourceList}>
            {presets.map((p) => (
              <li key={p.id}>
                <button type="button" className={own.source} aria-pressed={source?.kind === 'preset' && source.id === p.id}
                        onClick={() => setSource({ kind: 'preset', id: p.id })}>
                  <span>{p.name}</span>
                  <span>{p.chords.map((c) => formatMusic(c.symbol.split('/')[0])).join(' ')}</span>
                </button>
              </li>
            ))}
          </ul>

          <h2 className="panel-title">Your progressions</h2>
          <ul className={own.sourceList}>
            <li>
              <button type="button" className={own.source} aria-pressed={source?.kind === 'workspace'}
                      disabled={workspace.content.chords.length === 0} onClick={() => setSource({ kind: 'workspace' })}>
                <span>Workspace progression</span>
                <span>{workspace.content.chords.map((c) => formatMusic(c.symbol)).join(' ') || 'empty'}</span>
              </button>
            </li>
            {custom.map((p) => (
              <li key={p.id} className={own.customRow}>
                <button type="button" className={own.source} aria-pressed={source?.kind === 'custom' && source.id === p.id}
                        onClick={() => setSource({ kind: 'custom', id: p.id })}>
                  <span>{p.name}</span>
                  <span>{p.symbols.map(formatMusic).join(' ')}</span>
                </button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Delete ${p.name}`}
                        onClick={() => {
                          updateCustom(custom.filter((c) => c.id !== p.id))
                          if (source?.kind === 'custom' && source.id === p.id) setSource(null)
                        }}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
          <CustomProgressionForm keyDto={key} onCreated={(p) => {
            updateCustom([...custom, p])
            setSource({ kind: 'custom', id: p.id })
          }} />
        </aside>

        <div className={own.main}>
          <div className={own.transport}>
            <button type="button" className={`btn btn-primary ${own.play}`} onClick={togglePlay} disabled={!data}>
              {playing ? <><Square size={14} aria-hidden /> Stop</> : <><Play size={14} aria-hidden /> Play loop</>}
            </button>
            <label className="field">
              <span className="field-label">Tempo (BPM)</span>
              <input className={`input ${own.tempo}`} inputMode="numeric" value={tempoText} aria-invalid={tempoError !== null}
                     onChange={(e) => {
                       setTempoText(e.target.value)
                       if (validateTempo(e.target.value) === null) audio.setTempo(Number(e.target.value))
                     }} />
            </label>
            <p className={own.description}>{request?.description ? formatMusicProse(request.description) : null}</p>
            {loading && <Spinner label="Preparing" />}
          </div>
          {tempoError && <p className="field-error" role="alert">{tempoError}</p>}
          {error && <ErrorBanner message={error} />}
          {!source && !error && <p className={own.hint}>Choose a progression on the left.</p>}

          {data && currentChord && (
            <>
              <ol className={own.strip} aria-label="Progression">
                {data.chords.map((c, i) => (
                  <li key={i} style={{ '--beats': c.chord.durationBeats ?? 4 } as CSSProperties}>
                    <button type="button" aria-pressed={i === current} className={`${own.chordButton} ${playing && i === current ? own.playing : ''}`}
                            onClick={() => {
                              setSelected(i)
                              if (!playing) void audio.playChord(c.chord.voicing)
                            }}
                            aria-label={`Chord ${i + 1}: ${c.chord.symbol}`}>
                      <strong>{formatMusic(c.chord.symbol)}</strong>
                      <span>{c.chord.durationBeats ?? 4} beats</span>
                    </button>
                  </li>
                ))}
              </ol>

              <div className={own.now} aria-live="polite">
                <strong className={own.nowChord}>{formatMusic(currentChord.chord.symbol)}</strong>
                {nextChord && <span className={own.next}>then <strong>{formatMusic(nextChord.chord.symbol)}</strong></span>}
                <span className={own.keysHint}>
                  <Keyboard size={13} aria-hidden /> Play along with A W S E D F T G Y H U J K (from {formatMusic(midiName(base))}), Z / X change octave, Space plays or stops.
                </span>
              </div>

              <KeyboardPanel
                highlights={chordHighlights(null)}
                pitchClassHighlights={guideHighlights}
                legend="improvisation"
                title={<>Notes over <span className="score">{formatMusic(currentChord.chord.symbol)}</span></>}
                label="Improvisation keyboard"
              />
              <NoteGuide guide={currentChord.guide} />
              <p className={own.hint}>{data.legend}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
