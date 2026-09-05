# ATLAS API

Node/TypeScript service over PostgreSQL + PostGIS. The frontend never owns catalog, relationship, evidence, event, or AOI records.

## Run locally

1. Start Docker Desktop, then from the repo root:

```bash
docker compose up -d
```

2. From `server/`:

```bash
npm install
npm run migrate
npm run seed
npm run dev
```

API: `http://127.0.0.1:3001/api/health`

Default database URL: `postgres://atlas:atlas@127.0.0.1:5433/atlas`

Copy `.env.example` to `.env` if you need to override it. The Vite app proxies `/api` to this server.

## Scale notes

- Map reads entities by viewport (`bbox`) with a hard cap.
- Sidebar search is trigram/ILIKE + keyset cursor, not a full table dump.
- Impact and neighborhood walks are recursive SQL on indexed adjacency lists, depth-capped.
- `entities.source` + `entities.external_id` are the ingest keys for later company feeds.
