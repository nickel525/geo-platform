import {
  catalogAois,
  catalogEntities,
  catalogEvents,
  catalogEvidence,
  catalogRelationships,
} from './catalog.ts'
import { sql } from './db.ts'

await sql.begin(async (tx) => {
  for (const entity of catalogEntities) {
    await tx`
      INSERT INTO entities (id, name, kind, description, geometry, source, created_at, updated_at)
      VALUES (
        ${entity.id},
        ${entity.name},
        ${entity.kind}::entity_kind,
        ${entity.description},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(entity.geometry)}), 4326),
        'catalog',
        ${entity.createdAt},
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        kind = excluded.kind,
        description = excluded.description,
        geometry = excluded.geometry,
        source = excluded.source,
        updated_at = now()
    `
  }

  for (const aoi of catalogAois) {
    await tx`
      INSERT INTO aois (id, name, geometry, created_at, updated_at)
      VALUES (
        ${aoi.id},
        ${aoi.name},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(aoi.geometry)}), 4326),
        ${aoi.createdAt},
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        geometry = excluded.geometry,
        updated_at = now()
    `
  }

  for (const item of catalogEvidence) {
    await tx`
      INSERT INTO evidence (id, title, source, url, published_at)
      VALUES (
        ${item.id},
        ${item.title},
        ${item.source},
        ${item.url ?? null},
        ${item.publishedAt ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = excluded.title,
        source = excluded.source,
        url = excluded.url,
        published_at = excluded.published_at
    `
  }

  for (const rel of catalogRelationships) {
    await tx`
      INSERT INTO relationships (id, from_id, to_id, type, confidence, note)
      VALUES (
        ${rel.id},
        ${rel.fromId},
        ${rel.toId},
        ${rel.type}::relationship_type,
        ${rel.confidence},
        ${rel.note ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        from_id = excluded.from_id,
        to_id = excluded.to_id,
        type = excluded.type,
        confidence = excluded.confidence,
        note = excluded.note,
        updated_at = now()
    `
    await tx`DELETE FROM relationship_evidence WHERE relationship_id = ${rel.id}`
    for (const evidenceId of rel.evidenceIds) {
      await tx`
        INSERT INTO relationship_evidence (relationship_id, evidence_id)
        VALUES (${rel.id}, ${evidenceId})
        ON CONFLICT DO NOTHING
      `
    }
  }

  for (const event of catalogEvents) {
    await tx`
      INSERT INTO events (id, title, description, severity, geometry, occurred_at)
      VALUES (
        ${event.id},
        ${event.title},
        ${event.description},
        ${event.severity}::event_severity,
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(event.geometry)}), 4326),
        ${event.occurredAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        severity = excluded.severity,
        geometry = excluded.geometry,
        occurred_at = excluded.occurred_at
    `
    await tx`DELETE FROM event_entities WHERE event_id = ${event.id}`
    for (const entityId of event.entityIds) {
      await tx`
        INSERT INTO event_entities (event_id, entity_id)
        VALUES (${event.id}, ${entityId})
        ON CONFLICT DO NOTHING
      `
    }
  }
})

console.log(
  `Seeded ${catalogEntities.length} entities, ${catalogRelationships.length} relationships, ${catalogAois.length} AOIs`,
)
await sql.end()
