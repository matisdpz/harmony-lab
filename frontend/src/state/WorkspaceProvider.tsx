import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { theoryApi } from '../api/theory'
import { projectsApi } from '../api/projects'
import { ApiError, errorMessage, isAbort } from '../api/http'
import type { AnalysisResponse, KeyDto, ProjectResponse, RegisterDto, VoicedChord, VoicingStyle } from '../api/types'
import {
  emptyContent, initialState, isDirty, newSlotId, selectedIndex, toChordInput, toSlot, workspaceReducer,
  type ChordSlot, type ProjectContent, type WorkspaceState,
} from '../model/workspace'
import { shiftNoteOctave } from '../model/notes'
import { useToast } from './ToastProvider'
import { useProjects } from './ProjectsProvider'
import { qualityById, useCatalog } from './CatalogProvider'

export interface ChordEdit {
  root?: string
  quality?: string
  inversion?: number
  style?: VoicingStyle
}

export interface AnalysisState {
  data: AnalysisResponse | null
  loading: boolean
  error: string | null
}

interface WorkspaceApi {
  state: WorkspaceState
  content: ProjectContent
  selected: ChordSlot | null
  selectedIndex: number
  dirty: boolean
  initializing: boolean
  pendingIds: ReadonlySet<string>
  analysis: AnalysisState
  saving: boolean
  conflict: ApiError | null
  select: (id: string | null) => void
  undo: () => void
  redo: () => void
  setName: (name: string) => void
  setKey: (key: KeyDto) => void
  setTempo: (bpm: number) => void
  setRegister: (register: RegisterDto) => void
  addChordBySymbol: (symbol: string, index?: number) => Promise<string | null>
  addChord: (root: string, quality: string, index?: number) => Promise<string | null>
  insertChord: (chord: VoicedChord, index?: number) => void
  editChord: (id: string, changes: ChordEdit) => Promise<void>
  shiftOctave: (id: string, octaves: number) => void
  setDuration: (id: string, beats: number) => void
  replaceChord: (id: string, chord: VoicedChord) => void
  removeChord: (id: string) => void
  duplicateChord: (id: string) => void
  moveChord: (id: string, toIndex: number) => void
  clear: () => void
  replaceAllChords: (chords: VoicedChord[]) => void
  save: () => Promise<boolean>
  saveAsCopy: () => Promise<boolean>
  reloadSaved: () => Promise<void>
  dismissConflict: () => void
  openProject: (id: string) => Promise<boolean>
  newProject: () => void
  loadExample: () => Promise<void>
  projectRenamed: (project: ProjectResponse) => void
  projectDeleted: (id: string) => void
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null)

const EXAMPLE = ['A:MINOR', 'F:MAJOR', 'C:MAJOR', 'G:MAJOR']

export function contentFromProject(project: ProjectResponse): ProjectContent {
  return {
    name: project.name,
    key: project.key,
    tempoBpm: project.tempoBpm,
    register: project.register,
    chords: project.chords.map((chord) => toSlot(chord, newSlotId(), chord.durationBeats ?? 4)),
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, () => initialState(emptyContent({ tonic: 'A', mode: 'MINOR' })))
  const [initializing, setInitializing] = useState(true)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const [analysis, setAnalysis] = useState<AnalysisState>({ data: null, loading: false, error: null })
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<ApiError | null>(null)
  const { notify } = useToast()
  const projects = useProjects()
  const catalog = useCatalog()

  // Async callbacks read the latest state through a ref so they never act on a stale closure.
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])
  const requestSeq = useRef(new Map<string, number>())

  const content = state.content

  // ---- analysis (debounced, cancels outdated requests) ---------------------------------------------
  const analysisInput = useMemo(
    () => (content.chords.length === 0 ? null : JSON.stringify({ key: content.key, chords: content.chords.map(toChordInput) })),
    [content.key, content.chords],
  )
  useEffect(() => {
    if (!analysisInput) {
      setAnalysis({ data: null, loading: false, error: null })
      return
    }
    const controller = new AbortController()
    setAnalysis((a) => ({ ...a, loading: true }))
    const timer = window.setTimeout(() => {
      const input = JSON.parse(analysisInput) as { key: KeyDto; chords: ReturnType<typeof toChordInput>[] }
      theoryApi.analyze(input.key, input.chords, controller.signal)
        .then((data) => setAnalysis({ data, loading: false, error: null }))
        .catch((e: unknown) => {
          if (!isAbort(e)) setAnalysis({ data: null, loading: false, error: errorMessage(e) })
        })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [analysisInput])

  // ---- helpers -------------------------------------------------------------------------------------
  const setPending = useCallback((id: string, pending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current)
      if (pending) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const loadExample = useCallback(async () => {
    try {
      const response = await theoryApi.optimize({
        chords: EXAMPLE.map((c) => {
          const [root, quality] = c.split(':')
          return { root, quality, inversion: 0 }
        }),
        // Root position matches the conventional "Am – F – C – G" spelling of the example.
        allowInversions: false,
        keepFirstVoicing: false,
      })
      const example: ProjectContent = {
        ...emptyContent({ tonic: 'A', mode: 'MINOR' }),
        name: 'Example progression',
        chords: response.chords.map((chord) => toSlot(chord)),
      }
      dispatch({ type: 'load', projectId: null, version: null, content: example, pristine: true })
    } catch (e) {
      notify('error', `Could not load the example progression: ${errorMessage(e)}`)
    } finally {
      setInitializing(false)
    }
  }, [notify])

  const didInit = useRef(false)
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    void loadExample()
  }, [loadExample])

  const insertChord = useCallback((chord: VoicedChord, index?: number) => {
    dispatch({ type: 'addChord', chord: toSlot(chord), index })
  }, [])

  const addResolved = useCallback(async (resolve: (previousVoicing?: number[]) => Promise<VoicedChord>, index?: number) => {
    const chords = stateRef.current.content.chords
    const insertAt = index ?? chords.length
    const previous = chords[insertAt - 1] ?? chords[chords.length - 1]
    try {
      const chord = await resolve(previous?.voicing)
      dispatch({ type: 'addChord', chord: toSlot(chord), index: insertAt })
      return null
    } catch (e) {
      return errorMessage(e)
    }
  }, [])

  const addChordBySymbol = useCallback((symbol: string, index?: number) => {
    const { register, key } = stateRef.current.content
    return addResolved(async (previousVoicing) =>
      (await theoryApi.parseChord({ symbol, register, key, previousVoicing })).chord, index)
  }, [addResolved])

  const addChord = useCallback((root: string, quality: string, index?: number) => {
    const { register, key } = stateRef.current.content
    return addResolved(async (previousVoicing) =>
      (await theoryApi.resolveChord({ root, quality, inversion: 0, register, key, previousVoicing })).chord, index)
  }, [addResolved])

  const editChord = useCallback(async (id: string, changes: ChordEdit) => {
    const slot = stateRef.current.content.chords.find((c) => c.id === id)
    if (!slot) return
    const quality = changes.quality ?? slot.quality
    const size = qualityById(catalog, quality)?.size ?? 3
    const requestedInversion = changes.inversion ?? (changes.quality && changes.quality !== slot.quality ? 0 : slot.inversion)
    const inversion = Math.min(requestedInversion, size - 1)
    const seq = (requestSeq.current.get(id) ?? 0) + 1
    requestSeq.current.set(id, seq)
    setPending(id, true)
    try {
      const { register, key } = stateRef.current.content
      const details = await theoryApi.resolveChord({
        root: changes.root ?? slot.root,
        quality,
        inversion,
        register,
        key,
        // Without an explicit style, keep the chord where it is on the keyboard (smoothest voicing).
        ...(changes.style ? { style: changes.style } : { previousVoicing: slot.voicing }),
      })
      if (requestSeq.current.get(id) === seq) {
        dispatch({ type: 'replaceChord', id, chord: details.chord })
      }
    } catch (e) {
      if (requestSeq.current.get(id) === seq) notify('error', errorMessage(e))
    } finally {
      if (requestSeq.current.get(id) === seq) setPending(id, false)
    }
  }, [catalog, notify, setPending])

  const shiftOctave = useCallback((id: string, octaves: number) => {
    const slot = stateRef.current.content.chords.find((c) => c.id === id)
    if (!slot) return
    const voicing = slot.voicing.map((n) => n + 12 * octaves)
    if (voicing[0] < 21 || voicing[voicing.length - 1] > 108) {
      notify('info', 'That would move the chord outside the piano range.')
      return
    }
    dispatch({
      type: 'replaceChord',
      id,
      chord: { ...slot, voicing, voicingNotes: slot.voicingNotes.map((n) => shiftNoteOctave(n, octaves)) },
    })
  }, [notify])

  // ---- persistence ---------------------------------------------------------------------------------
  const persist = useCallback(async (asCopy: boolean) => {
    const current = stateRef.current
    const requested = current.content
    const name = requested.name.trim()
    if (!name) {
      notify('error', 'Give the project a name before saving.')
      return false
    }
    const body = {
      name,
      key: requested.key,
      tempoBpm: requested.tempoBpm,
      register: requested.register,
      chords: requested.chords.map(toChordInput),
    }
    setSaving(true)
    try {
      const response = !asCopy && current.projectId && current.version !== null
        ? await projectsApi.update(current.projectId, { ...body, version: current.version })
        : await projectsApi.create(asCopy ? { ...body, name: `${name} (copy)`.slice(0, 100) } : body)
      dispatch({ type: 'markSaved', projectId: response.id, version: response.version, requested, saved: contentFromProject(response) })
      setConflict(null)
      notify('success', asCopy ? `Saved as "${response.name}"` : `Saved "${response.name}"`)
      void projects.refresh()
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflict(e)
      } else if (e instanceof ApiError && e.fieldErrors.length > 0) {
        notify('error', `Not saved: ${e.fieldErrors.map((f) => `${f.field} ${f.message}`).join('; ')}`)
      } else {
        notify('error', `Not saved: ${errorMessage(e)}`)
      }
      return false
    } finally {
      setSaving(false)
    }
  }, [notify, projects])

  const openProject = useCallback(async (id: string) => {
    try {
      const project = await projectsApi.get(id)
      dispatch({ type: 'load', projectId: project.id, version: project.version, content: contentFromProject(project), pristine: true })
      setConflict(null)
      return true
    } catch (e) {
      notify('error', `Could not open the project: ${errorMessage(e)}`)
      if (e instanceof ApiError && e.status === 404) void projects.refresh()
      return false
    }
  }, [notify, projects])

  const reloadSaved = useCallback(async () => {
    const id = stateRef.current.projectId
    if (id) await openProject(id)
  }, [openProject])

  const api = useMemo<WorkspaceApi>(() => ({
    state,
    content,
    selected: content.chords.find((c) => c.id === state.selectedId) ?? null,
    selectedIndex: selectedIndex(state),
    dirty: isDirty(state),
    initializing,
    pendingIds,
    analysis,
    saving,
    conflict,
    select: (id) => dispatch({ type: 'select', id }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    setName: (name) => dispatch({ type: 'setName', name: name.slice(0, 100) }),
    setKey: (key) => dispatch({ type: 'setKey', key }),
    setTempo: (tempoBpm) => dispatch({ type: 'setTempo', tempoBpm }),
    setRegister: (register) => dispatch({ type: 'setRegister', register }),
    addChordBySymbol,
    addChord,
    insertChord,
    editChord,
    shiftOctave,
    setDuration: (id, durationBeats) => dispatch({ type: 'setDuration', id, durationBeats }),
    replaceChord: (id, chord) => dispatch({ type: 'replaceChord', id, chord }),
    removeChord: (id) => dispatch({ type: 'removeChord', id }),
    duplicateChord: (id) => dispatch({ type: 'duplicateChord', id, newId: newSlotId() }),
    moveChord: (id, toIndex) => dispatch({ type: 'moveChord', id, toIndex }),
    clear: () => dispatch({ type: 'clear' }),
    replaceAllChords: (chords) => dispatch({ type: 'replaceAllChords', chords }),
    save: () => persist(false),
    saveAsCopy: () => persist(true),
    reloadSaved,
    dismissConflict: () => setConflict(null),
    openProject,
    newProject: () => {
      dispatch({ type: 'load', projectId: null, version: null, content: emptyContent(stateRef.current.content.key), pristine: true })
      setConflict(null)
    },
    loadExample,
    projectRenamed: (project) => {
      if (project.id === stateRef.current.projectId) dispatch({ type: 'syncMeta', name: project.name, version: project.version })
    },
    projectDeleted: (id) => {
      if (id === stateRef.current.projectId) {
        dispatch({ type: 'detach' })
        notify('info', 'The open project was deleted. Its content is still here as an unsaved project.')
      }
    },
  }), [state, content, initializing, pendingIds, analysis, saving, conflict, addChordBySymbol, addChord, insertChord,
    editChord, shiftOctave, persist, reloadSaved, openProject, loadExample, notify])

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceApi {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return context
}
