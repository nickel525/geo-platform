import { getEntitiesByIds, getEntity } from './entities.ts'
import { listEvents } from './events.ts'
import { neighborhood, traverseImpact, upstreamIds } from './graph.ts'
import { listEvidenceByIds, listRelationshipsForEntity } from './relationships.ts'
import type { AtlasEvent, Entity, Evidence, Relationship } from '../types.ts'

export async function getEntityRecord(id: string): Promise<{
  entity: Entity
  relationships: Relationship[]
  evidence: Evidence[]
  events: AtlasEvent[]
  upstream: Entity[]
  downstream: Entity[]
} | null> {
  const entity = await getEntity(id)
  if (!entity) return null

  const [relationships, events, upstream, impact] = await Promise.all([
    listRelationshipsForEntity(id),
    listEvents({ entityId: id, limit: '50' }),
    upstreamIds(id),
    traverseImpact([id]),
  ])

  const evidenceIds = [...new Set(relationships.flatMap((rel) => rel.evidenceIds))]
  const downstreamIds = impact.filter((hop) => hop.depth > 0).map((hop) => hop.entityId)
  const [evidence, related] = await Promise.all([
    listEvidenceByIds(evidenceIds),
    getEntitiesByIds([...new Set([...upstream, ...downstreamIds])]),
  ])
  const byId = new Map(related.map((item) => [item.id, item]))

  return {
    entity,
    relationships,
    evidence,
    events: events.items,
    upstream: upstream.flatMap((item) => (byId.get(item) ? [byId.get(item)!] : [])),
    downstream: downstreamIds.flatMap((item) => (byId.get(item) ? [byId.get(item)!] : [])),
  }
}

export async function getNeighborhoodRecord(id: string, depth = 2) {
  const entity = await getEntity(id)
  if (!entity) return null
  return neighborhood(id, depth)
}
