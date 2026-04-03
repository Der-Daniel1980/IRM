# 🏢 IRM Backend — Technische Dokumentation

**Immobilien- & Ressourcenmanagement | NestJS Backend**
**Version:** 1.0 | **Stand:** April 2026

```
╔══════════════════════════════════════════════════════════════════════╗
║   NestJS (TypeScript strict) · Prisma ORM · PostgreSQL 16 + PostGIS ║
║   Redis / BullMQ · Keycloak · Puppeteer · OpenAPI / Swagger         ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 📐 Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                         IRM Backend                                 │
│                    NestJS (Port 3001)                               │
│                                                                     │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────────┐  │
│  │  auth   │  │customers │  │properties │  │      staff        │  │
│  │ Keycloak│  │ K-0000001│  │OBJ-0000001│  │     MA-0001       │  │
│  │  JWT    │  │          │  │ PostGIS   │  │  Fähigkeiten      │  │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘  └────────┬──────────┘  │
│       │            │              │                   │             │
│  ┌────▼────────────▼──────────────▼───────────────────▼──────────┐ │
│  │                    work-orders (2026-10000001)                 │ │
│  │         Auftragsverwaltung · Status-Workflow · History         │ │
│  └────────────────────────────┬───────────────────────────────────┘ │
│                               │                                     │
│  ┌───────────┐   ┌────────────▼──────────┐   ┌──────────────────┐  │
│  │scheduling │   │    route-sheets       │   │    formulas      │  │
│  │  Scoring  │   │  PDF via Puppeteer    │   │  JSONB Formel    │  │
│  │  PostGIS  │◄──│  2026-20000001        │   │  MathParser      │  │
│  │  BullMQ   │   └───────────────────────┘   └──────────────────┘  │
│  └───────────┘                                                      │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌───────┐  ┌─────────┐  │
│  │equipment │  │absences  │  │activity │  │  map  │  │dashboard│  │
│  │GER-0001  │  │Urlaub/   │  │  types  │  │PostGIS│  │Kennzahl.│  │
│  │          │  │Krank     │  │Katalog  │  │       │  │         │  │
│  └──────────┘  └──────────┘  └─────────┘  └───────┘  └─────────┘  │
│                                                                     │
│  ┌────────┐  ┌────────┐  ┌───────────────────────────────────────┐ │
│  │ admin  │  │ skills │  │              prisma                   │ │
│  │Keycloak│  │Katalog │  │  PrismaService · nextSequenceNumber() │ │
│  │Users   │  │        │  │  nextMasterDataNumber()               │ │
│  └────────┘  └────────┘  └───────────────────────────────────────┘ │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
          ┌────────────────────────┼───────────────────────────┐
          │                        │                           │
   ┌──────▼──────┐        ┌────────▼───────┐        ┌────────▼──────┐
   │ PostgreSQL  │        │     Redis      │        │   Keycloak    │
   │ :5432       │        │    :6379       │        │    :8080      │
   │ PostGIS 3.4 │        │  BullMQ Queues │        │  Realm: irm   │
   │ pg_trgm     │        │               │        │  JWT (RS256)  │
   └─────────────┘        └───────────────┘        └───────────────┘
```

---

## 🚀 Schnellstart

### 1️⃣ Voraussetzungen prüfen

```bash
node --version   # >= 20.x
pnpm --version   # >= 9.x
docker --version # >= 24.x
```

### 2️⃣ Umgebungsvariablen anlegen

```bash
# Im Repository-Root
cp .env.example .env
# .env anpassen (mindestens JWT_SECRET ändern für Produktion)
```

### 3️⃣ Infrastruktur starten

```bash
# Im Repository-Root
docker compose up -d

# Dienste prüfen
docker compose ps
# postgres:     healthy
# redis:        healthy
# keycloak:     healthy (dauert ~60s beim ersten Start)
# meilisearch:  healthy
```

### 4️⃣ Abhängigkeiten installieren

```bash
# Im Repository-Root
pnpm install
```

### 5️⃣ Datenbank migrieren

```bash
cd packages/backend
pnpm prisma migrate dev
pnpm prisma generate
```

### 6️⃣ Backend starten

```bash
# Entwicklungsmodus (Hot Reload)
pnpm run start:dev

# Produktionsmodus
pnpm run build
pnpm run start:prod
```

### 7️⃣ Verfügbarkeit prüfen

```
API:        http://localhost:3001/api/v1/
Swagger:    http://localhost:3001/api/docs
Health:     http://localhost:3001/health
Keycloak:   http://localhost:8080/admin  (admin / admin_change_me)
```

---

## 📦 Module & Endpunkte

| Modul             | API-Prefix                       | Beschreibung                                    | Auth-Guard        |
|-------------------|----------------------------------|-------------------------------------------------|-------------------|
| `auth`            | `/api/v1/auth`                   | Dev-Login, JWT                                  | @Public()         |
| `customers`       | `/api/v1/customers`              | Kundenverwaltung (K-0000001)                    | JWT + Roles       |
| `properties`      | `/api/v1/properties`             | Immobilien (OBJ-0000001), PostGIS-Koordinaten   | JWT + Roles       |
| `staff`           | `/api/v1/staff`                  | Personal (MA-0001), Fähigkeiten-Zuordnung       | JWT + Roles       |
| `skills`          | `/api/v1/skills`                 | Fähigkeiten-Katalog (Stammdaten)                | JWT + Roles       |
| `equipment`       | `/api/v1/equipment`              | Maschinen & KFZ (GER-0001)                      | JWT + Roles       |
| `activity-types`  | `/api/v1/activity-types`         | Tätigkeitskatalog mit Saisonalität              | JWT + Roles       |
| `work-orders`     | `/api/v1/work-orders`            | Aufträge (2026-10000001), Status-Workflow        | JWT + Roles       |
| `absences`        | `/api/v1/absences`               | Urlaub, Krankheit, Freizeitausgleich            | JWT + Roles       |
| `formulas`        | `/api/v1/formulas`               | Zeitformeln (JSONB), Berechnung, Vorschau       | JWT + Roles       |
| `scheduling`      | `/api/v1/scheduling`             | Terminvorschläge, Umplanung, Verfügbarkeit      | JWT + Roles       |
| `route-sheets`    | `/api/v1/route-sheets`           | Laufzettel (2026-20000001), PDF-Download        | JWT + Roles       |
| `map`             | `/api/v1/map`                    | Immobilien-Marker mit Status (PostGIS)          | JWT + Roles       |
| `dashboard`       | `/api/v1/dashboard`              | KPIs, offene Aufträge, Auslastung               | JWT + Roles       |
| `admin`           | `/api/v1/admin`                  | Keycloak-User-Verwaltung, Systemeinstellungen   | JWT + irm-admin   |

### Wichtige Einzelendpunkte

| Methode | Pfad                                        | Beschreibung                              |
|---------|---------------------------------------------|-------------------------------------------|
| POST    | `/api/v1/auth/dev-login`                    | Dev-JWT holen (nur APP_ENV=development)   |
| GET     | `/api/v1/work-orders/:id/previous`          | Vorgängerauftrag mit Dauer laden          |
| POST    | `/api/v1/scheduling/suggest`                | Terminvorschläge berechnen                |
| POST    | `/api/v1/scheduling/replan`                 | Umplanung bei Mitarbeiter-Ausfall         |
| GET     | `/api/v1/scheduling/availability`           | Tagesverfügbarkeit eines Mitarbeiters     |
| POST    | `/api/v1/formulas/:id/calculate`            | Formel mit Variablen berechnen            |
| GET     | `/api/v1/route-sheets/:id/pdf`              | Laufzettel als PDF (Puppeteer)            |
| GET     | `/api/v1/map/properties`                    | Alle Immobilien als GeoJSON-Marker        |
| GET     | `/api/v1/admin/users`                       | Keycloak-User-Liste (nur irm-admin)       |
| GET     | `/api/v1/admin/settings`                    | Systemeinstellungen lesen                 |

---

## 🗄️ Datenbankschema

```
┌─────────────────┐        ┌─────────────────────────────────────────┐
│    Customer      │        │               Property                  │
│─────────────────│        │─────────────────────────────────────────│
│ id (UUID)        │◄──────┤ id (UUID)                               │
│ customerNumber   │1    N │ propertyNumber  (OBJ-0000001)           │
│ (K-0000001)      │        │ customerId (FK)                         │
│ companyName      │        │ latitude / longitude (Decimal 10,7)     │
│ isInternal       │        │ geo_point (PostGIS GEOMETRY Point 4326) │
│ isActive         │        │ totalAreaSqm / greenAreaSqm             │
└─────────────────┘        │ propertyType (RESIDENTIAL|COMMERCIAL...) │
                            └──────────────────┬──────────────────────┘
                                               │ 1:N
                            ┌──────────────────▼──────────────────────┐
                            │              WorkOrder                   │
                            │─────────────────────────────────────────│
                            │ id (UUID)                                │
                            │ orderNumber (2026-10000001)              │
                            │ propertyId / customerId / activityTypeId │
                            │ status: DRAFT→PLANNED→ASSIGNED→          │
                            │         IN_PROGRESS→COMPLETED|CANCELLED  │
                            │ priority: LOW|NORMAL|HIGH|URGENT         │
                            │ plannedDate / plannedStartTime           │
                            │ plannedDurationMin / actualDurationMin   │
                            │ assignedStaff: UUID[] (Array)            │
                            │ calculationParams (JSONB)                │
                            │ previousOrderId (Self-Relation)          │
                            └──────────────────┬──────────────────────┘
                                               │
             ┌─────────────────────────────────┼──────────────────────┐
             │                                 │                      │
┌────────────▼──────────┐   ┌─────────────────▼────────────────────┐ │
│      RouteSheet        │   │           RouteSheetItem             │ │
│────────────────────────│   │──────────────────────────────────────│ │
│ sheetNumber(2026-2...) │   │ routeSheetId (FK)                    │ │
│ staffId (FK→Staff)     │   │ workOrderId (FK)                     │ │
│ date                   │   │ sortOrder                            │ │
│ status: DRAFT→ISSUED→  │   │ estimatedDurationMin                 │ │
│  IN_PROGRESS→COMPLETED │   │ completedAt / staffNotes             │ │
│ pdfPath                │   └──────────────────────────────────────┘ │
└────────────────────────┘                                            │
                                                                      │
┌──────────────────────┐    ┌──────────────────────────────────────┐  │
│       Staff           │    │            ActivityType             │  │
│──────────────────────│    │──────────────────────────────────────│  │
│ staffNumber (MA-0001) │    │ code (eindeutig)                    │  │
│ latitude / longitude  │    │ defaultDurationMin                  │  │
│ color (#3B82F6)        │    │ isRecurring / recurrenceInterval   │  │
│ userId (Keycloak UUID) │    │ seasonStart / seasonEnd (Monat 1-12)│ │
│ skills: StaffSkill[]  │    │ requiredSkills: Skill[]             │  │
│ absences: Absence[]   │    │ timeFormulas: TimeFormula[]         │  │
└──────────────────────┘    └──────────────────────────────────────┘  │
                                                                      │
┌──────────────────────┐    ┌──────────────────────────────────────┐  │
│      Equipment        │    │            TimeFormula              │  │
│──────────────────────│    │──────────────────────────────────────│  │
│ equipmentNumber       │    │ formula (JSONB): { expression: "..." }│ │
│ (GER-0001)            │    │ variables (JSONB): { label, type }  │  │
│ category: MACHINE|    │    │ defaultValues (JSONB)               │  │
│   VEHICLE|TOOL|MATERIAL│   │ resultUnit: "minutes"               │  │
│ status: AVAILABLE|    │    └──────────────────────────────────────┘  │
│   IN_USE|MAINTENANCE  │                                              │
└──────────────────────┘                                              │
                                                                      │
┌──────────────────────────────────────────────────────────────────┐  │
│                      NumberSequence                              │◄─┘
│──────────────────────────────────────────────────────────────────│
│ year (Int)  +  typeDigit (Int)  →  PK (year, typeDigit)          │
│ lastNumber (BigInt) — atomar via ON CONFLICT DO UPDATE           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentifizierung

### Keycloak + JWT (Produktion)

Der Backend-Server validiert jeden Request gegen ein Bearer-Token, das von Keycloak
ausgestellt wurde. Der öffentliche Schlüssel wird beim ersten Request von der
Keycloak JWKS-URL geladen und gecacht:

```
Keycloak JWKS:  http://localhost:8080/realms/irm/protocol/openid-connect/certs
Token-Format:   Authorization: Bearer <jwt>
Algorithmus:    RS256 (asymmetrisch, x5c-Zertifikat)
Token-Gültigkeit: 1h (konfigurierbar in Keycloak)
```

### Dev-Login (nur APP_ENV=development)

```bash
# JWT für Entwicklung holen
curl -s -X POST http://localhost:3001/api/v1/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"admin"}' \
  | jq '.access_token'

# Token für API-Requests nutzen
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"admin"}' | jq -r '.access_token')

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/customers
```

Der Dev-Login-Endpunkt ist bei `APP_ENV=production` gesperrt und gibt HTTP 403 zurück.

### Auth-Bypass im Entwicklungsmodus

Bei `APP_ENV=development` werden `JwtAuthGuard` und `RolesGuard` vollständig
umgangen. Alle Endpunkte sind ohne Token erreichbar. Dieses Verhalten ist
in `SECURITY.md` detailliert dokumentiert.

---

## ⚙️ Konfiguration (.env)

Vollständige `.env.example` liegt im Repository-Root. Wichtigste Variablen:

```bash
# ── Datenbank ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://irm:irm_secret_change_me@localhost:5432/irm_dev
POSTGRES_USER=irm
POSTGRES_PASSWORD=irm_secret_change_me    # ⚠️ In Produktion ändern!
POSTGRES_DB=irm_dev

# ── Redis / BullMQ ──────────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ── Keycloak ─────────────────────────────────────────────────────────────────
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=irm
KEYCLOAK_CLIENT_ID=irm-backend
KEYCLOAK_CLIENT_SECRET=change_me          # ⚠️ Aus Keycloak Admin kopieren

# ── Meilisearch ──────────────────────────────────────────────────────────────
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=change_me             # ⚠️ In Produktion ändern!

# ── Anwendung ────────────────────────────────────────────────────────────────
APP_PORT=3001
APP_ENV=development                       # production → aktiviert alle Sicherheitsfeatures
JWT_SECRET=change_me_to_random_string     # ⚠️ UNBEDINGT ändern: openssl rand -base64 64

# ── Scheduling-Engine ────────────────────────────────────────────────────────
WORK_DAY_START=07:00                      # Beginn Arbeitstag
WORK_DAY_END=17:00                        # Ende Arbeitstag
BUFFER_BETWEEN_ORDERS_MIN=15              # Puffer zwischen zwei Einsätzen
```

---

## 🎯 Scheduling-Engine

Die Scheduling-Engine berechnet optimale Terminvorschläge für Aufträge.
Sie befindet sich in `src/modules/scheduling/scheduling.service.ts`.

### Algorithmus (POST /api/v1/scheduling/suggest)

```
Eingabe:
  activityTypeId  → Bestimmt benötigte Fähigkeiten + Saisonalität
  propertyId      → Zielimmobilie (GPS-Koordinaten via PostGIS)
  durationMin     → Geplante Dauer in Minuten
  preferredDate   → Wunschdatum (Standard: heute)
  maxSuggestions  → Anzahl Vorschläge (Standard: 5)

Ablauf für jeden Kandidaten-Tag (max. 14 Tage ab Wunschdatum):
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. Wochenende überspringen (Sa/So)                         │
  │ 2. Saisonalitäts-Check (seasonStart/seasonEnd Monat)       │
  │ 3. Qualifizierte Mitarbeiter laden (requiredSkills-Match)   │
  │    → Ein Mitarbeiter MUSS alle erforderlichen Skills haben! │
  │ 4. Für jeden qualifizierten Mitarbeiter:                    │
  │    a) Abwesenheits-Check (APPROVED Absences)               │
  │    b) Bestehende Aufträge des Tages laden                  │
  │    c) Freie Zeitslots berechnen (Arbeitstag - Aufträge     │
  │       - Pufferzeiten)                                       │
  │    d) Entfernung berechnen (PostGIS ST_Distance):          │
  │       → von letztem Einsatz → Zielimmobilie               │
  │       → oder vom Wohnort des Mitarbeiters                 │
  │    e) Score berechnen:                                      │
  │       skillLevelBonus  × 30 Punkte (BASIC/INTER./EXPERT)   │
  │       distanceScore    × 40 Punkte (1 - km/50, max 1.0)    │
  │       dateProximity    × 30 Punkte (1 - dayOffset/14)      │
  └─────────────────────────────────────────────────────────────┘

Ausgabe:
  Vorschläge sortiert nach Score (höchster zuerst)
  Bester Vorschlag mit isRecommended=true markiert
  Grund-Label: 'Experte', 'Geringste Fahrzeit', 'Wunschtermin verfügbar', etc.
```

### Umplanung (POST /api/v1/scheduling/replan)

Ermittelt alle betroffenen Aufträge eines Mitarbeiters im angegebenen Zeitraum
(z.B. bei Krankheit) und generiert für jeden Auftrag alternative Vorschläge.
**Aufträge werden NICHT automatisch umgeplant** — der Disponent bestätigt manuell.

### Verfügbarkeitsabfrage (GET /api/v1/scheduling/availability)

Gibt für jeden Tag in einem Zeitraum zurück:
- `isAvailable`: Mitarbeiter verfügbar (keine APPROVED-Abwesenheit)
- `ordersCount`: Anzahl bereits geplanter Aufträge
- `reason`: Abwesenheitsgrund falls nicht verfügbar

---

## 📊 Nummernkreise

Alle Nummern werden **atomar** via PostgreSQL-Transaktion vergeben.
Kein Doppel-Vergabe möglich, auch bei parallelen Requests.

### Format: Transaktionsnummern

```
Format:    YYYY - T NNNNNNN
Beispiel:  2026 - 1 0000042

  YYYY  = aktuelles Jahr (4-stellig)
  T     = Typ-Ziffer (1 Stelle)
  NNNNNNN = laufende Nummer (7-stellig, führende Nullen)

Typ-Ziffern:
  T=1  → Auftrag (Work Order)        → 2026-10000001
  T=2  → Laufzettel (Route Sheet)    → 2026-20000001
  T=3  → Wartungsauftrag             → 2026-30000001
```

### Format: Stammdatennummern

```
Format:     PREFIX - NNNNNNN
Beispiele:

  K-0000001    → Kunde (Customer)      Präfix: K,   7-stellig
  OBJ-0000001  → Immobilie (Property)  Präfix: OBJ, 7-stellig
  MA-0001      → Mitarbeiter (Staff)   Präfix: MA,  4-stellig
  GER-0001     → Gerät (Equipment)     Präfix: GER, 4-stellig
```

### Datenbankschema

```
Tabelle: number_sequences
  year (Int) + type_digit (Int)  →  Primärschlüssel
  last_number (BigInt)           →  atomar inkrementiert

Tabelle: master_data_sequences
  prefix (String)                →  Primärschlüssel (z.B. "K", "OBJ")
  last_number (BigInt)           →  atomar inkrementiert
```

### Verwendung im Code

```typescript
// Auftragsnummer vergeben
const orderNumber = await this.prisma.nextSequenceNumber(1);
// → "2026-10000001"

// Kundennummer vergeben
const customerNumber = await this.prisma.nextMasterDataNumber('K', 7);
// → "K-0000001"

// Mitarbeiternummer vergeben
const staffNumber = await this.prisma.nextMasterDataNumber('MA', 4);
// → "MA-0001"
```

---

## 🧪 Tests ausführen

```bash
# Im Verzeichnis packages/backend

# Alle Unit-Tests
pnpm test

# Tests mit Coverage-Report
pnpm test:cov

# Tests im Watch-Modus (Entwicklung)
pnpm test:watch

# Spezifische Test-Suite
pnpm test -- scheduling.service.spec.ts
pnpm test -- formulas.service.spec.ts

# E2E-Tests (separates Verzeichnis)
pnpm test:e2e
```

### Testabdeckung (wichtige Dateien)

| Datei                                | Was getestet wird                            |
|--------------------------------------|----------------------------------------------|
| `scheduling.service.spec.ts`         | Score-Berechnung, Slot-Findung, Abwesenheiten|
| `formulas.service.spec.ts`           | MathParser, Formelauswertung, Variablen      |

---

## 📡 API-Dokumentation (Swagger)

```
URL:  http://localhost:3001/api/docs
JSON: http://localhost:3001/api/docs-json
```

Die Swagger-Oberfläche erlaubt das direkte Testen aller Endpunkte.

### Authentifizierung in Swagger

1. Swagger unter `http://localhost:3001/api/docs` öffnen
2. Dev-Login ausführen: `POST /api/v1/auth/dev-login`
   - email: `admin`, password: `admin`
3. Erhaltenen `access_token` kopieren
4. Oben rechts auf "Authorize" klicken
5. Token einfügen und bestätigen
6. Alle Endpunkte sind nun authentifiziert testbar

### API-Konventionen

```
Basis-URL:       /api/v1/
Paginierung:     ?page=1&limit=20  (Standard-Limit: 20, Maximum: 100)
Datumsformat:    ISO 8601          (z.B. 2026-04-15)
UUID-Format:     RFC 4122 UUID v4
Content-Type:    application/json
Fehlerformat:    { statusCode, message, error }
```

---

## 🐳 Docker-Dienste

| Service        | Image                       | Container-Name    | Port  | Zweck                              |
|----------------|-----------------------------|-------------------|-------|------------------------------------|
| postgres       | postgis/postgis:16-3.4      | irm-postgres      | 5432  | PostgreSQL + PostGIS + Erweiterungen|
| redis          | redis:7-alpine              | irm-redis         | 6379  | BullMQ-Queues, Session-Cache       |
| keycloak       | keycloak/keycloak:25.0      | irm-keycloak      | 8080  | Auth-Server, RBAC, JWT-Ausstellung |
| meilisearch    | getmeili/meilisearch:v1.8   | irm-meilisearch   | 7700  | Volltext-Suche (zukünftig)         |

### Dienste starten und stoppen

```bash
# Alle Dienste starten
docker compose up -d

# Einzelnen Dienst neu starten
docker compose restart postgres

# Logs verfolgen
docker compose logs -f keycloak
docker compose logs -f postgres

# Alle Dienste stoppen (Daten bleiben erhalten)
docker compose down

# Alles inklusive Volumes löschen (ACHTUNG: Datenverlust!)
docker compose down -v
```

### Datenbank direkt verbinden

```bash
# psql im Container
docker exec -it irm-postgres psql -U irm -d irm_dev

# Nützliche psql-Befehle
\dt             # Alle Tabellen auflisten
\d work_orders  # Schema einer Tabelle anzeigen
\q              # Beenden

# Redis CLI
docker exec -it irm-redis redis-cli
keys *          # Alle Keys (BullMQ-Queues)
```

---

## 🔧 Entwicklung

### Nützliche Befehle

```bash
# Prisma Studio (Datenbankbrowser im Browser)
pnpm prisma studio
# → http://localhost:5555

# Neue Migration erstellen
pnpm prisma migrate dev --name beschreibung-der-aenderung

# Prisma Client neu generieren (nach Schema-Änderungen)
pnpm prisma generate

# Datenbank zurücksetzen (ACHTUNG: löscht alle Daten!)
pnpm prisma migrate reset

# Prisma Schema validieren
pnpm prisma validate

# TypeScript kompilieren (ohne Start)
pnpm run build

# Linter ausführen
pnpm run lint

# Linter mit automatischer Korrektur
pnpm run lint:fix
```

### Neues Modul anlegen

Die Modul-Struktur ist standardisiert:

```
src/modules/<modul-name>/
├── <modul>.module.ts       # NestJS-Modul, Provider-Liste
├── <modul>.controller.ts   # REST-Endpunkte, nur Routing + Delegation
├── <modul>.service.ts      # Geschäftslogik (IMMER hier, nie im Controller!)
├── dto/
│   ├── create-<modul>.dto.ts
│   ├── update-<modul>.dto.ts
│   └── query-<modul>.dto.ts
└── <modul>.service.spec.ts # Unit-Tests
```

**Pflichtregeln für neue Module:**
- Geschäftslogik **nur** im Service
- Jeden Endpunkt mit `@ApiOperation()`, `@ApiResponse()` dokumentieren
- DTOs mit `class-validator` Dekoratoren absichern
- Nummernvergabe **nur** via `PrismaService.nextSequenceNumber()` oder `nextMasterDataNumber()`
- Rollen mit `@Roles()` Decorator schützen

### Debugging

```bash
# Backend mit Node.js Inspector starten
node --inspect -r ts-node/register -r tsconfig-paths/register src/main.ts

# VS Code: Launch-Konfiguration (bereits in .vscode/launch.json)
# → "Debug NestJS" auswählen und F5 drücken

# Prisma Query-Logging aktivieren (in prisma.service.ts)
# → log: [{ emit: 'event', level: 'query' }]  (bereits aktiv)

# Verbose-Logging für NestJS
LOG_LEVEL=verbose pnpm run start:dev
```

### Häufige Fehler und Lösungen

```
Fehler: "P2002 Unique constraint failed"
Lösung: Nummernkreis-Kollision oder doppelter Unique-Wert — Wert prüfen

Fehler: "Can't reach database server at localhost:5432"
Lösung: Docker-Container prüfen: docker compose ps && docker compose up postgres -d

Fehler: "Keycloak nicht erreichbar, verwende JWT_SECRET als Fallback"
Lösung: Nur in Entwicklung tolerierbar. Keycloak-Container starten.
        Im Produktionsbetrieb ist dieser Fallback ein Sicherheitsproblem!

Fehler: "ForbiddenException: Dev-Login ist nur im Entwicklungsmodus verfügbar"
Lösung: APP_ENV=development in .env setzen

Fehler: "TypeError: Cannot read properties of undefined (reading 'x5c')"
Lösung: Keycloak-Realm 'irm' noch nicht konfiguriert. realm-irm.json prüfen.

Fehler: Puppeteer/PDF-Generierung schlägt fehl
Lösung: Chromium-Abhängigkeiten installieren:
        apt-get install -y libgbm-dev libnss3 libatk-bridge2.0-0 ...
```

### Umgebungsvariablen für verschiedene Umgebungen

```bash
# Entwicklung (Standard)
APP_ENV=development     # Auth-Bypass aktiv, Dev-Login verfügbar

# Staging (wie Produktion, aber mit Testdaten)
APP_ENV=production
JWT_SECRET=<echter-secret>
KEYCLOAK_URL=https://keycloak.staging.example.com

# Produktion
APP_ENV=production
# Alle change_me Werte durch echte Secrets ersetzen!
# Siehe SECURITY.md für vollständige Checkliste
```

---

*Für Sicherheits- und Deployment-Informationen: siehe `SECURITY.md` im gleichen Verzeichnis.*
*Vollständige Systemspezifikation: `docs/IRM-KONZEPT.md` im Repository-Root.*
