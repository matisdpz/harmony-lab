import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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
    localStorage.clear()
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
      [{ notes: [57, 60, 64], beats: 4, pattern: 'BLOCK' }, { notes: [57, 60, 65], beats: 4, pattern: 'BLOCK' },
        { notes: [55, 60, 64], beats: 4, pattern: 'BLOCK' }, { notes: [55, 59, 62], beats: 4, pattern: 'BLOCK' }],
      90, expect.any(Object), expect.objectContaining({ loop: false }))
  })

  it('changes a chord rhythm, plays a preview and uses it for playback', async () => {
    await renderWorkspace()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rhythm' }), 'ARPEGGIO_UP')
    expect(getAudioEngine().playSequence).toHaveBeenLastCalledWith(
      [{ notes: [57, 60, 64], beats: 4, pattern: 'ARPEGGIO_UP' }], 90, expect.any(Object), expect.objectContaining({ loop: false }))
    expect(screen.getByText('arp. ↑')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Play$/ }))
    expect(vi.mocked(getAudioEngine().playSequence).mock.lastCall?.[0][0]).toEqual({ notes: [57, 60, 64], beats: 4, pattern: 'ARPEGGIO_UP' })
  })

  it('changes the mode, keeping the tonic when that key exists in the new mode', async () => {
    await renderWorkspace()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mode' }), 'DORIAN')
    await waitFor(() => expect(vi.mocked(theoryApi.analyze).mock.lastCall?.[0]).toEqual({ tonic: 'A', mode: 'DORIAN' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mode' }), 'MAJOR')
    await waitFor(() => expect(vi.mocked(theoryApi.analyze).mock.lastCall?.[0]).toEqual({ tonic: 'C', mode: 'MAJOR' }))
    expect(screen.getByRole('option', { name: 'Dorian' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Lydian' })).not.toBeInTheDocument() // no tonics in this catalog
  })

  it('suggests a better-fitting key without changing it until asked', async () => {
    await renderWorkspace()
    // the default mock agrees with the current key (A minor): no hint
    await waitFor(() => expect(theoryApi.detectKey).toHaveBeenCalled())
    expect(screen.queryByText(/These chords sound like/)).not.toBeInTheDocument()

    vi.mocked(theoryApi.detectKey).mockResolvedValue({
      candidates: [{ key: { tonic: 'C', mode: 'MAJOR' }, label: 'C major', correlation: 0.9 }],
      confidence: 'STRONG', explanation: 'C major fits best.',
    })
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate chord' })) // any edit re-runs detection
    await userEvent.click(await screen.findByRole('button', { name: 'Use C major' }, { timeout: 3000 }))
    await waitFor(() => expect(vi.mocked(theoryApi.analyze).mock.lastCall?.[0]).toEqual({ tonic: 'C', mode: 'MAJOR' }))
  })

  it('transposes the key and every chord as one undoable step', async () => {
    await renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: 'Transpose up a semitone' }))
    await screen.findByRole('button', { name: 'Chord 1: Am+1' })
    expect(theoryApi.transpose).toHaveBeenCalledWith({ tonic: 'A', mode: 'MINOR' }, expect.any(Array), 1)
    expect(screen.getByRole('combobox', { name: 'Key tonic' })).toHaveValue('E')
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Chord 1: Am' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Key tonic' })).toHaveValue('A')
  })

  it('plays from the selected chord with Shift+Space and from the toolbar', async () => {
    await renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: 'Chord 3: C/G' }))
    await userEvent.keyboard('{Shift>} {/Shift}')
    expect(vi.mocked(getAudioEngine().playSequence).mock.lastCall?.[0]).toHaveLength(2)
    vi.mocked(getAudioEngine().playSequence).mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Stop playback' }))
    expect(getAudioEngine().stop).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Chord 2: F/A' }))
    await userEvent.click(screen.getByRole('button', { name: 'Play from this chord' }))
    expect(vi.mocked(getAudioEngine().playSequence).mock.lastCall?.[0]).toHaveLength(3)
  })

  it('can play a chord when its measure is clicked, as a setting', async () => {
    await renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: 'Chord 2: F/A' }))
    expect(getAudioEngine().playChord).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Selects and plays it' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Chord 4: G' }))
    expect(getAudioEngine().playChord).toHaveBeenCalledWith([55, 59, 62])
  })

  it('lists the keyboard shortcuts when ? is pressed', async () => {
    await renderWorkspace()
    await userEvent.keyboard('?')
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument()
    expect(screen.getByText('Transpose everything by a semitone')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument()
  })

  it('switches the sound from the transport and remembers it', async () => {
    await renderWorkspace()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sound' }), 'vibes')
    await waitFor(() => expect(getAudioEngine().setInstrument).toHaveBeenLastCalledWith('vibes'))
    expect(JSON.parse(localStorage.getItem('harmony-lab.settings') ?? '{}').instrument).toBe('vibes')
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
