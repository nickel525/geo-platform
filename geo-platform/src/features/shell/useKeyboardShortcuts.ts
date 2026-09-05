import { useEffect, useRef } from 'react'
import { useWorkspace } from '../../state/useWorkspace'

export function useKeyboardShortcuts(): void {
  const workspace = useWorkspace()
  const workspaceRef = useRef(workspace)

  useEffect(() => {
    workspaceRef.current = workspace
  }, [workspace])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return
      }
      const { isDrawing, cancelDrawing, finishAoi, undoVertex } = workspaceRef.current
      if (!isDrawing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelDrawing()
      }
      if (event.key === 'Enter' || event.key === 'f') {
        event.preventDefault()
        finishAoi()
      }
      if (event.key === 'Backspace' || event.key === 'z') {
        event.preventDefault()
        undoVertex()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
