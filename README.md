# IRM — Immobilien- & Ressourcenmanagement

Ein vollständiges System zur Verwaltung von Immobilien, Personal, Maschinen und Arbeitsaufträgen mit automatischer Einsatzplanung, Formel-Designer und PDF-Laufzettel-Generierung.

---

## Inhaltsverzeichnis

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architektur](#architektur)
- [Schnellstart](#schnellstart)
- [Konfiguration](#konfiguration)
- [Entwicklung](#entwicklung)
- [Tests](#tests)
- [API-Dokumentation](#api-dokumentation)
- [Ports & Services](#ports--services)

---

## Features

| Modul | Beschreibung |
|-------|-------------|
| **Immobilien** | Verwaltung von Objekten und Einheiten mit Geo-Koordinaten, Leaflet-Karte mit farbigen Status-Markern |
| **Kunden** | Kundenstamm mit Nummernkreis `K-0000001` |
| **Personal** | Mitarbeiter mit Fähigkeiten und Skill-Level (BASIC / INTERMEDIATE / EXPERT / MASTER) |
| **Maschinen & KFZ** | Gerätepool mit Verfügbarkeitsprüfung |
| **Tätigkeitskatalog** | Standardisierte Tätigkeiten mit Zeitformeln und Saisonalität |
| **Auftragserfassung** | 6-Schritt-Wizard: Immobilie → Tätigkeit → Zeitberechnung → Termin → Personal → Geräte |
| **Formel-Designer** | JSONB-Formeln mit Variablen aus Immobiliendaten, visueller Editor, manuell überschreibbar |
| **Einsatzplanung** | FullCalendar mit Drag & Drop, Abwesenheitsanzeige, automatische Umplanung bei Krankmeldung |
| **Scheduling-Engine** | Skill-Match + Verfügbarkeit + PostGIS-Entfernung + Score-System |
| **Laufzettel** | PDF-Generierung per Puppeteer mit Route, Mieter-Liste, Fahrtzeiten |
| **Abwesenheiten** | Urlaub/Krankmeldung mit Genehmigungsworkflow und Konflikt-Erkennung |
| **Berichte** | Auftragsstatistik, Mitarbeiter-Auslastung, Geräte-Übersicht |
| **Admin** | Benutzerverwaltung, Rollen-Zuweisung via Keycloak |

---

## Tech Stack

### Backend
- **NestJS 10** (TypeScript strict) — ein Modul pro Bounded Context
- **Prisma ORM** — mit PostgreSQL 16 + PostGIS 3.4
- **BullMQ** (Redis 7) — Queues für Scheduling-Berechnung und PDF-Generierung
- **Puppeteer** — PDF-Generierung für Laufzettel
- **Swagger/OpenAPI** — automatische API-Dokumentation

### Frontend
- **Next.js 14** (App Router, TypeScript)
- **shadcn/ui** + TailwindCSS — UI-Komponenten
- **TanStack Query v5** — Server State Management
- **FullCalendar** — Einsatzplanung mit Drag & Drop
- **Leaflet** + react-leaflet + OpenStreetMap — Kartenansicht (kein Google Maps)

### Infrastruktur
- **PostgreSQL 16 + PostGIS** — Geo-Abfragen mit ST_Distance
- **Redis 7** — Queue-Backend und Pub/Sub
- **Keycloak 25** — RBAC, SSO, PKCE für Frontend
- **Meilisearch v1.8** — Volltextsuche

---

## Architektur

```
IRM/
├── packages/
│   ├── backend/               # NestJS API (Port 3001)
│   │   ├── src/
│   │   │   ├── modules/       # Feature-Module
│   │   │   │   ├── auth/
│   │   │   │   ├── customers/
│   │   │   │   ├── properties/
│   │   │   │   ├── staff/
│   │   │   │   ├── equipment/
│   │   │   │   ├── activities/
│   │   │   │   ├── work-orders/
│   │   │   │   ├── scheduling/    # Scheduling-Engine
│   │   │   │   ├── route-sheets/  # PDF-Generierung
│   │   │   │   ├── absences/
│   │   │   │   ├── formulas/      # Formel-Designer + MathParser
│   │   │   │   └── reports/
│   │   │   ├── common/        # Guards, Decorators, Filter
│   │   │   └── prisma/        # PrismaService + Nummernkreise
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       └── seed.ts
│   └── frontend/              # Next.js App (Port 3002)
│       └── src/
│           ├── app/           # App Router Seiten
│           ├── components/    # UI-Komponenten
│           ├── hooks/         # React Query Hooks
│           └── lib/           # API-Client, Utilities
├── docker/
│   ├── postgres/init.sql
│   └── keycloak/realm-irm.json
├── docker-compose.yml
└── Makefile
```

### Scheduling-Engine

Der Score-Algorithmus berücksichtigt:

```
Score = skillLevel × 30 + distanceScore × 40 + dateProximity × 30
```

- **Skill-Match**: nur Mitarbeiter mit passender Fähigkeit (GROUP BY HAVING COUNT)
- **Verfügbarkeit**: Abwesenheits-Check + bestehende Aufträge
- **PostGIS-Entfernung**: ST_Distance für reale Fahrtweg-Schätzung
- **Saisonalität**: z.B. Rasenmähen nur April–Oktober
- **Pufferzeit**: 15 Minuten zwischen Aufträgen (konfigurierbar)

### Nummernkreise

Atomare Vergabe via PostgreSQL `SELECT FOR UPDATE`:

| Typ | Format | Beispiel |
|-----|--------|---------|
| Auftrag | `YYYY-1NNNNNNNN` | `2026-100000001` |
| Laufzettel | `YYYY-2NNNNNNNN` | `2026-200000001` |
| Wartungsauftrag | `YYYY-3NNNNNNNN` | `2026-300000001` |
| Kunde | `K-0000001` | |
| Immobilie | `OBJ-0000001` | |
| Mitarbeiter | `MA-0001` | |
| Gerät | `GER-0001` | |

---

## Schnellstart

### Voraussetzungen

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (läuft)
- [Node.js 20+](https://nodejs.org/)
- Freie Ports: `3001`, `3002`, `5432`, `6379`, `7700`, `8080`

### 1. Repository klonen

```bash
git clone https://github.com/Der-Daniel1980/IRM.git
cd IRM
```

### 2. Infrastruktur starten

```bash
make up
make wait-healthy
```

Alle 4 Container starten (PostgreSQL, Redis, Keycloak, Meilisearch). Keycloak benötigt ~60 Sekunden beim ersten Start.

```bash
make ps   # Status prüfen — alle sollten "healthy" sein
```

### 3. Backend konfigurieren

```bash
cat > packages/backend/.env << 'EOF'
DATABASE_URL="postgresql://irm:irm_secret_change_me@localhost:5432/irm_dev"
REDIS_HOST=localhost
REDIS_PORT=6379
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=irm
KEYCLOAK_CLIENT_ID=irm-backend
JWT_SECRET=dev-secret-change-in-prod
MEILISEARCH_HOST=http://localhost:7700
APP_PORT=3001
EOF
```

### 4. Datenbank einrichten

```bash
cd packages/backend
npm install
npx prisma migrate deploy
npx prisma db seed
```

Der Seed legt an: 8 Fähigkeiten, 10 Tätigkeitstypen, 3 Zeitformeln (Rasenmähen, Winterdienst, Reinigung).

### 5. Backend starten

```bash
npm run start:dev
```

Backend: **http://localhost:3001**  
Swagger: **http://localhost:3001/api/docs**

### 6. Frontend starten

```bash
# Neues Terminal
cd packages/frontend
npm install
npm run dev
```

Frontend: **http://localhost:3002**

### 7. Ersten Benutzer in Keycloak anlegen

1. **http://localhost:8080** → Login: `admin` / `admin_change_me`
2. Realm **`irm`** auswählen (links oben im Dropdown)
3. **Users → Add user** → Username vergeben → Save
4. Tab **Credentials** → Passwort setzen (Temporary: **Off**)
5. Tab **Role Mappings → Assign Role** → `irm-admin` zuweisen

Danach im IRM-Frontend einloggen: **http://localhost:3002**

---

## Konfiguration

### Backend `.env`

| Variable | Standard | Beschreibung |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL Connection String |
| `REDIS_HOST` | `localhost` | Redis Hostname |
| `REDIS_PORT` | `6379` | Redis Port |
| `KEYCLOAK_URL` | `http://localhost:8080` | Keycloak URL |
| `KEYCLOAK_REALM` | `irm` | Keycloak Realm Name |
| `KEYCLOAK_CLIENT_ID` | `irm-backend` | Keycloak Client |
| `JWT_SECRET` | — | Fallback JWT Secret (nur dev) |
| `MEILISEARCH_HOST` | `http://localhost:7700` | Meilisearch URL |
| `APP_PORT` | `3001` | Backend Port |
| `WORK_DAY_START` | `07:00` | Arbeitstag Beginn |
| `WORK_DAY_END` | `17:00` | Arbeitstag Ende |
| `BUFFER_BETWEEN_ORDERS_MIN` | `15` | Puffer zwischen Aufträgen (Minuten) |

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM=irm
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=irm-frontend
```

### RBAC-Rollen

| Rolle | Berechtigungen |
|-------|---------------|
| `irm-admin` | Vollzugriff, überspringt alle Rollen-Checks |
| `irm-disponent` | Einsatzplanung, Aufträge, Laufzettel |
| `irm-objektverwalter` | Immobilien, Kunden, Berichte |
| `irm-mitarbeiter` | Eigene Aufträge lesen |
| `irm-readonly` | Lesezugriff |

---

## Entwicklung

### Hilfreiche Make-Befehle

```bash
make up           # Infrastruktur starten
make down         # Infrastruktur stoppen
make restart      # Neustart
make logs         # Alle Container-Logs
make logs-db      # Nur PostgreSQL-Logs
make logs-keycloak
make db-shell     # psql-Shell
make redis-cli    # Redis CLI
make clean        # Alles löschen inkl. Volumes (Achtung: Datenverlust!)
```

### Prisma

```bash
cd packages/backend

# Schema ändern → Migration erstellen
npx prisma migrate dev --name meine_migration

# Prisma Client neu generieren
npx prisma generate

# Datenbank-Browser
npx prisma studio
```

### Backend im Watch-Mode

```bash
cd packages/backend
npm run start:dev
```

### Frontend im Dev-Mode

```bash
cd packages/frontend
npm run dev      # Port 3002
```

---

## Tests

### Backend (Jest)

```bash
cd packages/backend
npm test                    # Alle Tests
npm test -- --watch         # Watch-Mode
npm test -- --coverage      # Mit Coverage-Report
```

**Abgedeckte Module:**
- `scheduling.service.spec.ts` — 17 Tests: Slot-Finder, Score-Berechnung (EXPERT > BASIC), Skill-Filter, Saisonalität, Pufferzeit
- `formulas.service.spec.ts` — 13 Tests: MathParser (Grundrechenarten, Klammern, Variablen), Formel-Berechnung, Sicherheit (kein eval)
- `prisma.service.spec.ts` — 10 Tests: Nummernkreise, Masterdata-Nummern, Concurrency-Simulation

### Frontend (Vitest)

```bash
cd packages/frontend
npm test
```

---

## API-Dokumentation

Swagger UI ist nach dem Backend-Start erreichbar unter:

**http://localhost:3001/api/docs**

Alle Endpunkte folgen dem Schema:

```
GET    /api/v1/properties
POST   /api/v1/properties
GET    /api/v1/properties/:id
PATCH  /api/v1/properties/:id
DELETE /api/v1/properties/:id
```

Authentifizierung: Bearer Token (JWT von Keycloak).

---

## Ports & Services

| Service | URL | Zugangsdaten (Dev) |
|---------|-----|-------------------|
| **Frontend** | http://localhost:3002 | Keycloak-Benutzer |
| **Backend API** | http://localhost:3001/api/v1 | Bearer Token |
| **Swagger** | http://localhost:3001/api/docs | — |
| **Keycloak Admin** | http://localhost:8080 | `admin` / `admin_change_me` |
| **PostgreSQL** | localhost:5432 | `irm` / `irm_secret_change_me` |
| **Redis** | localhost:6379 | — |
| **Meilisearch** | http://localhost:7700 | — |

---

## Lizenz

Privates Projekt — alle Rechte vorbehalten.
