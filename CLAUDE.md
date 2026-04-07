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

## Mobile App (React Native / Expo)
- **Verzeichnis:** `packages/mobile/`
- **Tech:** Expo SDK 52, Expo Router, React Native Paper, TanStack Query
- **Auth:** Keycloak PKCE via expo-auth-session, Tokens in expo-secure-store
- **Keycloak Client:** `irm-mobile` (public, PKCE S256)
- **Backend-Modul:** `packages/backend/src/modules/mobile/` — 10 Endpunkte unter `/api/v1/mobile/`
- **Kernfunktion:** Staff-Auflösung via `Staff.userId` → `JwtPayload.sub`
- **Foto-Upload:** Multer + Disk-Storage unter `./uploads/photos/`
- **DB-Models:** `WorkOrderPhoto`, `TimeEntry` (Prisma)
- **Offline:** Queue in AsyncStorage, Auto-Sync bei Reconnect

## Deployment
- **Install-Script:** `install.sh` — vollautomatische Installation auf leerem Ubuntu-Server
- **Update-Script:** `update.sh` — Update/Neustart (`--force`, `--clean`)
- **Portainer-Stack:** `docker-compose.portainer.yml` (Self-Signed SSL, lokales Netzwerk)
- **Nginx-Config:** `docker/nginx/nginx.local.conf` (Reverse-Proxy mit Keycloak unter `/auth/`)
- **SSL-Init:** `docker/nginx/init-ssl.sh` (automatische Zertifikat-Generierung)
- **Env-Referenz:** `.env.portainer.example`
- **Installationsverzeichnis:** `/opt/irm/`
- **Doku:** `docs/IRM-KONZEPT.md` Kapitel 9

## Testing
- Jest (Backend), Vitest (Frontend), Playwright (E2E)
- Scheduling-Engine: Tests mit verschiedenen Szenarien!
- Mobile Backend: 14 Tests für MobileService (resolveStaff, startWork, stopWork, etc.)

## Git
Conventional Commits: feat(module): description
Remote: https://github.com/Der-Daniel1980/IRM.git
