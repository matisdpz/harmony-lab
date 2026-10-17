import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import {
  AudioWaveform, BookOpenText, FolderOpen, GitCompareArrows, KeyboardMusic, LayoutPanelTop, Menu, Plus, Settings, Spline, X,
} from 'lucide-react'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useProjects } from '../../state/ProjectsProvider'
import { useProjectSwitching } from './useOpenProject'
import { SettingsDialog } from './SettingsDialog'
import styles from './AppShell.module.css'

const NAV = [
  { to: '/', label: 'Workspace', icon: LayoutPanelTop, end: true },
  { to: '/explorer', label: 'Chord Explorer', icon: BookOpenText },
  { to: '/analyzer', label: 'Analyzer', icon: AudioWaveform },
  { to: '/voice-leading', label: 'Voice Leading', icon: Spline },
  { to: '/improvise', label: 'Improvisation', icon: KeyboardMusic },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
]

export function AppShell() {
  const workspace = useWorkspace()
  const { projects, loading } = useProjects()
  const { open, createNew } = useProjectSwitching()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!workspace.dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [workspace.dirty])

  return (
    <div className={styles.shell}>
      <header className={styles.mobileBar}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setDrawerOpen((o) => !o)}
                aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={drawerOpen}>
          {drawerOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <Wordmark />
      </header>

      <aside className={`${styles.sidebar} ${drawerOpen ? styles.open : ''}`} aria-label="Main navigation">
        <div className={styles.brand}><Wordmark /></div>

        <nav className={styles.nav}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
              <Icon size={16} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button type="button" className={`btn ${styles.newButton}`} onClick={() => {
          setDrawerOpen(false)
          void createNew()
        }}>
          <Plus size={15} aria-hidden /> New project
        </button>

        <div className={styles.projects}>
          <div className={styles.projectsHeader}>
            <span className="panel-title">Saved projects</span>
            <GitCompareArrows size={13} aria-hidden className={styles.dim} />
          </div>
          {loading && projects.length === 0 && <p className={styles.dim}>Loading…</p>}
          {!loading && projects.length === 0 && <p className={styles.dim}>Nothing saved yet.</p>}
          <ul>
            {projects.slice(0, 8).map((project) => {
              const current = project.id === workspace.state.projectId
              return (
                <li key={project.id}>
                  <button type="button" className={`${styles.projectLink} ${current ? styles.current : ''}`}
                          onClick={() => {
                            setDrawerOpen(false)
                            void open(project.id)
                          }} aria-current={current ? 'true' : undefined}>
                    <span className={styles.projectName}>
                      {project.name}
                      {current && workspace.dirty && <span className={styles.dirtyDot} title="Unsaved changes" aria-label="unsaved changes" />}
                    </span>
                    <span className={styles.projectMeta}>{project.keyLabel} · {project.chordCount} chords</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <button type="button" className={`btn btn-ghost ${styles.settingsButton}`} onClick={() => setSettingsOpen(true)}>
          <Settings size={15} aria-hidden /> Settings
        </button>
      </aside>

      {drawerOpen && <div className={styles.scrim} onClick={() => setDrawerOpen(false)} aria-hidden />}

      <main className={styles.main}>
        <Outlet />
      </main>

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function Wordmark() {
  return (
    <span className={styles.wordmark}>
      <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden>
        <rect x="5" y="8" width="5" height="18" rx="1.5" fill="var(--accent)" />
        <rect x="13.5" y="13" width="5" height="13" rx="1.5" fill="var(--text)" />
        <rect x="22" y="5" width="5" height="21" rx="1.5" fill="var(--tone)" />
      </svg>
      Harmony Lab
    </span>
  )
}
