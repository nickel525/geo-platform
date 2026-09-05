import type { Point, Polygon, Position } from 'geojson'
import type { AreaOfInterest, Entity } from '../types/domain'

export function pointCoordinates(geometry: Point | Polygon | null): Position | null {
  if (!geometry) return null
  if (geometry.type === 'Point') return geometry.coordinates
  const ring = geometry.coordinates[0]
  if (!ring?.length) return null
  const [sumLng, sumLat] = ring.reduce<[number, number]>(
    ([lng, lat], [x, y]) => [lng + x, lat + y],
    [0, 0],
  )
  return [sumLng / ring.length, sumLat / ring.length]
}

export function bboxOfPositions(
  positions: Position[],
): [[number, number], [number, number]] | null {
  if (positions.length === 0) return null
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of positions) {
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

export function polygonBbox(
  polygon: Polygon,
): [[number, number], [number, number]] {
  return bboxOfPositions(polygon.coordinates.flat()) ?? [
    [0, 0],
    [0, 0],
  ]
}

export function entitiesBbox(
  entities: Entity[],
): [[number, number], [number, number]] | null {
  const points = entities.flatMap((entity) => {
    const box = entityBbox(entity)
    return box ? [box[0], box[1]] : []
  })
  if (points.length === 0) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const [lng, lat] of points) {
    west = Math.min(west, lng)
    south = Math.min(south, lat)
    east = Math.max(east, lng)
    north = Math.max(north, lat)
  }
  return [
    [west, south],
    [east, north],
  ]
}

export function entityBbox(
  entity: Entity,
): [[number, number], [number, number]] | null {
  if (!entity.geometry) return null
  if (entity.geometry.type === 'Point') {
    const [lng, lat] = entity.geometry.coordinates
    const pad = 0.35
    return [
      [lng - pad, lat - pad],
      [lng + pad, lat + pad],
    ]
  }
  return polygonBbox(entity.geometry)
}

export function pointInRing(point: Position, ring: Position[]): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function pointInPolygon(point: Position, polygon: Polygon): boolean {
  const [outer, ...holes] = polygon.coordinates
  if (!outer || !pointInRing(point, outer)) return false
  return holes.every((hole) => !pointInRing(point, hole))
}

export function entitiesInsideAoi(
  entities: Entity[],
  aoi: AreaOfInterest,
): Entity[] {
  return entities.filter((entity) => {
    const point = pointCoordinates(entity.geometry)
    return point ? pointInPolygon(point, aoi.geometry) : false
  })
}

export function formatArea(polygon: Polygon): string {
  const sqm = sphericalRingArea(polygon.coordinates[0] ?? [])
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(2)} km²`
  if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(2)} ha`
  return `${Math.round(sqm).toLocaleString()} m²`
}

function sphericalRingArea(ring: Position[]): number {
  if (ring.length < 4) return 0
  const radius = 6371008.8
  let total = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i]
    const [lng2, lat2] = ring[i + 1]
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)))
  }
  return Math.abs((total * radius * radius) / 2)
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function createAoi(positions: Position[], name: string): AreaOfInterest | null {
  if (positions.length < 3) return null
  return {
    id: crypto.randomUUID(),
    name,
    geometry: { type: 'Polygon', coordinates: [[...positions, positions[0]]] },
    createdAt: new Date().toISOString(),
  }
}
