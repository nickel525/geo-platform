import { useContext } from 'react'
import { WorkspaceContext, type WorkspaceValue } from './context'

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext)
  if (!value) {
    throw new Error('useWorkspace must be used within WorkspaceProvider')
  }
  return value
}
