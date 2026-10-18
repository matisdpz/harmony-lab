import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/renderApp'
import { theoryApi } from '../api/theory'
import { getAudioEngine } from '../audio/audioEngine'
import { progressionToMidi } from '../model/midiFile'
import { AM, G } from '../test/fixtures'

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

// The identification endpoint, answered from fixtures by pitch-class set.
function identifyFromFixtures() {
  vi.mocked(theoryApi.identify).mockImplementation(async (notes: number[]) => {
    const pcs = [...new Set(notes.map((n) => n % 12))].sort().join(',')
    const chord = [AM, G].find((c) => [...new Set(c.voicing.map((n) => n % 12))].sort().join(',') === pcs)
    return { candidates: chord ? [{ chord, rootPosition: true, explanation: '' }] : [], message: '' }
  })
}

async function renderWorkspace() {
  renderApp('/')
  await screen.findByRole('button', { name: 'Chord 4: G' })
}

describe('MIDI files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    identifyFromFixtures()
  })

  it('imports a MIDI file as chords, keeping their lengths and the file tempo', async () => {
    vi.mocked(theoryApi.optimize).mockImplementation(async (body) => ({
      chords: body.chords.map((c) => (c.root === 'G' ? G : AM)), totalMovement: 0, totalCost: 0,
    }))
    await renderWorkspace()
    const bytes = progressionToMidi([{ voicing: [57, 60, 64], beats: 4 }, { voicing: [55, 59, 62], beats: 2 }], 120, 'Song')
    const file = new File([bytes as BlobPart], 'song.mid', { type: 'audio/midi' })
    await userEvent.upload(screen.getByLabelText('MIDI file to import'), file)

    await screen.findByRole('button', { name: 'Chord 2: G' })
    expect(screen.queryByRole('button', { name: 'Chord 3: C/G' })).not.toBeInTheDocument()
    expect(theoryApi.optimize).toHaveBeenLastCalledWith(expect.objectContaining({
      chords: [{ root: 'A', quality: 'MINOR', inversion: 0, durationBeats: 4 }, { root: 'G', quality: 'MAJOR', inversion: 0, durationBeats: 2 }],
    }))
    expect(screen.getByRole('textbox', { name: 'Tempo (BPM)' })).toHaveValue('120')
    expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue('Song')
    expect(await screen.findByText(/Imported 2 chords from song.mid/)).toBeInTheDocument()
  })

  it('explains when a file has no recognisable chord', async () => {
    await renderWorkspace()
    const bytes = progressionToMidi([{ voicing: [60, 61], beats: 4 }], 100, 'Cluster')
    await userEvent.upload(screen.getByLabelText('MIDI file to import'), new File([bytes as BlobPart], 'c.mid'))
    expect(await screen.findByText(/No chord in this file could be recognised/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chord 4: G' })).toBeInTheDocument()
  })
})

describe('MIDI keyboard', () => {
  const input = { name: 'Test Piano', onmidimessage: null as null | ((e: { data: Uint8Array }) => void) }
  const send = (...bytes: number[]) => act(() => input.onmidimessage?.({ data: new Uint8Array(bytes) }))

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    identifyFromFixtures()
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn(async () => ({ inputs: new Map([['1', input]]), onstatechange: null })),
    })
  })
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).requestMIDIAccess
  })

  it('plays held notes, honours the sustain pedal and offers to add the chord being held', async () => {
    await renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: 'Connect MIDI keyboard' }))
    expect(await screen.findByText('Test Piano')).toBeInTheDocument()

    send(0x90, 55, 100)
    send(0x90, 59, 100)
    send(0x90, 62, 100)
    expect(getAudioEngine().noteOn).toHaveBeenCalledWith(62, 100 / 127)
    expect(document.querySelector('[data-midi="59"]')?.className).toMatch(/sounding/)

    expect(await screen.findByText('Playing')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add G' }))
    await waitFor(() => expect(theoryApi.resolveChord).toHaveBeenCalledWith(expect.objectContaining({ root: 'G', quality: 'MAJOR', inversion: 0 })))

    send(0xb0, 64, 127) // pedal down: releases are held back
    send(0x80, 55, 0)
    expect(getAudioEngine().noteOff).not.toHaveBeenCalled()
    send(0xb0, 64, 0)
    expect(getAudioEngine().noteOff).toHaveBeenCalledWith(55)
    expect(JSON.parse(localStorage.getItem('harmony-lab.settings') ?? '{}').midiEnabled).toBe(true)
  })
})
