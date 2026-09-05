import type { EntityKind, Relationship, RelationshipType } from '../types/domain'

export type ImpactHop = {
  entityId: string
  viaRelationshipId: string | null
  depth: number
}

const OUTGOING_IMPACT: RelationshipType[] = ['supplies', 'operates', 'owns']
const INCOMING_IMPACT: RelationshipType[] = [
  'depends_on',
  'operates',
  'owns',
  'located_at',
  'customer_of',
]

export function traverseImpact(
  startId: string,
  relationships: Relationship[],
): ImpactHop[] {
  const hops: ImpactHop[] = [{ entityId: startId, viaRelationshipId: null, depth: 0 }]
  const seen = new Set<string>([startId])
  const queue = [startId]
  const depthOf = new Map<string, number>([[startId, 0]])

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    const depth = depthOf.get(current) ?? 0

    for (const rel of relationships) {
      const neighbor = impactedNeighbor(current, rel)
      if (!neighbor || seen.has(neighbor)) continue
      seen.add(neighbor)
      depthOf.set(neighbor, depth + 1)
      queue.push(neighbor)
      hops.push({
        entityId: neighbor,
        viaRelationshipId: rel.id,
        depth: depth + 1,
      })
    }
  }

  return hops
}

function impactedNeighbor(disruptedId: string, rel: Relationship): string | null {
  if (rel.fromId === disruptedId && OUTGOING_IMPACT.includes(rel.type)) {
    return rel.toId
  }
  if (rel.toId === disruptedId && INCOMING_IMPACT.includes(rel.type)) {
    return rel.fromId
  }
  return null
}

export function upstreamIds(
  entityId: string,
  relationships: Relationship[],
): string[] {
  const ids = new Set<string>()
  for (const rel of relationships) {
    if (rel.toId === entityId && OUTGOING_IMPACT.includes(rel.type)) {
      ids.add(rel.fromId)
    }
    if (
      rel.fromId === entityId &&
      (rel.type === 'depends_on' ||
        rel.type === 'located_at' ||
        rel.type === 'customer_of')
    ) {
      ids.add(rel.toId)
    }
  }
  return [...ids]
}

export function downstreamIds(
  entityId: string,
  relationships: Relationship[],
): string[] {
  return traverseImpact(entityId, relationships)
    .filter((hop) => hop.depth > 0)
    .map((hop) => hop.entityId)
}

export function relationshipsFor(
  entityId: string,
  relationships: Relationship[],
): Relationship[] {
  return relationships.filter(
    (rel) => rel.fromId === entityId || rel.toId === entityId,
  )
}

export function neighborhood(
  focusId: string,
  relationships: Relationship[],
  depth = 1,
): { entityIds: string[]; relationships: Relationship[] } {
  const entityIds = new Set<string>([focusId])
  let frontier = [focusId]
  for (let hop = 0; hop < depth; hop += 1) {
    const next: string[] = []
    for (const id of frontier) {
      for (const rel of relationships) {
        const other = rel.fromId === id ? rel.toId : rel.toId === id ? rel.fromId : null
        if (!other || entityIds.has(other)) continue
        entityIds.add(other)
        next.push(other)
      }
    }
    frontier = next
  }
  const kept = relationships.filter(
    (rel) => entityIds.has(rel.fromId) && entityIds.has(rel.toId),
  )
  return { entityIds: [...entityIds], relationships: kept }
}

const COMPANY_GRAPH_TYPES: RelationshipType[] = ['supplies', 'customer_of']

/** One hop from the focus node. Companies show only supplier/customer links. */
export function directNeighborhood(
  focusId: string,
  relationships: Relationship[],
  focusKind?: EntityKind,
): { entityIds: string[]; relationships: Relationship[] } {
  const allowed =
    focusKind === 'company' ? new Set<RelationshipType>(COMPANY_GRAPH_TYPES) : null
  const kept = relationships.filter((rel) => {
    if (rel.fromId !== focusId && rel.toId !== focusId) return false
    if (allowed && !allowed.has(rel.type)) return false
    return true
  })
  const entityIds = new Set<string>([focusId])
  for (const rel of kept) {
    entityIds.add(rel.fromId)
    entityIds.add(rel.toId)
  }
  return { entityIds: [...entityIds], relationships: kept }
}

/** Left-to-right supply-chain direction: upstream (supplier) → downstream (customer). */
export function supplyFlow(
  rel: Relationship,
): { upstream: string; downstream: string } | null {
  switch (rel.type) {
    case 'supplies':
    case 'operates':
    case 'owns':
      return { upstream: rel.fromId, downstream: rel.toId }
    case 'customer_of':
    case 'depends_on':
    case 'located_at':
      return { upstream: rel.toId, downstream: rel.fromId }
    default:
      return null
  }
}

export function uniqueSupplyFlows(relationships: Relationship[]): Array<{
  upstream: string
  downstream: string
  rel: Relationship
}> {
  const priority = (type: RelationshipType) => {
    if (type === 'supplies') return 0
    if (type === 'customer_of') return 2
    return 1
  }
  const ordered = [...relationships].sort((a, b) => priority(a.type) - priority(b.type))
  const seen = new Set<string>()
  const flows: Array<{ upstream: string; downstream: string; rel: Relationship }> = []
  for (const rel of ordered) {
    const flow = supplyFlow(rel)
    if (!flow || flow.upstream === flow.downstream) continue
    const key = `${flow.upstream}|${flow.downstream}`
    if (seen.has(key)) continue
    seen.add(key)
    flows.push({ ...flow, rel })
  }
  return flows
}

export function relationshipLabel(type: RelationshipType): string {
  switch (type) {
    case 'depends_on':
      return 'depends on'
    case 'located_at':
      return 'located at'
    case 'customer_of':
      return 'customer of'
    default:
      return type
  }
}
