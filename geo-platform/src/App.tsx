import { Inspector } from './features/inspector/Inspector'
import { MapPane } from './features/map/MapPane'
import { NetworkView } from './features/network/NetworkView'
import { Sidebar } from './features/shell/Sidebar'
import { Toolbar } from './features/shell/Toolbar'
import { useKeyboardShortcuts } from './features/shell/useKeyboardShortcuts'
import { useWorkspace } from './state/useWorkspace'
import { WorkspaceProvider } from './state/workspace'

function Workspace() {
  const { view } = useWorkspace()
  useKeyboardShortcuts()

  return (
    <div className="app">
      <Sidebar />
      <div className="app-main">
        <Toolbar />
        <div className="workspace">
          <main>{view === 'map' ? <MapPane /> : <NetworkView />}</main>
          <Inspector />
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <WorkspaceProvider>
      <Workspace />
    </WorkspaceProvider>
  )
}

export default App
