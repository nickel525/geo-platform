import type {
  AreaOfInterest,
  AtlasEvent,
  Entity,
  EntityKind,
  Evidence,
  Relationship,
} from '../types/domain'

export type ListResponse<T> = {
  items: T[]
  truncated: boolean
  nextCursor: string | null
}

export type EntityRecord = {
  entity: Entity
  relationships: Relationship[]
  evidence: Evidence[]
  events: AtlasEvent[]
  upstream: Entity[]
  downstream: Entity[]
}

export type ImpactResponse = {
  hops: Array<{ entityId: string; viaRelationshipId: string | null; depth: number }>
  affectedIds: string[]
}

const base = import.meta.env.VITE_API_BASE ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${base}${path}`, { ...init, headers })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `${response.status} ${response.statusText}`)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),

  listEntities: (params: {
    q?: string
    kind?: EntityKind | 'all'
    bbox?: string
    ids?: string
    limit?: string
    cursor?: string
  }) => request<ListResponse<Entity>>(`/api/entities${qs(params)}`),

  getEntity: (id: string) => request<Entity>(`/api/entities/${id}`),

  getEntityRecord: (id: string) => request<EntityRecord>(`/api/entities/${id}/record`),

  getNeighborhood: (id: string, depth = 2) =>
    request<{ entities: Entity[]; relationships: Relationship[] }>(
      `/api/entities/${id}/neighborhood${qs({ depth: String(depth) })}`,
    ),

  listAois: () => request<ListResponse<AreaOfInterest>>('/api/aois'),

  getAoi: (id: string) => request<AreaOfInterest>(`/api/aois/${id}`),

  aoiEntities: (id: string) =>
    request<{ items: Entity[] }>(`/api/aois/${id}/entities`),

  createAoi: (body: { name: string; geometry: AreaOfInterest['geometry'] }) =>
    request<AreaOfInterest>('/api/aois', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateAoi: (id: string, body: { name?: string }) =>
    request<AreaOfInterest>(`/api/aois/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteAoi: (id: string) =>
    request<{ ok: boolean }>(`/api/aois/${id}`, { method: 'DELETE' }),

  getRelationship: (id: string) =>
    request<{ relationship: Relationship; evidence: Evidence[] }>(
      `/api/relationships/${id}`,
    ),

  listEvents: (params: { entityId?: string; limit?: string } = {}) =>
    request<ListResponse<AtlasEvent>>(`/api/events${qs(params)}`),

  getEvent: (id: string) => request<AtlasEvent>(`/api/events/${id}`),

  impact: (entityIds: string[]) =>
    request<ImpactResponse>('/api/impact', {
      method: 'POST',
      body: JSON.stringify({ entityIds }),
    }),
}
