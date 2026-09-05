import { useWorkspace } from '../../state/useWorkspace'
import { MapView } from './MapView'

export function MapPane() {
  const {
    aois,
    mapEntities,
    events,
    isDrawing,
    draftPositions,
    selection,
    disruptedIds,
    affectedIds,
    addVertex,
    finishAoi,
    select,
    setViewportBbox,
  } = useWorkspace()

  return (
    <div className="map-pane">
      <MapView
        aois={aois}
        entities={mapEntities}
        events={events}
        visibleEntityIds={mapEntities.map((entity) => entity.id)}
        isDrawing={isDrawing}
        draftPositions={draftPositions}
        selection={selection}
        disruptedIds={disruptedIds}
        affectedIds={affectedIds}
        onVertexAdd={addVertex}
        onFinishDraft={finishAoi}
        onSelect={select}
        onViewportChange={setViewportBbox}
      />
      <div className="map-legend">
        <span>
          <i className="swatch kind-company" /> Company
        </span>
        <span>
          <i className="swatch kind-facility" /> Facility
        </span>
        <span>
          <i className="swatch kind-port" /> Port
        </span>
        <span>
          <i className="swatch kind-airport" /> Airport
        </span>
        <span>
          <i className="swatch kind-power_infrastructure" /> Power
        </span>
        <span>
          <i className="swatch kind-transport_infrastructure" /> Transport
        </span>
        <span>
          <i className="swatch is-disrupted" /> Disrupted
        </span>
        <span>
          <i className="swatch is-affected" /> Affected
        </span>
      </div>
    </div>
  )
}
