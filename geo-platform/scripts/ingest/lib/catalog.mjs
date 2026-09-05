import { createHash } from 'node:crypto'

export function companyEntityId(match, { ticker, name }) {
  if (match.profile) return `company:${match.profile.id}`
  const symbol = ticker ? String(ticker).trim().toUpperCase() : ''
  if (symbol) return stableId('company', symbol)
  return stableId('company', name)
}

export function stableId(prefix, value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  const hash = createHash('sha1').update(String(value)).digest('hex').slice(0, 8)
  return `${prefix}:${slug || 'item'}:${hash}`
}

export function createCatalogBuilder() {
  const entities = new Map()
  const relationships = new Map()

  function addEntity(entity) {
    const current = entities.get(entity.id)
    if (!current) {
      entities.set(entity.id, {
        ...entity,
        metadata: { ...(entity.metadata ?? {}) },
      })
      return entities.get(entity.id)
    }

    if (!current.latitude && entity.latitude != null) {
      current.latitude = entity.latitude
      current.longitude = entity.longitude
    }
    current.metadata = {
      ...current.metadata,
      ...entity.metadata,
      sourceNames: uniqueStrings([
        ...(current.metadata.sourceNames ?? []),
        ...(entity.metadata?.sourceNames ?? []),
        entity.name,
      ]),
    }
    if (entity.metadata?.reviewFlag) current.metadata.reviewFlag = true
    return current
  }

  function addRelationship(relationship) {
    const id =
      relationship.id ??
      stableId(
        'rel',
        [relationship.sourceEntityId, relationship.type, relationship.targetEntityId].join('|'),
      )
    const current = relationships.get(id)
    if (!current) {
      relationships.set(id, { ...relationship, id, evidence: relationship.evidence ?? [] })
      return
    }
    current.evidence = [...current.evidence, ...(relationship.evidence ?? [])]
    current.metadata = mergeRelMetadata(current.metadata, relationship.metadata)
    if (
      relationship.confidence != null &&
      (current.confidence == null || relationship.confidence > current.confidence)
    ) {
      current.confidence = relationship.confidence
    }
  }

  return {
    addEntity,
    addRelationship,
    toJSON() {
      return {
        generatedAt: new Date().toISOString(),
        entities: [...entities.values()].sort((a, b) => a.name.localeCompare(b.name)),
        relationships: [...relationships.values()],
      }
    },
  }
}

function mergeRelMetadata(current, incoming) {
  if (!current && !incoming) return undefined
  const notes = uniqueStrings([current?.note, incoming?.note])
  return {
    ...current,
    ...incoming,
    note: notes.join(' · ') || undefined,
  }
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))]
}
