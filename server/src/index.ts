import cors from '@fastify/cors'
import Fastify from 'fastify'
import { config } from './config.ts'
import { sql } from './db.ts'
import { registerRoutes } from './routes.ts'

const app = Fastify({ logger: true })
await app.register(cors, { origin: true })
await registerRoutes(app)

try {
  await sql`SELECT 1`
  await app.listen({ port: config.port, host: config.host })
} catch (error) {
  app.log.error(error)
  await sql.end({ timeout: 2 })
  process.exit(1)
}

const shutdown = async () => {
  await app.close()
  await sql.end({ timeout: 5 })
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
