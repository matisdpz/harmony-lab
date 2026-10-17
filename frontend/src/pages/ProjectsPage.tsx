import { useState, type FormEvent } from 'react'
import { Copy, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { projectsApi } from '../api/projects'
import { ApiError, errorMessage } from '../api/http'
import type { ProjectSummary } from '../api/types'
import { useProjects } from '../state/ProjectsProvider'
import { useWorkspace } from '../state/WorkspaceProvider'
import { useConfirm } from '../state/ConfirmProvider'
import { useToast } from '../state/ToastProvider'
import { useProjectSwitching } from '../components/layout/useOpenProject'
import { EmptyState, ErrorBanner, Spinner } from '../components/common/Status'
import styles from './Pages.module.css'
import own from './ProjectsPage.module.css'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function ProjectsPage() {
  const { projects, loading, error, refresh } = useProjects()
  const { open, createNew } = useProjectSwitching()

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Saved projects</h1>
          <p className={styles.lead}>Projects are stored in the local PostgreSQL database. Harmony Lab is single-user: there are no accounts.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void createNew()}><Plus size={14} aria-hidden /> New project</button>
      </header>

      {error && <ErrorBanner message={`Could not load projects: ${error}`} onRetry={() => void refresh()} />}
      {loading && projects.length === 0 && !error && <Spinner label="Loading projects" />}
      {!loading && !error && projects.length === 0 && (
        <EmptyState icon={<FolderOpen size={22} />} title="No saved projects yet">
          Build a progression in the workspace and press Save (Ctrl+S). It will appear here.
        </EmptyState>
      )}

      <ul className={own.list}>
        {projects.map((project) => <ProjectRow key={project.id} project={project} onOpen={() => void open(project.id)} />)}
      </ul>
    </div>
  )
}

function ProjectRow({ project, onOpen }: { project: ProjectSummary; onOpen: () => void }) {
  const { refresh } = useProjects()
  const workspace = useWorkspace()
  const confirm = useConfirm()
  const { notify } = useToast()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(project.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isOpen = project.id === workspace.state.projectId

  const rename = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Name is required')
      return
    }
    setBusy(true)
    try {
      const updated = await projectsApi.rename(project.id, trimmed, project.version)
      workspace.projectRenamed(updated)
      setRenaming(false)
      setNameError(null)
      notify('success', `Renamed to "${updated.name}"`)
      await refresh()
    } catch (e) {
      setNameError(e instanceof ApiError && e.status === 409 ? 'This project changed elsewhere; reload the list and try again.' : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async () => {
    setBusy(true)
    try {
      const copy = await projectsApi.duplicate(project.id)
      notify('success', `Created "${copy.name}"`)
      await refresh()
    } catch (e) {
      notify('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      message: 'The project will be permanently removed from the database. This cannot be undone.',
      confirmLabel: 'Delete project',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await projectsApi.remove(project.id)
      workspace.projectDeleted(project.id)
      notify('success', `Deleted "${project.name}"`)
      await refresh()
    } catch (e) {
      notify('error', errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <li className={`panel ${own.row} ${isOpen ? own.open : ''}`} aria-busy={busy}>
      <div className={own.info}>
        {renaming ? (
          <form onSubmit={(e) => void rename(e)} className={own.renameForm} noValidate>
            <label htmlFor={`rename-${project.id}`} className="visually-hidden">New name</label>
            <input id={`rename-${project.id}`} className="input" value={name} maxLength={100} autoFocus
                   onChange={(e) => setName(e.target.value)} aria-invalid={nameError !== null}
                   onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)} />
            <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>Save</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRenaming(false)}>Cancel</button>
            {nameError && <span className="field-error" role="alert">{nameError}</span>}
          </form>
        ) : (
          <h2 className={own.name}>{project.name}{isOpen && <span className="badge badge-tone">open</span>}</h2>
        )}
        <p className={own.meta}>
          {project.keyLabel} · {project.tempoBpm} BPM · {project.chordCount} chord{project.chordCount === 1 ? '' : 's'} · updated {dateFormat.format(new Date(project.updatedAt))}
        </p>
        {project.preview.length > 0 && <p className={`mono ${own.preview}`}>{project.preview.join('  ')}{project.chordCount > project.preview.length ? '  …' : ''}</p>}
      </div>
      <div className={own.actions}>
        <button type="button" className="btn btn-sm" onClick={onOpen} disabled={busy}><FolderOpen size={13} aria-hidden /> Open</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => {
          setName(project.name)
          setRenaming(true)
        }} disabled={busy} aria-label={`Rename ${project.name}`}><Pencil size={13} /></button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void duplicate()} disabled={busy} aria-label={`Duplicate ${project.name}`}><Copy size={13} /></button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void remove()} disabled={busy} aria-label={`Delete ${project.name}`}><Trash2 size={13} /></button>
      </div>
    </li>
  )
}
