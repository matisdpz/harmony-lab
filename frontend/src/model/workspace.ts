import type { ChordInput, KeyDto, RegisterDto, VoicedChord } from '../api/types'
import { PATTERNS, type PlaybackPattern } from './rhythm'

/** A chord in the progression. `id` is a client-side identity that survives reordering and edits. */
export interface ChordSlot extends VoicedChord {
  id: string
  durationBeats: number
  /** How the chord is played back; saved with the project. */
  pattern: PlaybackPattern
}

export interface ProjectContent {
  name: string
  key: KeyDto
  tempoBpm: number
  register: RegisterDto
  chords: ChordSlot[]
}

interface Snapshot {
  content: ProjectContent
  selectedId: string | null
}

export interface WorkspaceState {
  projectId: string | null
  version: number | null
  content: ProjectContent
  selectedId: string | null
  past: Snapshot[]
  future: Snapshot[]
  /** Signature of the content as last loaded/saved; null when there is nothing to compare against. */
  baseline: string | null
  /** Tag of the last coalescable edit (typing in the title or tempo field creates one undo step). */
  lastEditTag: string | null
}

export const HISTORY_LIMIT = 100
export const DEFAULT_REGISTER: RegisterDto = { low: 45, high: 79 }
export const MIN_TEMPO = 30
export const MAX_TEMPO = 300

export type EditAction =
  | { type: 'setName'; name: string }
  | { type: 'setKey'; key: KeyDto }
  | { type: 'setTempo'; tempoBpm: number }
  | { type: 'setRegister'; register: RegisterDto }
  | { type: 'addChord'; chord: ChordSlot; index?: number }
  | { type: 'replaceChord'; id: string; chord: VoicedChord }
  | { type: 'setDuration'; id: string; durationBeats: number }
  | { type: 'setPattern'; id: string; pattern: PlaybackPattern }
  | { type: 'removeChord'; id: string }
  | { type: 'duplicateChord'; id: string; newId: string }
  | { type: 'moveChord'; id: string; toIndex: number }
  | { type: 'replaceAllChords'; chords: VoicedChord[] }
  | { type: 'transpose'; key: KeyDto; chords: VoicedChord[] }
  | { type: 'clear' }

export type WorkspaceAction =
  | EditAction
  | { type: 'load'; projectId: string | null; version: number | null; content: ProjectContent; pristine: boolean }
  | { type: 'markSaved'; projectId: string; version: number; requested: ProjectContent; saved: ProjectContent }
  | { type: 'syncMeta'; name: string; version: number }
  | { type: 'detach' }
  | { type: 'select'; id: string | null }
  | { type: 'undo' }
  | { type: 'redo' }

let idCounter = 0
export function newSlotId(): string {
  idCounter += 1
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2)
  return `chord-${idCounter}-${random.slice(0, 8)}`
}

export function toSlot(chord: VoicedChord, id: string = newSlotId(), durationBeats?: number, pattern?: PlaybackPattern): ChordSlot {
  return { ...chord, id, durationBeats: durationBeats ?? chord.durationBeats ?? 4, pattern: pattern ?? toPattern(chord.pattern) }
}

export function toPattern(value: string | null | undefined): PlaybackPattern {
  return PATTERNS.find((p) => p.id === value)?.id ?? 'BLOCK'
}

export function toChordInput(slot: ChordSlot): ChordInput {
  return {
    root: slot.root, quality: slot.quality, inversion: slot.inversion, voicing: slot.voicing,
    durationBeats: slot.durationBeats, pattern: slot.pattern,
  }
}

/** Stable string of everything that is persisted; used to detect unsaved changes. */
export function signature(content: ProjectContent): string {
  return JSON.stringify({
    name: content.name,
    key: content.key,
    tempoBpm: content.tempoBpm,
    register: content.register,
    chords: content.chords.map(toChordInput),
  })
}

export function emptyContent(key: KeyDto = { tonic: 'C', mode: 'MAJOR' }): ProjectContent {
  return { name: 'Untitled progression', key, tempoBpm: 90, register: DEFAULT_REGISTER, chords: [] }
}

export function initialState(content: ProjectContent = emptyContent()): WorkspaceState {
  return {
    projectId: null,
    version: null,
    content,
    selectedId: content.chords[0]?.id ?? null,
    past: [],
    future: [],
    baseline: signature(content),
    lastEditTag: null,
  }
}

export function isDirty(state: WorkspaceState): boolean {
  return state.baseline === null || signature(state.content) !== state.baseline
}

export function selectedIndex(state: WorkspaceState): number {
  return state.content.chords.findIndex((c) => c.id === state.selectedId)
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'load':
      return {
        ...initialState(action.content),
        projectId: action.projectId,
        version: action.version,
        baseline: action.pristine ? signature(action.content) : null,
      }
    case 'markSaved': {
      // If nothing changed while the request was in flight, adopt the server's normalised view
      // (e.g. trimmed name) and keep client ids. Otherwise keep the newer local edits, which stay "unsaved".
      const editedDuringSave = signature(state.content) !== signature(action.requested)
      const savedWithIds: ProjectContent = {
        ...action.saved,
        chords: action.saved.chords.map((chord, i) => ({ ...chord, id: action.requested.chords[i]?.id ?? chord.id })),
      }
      return {
        ...state,
        projectId: action.projectId,
        version: action.version,
        content: editedDuringSave ? state.content : savedWithIds,
        baseline: signature(savedWithIds),
        lastEditTag: null,
      }
    }
    case 'syncMeta': {
      const wasClean = !isDirty(state)
      const content = { ...state.content, name: action.name }
      return { ...state, version: action.version, content, baseline: wasClean ? signature(content) : state.baseline }
    }
    case 'detach':
      return { ...state, projectId: null, version: null, baseline: null }
    case 'select':
      if (action.id !== null && !state.content.chords.some((c) => c.id === action.id)) {
        return state
      }
      return { ...state, selectedId: action.id, lastEditTag: null }
    case 'undo': {
      const previous = state.past[state.past.length - 1]
      if (!previous) return state
      return restore(state, previous, state.past.slice(0, -1), [snapshot(state), ...state.future])
    }
    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      return restore(state, next, [...state.past, snapshot(state)], state.future.slice(1))
    }
    default:
      return applyEdit(state, action)
  }
}

function snapshot(state: WorkspaceState): Snapshot {
  return { content: state.content, selectedId: state.selectedId }
}

function restore(state: WorkspaceState, target: Snapshot, past: Snapshot[], future: Snapshot[]): WorkspaceState {
  const selectedId = target.content.chords.some((c) => c.id === target.selectedId)
    ? target.selectedId
    : target.content.chords[0]?.id ?? null
  return { ...state, content: target.content, selectedId, past, future, lastEditTag: null }
}

function applyEdit(state: WorkspaceState, action: EditAction): WorkspaceState {
  const result = edit(state.content, state.selectedId, action)
  if (result === null) {
    return state
  }
  const tag = action.type === 'setName' || action.type === 'setTempo' ? action.type : null
  const coalesce = tag !== null && tag === state.lastEditTag
  const past = coalesce ? state.past : [...state.past, snapshot(state)].slice(-HISTORY_LIMIT)
  return { ...state, content: result.content, selectedId: result.selectedId, past, future: [], lastEditTag: tag }
}

/** Applies one edit; returns null when the edit does not change anything (so no history entry is created). */
function edit(content: ProjectContent, selectedId: string | null, action: EditAction):
  { content: ProjectContent; selectedId: string | null } | null {
  const chords = content.chords
  const indexOf = (id: string) => chords.findIndex((c) => c.id === id)
  switch (action.type) {
    case 'setName':
      return action.name === content.name ? null : { content: { ...content, name: action.name }, selectedId }
    case 'setKey':
      return { content: { ...content, key: action.key }, selectedId }
    case 'setTempo':
      return action.tempoBpm === content.tempoBpm ? null : { content: { ...content, tempoBpm: action.tempoBpm }, selectedId }
    case 'setRegister':
      return { content: { ...content, register: action.register }, selectedId }
    case 'addChord': {
      const index = action.index === undefined ? chords.length : Math.max(0, Math.min(action.index, chords.length))
      const next = [...chords.slice(0, index), action.chord, ...chords.slice(index)]
      return { content: { ...content, chords: next }, selectedId: action.chord.id }
    }
    case 'replaceChord': {
      const i = indexOf(action.id)
      if (i < 0) return null
      const next = chords.map((c) => (c.id === action.id ? { ...action.chord, id: c.id, durationBeats: c.durationBeats, pattern: c.pattern } : c))
      return { content: { ...content, chords: next }, selectedId }
    }
    case 'setDuration': {
      const i = indexOf(action.id)
      if (i < 0 || chords[i].durationBeats === action.durationBeats) return null
      const next = chords.map((c) => (c.id === action.id ? { ...c, durationBeats: action.durationBeats } : c))
      return { content: { ...content, chords: next }, selectedId }
    }
    case 'setPattern': {
      const i = indexOf(action.id)
      if (i < 0 || chords[i].pattern === action.pattern) return null
      const next = chords.map((c) => (c.id === action.id ? { ...c, pattern: action.pattern } : c))
      return { content: { ...content, chords: next }, selectedId }
    }
    case 'removeChord': {
      const i = indexOf(action.id)
      if (i < 0) return null
      const next = chords.filter((c) => c.id !== action.id)
      let nextSelected = selectedId
      if (selectedId === action.id) {
        nextSelected = next[Math.min(i, next.length - 1)]?.id ?? null
      }
      return { content: { ...content, chords: next }, selectedId: nextSelected }
    }
    case 'duplicateChord': {
      const i = indexOf(action.id)
      if (i < 0) return null
      const copy = { ...chords[i], id: action.newId }
      const next = [...chords.slice(0, i + 1), copy, ...chords.slice(i + 1)]
      return { content: { ...content, chords: next }, selectedId: action.newId }
    }
    case 'moveChord': {
      const from = indexOf(action.id)
      const to = Math.max(0, Math.min(action.toIndex, chords.length - 1))
      if (from < 0 || from === to) return null
      const next = [...chords]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return { content: { ...content, chords: next }, selectedId }
    }
    case 'replaceAllChords': {
      // Same length: keep ids so the selection follows its position; otherwise create new slots.
      const sameLength = action.chords.length === chords.length
      const next = action.chords.map((chord, i) =>
        sameLength ? { ...chord, id: chords[i].id, durationBeats: chords[i].durationBeats, pattern: chords[i].pattern } : toSlot(chord))
      const keepSelection = next.some((c) => c.id === selectedId)
      return { content: { ...content, chords: next }, selectedId: keepSelection ? selectedId : next[0]?.id ?? null }
    }
    case 'transpose': {
      // Key and chords change together, as one undo step; slots keep their id, length and rhythm.
      if (action.chords.length !== chords.length) return null
      const next = action.chords.map((chord, i) => ({ ...chord, id: chords[i].id, durationBeats: chords[i].durationBeats, pattern: chords[i].pattern }))
      return { content: { ...content, key: action.key, chords: next }, selectedId }
    }
    case 'clear':
      return chords.length === 0 ? null : { content: { ...content, chords: [] }, selectedId: null }
  }
}
