import { sql } from '../db.ts'
import { clampLimit, mapEvent, parseBbox, type EventRow } from '../lib/mappers.ts'
import type { AtlasEvent, ListResponse } from '../types.ts'

const EVENT_SELECT = sql`
  ev.id,
  ev.title,
  ev.description,
  ev.severity,
  CASE
    WHEN ev.geometry IS NULL THEN NULL
    ELSE ST_AsGeoJSON(ev.geometry)::json
  END AS geometry,
  ev.occurred_at,
  COALESCE(
    (
      SELECT array_agg(ee.entity_id ORDER BY ee.entity_id)
      FROM event_entities ee
      WHERE ee.event_id = ev.id
    ),
    ARRAY[]::text[]
  ) AS entity_ids
`

export async function listEvents(query: {
  entityId?: string
  bbox?: string
  limit?: string
}): Promise<ListResponse<AtlasEvent>> {
  const limit = clampLimit(query.limit, 50, 200)
  const bbox = parseBbox(query.bbox)
  const entityId = query.entityId ?? null

  const rows = await sql<EventRow[]>`
    SELECT ${EVENT_SELECT}
    FROM events ev
    WHERE
      (${entityId}::text IS NULL OR EXISTS (
        SELECT 1 FROM event_entities ee
        WHERE ee.event_id = ev.id AND ee.entity_id = ${entityId}
      ))
      AND (
        ${bbox === null}::boolean
        OR (
          ev.geometry IS NOT NULL
          AND ST_Intersects(
            ev.geometry,
            ST_MakeEnvelope(
              ${bbox?.[0] ?? -180},
              ${bbox?.[1] ?? -90},
              ${bbox?.[2] ?? 180},
              ${bbox?.[3] ?? 90},
              4326
            )
          )
        )
      )
    ORDER BY ev.occurred_at DESC
    LIMIT ${limit + 1}
  `

  const truncated = rows.length > limit
  const page = truncated ? rows.slice(0, limit) : rows
  return {
    items: page.map(mapEvent),
    truncated,
    nextCursor: truncated ? page[page.length - 1]?.id ?? null : null,
  }
}

export async function getEvent(id: string): Promise<AtlasEvent | null> {
  const rows = await sql<EventRow[]>`
    SELECT ${EVENT_SELECT}
    FROM events ev
    WHERE ev.id = ${id}
    LIMIT 1
  `
  return rows[0] ? mapEvent(rows[0]) : null
}
