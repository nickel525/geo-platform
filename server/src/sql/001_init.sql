CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_kind') THEN
    CREATE TYPE entity_kind AS ENUM ('company', 'facility', 'port', 'infrastructure');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relationship_type') THEN
    CREATE TYPE relationship_type AS ENUM (
      'operates',
      'supplies',
      'depends_on',
      'owns',
      'located_at'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_severity') THEN
    CREATE TYPE event_severity AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind entity_kind NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  geometry geometry(Geometry, 4326),
  external_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entities_geometry_gix ON entities USING GIST (geometry);
CREATE INDEX IF NOT EXISTS entities_kind_idx ON entities (kind);
CREATE INDEX IF NOT EXISTS entities_name_trgm ON entities USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS entities_description_trgm ON entities USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS entities_source_external_idx ON entities (source, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS entities_source_external_uniq
  ON entities (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS aois (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  geometry geometry(Polygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aois_geometry_gix ON aois USING GIST (geometry);
CREATE INDEX IF NOT EXISTS aois_name_trgm ON aois USING GIN (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  published_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type relationship_type NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_id, to_id, type)
);

CREATE INDEX IF NOT EXISTS relationships_from_idx ON relationships (from_id);
CREATE INDEX IF NOT EXISTS relationships_to_idx ON relationships (to_id);
CREATE INDEX IF NOT EXISTS relationships_type_idx ON relationships (type);
CREATE INDEX IF NOT EXISTS relationships_from_type_idx ON relationships (from_id, type);
CREATE INDEX IF NOT EXISTS relationships_to_type_idx ON relationships (to_id, type);

CREATE TABLE IF NOT EXISTS relationship_evidence (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (relationship_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity event_severity NOT NULL,
  geometry geometry(Point, 4326),
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_geometry_gix ON events USING GIST (geometry);
CREATE INDEX IF NOT EXISTS events_occurred_idx ON events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS event_entities (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, entity_id)
);

CREATE INDEX IF NOT EXISTS event_entities_entity_idx ON event_entities (entity_id);
