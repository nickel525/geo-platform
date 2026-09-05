import type { Feature, FeatureCollection, Point, Polygon, Position } from 'geojson'
import type { AreaOfInterest, AtlasEvent, Entity } from '../types/domain'

export function aoisToFeatureCollection(
  aois: AreaOfInterest[],
): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: aois.map((aoi) => ({
      type: 'Feature',
      id: aoi.id,
      geometry: aoi.geometry,
      properties: { id: aoi.id, name: aoi.name },
    })),
  }
}

export function entitiesToFeatureCollection(
  entities: Entity[],
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: entities.flatMap((entity) => {
      if (!entity.geometry || entity.geometry.type !== 'Point') return []
      const feature: Feature<Point> = {
        type: 'Feature',
        id: entity.id,
        geometry: entity.geometry,
        properties: { id: entity.id, name: entity.name, kind: entity.kind },
      }
      return [feature]
    }),
  }
}

export function eventsToFeatureCollection(
  events: AtlasEvent[],
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: events.flatMap((event) => {
      if (!event.geometry) return []
      return [
        {
          type: 'Feature',
          id: event.id,
          geometry: event.geometry,
          properties: {
            id: event.id,
            title: event.title,
            severity: event.severity,
          },
        },
      ]
    }),
  }
}

export function draftToGeoJSON(positions: Position[]): FeatureCollection {
  if (positions.length === 0) {
    return { type: 'FeatureCollection', features: [] }
  }

  const points = positions.map((coordinates) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates },
    properties: {},
  }))

  if (positions.length === 1) {
    return { type: 'FeatureCollection', features: points }
  }

  const lineCoords =
    positions.length >= 3 ? [...positions, positions[0]] : positions
  const features: FeatureCollection['features'] = [
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: lineCoords },
      properties: {},
    },
    ...points,
  ]

  if (positions.length >= 3) {
    features.unshift({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [lineCoords] },
      properties: {},
    })
  }

  return { type: 'FeatureCollection', features }
}

export function aoiToFeature(aoi: AreaOfInterest): Feature<Polygon> {
  return {
    type: 'Feature',
    id: aoi.id,
    geometry: aoi.geometry,
    properties: { id: aoi.id, name: aoi.name, createdAt: aoi.createdAt },
  }
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/geo+json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function aoisFromUnknownGeoJSON(data: unknown): AreaOfInterest[] {
  if (!data || typeof data !== 'object') return []
  const value = data as { type?: string }

  if (value.type === 'FeatureCollection' && 'features' in value) {
    return (value as FeatureCollection).features.flatMap(aoiFromFeature)
  }
  if (value.type === 'Feature') return aoiFromFeature(value as Feature)
  if (value.type === 'Polygon') return aoiFromPolygon(value as Polygon, 'Imported AOI')
  return []
}

function aoiFromFeature(feature: Feature): AreaOfInterest[] {
  if (feature.geometry?.type !== 'Polygon') return []
  const name =
    (typeof feature.properties?.name === 'string' && feature.properties.name) ||
    'Imported AOI'
  return aoiFromPolygon(feature.geometry, name)
}

function aoiFromPolygon(geometry: Polygon, name: string): AreaOfInterest[] {
  if (!geometry.coordinates[0] || geometry.coordinates[0].length < 4) return []
  return [
    {
      id: crypto.randomUUID(),
      name,
      geometry,
      createdAt: new Date().toISOString(),
    },
  ]
}
