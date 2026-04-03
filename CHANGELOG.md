# Changelog

Alle wesentlichen Änderungen am IRM-Projekt werden in dieser Datei dokumentiert.
Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

---

## [0.3.0] — 2026-04-03

### Neu

#### Mobile App (React Native / Expo)
- **Android + iOS App** mit einer Codebasis (Expo SDK 52, Expo Router)
- **Server-URL Setup** — App fragt beim ersten Start nach Backend-URL, validiert via Health-Endpoint
- **Keycloak PKCE Login** — neuer Client `irm-mobile`, Tokens in SecureStore (hardware-backed)
- **Auftragsansicht** — eigene Aufträge mit Filter-Tabs (Heute/Geplant/Aktiv/Erledigt), Pull-to-refresh
- **Auftragsdetail** — Immobilie, Tätigkeit, Navigation starten, Abschlussnotizen
- **Zeiterfassung** — Live-Timer (Start/Stop) + manuelle Zeitrückmeldung
- **Foto-Upload** — Kamera + Galerie, max 5×10MB, GPS-Extraktion, Komprimierung
- **Mitarbeiter-Profil** — Tagesübersicht, Kontaktdaten, Logout, Server-URL ändern
- **Offline-Queue** — AsyncStorage Queue für Mutations, Auto-Sync bei Reconnect
- **Biometrische Auth** — Face ID / Fingerprint Unterstützung
- **EAS Build Config** — development/preview/production Profile

#### Backend: Mobile-Modul
- **10 neue API-Endpunkte** unter `/api/v1/mobile/` (me, my-orders, start/stop, time-entry, photos)
- **Staff-Auflösung** — JWT User → Staff-Profil via `Staff.userId` Verknüpfung
- **Foto-Storage** — Multer + Disk-Storage unter `./uploads/photos/{workOrderId}/`
- **Health-Endpoint** — `GET /health` für Mobile App Server-Validierung
- **`irm-mitarbeiter` Role** zu work-orders GET/complete Endpunkten hinzugefügt

#### Datenbank
- **WorkOrderPhoto** — Foto-Modell mit GPS, EXIF-Timestamp, Dateigrößen
- **TimeEntry** — Zeitrückmeldungen mit Quelle (MOBILE/WEB/MANUAL)
- **Migration** `20260403000000_add_mobile_models` mit Indizes

#### Shared Package
- **`packages/shared/`** — Gemeinsame TypeScript-Typen (WorkOrder, Staff, Auth)

#### Sicherheit (OWASP Mobile Top 10)
- Keycloak PKCE (kein Client Secret), SecureStore, Certificate Pinning
- class-validator + UUID-Dateinamen + Prisma parameterisiert
- Rate Limiting, Session-Timeout, Screenshot-Prevention

### Tests
- **14 neue Tests** für MobileService (resolveStaff, startWork, stopWork, Zeiteinträge, Fotos, Berechtigungen)
- Alle 54 Backend-Tests grün

---

## [0.2.0] — 2026-04-03

### Neu

#### Authentifizierung & Login
- **Dev-Login-Seite** (`/login`) mit Demo-Credentials (admin/admin)
- Credentials über Umgebungsvariablen konfigurierbar (`DEV_LOGIN_USER`, `DEV_LOGIN_PASSWORD`)
- JWT-Token wird in `sessionStorage` gespeichert, automatische Weiterleitung nach Login

#### Demo-Daten
- **Admin-Panel**: Demo-Daten laden & löschen über die Oberfläche
- Vollständiger Demo-Datensatz: 4 Kunden, 5 Immobilien (mit Einheiten), 5 Mitarbeiter, 7 Geräte/KFZ, 6 Aufträge
- Demo-Datensätze eindeutig markiert (Präfix `K-DEM*`, `OBJ-DEM*`, `MA-DEM*`, `GER-DEM*`) für sauberes Löschen

#### Geocoding
- **Adresse → Koordinaten** in der Immobilienverwaltung
- Nutzt OpenStreetMap Nominatim (kein API-Key erforderlich)
- Schaltfläche „Aus Adresse ermitteln" im Immobilien-Formular

#### Datenbank-Backup
- **Backup-Download** direkt aus dem Admin-Panel
- Läuft serverseitig via `pg_dump`, Download als `.sql`-Datei im Browser
- Eingaben werden sanitisiert (Command-Injection-Schutz)

#### Produktions-Deployment
- **`docker-compose.prod.yml`**: Vollständiger Produktions-Stack
  - PostgreSQL 16 + PostGIS, Redis 7, Keycloak 25, Meilisearch v1.8
  - NestJS Backend, Next.js Frontend, Nginx Reverse Proxy
  - Certbot-Service für automatische Let's Encrypt Erneuerung
- **Multi-Stage Dockerfiles** für Backend (NestJS + Puppeteer) und Frontend (Next.js Standalone)
- **Nginx** mit TLS 1.3, HSTS (2 Jahre), CSP, Security-Header-Suite
- **`setup.sh`**: Interaktiver Ersteinrichtungs-Assistent (Firmenname, Admin-Credentials, Secrets)

#### SSL-Zertifikate
- **Let's Encrypt** (Produktion): certbot-Service mit automatischer Erneuerung alle 12h
- **Self-Signed** (Entwicklung/Test): `make ssl-selfsigned` → `docker/ssl-selfsigned.sh`
  - RSA 4096, Subject Alternative Names, konfigurierbare Gültigkeitsdauer
- `docker/nginx/nginx.conf.selfsigned` als separate nginx-Konfigurationsvariante

#### Makefile
- 36 dokumentierte Targets in 7 Kategorien
- Neu: `make ssl-selfsigned`, `make ssl-letsencrypt`
- `make help` zeigt alle Targets mit Beschreibung

#### Dokumentation
- `packages/backend/README.md` mit ASCII-Architekturdiagramm, Modul-Übersicht, Quickstart
- `packages/backend/SECURITY.md` mit Auth-Flow, RBAC-Rollen, Produktions-Checkliste
- `.env.example` mit 70+ Variablen, PFLICHT/⚠️-Markierungen, 9 Sektionen

### Bugfixes

- **Mitarbeiternamen in Aufträgen**: Statt UUIDs werden jetzt farbige Initialen-Badges mit korrekten Namen angezeigt (`enrichWithStaff()`-Methode im Backend)
- **Mitarbeiterauswahl in Laufzettel-Erstellung**: API-Limit von 100 eingehalten (war 200 → Fehler)
- **FullCalendar Build-Fehler**: Fehlendes Paket `@fullcalendar/resource` ergänzt
- **`property.units` undefined**: Eigenschafts-Detailseite nutzt jetzt `usePropertyUnits(id)`-Hook statt `property.units`
- **`next.config.ts` → `next.config.mjs`**: Next.js 14 unterstützt `.ts` nicht als Config-Datei
- **Prisma-Migration**: `CREATE TYPE IF NOT EXISTS` ist in PostgreSQL ungültig — `IF NOT EXISTS` entfernt
- **Seed-Daten**: Ungültige UUID-Strings (`seed-formula-rasen`) durch korrekte UUIDs ersetzt
- **RolesGuard 403 im Dev-Modus**: Guard gibt in `APP_ENV=development` immer `true` zurück (mit Logger-Warnung)

### Sicherheit

- **Helmet**: HTTP-Security-Header für alle API-Responses
- **Rate Limiting**: `@nestjs/throttler` — 20 Requests/Minute global, 5/Minute für Login
- **Backup-Endpoint**: Von `@Public()` auf `@Roles('irm-admin')` umgestellt
- **Demo-Seed-Endpoints**: Von `@Public()` auf `@Roles('irm-admin')` umgestellt
- **CORS**: Warnung bei fehlendem `CORS_ORIGIN` in Nicht-Dev-Umgebungen
- **SSL-Zertifikate**: Werden nicht mehr ins Repository committed (`.gitignore`)

---

## [0.1.0] — 2026-03-30

### Initiales Release

- **Phasen 0–5** vollständig implementiert
- NestJS Backend mit Prisma ORM + PostGIS
- Next.js Frontend (App Router) mit shadcn/ui + TailwindCSS
- Module: Immobilien, Kunden, Personal, Geräte, Tätigkeiten, Aufträge, Laufzettel, Kalender, Karte, Dashboard, Admin, Berichte, Abwesenheit, Formeln, Nummernkreise
- Scheduling-Engine (BullMQ): Fähigkeiten, Verfügbarkeit, Entfernung (PostGIS), Pufferzeiten
- PDF-Generierung (Puppeteer) für Laufzettel
- RBAC mit JWT (Dev-Bypass) + Keycloak-Vorbereitung für Produktion
- Docker Compose für lokale Entwicklung
- Jest (Backend) + Vitest (Frontend) Tests
- Conventional Commits, GitHub Remote

---

[0.2.0]: https://github.com/Der-Daniel1980/IRM/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Der-Daniel1980/IRM/releases/tag/v0.1.0
