# 🔐 IRM — Security Guide

**Version:** 1.0 | **Stand:** April 2026 | **Klassifizierung:** INTERN

```
╔══════════════════════════════════════════════════════════════════╗
║  DIESES DOKUMENT BESCHREIBT SICHERHEITSRELEVANTE KONFIGURATION  ║
║  UND BEKANNTE DEV-BYPASSES — NIEMALS IN PRODUKTION IGNORIEREN!  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## ⚠️ Sicherheitsübersicht

| Komponente            | Mechanismus                        | Status (Dev)       | Status (Prod)      |
|-----------------------|------------------------------------|--------------------|--------------------|
| Authentifizierung     | Keycloak JWT / Bearer Token        | ⚡ Bypass aktiv    | ✅ Pflicht         |
| Autorisierung (RBAC)  | RolesGuard + Keycloak Realm Roles  | ⚡ Bypass aktiv    | ✅ Pflicht         |
| Security-Headers      | Helmet (CSP, HSTS, etc.)           | ✅ Aktiv           | ✅ Aktiv           |
| Input-Validierung     | class-validator + Whitelist        | ✅ Aktiv           | ✅ Aktiv           |
| CORS                  | Explizite Origin-Whitelist         | ⚠️ localhost:3002  | ✅ Konfigurieren   |
| Datenbankzugriff      | Prisma ORM (parametrisiert)        | ✅ Aktiv           | ✅ Aktiv           |
| Nummernvergabe        | PostgreSQL SELECT FOR UPDATE       | ✅ Atomar          | ✅ Atomar          |
| Dev-Login Endpoint    | POST /api/v1/auth/dev-login        | ⚡ Verfügbar       | ❌ Gesperrt        |
| JWT-Secret (Fallback) | change_me_to_random_string         | ⚠️ Unsicher        | ❌ MUSS geändert   |

---

## 🛡️ Authentifizierung & Autorisierung

### Architektur: JWT + Keycloak

```
┌─────────────────────────────────────────────────────────────────┐
│                      Anfrage-Fluss (Produktion)                 │
│                                                                 │
│  Browser/Client                                                 │
│      │                                                          │
│      │  1. Login → Keycloak :8080                              │
│      │  ◄── JWT (RS256, 1h TTL)                                │
│      │                                                          │
│      │  2. API-Request + Authorization: Bearer <jwt>           │
│      ▼                                                          │
│  NestJS Backend :3001                                           │
│      │                                                          │
│      │  3. JwtAuthGuard.canActivate()                          │
│      │     → KeycloakJwtStrategy.getPublicKey()                │
│      │     → GET :8080/realms/irm/protocol/openid-connect/certs│
│      │     → Signaturprüfung (x5c-Zertifikat)                  │
│      │                                                          │
│      │  4. RolesGuard.canActivate()                            │
│      │     → payload.realm_access.roles prüfen                 │
│      │     → @Roles() Decorator am Endpunkt                    │
│      ▼                                                          │
│  Controller / Service                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Globale Guards (app.module.ts)

Beide Guards sind **global registriert** — jeder Endpunkt ist standardmäßig geschützt:

```
APP_GUARD → JwtAuthGuard  (Authentifizierung)
APP_GUARD → RolesGuard    (Autorisierung/RBAC)
```

Ausnahmen werden explizit mit dem `@Public()` Decorator markiert.

### Keycloak Public Key Caching

Der `KeycloakJwtStrategy` lädt den öffentlichen Schlüssel (x5c-Zertifikat) beim ersten
Request aus Keycloak und **cached ihn im Arbeitsspeicher**. Bei Neustart des Backends
wird der Schlüssel erneut geladen.

**Fallback-Verhalten:** Ist Keycloak beim Start nicht erreichbar, fällt die Strategie
auf den `JWT_SECRET` aus `.env` zurück. Dies ist nur für die Entwicklung tolerierbar.

---

## 🔑 Rollen-Übersicht

| Rolle                  | Beschreibung                                             | Zugriff                              |
|------------------------|----------------------------------------------------------|--------------------------------------|
| `irm-admin`            | Vollzugriff auf alle Endpunkte und Admin-Funktionen      | Alle Endpunkte inkl. `/admin/*`      |
| `irm-disponent`        | Einsatzplanung, Aufträge erstellen/bearbeiten, Laufzettel| Keine Admin-Verwaltung               |
| `irm-objektverwalter`  | Immobilien- und Kundendaten lesen und bearbeiten         | Kein Scheduling, kein Admin          |
| `irm-mitarbeiter`      | Eigene Aufträge und Laufzettel lesen                     | Eingeschränkter Lesezugriff          |
| `irm-readonly`         | Reiner Lesezugriff auf alle Stammdaten                   | Nur GET-Endpunkte                    |

**Wichtig:** `irm-admin` hat immer Vollzugriff — die RolesGuard prüft diese Rolle zuerst.

```typescript
// Aus roles.guard.ts:
if (userRoles.includes('irm-admin')) return true;
```

Rollen werden aus dem Keycloak JWT-Claim gelesen:
- Primär: `payload.realm_access.roles`
- Fallback: `payload.roles`

---

## 🚨 Bekannte Dev-Only Features (NIE in Production!)

```
╔══════════════════════════════════════════════════════════════════════╗
║  ⚠️  FOLGENDE FEATURES SIND AUSSCHLIESSLICH FÜR DIE ENTWICKLUNG!   ║
║      Sie sind bei APP_ENV=development aktiv und umgehen Security.   ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 1. Auth-Bypass im JwtAuthGuard

```
Datei:    src/common/guards/jwt-auth.guard.ts
Zeile:    if (process.env.APP_ENV === 'development') return true;
Effekt:   Jede Anfrage wird akzeptiert — kein JWT notwendig
```

### 2. Rollen-Bypass im RolesGuard

```
Datei:    src/common/guards/roles.guard.ts
Zeile:    if (process.env.APP_ENV === 'development') return true;
Effekt:   Alle Rollen-Prüfungen werden übersprungen
```

### 3. Dev-Login Endpunkt

```
Endpunkt: POST /api/v1/auth/dev-login
Datei:    src/modules/auth/auth.service.ts
Zugangsdaten (hartcodiert):
  email:    admin
  password: admin
Token-Gültigkeit: 24 Stunden (statt 1h in Produktion)
Effekt:   Gibt JWT ohne Keycloak aus
```

### 4. CORS für localhost

```
In main.ts: origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3002']
Effekt:     Ohne CORS_ORIGIN in .env ist localhost:3002 immer erlaubt
```

### 5. Keycloak-Fallback auf JWT_SECRET

```
Wenn Keycloak nicht erreichbar ist, wird JWT_SECRET als Signaturschlüssel
genutzt. Standardwert: 'change_me_to_random_string' — kryptographisch unsicher!
```

---

## 🔒 Kritische Konfiguration für Production

### Pflicht-Checkliste vor Go-Live

```
✅  APP_ENV auf 'production' setzen (deaktiviert alle Dev-Bypasses)
✅  JWT_SECRET durch kryptographisch sicheren Zufallsstring ersetzen
     → openssl rand -base64 64
✅  POSTGRES_PASSWORD ändern (Standard: irm_secret_change_me)
✅  KEYCLOAK_ADMIN_PASSWORD ändern (Standard: admin_change_me)
✅  KEYCLOAK_CLIENT_SECRET setzen (kein Standardwert)
✅  MEILISEARCH_API_KEY setzen (Standard: change_me)
✅  CORS_ORIGIN explizit auf die Produktions-Domain setzen
     Beispiel: CORS_ORIGIN=https://irm.example.com
✅  Keycloak Realm 'irm' konfiguriert und erreichbar
✅  TLS/HTTPS vor dem Backend (Reverse Proxy: Nginx, Caddy, Traefik)
✅  PostgreSQL nicht öffentlich erreichbar (nur internes Netz)
✅  Redis nicht öffentlich erreichbar (nur internes Netz)
✅  Meilisearch nicht öffentlich erreichbar (nur internes Netz)
✅  Keycloak hinter Reverse Proxy mit HTTPS
✅  Docker-Netzwerk 'irm-network' isoliert (kein öffentlicher Zugang)
❌  Dev-Login Endpunkt testen (ist in production automatisch gesperrt)
```

---

## 🔑 Secrets & Umgebungsvariablen

| Variable                   | Pflicht   | Typ               | Standard (Dev)                | Hinweis                              |
|----------------------------|-----------|-------------------|-------------------------------|--------------------------------------|
| `DATABASE_URL`             | Pflicht   | Connection String | postgresql://irm:...@localhost| Vollständige Prisma-URL              |
| `JWT_SECRET`               | Pflicht   | String            | change_me_to_random_string    | ⚠️ In Produktion UNBEDINGT ändern   |
| `APP_ENV`                  | Pflicht   | Enum              | development                   | `production` deaktiviert Dev-Features|
| `APP_PORT`                 | Optional  | Integer           | 3001                          | Backend-Port                         |
| `POSTGRES_PASSWORD`        | Pflicht   | String            | irm_secret_change_me          | ⚠️ In Produktion ändern             |
| `POSTGRES_USER`            | Optional  | String            | irm                           | PostgreSQL-Datenbankbenutzer         |
| `POSTGRES_DB`              | Optional  | String            | irm_dev                       | Datenbankname                        |
| `REDIS_HOST`               | Optional  | Hostname          | localhost                     | BullMQ-Queue Host                    |
| `REDIS_PORT`               | Optional  | Integer           | 6379                          | BullMQ-Queue Port                    |
| `KEYCLOAK_URL`             | Pflicht*  | URL               | http://localhost:8080         | *In Produktion: HTTPS!               |
| `KEYCLOAK_REALM`           | Optional  | String            | irm                           | Keycloak-Realm-Name                  |
| `KEYCLOAK_CLIENT_ID`       | Optional  | String            | irm-backend                   | Keycloak-Client-ID                   |
| `KEYCLOAK_CLIENT_SECRET`   | Pflicht   | String            | change_me                     | ⚠️ Generieren in Keycloak Admin     |
| `KEYCLOAK_ADMIN_USER`      | Optional  | String            | admin                         | Keycloak-Admin (nur für Setup)       |
| `KEYCLOAK_ADMIN_PASSWORD`  | Pflicht   | String            | admin_change_me               | ⚠️ In Produktion ändern             |
| `MEILISEARCH_HOST`         | Optional  | URL               | http://localhost:7700         | Volltext-Suche Host                  |
| `MEILISEARCH_API_KEY`      | Pflicht   | String            | change_me                     | ⚠️ In Produktion sicheres Secret    |
| `CORS_ORIGIN`              | Empfohlen | String (komma-sep)| (nicht gesetzt)               | In Produktion: Domain(s) setzen      |
| `WORK_DAY_START`           | Optional  | Zeit (HH:MM)      | 07:00                         | Beginn Arbeitstag für Scheduling     |
| `WORK_DAY_END`             | Optional  | Zeit (HH:MM)      | 17:00                         | Ende Arbeitstag für Scheduling       |
| `BUFFER_BETWEEN_ORDERS_MIN`| Optional  | Integer           | 15                            | Pufferzeit zwischen Einsätzen (Min.) |

---

## 🛡️ Security-Headers (Helmet)

Helmet ist global in `main.ts` aktiviert (`app.use(helmet())`).
Folgende HTTP-Security-Headers werden dadurch gesetzt:

```
Content-Security-Policy       → Schränkt erlaubte Ressourcen-Quellen ein
X-DNS-Prefetch-Control        → off  (verhindert DNS-Prefetching)
X-Frame-Options               → SAMEORIGIN  (verhindert Clickjacking)
X-Content-Type-Options        → nosniff  (verhindert MIME-Sniffing)
Strict-Transport-Security     → max-age=15552000 (HTTPS erzwingen)
X-Download-Options            → noopen
X-XSS-Protection              → 0 (modern: auf CSP verlassen)
Referrer-Policy               → no-referrer
Permissions-Policy            → (kamera, mikrofon etc. deaktiviert)
Cross-Origin-Embedder-Policy  → require-corp
Cross-Origin-Opener-Policy    → same-origin
Cross-Origin-Resource-Policy  → same-origin
```

**Hinweis für Produktion:** Falls Leaflet-Kartenkacheln (OpenStreetMap) geblockt werden,
muss die CSP-Policy angepasst werden:

```
img-src: 'self' data: https://*.tile.openstreetmap.org
connect-src: 'self' https://*.tile.openstreetmap.org
```

---

## ⏱️ Rate-Limiting

Aktuell ist kein zentrales Rate-Limiting implementiert. Für die Produktion wird empfohlen:

**Empfohlene Konfiguration (Nginx Reverse Proxy):**

```nginx
# Allgemeines API Rate-Limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

# Strengeres Limit für Auth-Endpunkte
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;

server {
    location /api/v1/auth/ {
        limit_req zone=auth burst=5 nodelay;
    }
    location /api/v1/ {
        limit_req zone=api burst=20 nodelay;
    }
}
```

**Endpunkte mit erhöhtem Schutzbedarf:**

| Endpunkt                      | Empfohlenes Limit | Grund                          |
|-------------------------------|-------------------|--------------------------------|
| `POST /api/v1/auth/dev-login` | 10/min pro IP     | Brute-Force-Schutz (Dev only!) |
| `POST /api/v1/scheduling/suggest` | 30/min pro User | Rechenintensiv             |
| `POST /api/v1/scheduling/replan`  | 20/min pro User | Rechenintensiv             |
| `GET  /api/v1/route-sheets/:id/pdf` | 10/min pro User | Puppeteer, CPU-intensiv  |

---

## 🗄️ Datenbank-Sicherheit

### Prisma ORM — SQL Injection Schutz

Alle Datenbankzugriffe erfolgen über Prisma ORM mit parametrisierten Queries.
Raw-SQL-Queries (`$queryRaw`) werden ausschließlich für die atomare Nummernvergabe
in `PrismaService` eingesetzt und verwenden Template-Literals mit automatischer
Parameterisierung.

```
Kein eval(), kein String-Concatenation in SQL!
Prisma-Template-Literal $queryRaw`` ist sicher gegen SQL-Injection.
```

### Nummernvergabe (atomare Sequenzen)

Die Nummernvergabe erfolgt via `SELECT FOR UPDATE` in einer PostgreSQL-Transaktion:

```
INSERT INTO number_sequences (year, type_digit, last_number)
VALUES ($year, $typeDigit, 1)
ON CONFLICT (year, type_digit)
DO UPDATE SET last_number = number_sequences.last_number + 1
RETURNING last_number AS next_val
```

Kein Race-Condition-Risiko, keine Lücken bei parallelen Requests.

### Datenbank-Backup

```bash
# Backup erstellen (täglich empfohlen)
pg_dump -h localhost -U irm -d irm_dev -Fc -f irm_backup_$(date +%Y%m%d).dump

# Backup wiederherstellen
pg_restore -h localhost -U irm -d irm_dev irm_backup_20260401.dump

# Docker-Container Backup
docker exec irm-postgres pg_dump -U irm irm_dev | gzip > backup.sql.gz
```

### PostgreSQL Extensions

```
postgis        → Geodaten (PostGIS Geometry, ST_Distance)
uuid-ossp      → UUID-Generierung (uuid_generate_v4)
pg_trgm        → Trigram-Suche (LIKE-Beschleunigung)
btree_gist     → GiST-Index für Ranges (Abwesenheitszeiträume)
```

---

## 📋 Security-Checkliste vor Production-Deployment

```
[ ] APP_ENV=production in .env gesetzt
[ ] JWT_SECRET geändert → openssl rand -base64 64
[ ] POSTGRES_PASSWORD geändert (mind. 32 Zeichen, Sonderzeichen)
[ ] KEYCLOAK_ADMIN_PASSWORD geändert
[ ] KEYCLOAK_CLIENT_SECRET in Keycloak generiert und eingetragen
[ ] MEILISEARCH_API_KEY geändert
[ ] CORS_ORIGIN auf Produktions-Domain(s) gesetzt
[ ] TLS-Zertifikat für Reverse Proxy eingerichtet (Let's Encrypt)
[ ] Keycloak Realm 'irm' konfiguriert:
    [ ] Rollen irm-admin, irm-disponent, irm-objektverwalter,
        irm-mitarbeiter, irm-readonly angelegt
    [ ] Mindestens ein Admin-User angelegt
    [ ] Client 'irm-backend' konfiguriert (Confidential, nicht Public)
    [ ] Token-Gültigkeitsdauer auf 1h begrenzt
[ ] PostgreSQL nicht über öffentliche IP erreichbar
[ ] Redis nicht über öffentliche IP erreichbar
[ ] Meilisearch nicht über öffentliche IP erreichbar
[ ] Docker-Netzwerk 'irm-network' isoliert
[ ] Logging-System eingerichtet (kein Speichern von Passwörtern in Logs)
[ ] Backup-Strategie für PostgreSQL definiert und getestet
[ ] Monitoring für Keycloak, PostgreSQL, Redis eingerichtet
[ ] Firewall-Regeln geprüft (nur Port 80/443 öffentlich)
[ ] Dev-Login Endpunkt getestet: muss HTTP 403 zurückgeben
```

---

## 🆘 Security-Incident Response

### Bei Verdacht auf kompromittierten JWT-Secret

```
1. JWT_SECRET in .env sofort ändern
2. Backend neu starten → alle laufenden Sessions werden ungültig
3. Keycloak: alle aktiven Sessions beenden (Admin Console)
4. Logs prüfen auf unberechtigte Zugriffe
5. Passwörter aller Admin-User in Keycloak zurücksetzen
```

### Bei SQL-Injection-Verdacht

```
1. Betroffenen Endpunkt sofort deaktivieren (Nginx: return 503)
2. PostgreSQL-Logs analysieren: /var/log/postgresql/
3. Prisma-Query-Logs im Backend auswerten (log level: query)
4. Datenbank-Snapshot für forensische Analyse sichern
5. Prisma-Version auf neueste patchen
```

### Bei Keycloak-Kompromittierung

```
1. KEYCLOAK_CLIENT_SECRET sofort rotieren
2. Keycloak Admin-Passwort ändern
3. Alle Realm-Keys rotieren (Keycloak Admin Console → Realm → Keys)
4. Alle aktiven User-Sessions beenden
5. JWT_SECRET im Backend rotieren + Neustart
```

### Notfall-Kontakte & Log-Speicherorte

```
Backend-Logs:    docker logs irm-backend -f
Keycloak-Logs:   docker logs irm-keycloak -f
PostgreSQL-Logs: docker exec irm-postgres cat /var/log/postgresql/postgresql.log
Redis-Logs:      docker logs irm-redis -f

NestJS-Loglevel kann über LOG_LEVEL=verbose|debug|log|warn|error gesteuert werden.
```

---

*Dieses Dokument muss bei Änderungen an der Auth-Infrastruktur aktualisiert werden.*
*Letzte Prüfung: April 2026*
