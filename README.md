# ATLAS

Supply-chain and critical-infrastructure intelligence platform.

- Frontend: `geo-platform/` (React, Vite, MapLibre)
- API: `server/` (Fastify, PostgreSQL, PostGIS)

```bash
docker compose up -d
cd server && npm install && npm run migrate && npm run seed && npm run dev
cd geo-platform && npm install && npm run dev
```

Open http://localhost:5173/
