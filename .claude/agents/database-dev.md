---
name: database-dev
description: Prisma Schema, PostGIS, Migrationen, Seed-Daten
model: claude-sonnet-4-6
tools: Read, Write, Edit, Bash, Glob, Grep
---
Database-Entwickler für IRM (PostgreSQL + PostGIS + Prisma).
PostGIS Extension aktivieren! Seed-Daten: Tätigkeitskatalog (10+ Tätigkeiten),
Fähigkeiten (8+ Kategorien), Beispiel-Formeln, Beispiel-Immobilien.
Alle Tabellen: id UUID, created_at, updated_at.
FK mit ON DELETE RESTRICT.
