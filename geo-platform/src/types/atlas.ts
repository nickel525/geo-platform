/** Canonical ATLAS objects produced by scripts/ingest. Frontend maps these into domain.ts. */

export type AtlasEntityType =
  | 'company'
  | 'facility'
  | 'port'
  | 'airport'
  | 'power_infrastructure'
  | 'transport_infrastructure'

export type AtlasRelationshipType =
  | 'supplies'
  | 'customer_of'
  | 'operates'
  | 'owns'
  | 'depends_on'
  | 'located_at'

export type AtlasEvidence = {
  sourceType: string
  sourceName: string
  sourceUrl?: string
  sourceRecordId?: string
  observedAt?: string
}

export type AtlasEntity = {
  id: string
  name: string
  type: AtlasEntityType
  latitude?: number
  longitude?: number
  metadata: Record<string, unknown>
}

export type AtlasRelationship = {
  id: string
  sourceEntityId: string
  targetEntityId: string
  type: AtlasRelationshipType
  confidence?: number
  evidence: AtlasEvidence[]
  metadata?: Record<string, unknown>
}

export type AtlasCatalog = {
  generatedAt: string
  entities: AtlasEntity[]
  relationships: AtlasRelationship[]
  sources?: Record<string, unknown>
}
