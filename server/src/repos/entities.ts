import { sql } from '../db.ts'
import { clampLimit, mapEntity, parseBbox, type EntityRow } from '../lib/mappers.ts'
import type { Entity, EntityKind, ListResponse } from '../types.ts'

const ENTITY_SELECT = sql`
  id,
  name,
  kind,
  description,
  CASE
    WHEN geometry IS NULL THEN NULL
    ELSE ST_AsGeoJSON(geometry)::json
  END AS geometry,
  created_at
`

export async function getEntity(id: string): Promise<Entity | null> {
  const rows = await sql<EntityRow[]>`
    SELECT ${ENTITY_SELECT}
    FROM entities
    WHERE id = ${id}
    LIMIT 1
  `
  return rows[0] ? mapEntity(rows[0]) : null
}

export async function getEntitiesByIds(ids: string[]): Promise<Entity[]> {
  if (ids.length === 0) return []
  const rows = await sql<EntityRow[]>`
    SELECT ${ENTITY_SELECT}
    FROM entities
    WHERE id = ANY(${ids})
  `
  return rows.map(mapEntity)
}

export async function listEntities(query: {
  q?: string
  kind?: EntityKind | 'all'
  bbox?: string
  ids?: string
  cursor?: string
  limit?: string
}): Promise<ListResponse<Entity>> {
  if (query.ids) {
    const ids = query.ids.split(',').map((id) => id.trim()).filter(Boolean)
    const items = await getEntitiesByIds(ids)
    return { items, truncated: false, nextCursor: null }
  }

  const limit = clampLimit(query.limit, 50, 500)
  const bbox = parseBbox(query.bbox)
  const q = query.q?.trim() ?? ''
  const kind = query.kind && query.kind !== 'all' ? query.kind : null
  const cursor = query.cursor ?? null
  const like = `%${q}%`

  const rows = bbox
    ? await sql<EntityRow[]>`
        SELECT ${ENTITY_SELECT}
        FROM entities
        WHERE
          (${kind}::entity_kind IS NULL OR kind = ${kind}::entity_kind)
          AND (
            ${q} = ''
            OR name ILIKE ${like}
            OR description ILIKE ${like}
            OR kind::text ILIKE ${like}
          )
          AND geometry IS NOT NULL
          AND ST_Intersects(
            geometry,
            ST_MakeEnvelope(${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}, 4326)
          )
          AND (
            ${cursor}::text IS NULL
            OR (name, id) > (SELECT name, id FROM entities WHERE id = ${cursor} LIMIT 1)
          )
        ORDER BY
          CASE WHEN ${q} = '' THEN 0 ELSE similarity(name, ${q}) END DESC,
          name ASC,
          id ASC
        LIMIT ${limit + 1}
      `
    : await sql<EntityRow[]>`
        SELECT ${ENTITY_SELECT}
        FROM entities
        WHERE
          (${kind}::entity_kind IS NULL OR kind = ${kind}::entity_kind)
          AND (
            ${q} = ''
            OR name ILIKE ${like}
            OR description ILIKE ${like}
            OR kind::text ILIKE ${like}
          )
          AND (
            ${cursor}::text IS NULL
            OR (name, id) > (SELECT name, id FROM entities WHERE id = ${cursor} LIMIT 1)
          )
        ORDER BY
          CASE WHEN ${q} = '' THEN 0 ELSE similarity(name, ${q}) END DESC,
          name ASC,
          id ASC
        LIMIT ${limit + 1}
      `

  const truncated = rows.length > limit
  const page = truncated ? rows.slice(0, limit) : rows
  return {
    items: page.map(mapEntity),
    truncated,
    nextCursor: truncated ? page[page.length - 1]?.id ?? null : null,
  }
}
