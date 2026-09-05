import type { Point, Polygon } from 'geojson'
import type {
  AreaOfInterest,
  AtlasEvent,
  Entity,
  EntityKind,
  EventSeverity,
  Evidence,
  Relationship,
  RelationshipType,
} from '../types.ts'

export type EntityRow = {
  id: string
  name: string
  kind: EntityKind
  description: string
  geometry: Point | Polygon | null
  created_at: Date | string
}

export type AoiRow = {
  id: string
  name: string
  geometry: Polygon
  created_at: Date | string
}

export type RelationshipRow = {
  id: string
  from_id: string
  to_id: string
  type: RelationshipType
  confidence: number
  note: string | null
  evidence_ids: string[] | null
}

export type EvidenceRow = {
  id: string
  title: string
  source: string
  url: string | null
  published_at: Date | string | null
}

export type EventRow = {
  id: string
  title: string
  description: string
  severity: EventSeverity
  geometry: Point | null
  occurred_at: Date | string
  entity_ids: string[] | null
}

export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

export function mapEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    description: row.description,
    geometry: row.geometry,
    createdAt: toIso(row.created_at),
  }
}

export function mapAoi(row: AoiRow): AreaOfInterest {
  return {
    id: row.id,
    name: row.name,
    geometry: row.geometry,
    createdAt: toIso(row.created_at),
  }
}

export function mapRelationship(row: RelationshipRow): Relationship {
  return {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    type: row.type,
    confidence: row.confidence,
    evidenceIds: row.evidence_ids ?? [],
    note: row.note ?? undefined,
  }
}

export function mapEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    url: row.url ?? undefined,
    publishedAt: row.published_at ? toIso(row.published_at).slice(0, 10) : undefined,
  }
}

export function mapEvent(row: EventRow): AtlasEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    entityIds: row.entity_ids ?? [],
    geometry: row.geometry,
    occurredAt: toIso(row.occurred_at),
  }
}

export function parseBbox(value: string | undefined): [number, number, number, number] | null {
  if (!value) return null
  const parts = value.split(',').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return null
  return [parts[0], parts[1], parts[2], parts[3]]
}

export function clampLimit(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}
