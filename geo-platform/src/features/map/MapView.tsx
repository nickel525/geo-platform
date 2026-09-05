import { useEffect, useRef } from 'react'
import type { Position } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

import { entityBbox, polygonBbox } from '../../lib/geo'
import {
  aoisToFeatureCollection,
  draftToGeoJSON,
  entitiesToFeatureCollection,
  eventsToFeatureCollection,
} from '../../lib/mapFeatures'
import type { AreaOfInterest, AtlasEvent, Entity, Selection } from '../../types/domain'

maplibregl.setWorkerUrl(workerUrl)

type MapViewProps = {
  aois: AreaOfInterest[]
  entities: Entity[]
  events: AtlasEvent[]
  visibleEntityIds: string[]
  isDrawing: boolean
  draftPositions: Position[]
  selection: Selection
  disruptedIds: string[]
  affectedIds: string[]
  onVertexAdd: (position: Position) => void
  onFinishDraft: () => void
  onSelect: (selection: Selection) => void
  onViewportChange: (bbox: [number, number, number, number]) => void
}

const PICK_LAYERS = ['entities-circle', 'events-circle', 'aois-fill'] as const

export function MapView({
  aois,
  entities,
  events,
  visibleEntityIds,
  isDrawing,
  draftPositions,
  selection,
  disruptedIds,
  affectedIds,
  onVertexAdd,
  onFinishDraft,
  onSelect,
  onViewportChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const isDrawingRef = useRef(isDrawing)
  const onVertexAddRef = useRef(onVertexAdd)
  const onFinishDraftRef = useRef(onFinishDraft)
  const onSelectRef = useRef(onSelect)
  const onViewportChangeRef = useRef(onViewportChange)
  const aoisRef = useRef(aois)
  const entitiesRef = useRef(entities)
  const eventsRef = useRef(events)
  const selectionRef = useRef(selection)
  const visibleEntityIdsRef = useRef(visibleEntityIds)
  const disruptedIdsRef = useRef(disruptedIds)
  const affectedIdsRef = useRef(affectedIds)

  useEffect(() => {
    isDrawingRef.current = isDrawing
    onVertexAddRef.current = onVertexAdd
    onFinishDraftRef.current = onFinishDraft
    onSelectRef.current = onSelect
    onViewportChangeRef.current = onViewportChange
    aoisRef.current = aois
    entitiesRef.current = entities
    eventsRef.current = events
    selectionRef.current = selection
    visibleEntityIdsRef.current = visibleEntityIds
    disruptedIdsRef.current = disruptedIds
    affectedIdsRef.current = affectedIds
  }, [
    isDrawing,
    onVertexAdd,
    onFinishDraft,
    onSelect,
    onViewportChange,
    aois,
    entities,
    events,
    selection,
    visibleEntityIds,
    disruptedIds,
    affectedIds,
  ])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [30, 24],
      zoom: 1.6,
    })

    map.on('click', (event: maplibregl.MapMouseEvent) => {
      if (isDrawingRef.current) {
        onVertexAddRef.current([event.lngLat.lng, event.lngLat.lat])
        return
      }
      const layers = PICK_LAYERS.filter((id) => map.getLayer(id))
      if (layers.length === 0) {
        onSelectRef.current(null)
        return
      }
      const features = map.queryRenderedFeatures(event.point, { layers: [...layers] })
      const feature = features[0]
      if (!feature) {
        onSelectRef.current(null)
        return
      }
      const id = String(feature.properties?.id ?? feature.id)
      if (feature.layer.id === 'entities-circle') {
        onSelectRef.current({ kind: 'entity', id })
      } else if (feature.layer.id === 'events-circle') {
        onSelectRef.current({ kind: 'event', id })
      } else {
        onSelectRef.current({ kind: 'aoi', id })
      }
    })

    const reportViewport = () => {
      const bounds = map.getBounds()
      onViewportChangeRef.current([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ])
    }
    map.on('moveend', reportViewport)

    map.on('dblclick', (event: maplibregl.MapMouseEvent) => {
      if (!isDrawingRef.current) return
      event.preventDefault()
      onFinishDraftRef.current()
    })

    map.on('mousemove', (event: maplibregl.MapMouseEvent) => {
      if (isDrawingRef.current) {
        map.getCanvas().style.cursor = 'crosshair'
        return
      }
      const layers = PICK_LAYERS.filter((id) => map.getLayer(id))
      if (layers.length === 0) return
      const hit = map.queryRenderedFeatures(event.point, { layers: [...layers] })
      map.getCanvas().style.cursor = hit.length > 0 ? 'pointer' : ''
    })

    map.on('load', () => {
      map.addSource('aois', {
        type: 'geojson',
        promoteId: 'id',
        data: aoisToFeatureCollection(aoisRef.current),
      })
      map.addLayer({
        id: 'aois-fill',
        type: 'fill',
        source: 'aois',
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#38bdf8',
            '#334155',
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.28,
            0.12,
          ],
        },
      })
      map.addLayer({
        id: 'aois-outline',
        type: 'line',
        source: 'aois',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#38bdf8',
            '#64748b',
          ],
          'line-width': 1.5,
        },
      })

      map.addSource('entities', {
        type: 'geojson',
        promoteId: 'id',
        data: entitiesToFeatureCollection(entitiesRef.current),
      })
      map.addLayer({
        id: 'entities-circle',
        type: 'circle',
        source: 'entities',
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            9,
            6,
          ],
          'circle-color': [
            'case',
            ['boolean', ['feature-state', 'disrupted'], false],
            '#f43f5e',
            ['boolean', ['feature-state', 'affected'], false],
            '#f59e0b',
            ['==', ['get', 'kind'], 'company'],
            '#818cf8',
            ['==', ['get', 'kind'], 'facility'],
            '#22d3ee',
            ['==', ['get', 'kind'], 'port'],
            '#34d399',
            ['==', ['get', 'kind'], 'airport'],
            '#2dd4bf',
            ['==', ['get', 'kind'], 'power_infrastructure'],
            '#fbbf24',
            ['==', ['get', 'kind'], 'transport_infrastructure'],
            '#fb923c',
            '#fbbf24',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0b1020',
        },
      })
      map.addLayer({
        id: 'entities-label',
        type: 'symbol',
        source: 'entities',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#e5e7eb',
          'text-halo-color': '#0b1020',
          'text-halo-width': 1.2,
        },
      })

      map.addSource('events', {
        type: 'geojson',
        promoteId: 'id',
        data: eventsToFeatureCollection(eventsRef.current),
      })
      map.addLayer({
        id: 'events-circle',
        type: 'circle',
        source: 'events',
        paint: {
          'circle-radius': 8,
          'circle-color': '#fb7185',
          'circle-opacity': 0.35,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fb7185',
        },
      })

      map.addSource('draft', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'draft-fill',
        type: 'fill',
        source: 'draft',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.12 },
      })
      map.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'draft',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2,
          'line-dasharray': [2, 1],
        },
      })
      map.addLayer({
        id: 'draft-points',
        type: 'circle',
        source: 'draft',
        paint: {
          'circle-radius': 4,
          'circle-color': '#38bdf8',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0b1020',
        },
      })

      reportViewport()
      applyEntityFilter(map, visibleEntityIdsRef.current)
      applyFeatureStates(
        map,
        entitiesRef.current,
        aoisRef.current,
        selectionRef.current,
        disruptedIdsRef.current,
        affectedIdsRef.current,
      )
    })

    mapRef.current = map
    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(container)

    return () => {
      map.remove()
      observer.disconnect()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (isDrawing) {
      map.doubleClickZoom.disable()
      map.getCanvas().style.cursor = 'crosshair'
    } else {
      map.doubleClickZoom.enable()
    }
  }, [isDrawing])

  useEffect(() => {
    const source = mapRef.current?.getSource('aois')
    if (source?.type !== 'geojson') return
    ;(source as maplibregl.GeoJSONSource).setData(aoisToFeatureCollection(aois))
  }, [aois])

  useEffect(() => {
    const source = mapRef.current?.getSource('entities')
    if (source?.type !== 'geojson') return
    ;(source as maplibregl.GeoJSONSource).setData(
      entitiesToFeatureCollection(entities),
    )
  }, [entities])

  useEffect(() => {
    const source = mapRef.current?.getSource('events')
    if (source?.type !== 'geojson') return
    ;(source as maplibregl.GeoJSONSource).setData(eventsToFeatureCollection(events))
  }, [events])

  useEffect(() => {
    const source = mapRef.current?.getSource('draft')
    if (source?.type !== 'geojson') return
    ;(source as maplibregl.GeoJSONSource).setData(draftToGeoJSON(draftPositions))
  }, [draftPositions])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applyEntityFilter(map, visibleEntityIds)
  }, [visibleEntityIds])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applyFeatureStates(
      map,
      entitiesRef.current,
      aoisRef.current,
      selection,
      disruptedIds,
      affectedIds,
    )
  }, [selection, disruptedIds, affectedIds, aois, entities])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    if (selection?.kind === 'aoi') {
      const aoi = aoisRef.current.find((item) => item.id === selection.id)
      if (aoi) {
        map.fitBounds(polygonBbox(aoi.geometry), {
          padding: 80,
          maxZoom: 10,
          duration: 700,
        })
      }
      return
    }
    if (selection?.kind === 'entity') {
      const entity = entitiesRef.current.find((item) => item.id === selection.id)
      const box = entity ? entityBbox(entity) : null
      if (box) {
        map.fitBounds(box, { padding: 80, maxZoom: 8, duration: 700 })
      }
    }
  }, [selection])

  return <div ref={containerRef} className="map-canvas" />
}

function applyEntityFilter(map: maplibregl.Map, visibleEntityIds: string[]): void {
  if (!map.getLayer('entities-circle')) return
  const filter: maplibregl.FilterSpecification = [
    'in',
    ['get', 'id'],
    ['literal', visibleEntityIds],
  ]
  map.setFilter('entities-circle', filter)
  map.setFilter('entities-label', filter)
}

function applyFeatureStates(
  map: maplibregl.Map,
  entities: Entity[],
  aois: AreaOfInterest[],
  selection: Selection,
  disruptedIds: string[],
  affectedIds: string[],
): void {
  if (!map.getSource('entities')) return
  for (const entity of entities) {
    map.setFeatureState(
      { source: 'entities', id: entity.id },
      {
        selected: selection?.kind === 'entity' && selection.id === entity.id,
        disrupted: disruptedIds.includes(entity.id),
        affected: affectedIds.includes(entity.id),
      },
    )
  }
  for (const aoi of aois) {
    map.setFeatureState(
      { source: 'aois', id: aoi.id },
      { selected: selection?.kind === 'aoi' && selection.id === aoi.id },
    )
  }
}
