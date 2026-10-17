import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/renderApp'
import { projectsApi } from '../api/projects'
import { ApiError } from '../api/http'
import type { ProjectSummary } from '../api/types'

vi.mock('../api/theory', async () => {
  const { createTheoryApiMock } = await import('../test/mocks')
  return { theoryApi: createTheoryApiMock() }
})
vi.mock('../api/projects', () => ({
  projectsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), rename: vi.fn(), remove: vi.fn(), duplicate: vi.fn() },
}))
vi.mock('../audio/audioEngine', async () => {
  const { createAudioEngineMock } = await import('../test/mocks')
  const engine = createAudioEngineMock()
  return { getAudioEngine: () => engine }
})

const SUMMARY: ProjectSummary = {
  id: 'p1', name: 'Night drive', key: { tonic: 'A', mode: 'MINOR' }, keyLabel: 'A minor', tempoBpm: 96, chordCount: 4,
  preview: ['Am', 'F', 'C', 'G'], version: 3, createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-02T10:00:00Z',
}

describe('Projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows API failures with a retry that recovers', async () => {
    vi.mocked(projectsApi.list)
      .mockRejectedValueOnce(new ApiError(0, 'Server unreachable', 'Cannot reach the Harmony Lab server.'))
      .mockResolvedValue([SUMMARY])
    renderApp('/projects')
    expect(await screen.findByText(/Could not load projects: Cannot reach the Harmony Lab server/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Night drive' })).toBeInTheDocument()
    expect(screen.getByText(/^Am\s+F\s+C\s+G$/)).toBeInTheDocument()
  })

  it('validates and submits a rename with the current version', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue([SUMMARY])
    vi.mocked(projectsApi.rename).mockResolvedValue({
      id: 'p1', name: 'Night drive II', key: SUMMARY.key, tempoBpm: 96, register: { low: 45, high: 79 }, chords: [],
      version: 4, createdAt: '', updatedAt: '',
    })
    renderApp('/projects')
    await userEvent.click(await screen.findByRole('button', { name: 'Rename Night drive' }))
    const input = screen.getByRole('textbox', { name: 'New name' })
    await userEvent.clear(input)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(projectsApi.rename).not.toHaveBeenCalled()

    await userEvent.type(input, 'Night drive II{Enter}')
    await waitFor(() => expect(projectsApi.rename).toHaveBeenCalledWith('p1', 'Night drive II', 3))
  })

  it('asks for confirmation before deleting', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue([SUMMARY])
    vi.mocked(projectsApi.remove).mockResolvedValue(undefined)
    renderApp('/projects')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Night drive' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete "Night drive"?' })
    expect(dialog).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(projectsApi.remove).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Night drive' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete project' }))
    await waitFor(() => expect(projectsApi.remove).toHaveBeenCalledWith('p1'))
    expect(projectsApi.list).toHaveBeenCalledTimes(2)
  })
})
