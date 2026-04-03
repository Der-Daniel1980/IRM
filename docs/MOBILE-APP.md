# IRM Mobile App — Dokumentation

## Überblick

Die IRM Mobile App ermöglicht Mitarbeitern im Feld:
- Zugewiesene Aufträge einsehen
- Arbeit starten/beenden (Zeiterfassung)
- Manuelle Zeitrückmeldungen
- Fotos von erledigten Arbeiten hochladen
- Aufträge als erledigt melden

## Technologie

| Komponente | Technologie |
|-----------|-------------|
| Framework | React Native (Expo SDK 52) |
| Routing | Expo Router v4 |
| UI | React Native Paper (Material Design 3) |
| State | TanStack Query v5 |
| HTTP | Axios |
| Auth | Keycloak PKCE via expo-auth-session |
| Token Storage | expo-secure-store (Keychain/Keystore) |
| Kamera | expo-image-picker |
| Biometrie | expo-local-authentication |
| Offline | AsyncStorage Queue |

## Verzeichnisstruktur

```
packages/mobile/
├── app/                      # Expo Router Screens
│   ├── _layout.tsx           # Root Layout (Provider, Theme)
│   ├── index.tsx             # Entry → Redirect
│   ├── setup.tsx             # Server-URL Konfiguration
│   ├── login.tsx             # Keycloak PKCE Login
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Tab-Navigator
│   │   ├── orders.tsx        # Auftragsliste
│   │   └── profile.tsx       # Mitarbeiter-Profil
│   └── orders/
│       └── [id].tsx          # Auftragsdetail
├── src/
│   ├── auth/
│   │   ├── auth-context.tsx  # React Context für Auth
│   │   ├── keycloak.ts       # PKCE-Konfiguration
│   │   └── biometric.ts      # Face ID / Fingerprint
│   ├── lib/
│   │   ├── api.ts            # Axios-Client mit Token-Interceptor
│   │   ├── storage.ts        # SecureStore Wrapper
│   │   └── offline-queue.ts  # Offline-Mutations-Queue
│   ├── hooks/
│   │   ├── useMyOrders.ts    # Aufträge + Start/Stop/TimeEntry
│   │   ├── usePhotoUpload.ts # Foto-Upload + Kamera/Galerie
│   │   └── useNetworkStatus.ts # Konnektivitätsprüfung
│   └── components/
│       ├── OrderCard.tsx     # Auftrag-Listenelement
│       ├── StatusBadge.tsx   # Status + Priorität Badges
│       ├── TimeTracker.tsx   # Timer + manuelle Eingabe
│       └── PhotoGallery.tsx  # Foto-Grid + Upload-Menü
├── app.json                  # Expo Config
├── eas.json                  # EAS Build Profile
└── package.json
```

## Authentifizierung

### Flow

1. **Server-URL eingeben** → App validiert via `GET /health`
2. **Keycloak PKCE** → expo-auth-session öffnet Browser
3. **Authorization Code** → Token-Exchange am Keycloak Token-Endpoint
4. **Tokens speichern** → SecureStore (hardware-backed)
5. **Profil laden** → `GET /api/v1/mobile/me` (JWT → Staff-Auflösung)
6. **Fehler 403** → "Kein Mitarbeiterprofil verknüpft"

### Keycloak-Client

- Client ID: `irm-mobile`
- Typ: Public (kein Client Secret)
- PKCE: S256
- Redirect URIs: `irm://auth/callback`, `exp://*/--/auth/callback`

### Mitarbeiter verknüpfen

Im Keycloak einen User mit Rolle `irm-mitarbeiter` anlegen. Die Keycloak User-UUID im IRM-Backend als `Staff.userId` eintragen. Nicht jeder Mitarbeiter braucht Zugangsdaten — nur Mitarbeiter mit gesetztem `userId` können die App nutzen.

## Backend-Modul

### Neue Prisma-Models

```prisma
model WorkOrderPhoto {
  id, workOrderId, uploadedBy, fileName, mimeType,
  fileSizeBytes, storagePath, caption, latitude, longitude,
  takenAt, createdAt
}

model TimeEntry {
  id, workOrderId, staffId, startedAt, endedAt,
  durationMin, notes, source (MOBILE|WEB|MANUAL),
  createdAt, updatedAt
}
```

### API-Endpunkte

Alle unter `/api/v1/mobile/`, Rolle `irm-mitarbeiter` erforderlich.

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/me` | JWT-User → Staff + Tagesübersicht |
| GET | `/my-orders` | Eigene Aufträge (status, from, to, page, limit) |
| GET | `/my-orders/:id` | Detail mit Property, Fotos, Zeiteinträgen |
| POST | `/my-orders/:id/start` | Status → IN_PROGRESS, actualStart setzen |
| POST | `/my-orders/:id/stop` | Status → COMPLETED, Dauer berechnen |
| POST | `/my-orders/:id/time-entry` | Manueller Zeiteintrag |
| POST | `/my-orders/:id/photos` | Foto-Upload (multipart, max 5×10MB) |
| GET | `/my-orders/:id/photos` | Fotos auflisten |
| DELETE | `/my-orders/:id/photos/:photoId` | Foto löschen (nur eigene) |
| GET | `/photos/:photoId/file` | Foto-Datei streamen |

### Berechtigungsmodell

- **JWT → Staff-Auflösung:** `Staff.userId == jwt.sub`
- **Auftrags-Zugriff:** Nur wenn Staff-ID in `assignedStaff[]`
- **Foto-Löschung:** Nur eigene Fotos (`uploadedBy == staff.id`)

## Foto-Upload

- Erlaubte Formate: JPEG, PNG, WebP, HEIC
- Max. Dateigröße: 10 MB pro Datei
- Max. 5 Dateien pro Upload
- Speicherort: `./uploads/photos/{workOrderId}/{uuid}.{ext}`
- GPS-Koordinaten optional (aus EXIF oder manuell)
- Komprimierung im Client: max 1920px Breite, 80% JPEG-Qualität

## Offline-Support

- **Lesen:** React Query Cache in AsyncStorage
- **Schreiben:** Offline-Queue für Start/Stop/Zeiteinträge
- **Sync:** Automatisch bei Reconnect (FIFO, max 5 Retries)
- **Foto-Upload:** Separate Queue (FormData)

## Sicherheit (OWASP Mobile Top 10)

| Risiko | Maßnahme |
|--------|----------|
| M1 Credential Usage | PKCE, kein Client Secret, SecureStore |
| M2 Supply Chain | Dependency-Pinning, npm audit, Expo Managed |
| M3 Auth/Authz | JWT server-seitig, RolesGuard, Staff.userId |
| M4 Input Validation | class-validator, UUID-Dateinamen, Prisma |
| M5 Communication | HTTPS, Certificate Pinning (Prod) |
| M6 Privacy | GPS opt-in, Daten-Löschung bei Logout |
| M7 Binary Protection | Hermes Bytecode, ProGuard/R8 |
| M8 Misconfiguration | kein dev-login mobil, Rate Limiting |
| M9 Data Storage | SecureStore (hardware-backed) |
| M10 Cryptography | TLS 1.2+, RSA JWKS |

Zusätzlich: 30 Min Inaktivitäts-Timeout, Screenshot-Prevention (Android), Jailbreak-Warnung.

## Tests

### Backend (14 Tests)

```bash
cd packages/backend
npx jest --testPathPattern="mobile.service.spec"
```

Szenarien:
- Staff-Auflösung (verknüpft / nicht verknüpft)
- Auftrag starten (Zugriff / Status-Validierung)
- Auftrag stoppen (Dauerberechnung / Status-Validierung)
- Zeiteinträge erstellen
- Foto-Upload / Löschung (Berechtigung)

### Mobile (geplant)

```bash
cd packages/mobile
npm test
```

## Entwicklung

### Lokaler Dev-Server

```bash
cd packages/mobile
npm install
npx expo start
```

### Build-Profile (EAS)

| Profil | Zweck | Build-Typ |
|--------|-------|-----------|
| development | Lokales Testen | APK / iOS Simulator |
| preview | Interne Verteilung | APK / Ad Hoc |
| production | Store-Release | AAB / IPA |

```bash
npx eas build --platform android --profile preview
npx eas build --platform ios --profile preview
```
