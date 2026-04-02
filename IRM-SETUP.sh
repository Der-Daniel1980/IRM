#!/bin/bash
# ═══════════════════════════════════════════════════════════
# IRM Setup — Direkt auf dem Rechner 192.168.0.25 ausführen
# Voraussetzung: IRM-KONZEPT.md liegt in /claude/IRM/docs/
# ═══════════════════════════════════════════════════════════

# ─── SCHRITT 1: Prüfen ob die Datei da ist ───
echo "=== Prüfe ob IRM-KONZEPT.md vorhanden ist ==="
if [ -f /claude/IRM/docs/IRM-KONZEPT.md ]; then
    echo "✅ IRM-KONZEPT.md gefunden!"
else
    echo "❌ /claude/IRM/docs/IRM-KONZEPT.md FEHLT!"
    echo "   Bitte zuerst über Nextcloud dorthin kopieren."
    echo "   Falls Verzeichnis fehlt: sudo mkdir -p /claude/IRM/docs && sudo chown -R daniel:daniel /claude"
    exit 1
fi

# ─── SCHRITT 2: Verzeichnisstruktur ───
echo ""
echo "=== Verzeichnisstruktur anlegen ==="
cd /claude/IRM
mkdir -p .claude/agents packages/backend packages/frontend packages/shared prisma
echo "✅ Verzeichnisse erstellt"

# ─── SCHRITT 3: Git initialisieren ───
echo ""
echo "=== Git Repository ==="
cd /claude/IRM
git init
git config user.name "Der-Daniel1980"
git config user.email "daniel.huflejt@gmail.com"
echo "✅ Git initialisiert"

# ─── SCHRITT 4: CLAUDE.md ───
echo ""
echo "=== CLAUDE.md erstellen ==="
cat > /claude/IRM/CLAUDE.md << 'CLAUDE_EOF'
# IRM — Immobilien- & Ressourcenmanagement

## Konzeptdokument (IMMER zuerst lesen!)
- `docs/IRM-KONZEPT.md` — Vollständige Spezifikation

## Tech Stack
- **Backend:** NestJS (TypeScript strict), Prisma ORM, PostgreSQL 16+ mit PostGIS
- **Frontend:** Next.js (App Router), React, shadcn/ui, TailwindCSS, Lucide Icons
- **Karte:** Leaflet + react-leaflet + OpenStreetMap (KEIN Google Maps!)
- **Kalender:** FullCalendar (@fullcalendar/react)
- **Auth:** Keycloak (RBAC, SSO)
- **Queue:** BullMQ (Redis) für Scheduling-Berechnung, PDF-Generierung
- **PDF:** Puppeteer für Laufzettel
- **Container:** Docker Compose

## Sprachkonventionen
- **Code:** Englisch
- **UI-Labels:** Deutsch
- **API:** Englisch RESTful (`/api/v1/properties`, `/api/v1/work-orders`)

## Architektur-Regeln
- Ein NestJS-Modul pro Bounded Context
- Jedes Modul: module.ts, controller.ts, service.ts, dto/, entities/
- DTOs mit class-validator
- Events über Redis Pub/Sub
- Geschäftslogik in Services, NIEMALS in Controllern
- OpenAPI/Swagger an jedem Endpunkt

## Navigation-Icons (Lucide React)
Dashboard=LayoutDashboard, Immobilien=Building2, Kunden=Users,
Personal=UserCog, Maschinen=Truck, Tätigkeiten=ClipboardList,
Aufträge=FileText, Einsatzplanung=CalendarClock, Karte=MapPin,
Laufzettel=Route, Abwesenheit=CalendarOff, Formeln=Calculator,
Berichte=BarChart3, Admin=Settings, Benutzer=UserPlus, Rollen=Shield

## Nummernkreise
Format: YYYY-TNNNNNNNN
- T=1: Auftrag (Work Order)
- T=2: Laufzettel (Route Sheet)
- T=3: Wartungsauftrag
Stammdaten: K-0000001 (Kunde), OBJ-0000001 (Immobilie), MA-0001, GER-0001
Atomare Vergabe via PostgreSQL SELECT FOR UPDATE!

## Scheduling-Engine
Berücksichtigt: Fähigkeiten, Verfügbarkeit (Urlaub/Krank), Geräte-Verfügbarkeit,
Entfernung (PostGIS), Arbeitszeiten, Pufferzeiten, Saisonalität.
Ein Mitarbeiter KANN NUR Aufträge bekommen für die er die Fähigkeiten hat!

## Formel-Designer
Formeln als JSONB, Variablen aus Immobiliendaten automatisch befüllt.
Berechnete Werte sind IMMER manuell überschreibbar vor Auftragsfreigabe.
Letzte Dauer aus Vorgängerauftrag anzeigen + Übernahme-Button.

## Karte
Leaflet + OpenStreetMap. PostGIS für Geo-Queries. KEIN Google Maps API-Key.
Immobilien als farbige Marker (grün=ok, orange=offen, rot=überfällig).

## Testing
- Jest (Backend), Vitest (Frontend), Playwright (E2E)
- Scheduling-Engine: Tests mit verschiedenen Szenarien!

## Git
Conventional Commits: feat(module): description
Remote: https://github.com/Der-Daniel1980/IRM.git
CLAUDE_EOF
echo "✅ CLAUDE.md erstellt"

# ─── SCHRITT 5: Subagent-Definitionen ───
echo ""
echo "=== Subagents erstellen ==="

cat > /claude/IRM/.claude/agents/architect.md << 'EOF'
---
name: architect
description: DB-Schema, API-Design, Scheduling-Algorithmus, PostGIS-Queries
model: claude-opus-4-6
tools: Read, Write, Edit, Bash, Glob, Grep
---
Du bist der Architect für das IRM-System (Immobilien- & Ressourcenmanagement).
Lies IMMER zuerst docs/IRM-KONZEPT.md.
Zuständig für: Prisma-Schema (inkl. PostGIS), API-Design, Scheduling-Engine-Algorithmus, Formel-Designer-Logik.
Alle Tabellen: id UUID, created_at, updated_at.
PostGIS: geo_point GEOMETRY(Point,4326) für Entfernungsberechnung.
EOF

cat > /claude/IRM/.claude/agents/backend-dev.md << 'EOF'
---
name: backend-dev
description: NestJS Module, Services, Controller, Prisma Queries
model: claude-sonnet-4-6
tools: Read, Write, Edit, Bash, Glob, Grep
---
Backend-Entwickler für NestJS-basiertes IRM.
TypeScript strict. OpenAPI-Dekoratoren. Business-Logik nur in Services.
Nummernvergabe NUR über NumberSequenceService.
Scheduling nur über SchedulingService.
EOF

cat > /claude/IRM/.claude/agents/frontend-dev.md << 'EOF'
---
name: frontend-dev
description: React/Next.js Seiten, Leaflet-Karte, FullCalendar, shadcn/ui
model: claude-sonnet-4-6
tools: Read, Write, Edit, Bash, Glob, Grep
---
Frontend-Entwickler für Next.js-basiertes IRM.
UI-Labels auf Deutsch. Lucide-Icons gemäß Navigation-Tabelle in CLAUDE.md.
Leaflet für Karte (react-leaflet), FullCalendar für Kalender.
shadcn/ui + TailwindCSS. React Query für Data Fetching.
Responsive: Desktop-first, aber mobile-fähig (Mitarbeiter im Feld!).
EOF

cat > /claude/IRM/.claude/agents/scheduling-engine.md << 'EOF'
---
name: scheduling-engine
description: Terminvorschlag-Algorithmus, Constraint-Matching, Routenoptimierung
model: claude-opus-4-6
tools: Read, Write, Edit, Bash, Glob, Grep
---
Du bist der Scheduling-Engine-Spezialist.
Dein Algorithmus MUSS berücksichtigen:
1. Fähigkeiten-Match (staff_skill vs activity_type.required_skills)
2. Verfügbarkeit (keine Überschneidung, Abwesenheiten prüfen)
3. Geräte-Verfügbarkeit (status = AVAILABLE, nicht anderweitig gebucht)
4. Entfernung (PostGIS ST_Distance zwischen Einsatzorten)
5. Arbeitszeiten (konfigurierbar, Default 07:00-17:00)
6. Pufferzeit (konfigurierbar, Default 15 min)
7. Saisonalität (activity_type.season_start/end)
Vorschläge nach Score sortiert (Gewichtung: Fähigkeits-Level > Entfernung > Verfügbarkeit).
EOF

cat > /claude/IRM/.claude/agents/test-engineer.md << 'EOF'
---
name: test-engineer
description: Unit-Tests, Integrationstests, E2E-Tests
model: claude-sonnet-4-6
tools: Read, Write, Edit, Bash, Glob, Grep
---
Test-Engineer für IRM.
Fokus: Scheduling-Engine (verschiedene Szenarien!), Formel-Berechnung,
Nummernkreise (Concurrency), Abwesenheits-Auswirkung auf Planung.
EOF

cat > /claude/IRM/.claude/agents/database-dev.md << 'EOF'
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
EOF
echo "✅ 6 Subagents erstellt"

# ─── SCHRITT 6: .env ───
echo ""
echo "=== .env erstellen ==="
cat > /claude/IRM/.env.example << 'EOF'
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=irm
POSTGRES_PASSWORD=irm_secret_change_me
POSTGRES_DB=irm_dev
DATABASE_URL=postgresql://irm:irm_secret_change_me@localhost:5432/irm_dev
REDIS_HOST=localhost
REDIS_PORT=6379
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=irm
KEYCLOAK_CLIENT_ID=irm-backend
KEYCLOAK_CLIENT_SECRET=change_me
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=admin_change_me
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=change_me
APP_PORT=3001
APP_ENV=development
JWT_SECRET=change_me_to_random_string
WORK_DAY_START=07:00
WORK_DAY_END=17:00
BUFFER_BETWEEN_ORDERS_MIN=15
EOF
cp /claude/IRM/.env.example /claude/IRM/.env
echo "✅ .env erstellt"

# ─── SCHRITT 7: .gitignore ───
cat > /claude/IRM/.gitignore << 'EOF'
node_modules/
dist/
.next/
.env
.DS_Store
coverage/
.turbo/
*.docx
EOF
echo "✅ .gitignore erstellt"

# ─── SCHRITT 8: Erster Commit + Push zu GitHub ───
echo ""
echo "=== Git Commit + Push ==="
cd /claude/IRM
git add -A
git commit -m "chore: initial IRM project with concept, agents, and config"
git branch -M main
git remote add origin https://github.com/Der-Daniel1980/IRM.git
git push -u origin main

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ FERTIG! Jetzt Claude Code starten:"
echo ""
echo "  cd /claude/IRM"
echo "  claude --dangerously-skip-permissions"
echo ""
echo "  Dann diesen Startbefehl einfügen (nächste Datei)"
echo "═══════════════════════════════════════════════"
