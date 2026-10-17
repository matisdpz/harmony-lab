import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { theoryApi } from '../api/theory'
import { errorMessage } from '../api/http'
import type { Catalog, QualityInfo } from '../api/types'

interface CatalogState {
  catalog: Catalog | null
  error: string | null
  retry: () => void
}

const CatalogContext = createContext<CatalogState | null>(null)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    theoryApi.catalog(controller.signal)
      .then((data) => {
        setCatalog(data)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e))
      })
    return () => controller.abort()
  }, [attempt])

  const retry = useCallback(() => {
    setError(null)
    setAttempt((a) => a + 1)
  }, [])

  return <CatalogContext.Provider value={{ catalog, error, retry }}>{children}</CatalogContext.Provider>
}

export function useCatalogState(): CatalogState {
  const context = useContext(CatalogContext)
  if (!context) throw new Error('useCatalogState must be used inside <CatalogProvider>')
  return context
}

/** The loaded catalog; only use below the point where the app waits for it. */
export function useCatalog(): Catalog {
  const { catalog } = useCatalogState()
  if (!catalog) throw new Error('Catalog not loaded yet')
  return catalog
}

export function qualityById(catalog: Catalog, id: string): QualityInfo | undefined {
  return catalog.qualities.find((q) => q.id === id)
}
