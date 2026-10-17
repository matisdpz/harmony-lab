import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/renderApp'
import { theoryApi } from '../api/theory'
import { projectsApi } from '../api/projects'
import { ApiError } from '../api/http'
import { getAudioEngine } from '../audio/audioEngine'

vi.mock('../api/theory', async () => {
  const { createTheoryApiMock } = await import('../test/mocks')
  return { theoryApi: createTheoryApiMock() }
})
vi.mock('../api/projects', () => ({
  projectsApi: { list: vi.fn(async () => []), get: vi.fn(), create: vi.fn(), update: vi.fn(), rename: vi.fn(), remove: vi.fn(), duplicate: vi.fn() },
}))
vi.mock('../audio/audioEngine', async () => {
  const { createAudioEngineMock } = await import('../test/mocks')
  const engine = createAudioEngineMock()
  return { getAudioEngine: () => engine }
})

const cardNames = () => screen.getAllByRole('button', { name: /^Chord \d+:/ }).map((b) => b.getAttribute('aria-label'))
const selectedCard = () => screen.getAllByRole('button', { name: /^Chord \d+:/ }).find((b) => b.getAttribute('aria-pressed') === 'true')
const keyState = (midi: number) => document.querySelector(`[data-midi="${midi}"]`)?.getAttribute('data-highlight')

async function renderWorkspace() {
  renderApp('/')
  await screen.findByRole('button', { name: 'Chord 4: G' })
}

describe('Workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the example progression and highlights the selected chord on the keyboard', async () => {
    await renderWorkspace()
    expect(cardNames()).toEqual(['Chord 1: Am', 'Chord 2: F/A', 'Chord 3: C/G', 'Chord 4: G'])
    expect(selectedCard()).toHaveAccessibleName('Chord 1: Am')
    expect(keyState(57)).toBe('root')
    expect(keyState(60)).toBe('tone')
    expect(keyState(64)).toBe('tone')
    expect(keyState(65)).toBe('none')
    // analysis comes from the (mocked) backend and is shown on the cards and in the inspector
    expect(await screen.findByText('Explanation for chord 1')).toBeInTheDocument()
  })

  it('selecting a chord updates the inspector and keyboard', async () => {
    await renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: 'Chord 2: F/A' }))
    expect(screen.getByRole('heading', { level: 2, name: 'F/A' })).toBeInTheDocument()
    expect(keyState(65)).toBe('root')
    expect(keyState(57)).toBe('tone')
    expect(keyState(64)).toBe('none')
  })

  it('editing the quality asks the theory API and updates the chord and keyboard', async () => {
    await renderWorkspace()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Quality' }), 'MINOR7')
    await screen.findByRole('button', { name: 'Chord 1: Am7' })
    expect(theoryApi.resolveChord).toHaveBeenCalledWith(expect.objectContaining({
      root: 'A', quality: 'MINOR7', inversion: 0, previousVoicing: [57, 60, 64],
    }))
    expect(keyState(67)).toBe('tone')
    expect(screen.getByText(/Unsaved changes|Not saved yet/)).toBeInTheDocument()
  })

  it('reordering keeps the same chord selected', async () => {
    await renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: 'Move right' }))
    expect(cardNames()).toEqual(['Chord 1: F/A', 'Chord 2: Am', 'Chord 3: C/G', 'Chord 4: G'])
    expect(selectedCard()).toHaveAccessibleName('Chord 2: Am')
    expect(screen.getByRole('button', { name: 'Move left' })).toBeEnabled()
  })

  it('supports keyboard shortcuts for selection and moving', async () => {
    await renderWorkspace()
    await userEvent.keyboard('{ArrowRight}')
    expect(selectedCard()).toHaveAccessibleName('Chord 2: F/A')
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')
    expect(cardNames()[2]).toBe('Chord 3: F/A')
    expect(selectedCard()).toHaveAccessibleName('Chord 3: F/A')
  })

  it('duplicate, delete and undo keep the selection consistent', async () => {
    await renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate chord' }))
    expect(cardNames()).toHaveLength(5)
    expect(selectedCard()).toHaveAccessibleName('Chord 2: Am')

    await userEvent.click(screen.getByRole('button', { name: 'Remove chord' }))
    expect(cardNames()).toHaveLength(4)
    expect(selectedCard()).toHaveAccessibleName('Chord 2: F/A')

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(cardNames()).toHaveLength(5)
    expect(selectedCard()).toHaveAccessibleName('Chord 2: Am')
  })

  it('validates typed chord symbols and adds valid ones after the selection', async () => {
    await renderWorkspace()
    const input = screen.getByRole('textbox', { name: 'Chord symbol' })
    await userEvent.click(screen.getByRole('button', { name: /Add after selected/ }))
    expect(await screen.findByText(/Type a chord symbol/)).toBeInTheDocument()

    await userEvent.type(input, 'Xyz{Enter}')
    expect(await screen.findByText(/Invalid chord symbol 'Xyz'/)).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(cardNames()).toHaveLength(4)

    await userEvent.clear(input)
    await userEvent.type(input, 'Dm{Enter}')
    await screen.findByRole('button', { name: 'Chord 2: Dm' })
    expect(selectedCard()).toHaveAccessibleName('Chord 2: Dm')
    expect(theoryApi.parseChord).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: 'Dm', previousVoicing: [57, 60, 64] }))
  })

  it('validates the tempo', async () => {
    await renderWorkspace()
    const tempo = screen.getByRole('textbox', { name: 'Tempo (BPM)' })
    await userEvent.clear(tempo)
    await userEvent.type(tempo, '500')
    expect(screen.getByRole('alert')).toHaveTextContent('Tempo must be between 30 and 300 BPM')
    await userEvent.clear(tempo)
    await userEvent.type(tempo, '120')
    expect(screen.queryByText(/Tempo must be/)).not.toBeInTheDocument()
  })

  it('auditions chords and keys through the audio engine', async () => {
    await renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: 'Play Am' }))
    expect(getAudioEngine().playChord).toHaveBeenCalledWith([57, 60, 64])
    await userEvent.click(screen.getByRole('button', { name: 'D4' }))
    expect(getAudioEngine().playNote).toHaveBeenCalledWith(62)
    await userEvent.click(screen.getByRole('button', { name: /^Play$/ }))
    expect(getAudioEngine().playSequence).toHaveBeenCalledWith(
      [{ notes: [57, 60, 64], beats: 4 }, { notes: [57, 60, 65], beats: 4 }, { notes: [55, 60, 64], beats: 4 }, { notes: [55, 59, 62], beats: 4 }],
      90, expect.any(Object), false)
  })

  it('shows an understandable error when saving fails', async () => {
    vi.mocked(projectsApi.create).mockRejectedValueOnce(
      new ApiError(503, 'Database unavailable', 'The project database could not complete the request. Please try again shortly.'))
    await renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(await screen.findByText(/Not saved: The project database could not complete the request/)).toBeInTheDocument()
    expect(screen.getByText('Not saved yet')).toBeInTheDocument()
  })

  it('saves and reports success', async () => {
    const { chordFor } = await import('../test/mocks')
    vi.mocked(projectsApi.create).mockImplementationOnce(async (body) => ({
      id: 'p1', version: 0, createdAt: '', updatedAt: '', name: body.name, key: body.key, tempoBpm: body.tempoBpm,
      register: body.register, chords: body.chords.map((c) => ({ ...chordFor(c), durationBeats: c.durationBeats ?? 4 })),
    }))
    await renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(await screen.findByText(/Saved "Example progression"/)).toBeInTheDocument()
    expect(projectsApi.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Example progression',
      chords: expect.arrayContaining([expect.objectContaining({ root: 'A', quality: 'MINOR', voicing: [57, 60, 64] })]),
    }))
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    expect(cardNames()).toHaveLength(4)
  })
})
