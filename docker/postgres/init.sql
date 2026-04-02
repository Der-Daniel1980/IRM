-- IRM PostgreSQL Initialization Script
-- Enables required extensions for PostGIS spatial queries

-- PostGIS: Geometrie-Typen und räumliche Funktionen
CREATE EXTENSION IF NOT EXISTS postgis;

-- PostGIS Topology (optional, für komplexere Geo-Operationen)
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- UUID Generation (für Prisma UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm: Trigram-Indizes für Volltextsuche (schnelle ILIKE-Queries)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- btree_gist: Für Überschneidungs-Checks bei Zeiträumen (Abwesenheiten, Aufträge)
CREATE EXTENSION IF NOT EXISTS btree_gist;
