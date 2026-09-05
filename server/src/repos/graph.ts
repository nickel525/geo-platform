import { sql } from '../db.ts'
import { getEntitiesByIds } from './entities.ts'
import { listRelationshipsAmong } from './relationships.ts'
import type { Entity, ImpactHop, Relationship } from '../types.ts'

const MAX_DEPTH = 16
const MAX_HOPS = 5000

export async function traverseImpact(
  entityIds: string[],
  maxDepth = 12,
): Promise<ImpactHop[]> {
  const roots = [...new Set(entityIds.filter(Boolean))]
  if (roots.length === 0) return []
  const depth = Math.min(Math.max(maxDepth, 1), MAX_DEPTH)

  const rows = await sql<{ entity_id: string; via_relationship_id: string | null; depth: number }[]>`
    WITH RECURSIVE hops AS (
      SELECT
        root_id AS entity_id,
        NULL::text AS via_relationship_id,
        0 AS depth,
        ARRAY[root_id] AS path
      FROM unnest(${roots}::text[]) AS root_id
      UNION ALL
      SELECT
        CASE
          WHEN r.from_id = h.entity_id
            AND r.type IN ('supplies', 'operates', 'owns')
            THEN r.to_id
          WHEN r.to_id = h.entity_id
            AND r.type IN ('depends_on', 'operates', 'owns', 'located_at')
            THEN r.from_id
        END AS entity_id,
        r.id,
        h.depth + 1,
        h.path || CASE
          WHEN r.from_id = h.entity_id
            AND r.type IN ('supplies', 'operates', 'owns')
            THEN r.to_id
          WHEN r.to_id = h.entity_id
            AND r.type IN ('depends_on', 'operates', 'owns', 'located_at')
            THEN r.from_id
        END
      FROM hops h
      JOIN relationships r
        ON (
          (r.from_id = h.entity_id AND r.type IN ('supplies', 'operates', 'owns'))
          OR
          (r.to_id = h.entity_id AND r.type IN ('depends_on', 'operates', 'owns', 'located_at'))
        )
      WHERE h.depth < ${depth}
        AND cardinality(h.path) < ${MAX_HOPS}
    )
    SELECT DISTINCT ON (entity_id)
      entity_id,
      via_relationship_id,
      depth
    FROM hops
    WHERE entity_id IS NOT NULL
      AND NOT (entity_id = ANY(path[1:cardinality(path) - 1]))
    ORDER BY entity_id, depth ASC
  `

  return rows.map((row) => ({
    entityId: row.entity_id,
    viaRelationshipId: row.via_relationship_id,
    depth: row.depth,
  }))
}

export async function neighborhood(
  entityId: string,
  depth = 2,
): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
  const hops = Math.min(Math.max(depth, 1), 4)
  const rows = await sql<{ id: string }[]>`
    WITH RECURSIVE walk AS (
      SELECT ${entityId}::text AS id, 0 AS depth, ARRAY[${entityId}::text] AS path
      UNION ALL
      SELECT
        CASE WHEN r.from_id = w.id THEN r.to_id ELSE r.from_id END,
        w.depth + 1,
        w.path || CASE WHEN r.from_id = w.id THEN r.to_id ELSE r.from_id END
      FROM walk w
      JOIN relationships r ON r.from_id = w.id OR r.to_id = w.id
      WHERE w.depth < ${hops}
        AND NOT (
          CASE WHEN r.from_id = w.id THEN r.to_id ELSE r.from_id END = ANY(w.path)
        )
    )
    SELECT DISTINCT id FROM walk
  `
  const ids = rows.map((row) => row.id)
  const [entities, relationships] = await Promise.all([
    getEntitiesByIds(ids),
    listRelationshipsAmong(ids),
  ])
  return { entities, relationships }
}

export async function upstreamIds(entityId: string): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    SELECT DISTINCT
      CASE
        WHEN to_id = ${entityId} AND type IN ('supplies', 'operates', 'owns') THEN from_id
        WHEN from_id = ${entityId} AND type IN ('depends_on', 'located_at') THEN to_id
      END AS id
    FROM relationships
    WHERE
      (to_id = ${entityId} AND type IN ('supplies', 'operates', 'owns'))
      OR (from_id = ${entityId} AND type IN ('depends_on', 'located_at'))
  `
  return rows.map((row) => row.id).filter(Boolean)
}
