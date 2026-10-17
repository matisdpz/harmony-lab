import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { projectsApi } from '../api/projects'
import { errorMessage } from '../api/http'
import type { ProjectSummary } from '../api/types'

interface ProjectsState {
  projects: ProjectSummary[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const ProjectsContext = createContext<ProjectsState | null>(null)

/** Shared list of saved projects (sidebar and projects page). */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setProjects(await projectsApi.list())
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return <ProjectsContext.Provider value={{ projects, loading, error, refresh }}>{children}</ProjectsContext.Provider>
}

export function useProjects(): ProjectsState {
  const context = useContext(ProjectsContext)
  if (!context) throw new Error('useProjects must be used inside <ProjectsProvider>')
  return context
}
