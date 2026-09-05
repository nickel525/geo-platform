import { sql } from '../db.ts'
import { clampLimit, mapAoi, mapEntity, parseBbox, type AoiRow, type EntityRow } from '../lib/mappers.ts'
import type { AreaOfInterest, Entity, ListResponse } from '../types.ts'
import type { Polygon } from 'geojson'

const AOI_SELECT = sql`
  id,
  name,
  ST_AsGeoJSON(geometry)::json AS geometry,
  created_at
`

const ENTITY_SELECT = sql`
  e.id,
  e.name,
  e.kind,
  e.description,
  CASE
    WHEN e.geometry IS NULL THEN NULL
    ELSE ST_AsGeoJSON(e.geometry)::json
  END AS geometry,
  e.created_at
`

export async function listAois(query: {
  bbox?: string
  limit?: string
}): Promise<ListResponse<AreaOfInterest>> {
  const limit = clampLimit(query.limit, 100, 500)
  const bbox = parseBbox(query.bbox)

  const rows = bbox
    ? await sql<AoiRow[]>`
        SELECT ${AOI_SELECT}
        FROM aois
        WHERE ST_Intersects(
          geometry,
          ST_MakeEnvelope(${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}, 4326)
        )
        ORDER BY name, id
        LIMIT ${limit + 1}
      `
    : await sql<AoiRow[]>`
        SELECT ${AOI_SELECT}
        FROM aois
        ORDER BY name, id
        LIMIT ${limit + 1}
      `

  const truncated = rows.length > limit
  const page = truncated ? rows.slice(0, limit) : rows
  return {
    items: page.map(mapAoi),
    truncated,
    nextCursor: truncated ? page[page.length - 1]?.id ?? null : null,
  }
}

export async function getAoi(id: string): Promise<AreaOfInterest | null> {
  const rows = await sql<AoiRow[]>`
    SELECT ${AOI_SELECT}
    FROM aois
    WHERE id = ${id}
    LIMIT 1
  `
  return rows[0] ? mapAoi(rows[0]) : null
}

export async function createAoi(input: {
  id?: string
  name: string
  geometry: Polygon
}): Promise<AreaOfInterest> {
  const id = input.id ?? crypto.randomUUID()
  const rows = await sql<AoiRow[]>`
    INSERT INTO aois (id, name, geometry)
    VALUES (
      ${id},
      ${input.name},
      ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(input.geometry)}), 4326)
    )
    RETURNING ${AOI_SELECT}
  `
  return mapAoi(rows[0])
}

export async function updateAoi(
  id: string,
  input: { name?: string; geometry?: Polygon },
): Promise<AreaOfInterest | null> {
  const current = await getAoi(id)
  if (!current) return null
  const name = input.name ?? current.name
  const geometry = input.geometry ?? current.geometry
  const rows = await sql<AoiRow[]>`
    UPDATE aois
    SET
      name = ${name},
      geometry = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326),
      updated_at = now()
    WHERE id = ${id}
    RETURNING ${AOI_SELECT}
  `
  return rows[0] ? mapAoi(rows[0]) : null
}

export async function deleteAoi(id: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM aois WHERE id = ${id} RETURNING id
  `
  return rows.length > 0
}

export async function entitiesInsideAoi(
  aoiId: string,
  limit = 200,
): Promise<Entity[]> {
  const rows = await sql<EntityRow[]>`
    SELECT ${ENTITY_SELECT}
    FROM entities e
    JOIN aois a ON a.id = ${aoiId}
    WHERE e.geometry IS NOT NULL
      AND ST_Contains(a.geometry, ST_Centroid(e.geometry))
    ORDER BY e.name, e.id
    LIMIT ${Math.min(limit, 500)}
  `
  return rows.map(mapEntity)
}
