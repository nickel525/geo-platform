import { operatedSiteIds } from '../../lib/graph'
import { useWorkspace } from '../../state/useWorkspace'
import { MapView } from './MapView'

export function MapPane() {
  const {
    aois,
    entities,
    relationships,
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
    selectedEntity,
  } = useWorkspace()

  const relatedSites = selectedEntity
    ? operatedSiteIds(selectedEntity.id, relationships)
        .map((id) => entities.find((entity) => entity.id === id))
        .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity?.geometry))
    : []

  return (
    <div className="map-pane">
      <MapView
        aois={aois}
        entities={mapEntities}
        events={events}
        visibleEntityIds={mapEntities.map((entity) => entity.id)}
        relatedSites={relatedSites}
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
