import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAoi, deleteAoi, entitiesInsideAoi, getAoi, listAois, updateAoi } from './repos/aois.ts'
import { getEntity, listEntities } from './repos/entities.ts'
import { getEvent, listEvents } from './repos/events.ts'
import { traverseImpact } from './repos/graph.ts'
import { getEntityRecord, getNeighborhoodRecord } from './repos/records.ts'
import { getRelationship, listEvidenceByIds, listRelationshipsForEntity } from './repos/relationships.ts'
import type { EntityKind } from './types.ts'

const kindSchema = z.enum(['company', 'facility', 'port', 'infrastructure', 'all'])
const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.array(z.number()).min(2))),
})

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({ ok: true }))

  app.get('/api/entities', async (request) => {
    const query = z
      .object({
        q: z.string().optional(),
        kind: kindSchema.optional(),
        bbox: z.string().optional(),
        ids: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.string().optional(),
      })
      .parse(request.query)
    return listEntities({
      ...query,
      kind: query.kind as EntityKind | 'all' | undefined,
    })
  })

  app.get('/api/entities/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const entity = await getEntity(id)
    if (!entity) return reply.code(404).send({ error: 'Entity not found' })
    return entity
  })

  app.get('/api/entities/:id/record', async (request, reply) => {
    const { id } = request.params as { id: string }
    const record = await getEntityRecord(id)
    if (!record) return reply.code(404).send({ error: 'Entity not found' })
    return record
  })

  app.get('/api/entities/:id/neighborhood', async (request, reply) => {
    const { id } = request.params as { id: string }
    const query = z
      .object({ depth: z.coerce.number().int().min(1).max(4).optional() })
      .parse(request.query)
    const graph = await getNeighborhoodRecord(id, query.depth)
    if (!graph) return reply.code(404).send({ error: 'Entity not found' })
    return graph
  })

  app.get('/api/aois', async (request) => {
    const query = z
      .object({
        bbox: z.string().optional(),
        limit: z.string().optional(),
      })
      .parse(request.query)
    return listAois(query)
  })

  app.get('/api/aois/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const aoi = await getAoi(id)
    if (!aoi) return reply.code(404).send({ error: 'AOI not found' })
    return aoi
  })

  app.get('/api/aois/:id/entities', async (request, reply) => {
    const { id } = request.params as { id: string }
    const aoi = await getAoi(id)
    if (!aoi) return reply.code(404).send({ error: 'AOI not found' })
    const query = z.object({ limit: z.coerce.number().int().optional() }).parse(request.query)
    return { items: await entitiesInsideAoi(id, query.limit) }
  })

  app.post('/api/aois', async (request, reply) => {
    const body = z
      .object({
        id: z.string().min(1).optional(),
        name: z.string().min(1),
        geometry: polygonSchema,
      })
      .parse(request.body)
    const aoi = await createAoi(body)
    return reply.code(201).send(aoi)
  })

  app.patch('/api/aois/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z
      .object({
        name: z.string().min(1).optional(),
        geometry: polygonSchema.optional(),
      })
      .parse(request.body)
    const aoi = await updateAoi(id, body)
    if (!aoi) return reply.code(404).send({ error: 'AOI not found' })
    return aoi
  })

  app.delete('/api/aois/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const deleted = await deleteAoi(id)
    if (!deleted) return reply.code(404).send({ error: 'AOI not found' })
    return { ok: true }
  })

  app.get('/api/relationships/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const relationship = await getRelationship(id)
    if (!relationship) return reply.code(404).send({ error: 'Relationship not found' })
    const evidence = await listEvidenceByIds(relationship.evidenceIds)
    return { relationship, evidence }
  })

  app.get('/api/relationships', async (request) => {
    const query = z.object({ entityId: z.string() }).parse(request.query)
    return { items: await listRelationshipsForEntity(query.entityId) }
  })

  app.get('/api/events', async (request) => {
    const query = z
      .object({
        entityId: z.string().optional(),
        bbox: z.string().optional(),
        limit: z.string().optional(),
      })
      .parse(request.query)
    return listEvents(query)
  })

  app.get('/api/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const event = await getEvent(id)
    if (!event) return reply.code(404).send({ error: 'Event not found' })
    return event
  })

  app.post('/api/impact', async (request) => {
    const body = z
      .object({
        entityIds: z.array(z.string()).max(50),
        maxDepth: z.number().int().min(1).max(16).optional(),
      })
      .parse(request.body)
    const hops = await traverseImpact(body.entityIds, body.maxDepth)
    return {
      hops,
      affectedIds: hops.filter((hop) => hop.depth > 0).map((hop) => hop.entityId),
    }
  })
}
