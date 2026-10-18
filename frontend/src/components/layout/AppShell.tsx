import { useEffect, useState } from 'react'
import { ShortcutsDialog } from './ShortcutsDialog'
import { useMidi } from '../../state/MidiProvider'
import { NavLink, Outlet } from 'react-router'
import {
  AudioWaveform, BookOpenText, Cable, Keyboard, FolderOpen, KeyboardMusic, LayoutPanelTop, Menu, Plus, Settings, Spline, X,
} from 'lucide-react'
import { formatMusic } from '../../model/notes'
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // "?" opens the shortcut list from anywhere, except while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null
      const typing = el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)
      if (event.key === '?' && !typing) {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
                    <span className={styles.projectMeta}>{formatMusic(project.keyLabel)}, {project.chordCount} chords</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className={styles.footer}>
          <MidiStatusControl />

          <button type="button" className={`btn btn-ghost ${styles.settingsButton}`} onClick={() => setShortcutsOpen(true)}>
            <Keyboard size={15} aria-hidden /> Keyboard shortcuts <kbd className="kbd">?</kbd>
          </button>
          <button type="button" className={`btn btn-ghost ${styles.settingsButton}`} onClick={() => setSettingsOpen(true)}>
            <Settings size={15} aria-hidden /> Settings
          </button>
        </div>
      </aside>

      {drawerOpen && <div className={styles.scrim} onClick={() => setDrawerOpen(false)} aria-hidden />}

      <main className={styles.main}>
        <Outlet />
      </main>

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
    </div>
  )
}

/** Connects a MIDI keyboard. Global, because the keyboard works on every page. */
function MidiStatusControl() {
  const midi = useMidi()
  if (midi.status === 'unsupported') {
    return <p className={styles.midiNote}>MIDI keyboards need Chrome, Edge or Firefox.</p>
  }
  if (midi.status === 'on') {
    return (
      <div className={styles.midi}>
        <span className={styles.midiDevice}>
          <span className={midi.devices.length ? styles.midiOn : styles.midiWaiting} aria-hidden />
          {midi.devices.length ? midi.devices.join(', ') : 'Waiting for a MIDI keyboard…'}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={midi.disconnect}>Disconnect</button>
      </div>
    )
  }
  return (
    <div className={styles.midi}>
      {midi.status === 'denied' && (
        <p className={styles.midiNote}>The browser refused MIDI access. Allow it for this site, then try again.</p>
      )}
      <button type="button" className={`btn btn-ghost ${styles.settingsButton}`} onClick={() => void midi.connect()}
              disabled={midi.status === 'connecting'}>
        <Cable size={15} aria-hidden /> {midi.status === 'connecting' ? 'Connecting…' : 'Connect MIDI keyboard'}
      </button>
    </div>
  )
}

function Wordmark() {
  return (
    <span className={styles.wordmark}>
      {/* A root-position triad on a staff: the root in blue, as on the keyboard. */}
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <path d="M6 8.5h20M6 13.5h20M6 18.5h20M6 23.5h20" stroke="var(--rule-strong)" strokeWidth="1" />
        <ellipse cx="16" cy="23.5" rx="4.6" ry="3.2" transform="rotate(-22 16 23.5)" fill="var(--blue)" />
        <ellipse cx="16" cy="18.5" rx="4.6" ry="3.2" transform="rotate(-22 16 18.5)" fill="var(--ink)" />
        <ellipse cx="16" cy="13.5" rx="4.6" ry="3.2" transform="rotate(-22 16 13.5)" fill="var(--ink)" />
      </svg>
      Harmony Lab
    </span>
  )
}
