import { useWorkspace } from '../../state/useWorkspace'

export function Toolbar() {
  const {
    isDrawing,
    draftPositions,
    startDrawing,
    cancelDrawing,
    undoVertex,
    finishAoi,
    selection,
    selectedEntity,
    disruptedIds,
    toggleDisruption,
    clearDisruption,
    status,
    view,
    loading,
    error,
  } = useWorkspace()

  const canDisrupt = selection?.kind === 'entity'
  const isDisrupted = selectedEntity
    ? disruptedIds.includes(selectedEntity.id)
    : false

  return (
    <div className="toolbar">
      <button
        type="button"
        className={isDrawing ? 'is-active' : undefined}
        onClick={isDrawing ? cancelDrawing : startDrawing}
      >
        {isDrawing ? 'Cancel AOI' : 'Draw AOI'}
      </button>
      {isDrawing && (
        <>
          <button
            type="button"
            disabled={draftPositions.length === 0}
            onClick={undoVertex}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={draftPositions.length < 3}
            onClick={finishAoi}
          >
            Finish
          </button>
          <span className="toolbar-hint">
            {draftPositions.length} pts · Enter finish · Esc cancel
          </span>
        </>
      )}

      <span className="toolbar-sep" />

      <button type="button" disabled={!canDisrupt} onClick={toggleDisruption}>
        {isDisrupted ? 'Clear this disruption' : 'Mark disrupted'}
      </button>
      <button type="button" onClick={clearDisruption}>
        Clear all impacts
      </button>

      {view === 'network' && (
        <span className="toolbar-hint">
          Graph: suppliers left · customers right · drag to pan · scroll to zoom
        </span>
      )}
      {loading ? <span className="app-status">Loading catalog…</span> : null}
      {error ? <span className="app-status">{error}</span> : null}
      {status ? <span className="app-status">{status}</span> : null}
    </div>
  )
}
