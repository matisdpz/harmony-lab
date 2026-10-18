import { describe, expect, it } from 'vitest'
import { AM, C, F, G } from '../test/fixtures'
import {
  HISTORY_LIMIT, emptyContent, initialState, isDirty, signature, toSlot, workspaceReducer, type WorkspaceState,
} from './workspace'

function stateWith(...chords: ReturnType<typeof toSlot>[]): WorkspaceState {
  return initialState({ ...emptyContent(), chords })
}

const ids = (s: WorkspaceState) => s.content.chords.map((c) => c.id)
const symbols = (s: WorkspaceState) => s.content.chords.map((c) => c.symbol)

describe('workspaceReducer', () => {
  const am = toSlot(AM, 'am')
  const f = toSlot(F, 'f')
  const c = toSlot(C, 'c')
  const g = toSlot(G, 'g')

  it('starts clean with the first chord selected', () => {
    const state = stateWith(am, f)
    expect(state.selectedId).toBe('am')
    expect(isDirty(state)).toBe(false)
  })

  it('adds a chord at a position and selects it', () => {
    const state = workspaceReducer(stateWith(am, c), { type: 'addChord', chord: f, index: 1 })
    expect(ids(state)).toEqual(['am', 'f', 'c'])
    expect(state.selectedId).toBe('f')
    expect(isDirty(state)).toBe(true)
  })

  it('sets a playback pattern, keeps it when the chord is replaced, and saves it', () => {
    let state = workspaceReducer(stateWith(am, f), { type: 'setPattern', id: 'f', pattern: 'ALBERTI' })
    expect(isDirty(state)).toBe(true)
    expect(workspaceReducer(state, { type: 'setPattern', id: 'f', pattern: 'ALBERTI' })).toBe(state)
    state = workspaceReducer(state, { type: 'replaceChord', id: 'f', chord: C })
    expect(state.content.chords[1].symbol).toBe(C.symbol)
    expect(state.content.chords[1].pattern).toBe('ALBERTI')
    expect(signature(state.content)).toContain('"pattern":"ALBERTI"')
  })

  it('reads unknown or missing saved patterns as block chords', () => {
    expect(toSlot({ ...AM, pattern: 'SWING' }).pattern).toBe('BLOCK')
    expect(toSlot({ ...AM, pattern: 'REPEATED' }).pattern).toBe('REPEATED')
  })

  it('keeps the moved chord selected when reordering', () => {
    let state = workspaceReducer(stateWith(am, f, c, g), { type: 'select', id: 'f' })
    state = workspaceReducer(state, { type: 'moveChord', id: 'f', toIndex: 3 })
    expect(ids(state)).toEqual(['am', 'c', 'g', 'f'])
    expect(state.selectedId).toBe('f')
    state = workspaceReducer(state, { type: 'moveChord', id: 'f', toIndex: -5 })
    expect(ids(state)).toEqual(['f', 'am', 'c', 'g'])
  })

  it('selects the neighbour when the selected chord is removed', () => {
    let state = workspaceReducer(stateWith(am, f, c), { type: 'select', id: 'f' })
    state = workspaceReducer(state, { type: 'removeChord', id: 'f' })
    expect(state.selectedId).toBe('c')
    state = workspaceReducer(state, { type: 'removeChord', id: 'c' })
    expect(state.selectedId).toBe('am')
    state = workspaceReducer(state, { type: 'removeChord', id: 'am' })
    expect(state.selectedId).toBeNull()
  })

  it('keeps the selection when another chord is removed', () => {
    let state = workspaceReducer(stateWith(am, f, c), { type: 'select', id: 'c' })
    state = workspaceReducer(state, { type: 'removeChord', id: 'am' })
    expect(state.selectedId).toBe('c')
  })

  it('duplicates after the original and selects the copy', () => {
    const state = workspaceReducer(stateWith(am, f), { type: 'duplicateChord', id: 'am', newId: 'am2' })
    expect(ids(state)).toEqual(['am', 'am2', 'f'])
    expect(symbols(state)).toEqual(['Am', 'Am', 'F/A'])
    expect(state.selectedId).toBe('am2')
  })

  it('replaces a chord but keeps its identity and duration', () => {
    let state = workspaceReducer(stateWith(am), { type: 'setDuration', id: 'am', durationBeats: 2 })
    state = workspaceReducer(state, { type: 'replaceChord', id: 'am', chord: G })
    expect(state.content.chords[0]).toMatchObject({ id: 'am', symbol: 'G', durationBeats: 2 })
  })

  it('undoes and redoes edits, restoring the selection', () => {
    let state = stateWith(am, f)
    state = workspaceReducer(state, { type: 'removeChord', id: 'am' })
    state = workspaceReducer(state, { type: 'addChord', chord: g })
    expect(symbols(state)).toEqual(['F/A', 'G'])

    state = workspaceReducer(state, { type: 'undo' })
    expect(symbols(state)).toEqual(['F/A'])
    state = workspaceReducer(state, { type: 'undo' })
    expect(symbols(state)).toEqual(['Am', 'F/A'])
    expect(state.selectedId).toBe('am')
    expect(isDirty(state)).toBe(false)

    state = workspaceReducer(state, { type: 'redo' })
    expect(symbols(state)).toEqual(['F/A'])
    expect(state.future).toHaveLength(1)

    state = workspaceReducer(state, { type: 'setTempo', tempoBpm: 120 })
    expect(state.future).toHaveLength(0) // a new edit clears the redo stack
  })

  it('coalesces consecutive typing into one undo step', () => {
    let state = stateWith(am)
    for (const name of ['M', 'My', 'My s', 'My song']) {
      state = workspaceReducer(state, { type: 'setName', name })
    }
    expect(state.past).toHaveLength(1)
    state = workspaceReducer(state, { type: 'undo' })
    expect(state.content.name).toBe('Untitled progression')
  })

  it('does not record no-op edits and bounds the history', () => {
    let state = stateWith(am, f)
    state = workspaceReducer(state, { type: 'moveChord', id: 'am', toIndex: 0 })
    expect(state.past).toHaveLength(0)
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      state = workspaceReducer(state, { type: 'setKey', key: { tonic: i % 2 ? 'C' : 'G', mode: 'MAJOR' } })
    }
    expect(state.past).toHaveLength(HISTORY_LIMIT)
  })

  it('clears the progression and the selection', () => {
    const state = workspaceReducer(stateWith(am, f), { type: 'clear' })
    expect(state.content.chords).toEqual([])
    expect(state.selectedId).toBeNull()
  })

  it('applies a same-length alternative keeping ids and selection', () => {
    let state = workspaceReducer(stateWith(am, f), { type: 'select', id: 'f' })
    state = workspaceReducer(state, { type: 'replaceAllChords', chords: [AM, G] })
    expect(ids(state)).toEqual(['am', 'f'])
    expect(symbols(state)).toEqual(['Am', 'G'])
    expect(state.selectedId).toBe('f')
  })

  it('marks content as saved and keeps edits made during the save as unsaved', () => {
    const requested = stateWith(am).content
    let state = stateWith(am)
    state = workspaceReducer(state, { type: 'setName', name: ' Song ' })
    const requestedContent = state.content
    const saved = { ...requestedContent, name: 'Song' }
    const clean = workspaceReducer(state, { type: 'markSaved', projectId: 'p1', version: 0, requested: requestedContent, saved })
    expect(clean.projectId).toBe('p1')
    expect(clean.content.name).toBe('Song')
    expect(isDirty(clean)).toBe(false)

    const editedMeanwhile = workspaceReducer(state, { type: 'addChord', chord: g })
    const result = workspaceReducer(editedMeanwhile, { type: 'markSaved', projectId: 'p1', version: 0, requested: requestedContent, saved })
    expect(symbols(result)).toEqual(['Am', 'G'])
    expect(isDirty(result)).toBe(true)
    expect(signature(requested)).not.toEqual(signature(result.content))
  })

  it('becomes unsaved when detached from a deleted project', () => {
    const state = workspaceReducer({ ...stateWith(am), projectId: 'p1', version: 2 }, { type: 'detach' })
    expect(state.projectId).toBeNull()
    expect(isDirty(state)).toBe(true)
  })

  it('ignores selection of unknown chords', () => {
    const state = stateWith(am)
    expect(workspaceReducer(state, { type: 'select', id: 'missing' })).toBe(state)
  })
})
