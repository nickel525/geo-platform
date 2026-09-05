import type { Point, Polygon } from 'geojson'

export type EntityKind = 'company' | 'facility' | 'port' | 'infrastructure'

export type Entity = {
  id: string
  name: string
  kind: EntityKind
  description: string
  geometry: Point | Polygon | null
  createdAt: string
}

export type RelationshipType =
  | 'operates'
  | 'supplies'
  | 'depends_on'
  | 'owns'
  | 'located_at'

export type Evidence = {
  id: string
  title: string
  source: string
  url?: string
  publishedAt?: string
}

export type Relationship = {
  id: string
  fromId: string
  toId: string
  type: RelationshipType
  confidence: number
  evidenceIds: string[]
  note?: string
}

export type EventSeverity = 'low' | 'medium' | 'high' | 'critical'

export type AtlasEvent = {
  id: string
  title: string
  description: string
  severity: EventSeverity
  entityIds: string[]
  geometry: Point | null
  occurredAt: string
}

export type AreaOfInterest = {
  id: string
  name: string
  geometry: Polygon
  createdAt: string
}

export type ImpactHop = {
  entityId: string
  viaRelationshipId: string | null
  depth: number
}

export type ListResponse<T> = {
  items: T[]
  truncated: boolean
  nextCursor: string | null
}

export type BBox = [number, number, number, number]
