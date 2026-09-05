import catalog from './generated/catalog.json' with { type: 'json' }
import type { AtlasCatalog, AtlasEntity, AtlasRelationship } from '../types/atlas'
import type { Entity, Evidence, Relationship } from '../types/domain'

const data = catalog as AtlasCatalog

function evidenceId(relId: string, index: number, recordId?: string): string {
  return recordId ? `ev:${recordId}:${index}` : `ev:${relId}:${index}`
}

function sourceLabel(sourceType: string): string {
  if (sourceType === 'sec_10k') return 'SEC 10-K'
  if (sourceType === 'sectivia') return 'Sectivia'
  if (sourceType === 'openstreetmap') return 'OpenStreetMap'
  if (sourceType === 'open_supply_hub') return 'Open Supply Hub'
  return sourceType
}

function describe(entity: AtlasEntity): string {
  const original =
    typeof entity.metadata.originalName === 'string' ? entity.metadata.originalName : null
  const sourceNames = Array.isArray(entity.metadata.sourceNames)
    ? entity.metadata.sourceNames.filter((name): name is string => typeof name === 'string')
    : []
  const parts = [`${entity.type.replaceAll('_', ' ')} from the ATLAS development catalog.`]
  if (original && original !== entity.name) {
    parts.push(`Source name: ${original}.`)
  } else if (sourceNames[0] && sourceNames[0] !== entity.name) {
    parts.push(`Source name: ${sourceNames[0]}.`)
  }
  if (entity.metadata.reviewFlag) {
    parts.push('Needs review before treating this as the same entity as a similar name.')
  }
  return parts.join(' ')
}

export function loadCatalog(): {
  entities: Entity[]
  relationships: Relationship[]
  evidence: Evidence[]
  generatedAt: string
} {
  const entities: Entity[] = data.entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    kind: entity.type,
    description: describe(entity),
    geometry:
      entity.latitude != null && entity.longitude != null
        ? { type: 'Point', coordinates: [entity.longitude, entity.latitude] }
        : null,
    createdAt: data.generatedAt,
    metadata: entity.metadata ?? {},
  }))

  const evidence: Evidence[] = []
  const seen = new Set<string>()
  const relationships: Relationship[] = data.relationships.map((rel: AtlasRelationship) => {
    const evidenceIds: string[] = []
    for (const [index, item] of (rel.evidence ?? []).entries()) {
      const id = evidenceId(rel.id, index, item.sourceRecordId)
      evidenceIds.push(id)
      if (seen.has(id)) continue
      seen.add(id)
      evidence.push({
        id,
        title: item.sourceName,
        source: sourceLabel(item.sourceType),
        url: item.sourceUrl,
        publishedAt: item.observedAt,
        sourceRecordId: item.sourceRecordId,
      })
    }
    const note =
      typeof rel.metadata?.note === 'string' ? rel.metadata.note : undefined
    return {
      id: rel.id,
      fromId: rel.sourceEntityId,
      toId: rel.targetEntityId,
      type: rel.type,
      confidence: rel.confidence ?? 0.5,
      evidenceIds,
      note,
    }
  })

  return {
    entities,
    relationships,
    evidence,
    generatedAt: data.generatedAt,
  }
}
