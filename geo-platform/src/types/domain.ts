import type { Point, Polygon } from 'geojson'

export type EntityKind =
  | 'company'
  | 'facility'
  | 'port'
  | 'airport'
  | 'power_infrastructure'
  | 'transport_infrastructure'

export type Entity = {
  id: string
  name: string
  kind: EntityKind
  description: string
  geometry: Point | Polygon | null
  createdAt: string
  metadata: Record<string, unknown>
}

export type RelationshipType =
  | 'operates'
  | 'supplies'
  | 'customer_of'
  | 'depends_on'
  | 'owns'
  | 'located_at'

export type Evidence = {
  id: string
  title: string
  source: string
  url?: string
  publishedAt?: string
  sourceRecordId?: string
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

export type Selection =
  | { kind: 'entity'; id: string }
  | { kind: 'aoi'; id: string }
  | { kind: 'relationship'; id: string }
  | { kind: 'event'; id: string }
  | null

export type WorkspaceView = 'map' | 'network'
