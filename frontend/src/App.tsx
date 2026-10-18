import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { ToastProvider } from './state/ToastProvider'
import { ConfirmProvider } from './state/ConfirmProvider'
import { CatalogProvider, useCatalogState } from './state/CatalogProvider'
import { ProjectsProvider } from './state/ProjectsProvider'
import { WorkspaceProvider } from './state/WorkspaceProvider'
import { SettingsProvider } from './state/SettingsProvider'
import { AudioProvider } from './audio/AudioProvider'
import { MidiProvider } from './state/MidiProvider'
import { AppShell } from './components/layout/AppShell'
import { ErrorBanner, Spinner } from './components/common/Status'
import { WorkspacePage } from './pages/WorkspacePage'
import { ExplorerPage } from './pages/ExplorerPage'
import { AnalyzerPage } from './pages/AnalyzerPage'
import { VoiceLeadingPage } from './pages/VoiceLeadingPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ImprovisationPage } from './pages/ImprovisationPage'

/** Everything depends on the theory catalog; wait for it (with a retry) before rendering the app. */
function BackendGate({ children }: { children: ReactNode }) {
  const { catalog, error, retry } = useCatalogState()
  if (catalog) return <>{children}</>
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: 'min(480px, 100%)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 18 }}>Harmony Lab</h1>
        {error ? <ErrorBanner message={error} onRetry={retry} /> : <Spinner label="Connecting to the Harmony Lab server" />}
      </div>
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WorkspacePage />} />
        <Route path="explorer" element={<ExplorerPage />} />
        <Route path="analyzer" element={<AnalyzerPage />} />
        <Route path="voice-leading" element={<VoiceLeadingPage />} />
        <Route path="improvise" element={<ImprovisationPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

/** Providers shared by the app and the tests (the router is supplied by the caller). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <CatalogProvider>
            <BackendGate>
              <AudioProvider>
                <MidiProvider>
                  <ProjectsProvider>
                    <WorkspaceProvider>{children}</WorkspaceProvider>
                  </ProjectsProvider>
                </MidiProvider>
              </AudioProvider>
            </BackendGate>
          </CatalogProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  )
}
