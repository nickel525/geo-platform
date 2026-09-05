import { sql } from '../db.ts'
import { mapEvidence, mapRelationship, type EvidenceRow, type RelationshipRow } from '../lib/mappers.ts'
import type { Evidence, Relationship } from '../types.ts'

const RELATIONSHIP_SELECT = sql`
  r.id,
  r.from_id,
  r.to_id,
  r.type,
  r.confidence,
  r.note,
  COALESCE(
    (
      SELECT array_agg(re.evidence_id ORDER BY re.evidence_id)
      FROM relationship_evidence re
      WHERE re.relationship_id = r.id
    ),
    ARRAY[]::text[]
  ) AS evidence_ids
`

export async function getRelationship(id: string): Promise<Relationship | null> {
  const rows = await sql<RelationshipRow[]>`
    SELECT ${RELATIONSHIP_SELECT}
    FROM relationships r
    WHERE r.id = ${id}
    LIMIT 1
  `
  return rows[0] ? mapRelationship(rows[0]) : null
}

export async function listRelationshipsForEntity(entityId: string): Promise<Relationship[]> {
  const rows = await sql<RelationshipRow[]>`
    SELECT ${RELATIONSHIP_SELECT}
    FROM relationships r
    WHERE r.from_id = ${entityId} OR r.to_id = ${entityId}
    ORDER BY r.type, r.id
  `
  return rows.map(mapRelationship)
}

export async function listRelationshipsAmong(entityIds: string[]): Promise<Relationship[]> {
  if (entityIds.length === 0) return []
  const rows = await sql<RelationshipRow[]>`
    SELECT ${RELATIONSHIP_SELECT}
    FROM relationships r
    WHERE r.from_id = ANY(${entityIds}) AND r.to_id = ANY(${entityIds})
    ORDER BY r.type, r.id
  `
  return rows.map(mapRelationship)
}

export async function listEvidenceByIds(ids: string[]): Promise<Evidence[]> {
  if (ids.length === 0) return []
  const rows = await sql<EvidenceRow[]>`
    SELECT id, title, source, url, published_at
    FROM evidence
    WHERE id = ANY(${ids})
  `
  return rows.map(mapEvidence)
}
