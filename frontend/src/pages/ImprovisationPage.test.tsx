import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/renderApp'
import { theoryApi } from '../api/theory'
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

const roleOf = (midi: number) => document.querySelector(`[data-midi="${midi}"]`)?.getAttribute('data-highlight')

async function renderPage() {
  renderApp('/improvise')
  await screen.findByRole('button', { name: 'Chord 2: F/A' })
}

describe('Improvisation page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('loads the first preset in the workspace key and colours the guide on the keyboard', async () => {
    await renderPage()
    expect(theoryApi.presets).toHaveBeenCalledWith({ tonic: 'A', mode: 'MINOR' }, expect.anything())
    expect(screen.getByRole('button', { name: /Minor pop/ })).toHaveAttribute('aria-pressed', 'true')
    // the guide is per pitch class, so every A is the root and every F a tension note
    expect(roleOf(57)).toBe('root')
    expect(roleOf(69)).toBe('root')
    expect(roleOf(53)).toBe('tension')
    expect(roleOf(62)).toBe('scale')
    expect(roleOf(64)).toBe('none')
    expect(screen.getByRole('button', { name: 'F4, tension note' })).toBeInTheDocument()
    expect(screen.getByText('Avoid note: a semitone above E')).toBeInTheDocument()
  })

  it('plays the progression in a loop and lets the computer keyboard play notes', async () => {
    await renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Play loop/ }))
    expect(getAudioEngine().playSequence).toHaveBeenCalledWith(
      [{ notes: [57, 60, 64], beats: 4 }, { notes: [57, 60, 65], beats: 4 }], 90, expect.any(Object), true)
    await userEvent.keyboard('a')
    expect(getAudioEngine().playNote).toHaveBeenCalledWith(60)
    await userEvent.keyboard('x')
    await userEvent.keyboard('a')
    expect(getAudioEngine().playNote).toHaveBeenLastCalledWith(72)
  })

  it('validates and saves a custom progression', async () => {
    await renderPage()
    const chords = screen.getByRole('textbox', { name: 'Chords' })
    await userEvent.click(screen.getByRole('button', { name: /Create/ }))
    expect(screen.getByText(/Type at least one chord/)).toBeInTheDocument()

    await userEvent.type(chords, 'Am Xyz{Enter}')
    expect(await screen.findByText("Chord 2 (Xyz): Invalid chord symbol 'Xyz'")).toBeInTheDocument()
    expect(chords).toHaveAttribute('aria-invalid', 'true')

    await userEvent.clear(chords)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name (optional)' }), 'My loop')
    await userEvent.type(chords, 'Dm | F{Enter}')
    const saved = await screen.findByRole('button', { name: /^My loop/ })
    expect(saved).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(theoryApi.improvisation).toHaveBeenLastCalledWith(
      expect.objectContaining({ symbols: ['Dm', 'F'] }), expect.anything()))
    expect(JSON.parse(window.localStorage.getItem('harmony-lab.improvisation.custom')!)[0].symbols).toEqual(['Dm', 'F'])

    await userEvent.click(screen.getByRole('button', { name: 'Delete My loop' }))
    expect(screen.queryByRole('button', { name: /^My loop/ })).not.toBeInTheDocument()
  })
})
