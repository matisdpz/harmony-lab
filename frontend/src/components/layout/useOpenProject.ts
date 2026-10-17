import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useWorkspace } from '../../state/WorkspaceProvider'
import { useConfirm } from '../../state/ConfirmProvider'

/** Opening another project or starting a new one asks before discarding unsaved changes. */
export function useProjectSwitching() {
  const workspace = useWorkspace()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const confirmDiscard = useCallback(async () => {
    if (!workspace.dirty) return true
    return confirm({
      title: 'Discard unsaved changes?',
      message: `"${workspace.content.name}" has changes that are not saved. They will be lost.`,
      confirmLabel: 'Discard changes',
      danger: true,
    })
  }, [workspace.dirty, workspace.content.name, confirm])

  const open = useCallback(async (id: string) => {
    if (id === workspace.state.projectId && !workspace.dirty) {
      navigate('/')
      return
    }
    if (!(await confirmDiscard())) return
    if (await workspace.openProject(id)) navigate('/')
  }, [workspace, confirmDiscard, navigate])

  const createNew = useCallback(async () => {
    if (!(await confirmDiscard())) return
    workspace.newProject()
    navigate('/')
  }, [workspace, confirmDiscard, navigate])

  return { open, createNew, confirmDiscard }
}
