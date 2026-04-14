# Immobilien- & Ressourcenmanagement (IRM)

## Technisches Konzept & Implementierungsanweisung für Claude Code

**Version 1.0 | März 2026 | VERTRAULICH**

Arbeitsverzeichnis: `/claude/IRM`
Später als Modul in ERP-System (`/claude/ERP`) integrierbar.

---

# 1. Einleitung und Zielsetzung

Dieses System verwaltet Immobilien (eigene + externe Kundenobjekte), plant
Ressourcen (Personal, Maschinen, KFZ), erstellt Einsatzpläne und Laufzettel
für Mitarbeiter, berechnet Zeiten automatisch und zeigt alles auf einer Karte.

## 1.1 Kernanforderungen

- Webbasiert, responsive (auch Mobile für Mitarbeiter im Feld)
- 100% Open Source, gleicher Tech-Stack wie ERP-System
- Immobilien-/Kundenverwaltung mit Kartenansicht (OpenStreetMap)
- Ressourcenplanung: Personal (mit Fähigkeiten), Maschinen, KFZ
- Einsatzplanung mit automatischen Terminvorschlägen
- Laufzettel-Generierung (PDF) für Mitarbeiter
- Tätigkeitskatalog (erweiterbar im Backend)
- Formel-Designer für automatische Zeitberechnung
- Urlaubs-/Krankheits-Verwaltung mit Umplanung
- Auftragshistorie mit Übernahme vorheriger Zeiten
- Später als Modul in das ERP-System integrierbar

---

# 2. Technologie-Stack

Identisch zum ERP-System für spätere Integration:

| Schicht | Technologie | Begründung |
|---------|-------------|------------|
| Datenbank | PostgreSQL 16+ (+ PostGIS) | ACID, JSONB, **Geodaten via PostGIS!** |
| Backend | NestJS (TypeScript) | Modularer DI-Container, OpenAPI |
| ORM | Prisma | Typsichere Queries, Migrationen |
| Frontend | Next.js + React | SSR, App Router, TypeScript |
| UI | shadcn/ui + TailwindCSS | Business-UI, Icons via **Lucide React** |
| Karte | **Leaflet + OpenStreetMap** | Open Source, kein API-Key nötig |
| Kalender | **FullCalendar (React)** | Drag-and-Drop Kalender, Open Source |
| Auth | Keycloak | RBAC, SSO, 2FA |
| Queue | BullMQ (Redis) | Termin-Berechnung, PDF-Generierung |
| PDF | Puppeteer | Laufzettel, Auftragsblätter |
| Container | Docker Compose | Reproduzierbare Deployments |

**Zusätzlich zu ERP:**
- **PostGIS Extension** für PostgreSQL (Geo-Queries, Entfernungsberechnung)
- **Leaflet** (react-leaflet) für Kartenansicht
- **FullCalendar** (@fullcalendar/react) für Kalender/Gantt
- **Lucide React** für Navigation-Icons

---

# 3. Navigation und Icons

Die Hauptnavigation (Sidebar) verwendet Lucide-React-Icons:

| Menüpunkt | Icon (Lucide) | Route |
|-----------|---------------|-------|
| Dashboard | `LayoutDashboard` | `/` |
| Immobilien | `Building2` | `/properties` |
| Kunden | `Users` | `/customers` |
| Personal | `UserCog` | `/staff` |
| Maschinen & KFZ | `Truck` | `/equipment` |
| Tätigkeiten | `ClipboardList` | `/activities` |
| Aufträge | `FileText` | `/orders` |
| Einsatzplanung | `CalendarClock` | `/scheduling` |
| Kartenansicht | `MapPin` | `/map` |
| Laufzettel | `Route` | `/route-sheets` |
| Urlaub & Abwesenheit | `CalendarOff` | `/absences` |
| Formel-Designer | `Calculator` | `/formula-designer` |
| Berichte | `BarChart3` | `/reports` |
| Verwaltung (Admin) | `Settings` | `/admin` |
| ↳ Benutzer | `UserPlus` | `/admin/users` |
| ↳ Rollen & Gruppen | `Shield` | `/admin/roles` |
| ↳ Systemeinstellungen | `Cog` | `/admin/settings` |

---

# 4. Datenmodell

## 4.1 Kunden (customer)

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | Primärschlüssel |
| customer_number | VARCHAR | Eindeutige Kundennummer (K-0000001) |
| company_name | VARCHAR | Firmenname (oder Privatname) |
| is_company | BOOLEAN | Firma vs. Privatperson |
| address_street | VARCHAR | Straße + Hausnr. |
| address_zip | VARCHAR | PLZ |
| address_city | VARCHAR | Ort |
| address_country | CHAR(2) | Ländercode (DE) |
| phone | VARCHAR | Telefon |
| email | VARCHAR | E-Mail |
| contact_person | VARCHAR | Hauptansprechpartner |
| notes | TEXT | Interne Notizen |
| is_internal | BOOLEAN | Eigene Verwaltung vs. externer Kunde |
| created_at | TIMESTAMP | Erstelldatum |
| updated_at | TIMESTAMP | Änderungsdatum |

## 4.2 Immobilien (property)

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | Primärschlüssel |
| property_number | VARCHAR | Objekt-Nummer (OBJ-0000001) |
| customer_id | UUID FK | Gehört zu Kunde |
| name | VARCHAR | Bezeichnung (z.B. "Wohnanlage Parkstr. 5") |
| address_street | VARCHAR | Straße + Hausnr. |
| address_zip | VARCHAR | PLZ |
| address_city | VARCHAR | Ort |
| latitude | DECIMAL(10,7) | Breitengrad (für Karte!) |
| longitude | DECIMAL(10,7) | Längengrad (für Karte!) |
| geo_point | GEOMETRY(Point,4326) | PostGIS Point (für Entfernungsberechnung) |
| property_type | ENUM | RESIDENTIAL, COMMERCIAL, MIXED, LAND, PARKING |
| total_area_sqm | DECIMAL | Gesamtfläche in m² |
| green_area_sqm | DECIMAL | Grünfläche in m² (relevant für Rasenmähen!) |
| floors | INTEGER | Anzahl Etagen |
| units_count | INTEGER | Anzahl Wohneinheiten/Gewerbeeinheiten |
| notes | TEXT | Besonderheiten (z.B. "Tor-Code: 4711") |
| is_active | BOOLEAN | Aktiv/Inaktiv |
| metadata | JSONB | Flexible Zusatzdaten |

## 4.3 Immobilien-Einheiten (property_unit)

Für Laufzettel: Etage + Name/Mieter pro Einheit.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | |
| property_id | UUID FK | Gehört zu Immobilie |
| unit_number | VARCHAR | Einheitennummer (z.B. "EG-01", "3.OG-04") |
| floor | VARCHAR | Etage (z.B. "EG", "1.OG", "2.OG", "DG") |
| tenant_name | VARCHAR | Name des Mieters / Bewohners |
| tenant_phone | VARCHAR | Telefon Mieter |
| usage_type | ENUM | RESIDENTIAL, COMMERCIAL, COMMON_AREA, TECHNICAL |
| area_sqm | DECIMAL | Fläche der Einheit |
| notes | TEXT | Besonderheiten |

## 4.4 Personal (staff)

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | |
| staff_number | VARCHAR | Personalnummer (MA-0001) |
| first_name | VARCHAR | Vorname |
| last_name | VARCHAR | Nachname |
| email | VARCHAR | E-Mail |
| phone | VARCHAR | Telefon |
| mobile | VARCHAR | Mobil |
| address | TEXT | Wohnadresse |
| latitude | DECIMAL(10,7) | Wohnort-Koordinaten (für Routenoptimierung) |
| longitude | DECIMAL(10,7) | |
| employment_type | ENUM | FULL_TIME, PART_TIME, MINI_JOB, FREELANCER |
| weekly_hours | DECIMAL | Wochenarbeitszeit |
| color | VARCHAR(7) | Farbe im Kalender (z.B. "#3B82F6") |
| is_active | BOOLEAN | Aktiv/Inaktiv |
| user_id | UUID FK nullable | Verknüpfung zum Keycloak-User (falls App-Zugang) |

## 4.5 Fähigkeiten / Qualifikationen (skill)

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | |
| name | VARCHAR | z.B. "Gartenpflege", "Elektroinstallation", "Sanitär" |
| category | VARCHAR | Kategorie (z.B. "Handwerk", "Garten", "Reinigung") |
| description | TEXT | Beschreibung |
| requires_certification | BOOLEAN | Zertifikat erforderlich? |
| icon | VARCHAR | Lucide-Icon-Name (z.B. "Leaf", "Zap", "Droplets") |

**Zuordnungstabelle staff_skill:**
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| staff_id | UUID FK | |
| skill_id | UUID FK | |
| level | ENUM | BASIC, INTERMEDIATE, EXPERT |
| certified_until | DATE nullable | Zertifikat gültig bis |

## 4.6 Maschinen & Geräte (equipment)

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | |
| equipment_number | VARCHAR | Geräte-Nr. (GER-0001) |
| name | VARCHAR | z.B. "Rasenmäher Husqvarna LC 353V" |
| category | ENUM | MACHINE, VEHICLE, TOOL, MATERIAL |
| equipment_type | VARCHAR | z.B. "Rasenmäher", "Kantenschneider", "Transporter" |
| license_plate | VARCHAR nullable | Kennzeichen (nur KFZ) |
| requires_license | BOOLEAN | Führerschein nötig? (z.B. LKW) |
| required_license_type | VARCHAR nullable | Führerscheinklasse (z.B. "B", "BE", "C1") |
| location | VARCHAR | Aktueller Standort |
| status | ENUM | AVAILABLE, IN_USE, MAINTENANCE, BROKEN |
| next_maintenance | DATE | Nächster Wartungstermin |
| notes | TEXT | |

## 4.7 Tätigkeitskatalog (activity_type)

Im Backend pflegbar! Neue Tätigkeiten hinzufügbar.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | |
| code | VARCHAR | Kurzcode (z.B. "RASEN", "WINTER", "REP_WASSER") |
| name | VARCHAR | z.B. "Rasenmähen", "Winterdienst", "Reparatur Wasserleitung" |
| category | VARCHAR | "Garten", "Winter", "Reparatur", "Reinigung", "Wartung" |
| description | TEXT | Ausführliche Beschreibung |
| required_skills | UUID[] | Welche Fähigkeiten werden benötigt (FK-Array auf skill) |
| default_equipment | UUID[] | Standard-Ausstattung (FK-Array auf equipment) |
| time_formula_id | UUID FK nullable | Verknüpfung zur Zeitformel |
| default_duration_min | INTEGER | Fallback-Dauer in Minuten (wenn keine Formel) |
| is_recurring | BOOLEAN | Wiederkehrende Tätigkeit? |
| recurrence_interval | VARCHAR nullable | z.B. "WEEKLY", "BIWEEKLY", "MONTHLY", "SEASONAL" |
| season_start | SMALLINT nullable | Saisonstart (Monat, z.B. 4 = April) |
| season_end | SMALLINT nullable | Saisonende (Monat, z.B. 10 = Oktober) |
| icon | VARCHAR | Lucide-Icon-Name |
| color | VARCHAR(7) | Farbe im Kalender |

## 4.8 Abwesenheiten (absence)

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | |
| staff_id | UUID FK | Mitarbeiter |
| type | ENUM | VACATION, SICK, TRAINING, PERSONAL, COMP_TIME |
| start_date | DATE | Von |
| end_date | DATE | Bis |
| status | ENUM | REQUESTED, APPROVED, REJECTED, CANCELLED |
| approved_by | UUID FK nullable | Genehmigt von |
| notes | TEXT | |

## 4.9 Aufträge (work_order)

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | |
| order_number | VARCHAR | Auftragsnummer (2026-10000001, Typ-Ziffer 1) |
| property_id | UUID FK | Immobilie |
| customer_id | UUID FK | Kunde |
| activity_type_id | UUID FK | Tätigkeit |
| title | VARCHAR | Kurzbezeichnung |
| description | TEXT | Detailbeschreibung |
| status | ENUM | DRAFT, PLANNED, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED |
| priority | ENUM | LOW, NORMAL, HIGH, URGENT |
| planned_date | DATE | Geplantes Datum |
| planned_start_time | TIME | Geplante Startzeit |
| planned_duration_min | INTEGER | Geplante Dauer (berechnet oder manuell) |
| actual_start | TIMESTAMP nullable | Tatsächlicher Start |
| actual_end | TIMESTAMP nullable | Tatsächliches Ende |
| actual_duration_min | INTEGER nullable | Tatsächliche Dauer |
| assigned_staff | UUID[] | Zugewiesene Mitarbeiter (Array!) |
| assigned_equipment | UUID[] | Zugewiesene Geräte/KFZ |
| calculation_params | JSONB | Parameter der Zeitberechnung (Fläche, Formel, etc.) |
| previous_order_id | UUID FK nullable | Referenz auf vorherigen Auftrag (gleiche Tätigkeit) |
| previous_duration_min | INTEGER nullable | Dauer des vorherigen Auftrags (zur Übernahme) |
| notes | TEXT | Auftragsnotizen |
| completion_notes | TEXT nullable | Abschlussnotizen des Mitarbeiters |
| created_by | UUID FK | Erstellt von |

## 4.10 Auftrags-Material-Liste (work_order_equipment)

Was der Mitarbeiter mitnehmen muss:

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | |
| work_order_id | UUID FK | |
| equipment_id | UUID FK | |
| quantity | INTEGER | Anzahl |
| is_checked_out | BOOLEAN | Mitgenommen? |
| notes | VARCHAR | |

## 4.11 Zeitformeln (time_formula)

Der Formel-Designer speichert Berechnungsregeln:

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID PK | |
| name | VARCHAR | z.B. "Rasenmähen Standard" |
| activity_type_id | UUID FK | Für welche Tätigkeit |
| formula | JSONB | Die Formel als JSON-Struktur (siehe 5.8) |
| variables | JSONB | Verfügbare Variablen + Beschreibung |
| default_values | JSONB | Standardwerte für Variablen |
| result_unit | VARCHAR | "minutes" |
| description | TEXT | Erklärung der Formel |
| version | INTEGER | Versionierung |

---

# 5. Module im Detail

## 5.1 Dashboard

Übersicht mit Kennzahlen:
- Heutige Aufträge (Anzahl, Status-Verteilung)
- Verfügbare Mitarbeiter heute
- Mitarbeiter im Einsatz (Live-Status)
- Ausstehende Aufträge nach Priorität
- Wetter-Widget (für Außeneinsätze relevant!)
- Mini-Karte mit heutigen Einsatzorten
- Nächste geplante Wartungen (Maschinen)
- Abwesende Mitarbeiter (Urlaub/Krank)

## 5.2 Immobilienverwaltung

**Listenansicht:**
- Tabelle mit Suche, Filter nach Kunde/Typ/Stadt
- Schnellstatus (letzte Tätigkeit, nächster geplanter Termin)

**Detailansicht einer Immobilie:**
- Stammdaten + Karte (OpenStreetMap, Marker auf Koordinaten)
- Tab "Einheiten" → Liste aller Wohn-/Gewerbeeinheiten (Etage, Mieter)
- Tab "Auftragshistorie" → Alle bisherigen Aufträge chronologisch
- Tab "Geplante Aufträge" → Zukünftige Termine
- Tab "Dokumente" → Fotos, Pläne (Upload)
- Button "Neuen Auftrag erstellen" → Vorbefüllt mit Immobilien-Daten

**Kartenansicht (OpenStreetMap):**
- Alle Immobilien als Marker auf Leaflet-Karte
- Farbige Marker je nach Status (grün = alles erledigt, orange = Auftrag offen, rot = überfällig)
- Click auf Marker → Popup mit Kurzinfo + Link zur Detailseite
- Cluster-Ansicht bei vielen Objekten
- Filter nach Kunde, Typ, Stadt

## 5.3 Personalverwaltung

**Personalstamm:**
- Liste aller Mitarbeiter mit Fähigkeiten-Tags
- Kalender-Farbkennzeichnung
- Status (aktiv, im Einsatz, abwesend)

**Fähigkeiten zuordnen:**
- Multi-Select aus Fähigkeiten-Katalog
- Level (Basis, Fortgeschritten, Experte) pro Fähigkeit
- Zertifikats-Ablaufdatum (Warnung bei Ablauf!)

**Verfügbarkeitsanzeige:**
- Kalenderansicht (FullCalendar) pro Mitarbeiter
- Farben: Grün = verfügbar, Blau = im Einsatz, Rot = abwesend
- Wochen-/Monatsansicht

## 5.4 Maschinen & KFZ

**Bestandsliste:**
- Alle Geräte, Maschinen, Fahrzeuge
- Filter nach Kategorie, Status
- Wartungswarnung (Ampel: grün/gelb/rot)

**Verfügbarkeitsprüfung:**
- Welche Geräte sind wann frei?
- Verknüpfung mit Aufträgen (welches Gerät ist wo im Einsatz?)

## 5.5 Tätigkeitskatalog (Backend-Admin)

**CRUD im Admin-Bereich:**
- Neue Tätigkeit anlegen (Name, Kategorie, Icon, Farbe)
- Benötigte Fähigkeiten zuordnen
- Standard-Ausstattung definieren (welche Geräte mitnehmen)
- Zeitformel verknüpfen
- Wiederkehr-Intervall definieren (wöchentlich, monatlich, saisonal)

**Seed-Daten (vordefiniert, erweiterbar):**

| Code | Name | Kategorie | Fähigkeiten | Standard-Ausstattung |
|------|------|-----------|-------------|---------------------|
| RASEN | Rasenmähen | Garten | Gartenpflege | Rasenmäher, Kantenschneider, Laubbläser |
| HECKE | Heckenschnitt | Garten | Gartenpflege | Heckenschere, Leiter |
| WINTER_RAEUM | Winterdienst Räumen | Winter | Winterdienst | Schneeschieber, Streuwagen, Streusalz |
| WINTER_STREU | Winterdienst Streuen | Winter | Winterdienst | Streuwagen, Streusalz |
| REP_WASSER | Reparatur Wasserleitung | Reparatur | Sanitär | Werkzeugkoffer, Dichtungen, Rohrschneider |
| REP_ELEKTRO | Reparatur Elektro | Reparatur | Elektroinstallation | Werkzeugkoffer, Prüfgerät, Sicherungen |
| REINIGUNG | Treppenhaus-Reinigung | Reinigung | Reinigung | Reinigungswagen, Wischmopp, Reinigungsmittel |
| SPERR | Sperrmüll-Entsorgung | Entsorgung | Allgemein | Transporter |
| WARTUNG_HEIZ | Heizungswartung | Wartung | Heizungstechnik | Werkzeugkoffer, Messgeräte |
| GARTEN_ALLG | Allgemeine Gartenpflege | Garten | Gartenpflege | Handgeräte, Schubkarre, Grünschnitt-Sack |

## 5.6 Auftragsmanagement

**Auftragserfassung:**
1. Immobilie auswählen (Dropdown oder Karten-Click)
2. Tätigkeit auswählen → Automatisch werden geladen:
   - Benötigte Fähigkeiten
   - Standard-Ausstattung
   - Zeitformel (berechnet automatisch Dauer)
3. **Automatische Zeitberechnung:**
   - System prüft: Gibt es einen vorherigen Auftrag der gleichen Tätigkeit an dieser Immobilie?
   - Wenn ja → Zeigt letzte Dauer an: "Letzter Auftrag: 45 min (am 15.02.2026)"
   - Übernahme-Button: "Letzte Zeit übernehmen"
   - Alternativ: Formel berechnet neu (z.B. bei Rasenmähen anhand m²)
   - **Manuell anpassbar!** Der berechnete/übernommene Wert kann vor der Freigabe überschrieben werden
4. Datum + Uhrzeit wählen (oder automatischen Vorschlag nutzen)
5. Mitarbeiter zuweisen (nur Mitarbeiter mit passenden Fähigkeiten!)
6. Geräte zuweisen (Verfügbarkeit wird geprüft)
7. Speichern → Status PLANNED

**Automatischer Terminvorschlag (Scheduling-Engine):**
Der Algorithmus berücksichtigt:
- Verfügbarkeit der Mitarbeiter (Urlaub, Krankheit, andere Aufträge)
- Fähigkeiten der Mitarbeiter (nur passend Qualifizierte)
- Verfügbarkeit der benötigten Geräte/KFZ
- Entfernung zum Objekt (PostGIS-Distanzberechnung vom vorherigen Einsatzort)
- Optimale Reihung (Cluster nahe Objekte zusammen → weniger Fahrzeit)
- Saisonalität (Rasenmähen nur Apr-Okt)
- Arbeitszeitgrenzen (nicht vor 7:00, nicht nach 17:00)
- Pufferzeiten zwischen Aufträgen (konfigurierbar, Default 15 min)

**Vorschlag-Antwort:**
```
Vorschläge für "Rasenmähen" an Parkstr. 5:
1. Mo 25.03. 09:00 – Müller, Hans (verfügbar, 3.2 km entfernt)
2. Di 26.03. 13:00 – Schmidt, Peter (verfügbar, 5.1 km entfernt)
3. Mi 27.03. 08:00 – Müller, Hans (verfügbar, 1.8 km entfernt, vorheriger Einsatz Parkstr. 3)
   ✨ EMPFOHLEN (geringste Fahrzeit, naher Folgeeinsatz)
```

## 5.7 Einsatzplanung (Kalender)

**FullCalendar-Integration:**
- Tagesansicht: Gantt-artige Zeitleiste pro Mitarbeiter
- Wochenansicht: Übersicht aller Mitarbeiter
- Monatsansicht: Übersicht aller Aufträge
- Drag-and-Drop: Aufträge verschieben/umplanen
- Farbcodierung nach Tätigkeit ODER nach Mitarbeiter (umschaltbar)
- Abwesenheiten als Hintergrund-Markierung (rot für Krank, orange für Urlaub)
- Konflikt-Warnung bei Doppelbelegung

**Schnelle Umplanung (z.B. bei Krankheit):**
1. Mitarbeiter als "krank" markieren
2. System zeigt sofort alle betroffenen Aufträge
3. Button "Automatisch umplanen" → Scheduling-Engine berechnet Alternativen
4. Manuell bestätigen oder anpassen

## 5.8 Formel-Designer

**Zweck:** Im Backend pflegbare Berechnungsformeln für Auftragsdauern.

**Formel-Struktur (JSONB):**
```json
{
  "name": "Rasenmähen Standard",
  "formula": "({green_area_sqm} / {mow_rate_sqm_per_hour} * 60) + {setup_time_min} + {edge_trimming_min}",
  "variables": {
    "green_area_sqm": { "label": "Grünfläche (m²)", "source": "property.green_area_sqm", "type": "number" },
    "mow_rate_sqm_per_hour": { "label": "Mähleistung (m²/h)", "default": 500, "type": "number" },
    "setup_time_min": { "label": "Rüstzeit (min)", "default": 15, "type": "number" },
    "edge_trimming_min": { "label": "Kantenschnitt (min)", "default": 10, "type": "number" }
  }
}
```

**Frontend-Editor:**
- Formular mit den definierten Variablen
- Formel als Text-Eingabe mit Variablen-Platzhaltern
- Live-Vorschau: Sofort berechnen bei Werteänderung
- Variablen können automatisch aus Immobiliendaten befüllt werden (z.B. green_area_sqm)
- Default-Werte im Backend pflegbar, aber pro Auftrag überschreibbar

**Beispielformeln (Seed):**

| Tätigkeit | Formel | Standard-Parameter |
|-----------|--------|--------------------|
| Rasenmähen | (Fläche / Mähleistung) × 60 + Rüstzeit + Kantenschnitt | Mähleistung: 500 m²/h, Rüstzeit: 15 min |
| Winterdienst Räumen | (Fläche / Räumleistung) × 60 + Anfahrt_Puffer | Räumleistung: 200 m²/h |
| Treppenhaus-Reinigung | Etagen × Minuten_pro_Etage + Eingangsbereich | 8 min/Etage, Eingang: 10 min |
| Heckenschnitt | Laufmeter / Schnittleistung × 60 + Entsorgung | Schnittleistung: 30 lfm/h |

## 5.9 Laufzettel

**PDF-Generierung für Mitarbeiter:**

Enthält für einen Tag / eine Tour:

```
╔══════════════════════════════════════════════╗
║  LAUFZETTEL                                  ║
║  Mitarbeiter: Müller, Hans                   ║
║  Datum: 25.03.2026                           ║
║  KFZ: VW Transporter (GÖ-XY 123)            ║
╠══════════════════════════════════════════════╣
║                                              ║
║  📍 Auftrag 1: 08:00 – 09:15               ║
║  Objekt: Wohnanlage Parkstr. 5               ║
║  Adresse: Parkstraße 5, 37073 Göttingen      ║
║  Tätigkeit: Rasenmähen (Grünfläche 450 m²)   ║
║  Material: Rasenmäher, Kantenschneider        ║
║  Besonderheiten: Torcode 4711                 ║
║  Geplante Dauer: 75 min                      ║
║                                              ║
║  ─── Fahrzeit ca. 8 min (3.2 km) ────       ║
║                                              ║
║  📍 Auftrag 2: 09:30 – 10:45               ║
║  Objekt: Mehrfamilienhaus Berliner Str. 12   ║
║  Adresse: Berliner Str. 12, 37073 Göttingen  ║
║  Tätigkeit: Treppenhaus-Reinigung            ║
║  Etagen: EG, 1.OG, 2.OG, 3.OG              ║
║  Einheiten:                                  ║
║    EG-01: Meier, Familie                     ║
║    EG-02: Schulze, Herbert                   ║
║    1.OG-01: Yilmaz, Ahmet                   ║
║    1.OG-02: Weber, Sabine                    ║
║    ...                                       ║
║  Material: Reinigungswagen, Wischmopp         ║
║  Geplante Dauer: 55 min                      ║
║                                              ║
╠══════════════════════════════════════════════╣
║  Zusammenfassung:                            ║
║  Aufträge: 2 | Gesamtdauer: 2h 10min        ║
║  Fahrzeit: ca. 16 min | Strecke: ca. 6.4 km ║
╚══════════════════════════════════════════════╝
```

**Route in Karte:** Link/QR-Code auf dem Laufzettel → Öffnet Kartenansicht mit Route in der App.

## 5.10 Urlaubs- & Abwesenheitsverwaltung

- Mitarbeiter (oder Admin) tragen Urlaub/Abwesenheit ein
- Genehmigungsworkflow: Anfrage → Genehmigt/Abgelehnt
- Kalenderansicht: Wer ist wann abwesend?
- **Automatische Auswirkung auf Planung:**
  - Bei neuer Abwesenheit → System prüft betroffene Aufträge
  - Warnung: "3 Aufträge von Müller betroffen"
  - Button: "Automatisch umplanen"
- Krankheit: Sofort-Eintragung (kein Genehmigungsworkflow)
  - Alle heutigen/morgigen Aufträge werden sofort als "Umplanung nötig" markiert

## 5.11 Benutzer-Backend (Admin)

**Benutzerverwaltung:**
- Benutzer anlegen/bearbeiten/deaktivieren
- Verknüpfung mit Keycloak (SSO)
- Rollen zuweisen

**Rollen (vordefiniert, erweiterbar):**

| Rolle | Rechte |
|-------|--------|
| Admin | Alles, inkl. Benutzerverwaltung, Systemeinstellungen |
| Disponent | Aufträge erstellen/planen, Personal zuweisen, Laufzettel generieren |
| Objektverwalter | Immobilien + Kunden verwalten, Aufträge einsehen |
| Mitarbeiter | Eigene Aufträge sehen, Status melden, Abwesenheit beantragen |
| Nur-Lesen | Dashboard + Berichte einsehen |

**Systemeinstellungen (Admin):**
- Arbeitszeitgrenzen (Start/Ende Tag)
- Pufferzeit zwischen Aufträgen (Default: 15 min)
- Saisoneinstellungen (Rasenmähen Apr–Okt, Winter Nov–Mär)
- Standard-Mähleistung, Räumleistung etc. (globale Formel-Defaults)
- Firmenlogo + Adresse (für Laufzettel-Header)

---

# 6. Nummernkreise

Gleiches System wie ERP (YYYY-TNNNNNNNN), aber eigene Typ-Ziffern:

| T | Belegtyp | Beispiel |
|---|----------|----------|
| 1 | Auftrag (Work Order) | 2026-10000001 |
| 2 | Laufzettel (Route Sheet) | 2026-20000001 |
| 3 | Wartungsauftrag (Equipment) | 2026-30000001 |

Stammdaten-Nummern (ohne Jahr):
- Kunden: K-0000001
- Immobilien: OBJ-0000001
- Personal: MA-0001
- Geräte: GER-0001

---

# 7. API-Endpunkte (Übersicht)

```
/api/v1/customers          CRUD Kunden
/api/v1/properties         CRUD Immobilien
/api/v1/properties/:id/units   CRUD Einheiten pro Immobilie
/api/v1/staff              CRUD Personal
/api/v1/staff/:id/skills   Fähigkeiten zuordnen
/api/v1/staff/:id/calendar Verfügbarkeit
/api/v1/skills             CRUD Fähigkeiten-Katalog
/api/v1/equipment          CRUD Maschinen/KFZ
/api/v1/activity-types     CRUD Tätigkeitskatalog
/api/v1/work-orders        CRUD Aufträge
/api/v1/work-orders/:id/schedule  Terminvorschlag berechnen
/api/v1/work-orders/:id/previous  Letzten gleichen Auftrag laden
/api/v1/scheduling/suggest POST Automatischen Terminvorschlag
/api/v1/scheduling/replan  POST Umplanung bei Ausfall
/api/v1/absences           CRUD Abwesenheiten
/api/v1/absences/:id/approve POST Genehmigung
/api/v1/route-sheets       Laufzettel generieren
/api/v1/route-sheets/:id/pdf  PDF-Download
/api/v1/formulas           CRUD Zeitformeln
/api/v1/formulas/:id/calculate POST Berechnung ausführen
/api/v1/map/properties     GeoJSON aller Immobilien
/api/v1/map/route          Route berechnen
/api/v1/dashboard/stats    Dashboard-Kennzahlen
/api/v1/admin/users        Benutzerverwaltung
/api/v1/admin/roles        Rollenverwaltung
/api/v1/admin/settings     Systemeinstellungen

/api/v1/mobile/me                         Eigenes Mitarbeiterprofil (JWT → Staff)
/api/v1/mobile/my-orders                  Eigene Aufträge (gefiltert, paginiert)
/api/v1/mobile/my-orders/:id              Auftragsdetail
/api/v1/mobile/my-orders/:id/start        Arbeit starten → IN_PROGRESS
/api/v1/mobile/my-orders/:id/stop         Arbeit beenden → COMPLETED
/api/v1/mobile/my-orders/:id/time-entry   Manuelle Zeitrückmeldung
/api/v1/mobile/my-orders/:id/photos       Foto-Upload / Auflisten
/api/v1/mobile/photos/:id/file            Foto-Datei herunterladen
/health                                   Health Check (Mobile App)
```

---

# 8. Claude Code Anweisung

## 8.1 Implementierungsreihenfolge

```
Phase 0: Infrastruktur
  0a: Docker Compose (PostgreSQL+PostGIS, Redis, Keycloak, Meilisearch)
  0b: NestJS bootstrappen, Prisma init mit PostGIS
  0c: Next.js bootstrappen, shadcn/ui, TailwindCSS, Lucide Icons
  0d: Keycloak-Integration, Auth Guards, RBAC

Phase 1: Stammdaten
  1a: Kunden CRUD + Frontend
  1b: Immobilien CRUD + Einheiten + OpenStreetMap-Karte (Leaflet)
  1c: Fähigkeiten-Katalog CRUD
  1d: Personal CRUD + Fähigkeiten-Zuordnung
  1e: Maschinen/KFZ CRUD
  1f: Tätigkeitskatalog CRUD + Standard-Ausstattung + Seed-Daten

Phase 2: Kernlogik
  2a: Formel-Designer (Backend + Frontend-Editor)
  2b: Auftragserfassung + automatische Zeitberechnung
  2c: Vorherigen Auftrag laden + Zeitübernahme
  2d: Abwesenheitsverwaltung + Genehmigungsworkflow

Phase 3: Planung
  3a: Scheduling-Engine (Terminvorschlag-Algorithmus)
  3b: Einsatzplanung-Kalender (FullCalendar + Drag-and-Drop)
  3c: Umplanung bei Krankheit/Ausfall
  3d: Laufzettel-Generierung (PDF mit Puppeteer)

Phase 4: Karte & Dashboard
  4a: Kartenansicht (alle Immobilien, Status-Marker, Cluster)
  4b: Route auf Karte (Tagesroute eines Mitarbeiters)
  4c: Dashboard mit Kennzahlen
  4d: Berichte (Auslastung, Auftragsstatistik)

Phase 5: Admin & Mobile
  5a: Benutzerverwaltung (CRUD, Keycloak-Sync)
  5b: Rollenverwaltung + Berechtigungen
  5c: Systemeinstellungen
  5d: Mobile App (React Native / Expo) — Aufträge, Zeiterfassung, Foto-Upload
```

## 8.2 Opus vs. Sonnet Aufgaben

**Opus 4.6 (Architektur + Komplexe Logik):**
- Datenbankschema-Design (komplett, inkl. PostGIS)
- Scheduling-Engine Algorithmus (Constraint-basiert)
- Formel-Designer Parsing + Berechnung
- API-Design und Modul-Schnittstellen
- CLAUDE.md und Agent-Definitionen

**Sonnet 4.6 (Implementierung):**
- NestJS CRUD-Module (alle Stammdaten)
- Frontend-Seiten (Listen, Formulare, Detail-Ansichten)
- Leaflet/OpenStreetMap-Integration
- FullCalendar-Integration
- PDF-Laufzettel-Templates
- Seed-Daten (Tätigkeiten, Fähigkeiten, Beispiel-Formeln)
- Tests
- Docker-Setup, Keycloak-Config

## 8.3 Erster Befehl an Claude Code

```
Lies bitte die Datei docs/IRM-KONZEPT.md komplett und gründlich.

Bestätige, dass du folgendes verstanden hast:
- Datenmodell (Kunden, Immobilien, Einheiten, Personal, Fähigkeiten,
  Maschinen, Tätigkeitskatalog, Aufträge, Abwesenheiten, Zeitformeln)
- Navigation mit Lucide-Icons
- Scheduling-Engine Logik (Fähigkeiten-Match, Verfügbarkeit, Entfernung)
- Formel-Designer (JSONB-Struktur, Variable aus Immobiliendaten)
- Laufzettel-Aufbau (Route, Material, Mieter-Liste, Fahrzeit)
- Nummernkreise (YYYY-TNNNNNNNN)
- Kartenanbindung (Leaflet + PostGIS)

Dann starte mit Phase 0a:
Docker Compose mit PostgreSQL 16 + PostGIS, Redis, Keycloak, Meilisearch.
```

---

# 9. Deployment

## 9.1 Voraussetzungen

- Ubuntu 22.04 oder 24.04 (Debian-basiert)
- Mindestens 4 GB RAM, 20 GB Festplatte
- Docker & Docker Compose (werden vom Install-Script automatisch installiert)
- Netzwerkzugang zu GitHub

## 9.2 Installation (leerer Ubuntu-Server)

Das Install-Script installiert automatisch alle Abhängigkeiten (Docker, Git, OpenSSL, UFW),
klont das Repository, fragt interaktiv nach Passwörtern, generiert ein Self-Signed SSL-Zertifikat
und startet den kompletten Stack.

```bash
# Auf dem Server herunterladen und ausführen:
cd /tmp && wget -q https://raw.githubusercontent.com/Der-Daniel1980/IRM/main/install.sh
sudo bash install.sh
```

Im interaktiven Modus werden folgende Einstellungen abgefragt (Enter = sicherer Standardwert):

| Einstellung | Beschreibung | Standard |
|---|---|---|
| Server-IP | LAN-IP des Servers | automatisch erkannt |
| Datenbank-User | PostgreSQL-Benutzer | `irm` |
| Datenbank-Passwort | PostgreSQL-Passwort | auto-generiert |
| Datenbank-Name | PostgreSQL-Datenbankname | `irm` |
| Redis-Passwort | Redis-Passwort | auto-generiert |
| Keycloak Admin | Keycloak-Admin-User | `admin` |
| Keycloak Passwort | Keycloak-Admin-Passwort | auto-generiert |
| Meilisearch API-Key | Meilisearch Master-Key | auto-generiert |
| JWT-Secret | Token-Signierung (min 32 Zeichen) | auto-generiert |
| NextAuth-Secret | Session-Secret (min 32 Zeichen) | auto-generiert |
| Arbeitszeiten | Beginn/Ende, Puffer | 07:00–17:00, 15 Min |

Nicht-interaktiver Modus (alle Standardwerte):
```bash
sudo bash install.sh --auto 192.168.0.21
```

### Installationsverzeichnis

| Pfad | Inhalt |
|---|---|
| `/opt/irm/` | Git-Repository + Quellcode |
| `/opt/irm/.env.portainer` | Alle Passwörter und Einstellungen |
| Docker Volumes | Datenbank, Redis, Keycloak, Meilisearch, SSL-Zertifikate, Uploads |

## 9.3 Updates

```bash
# Normales Update (nur bei Änderungen)
sudo /opt/irm/update.sh

# Neuaufbau erzwingen
sudo /opt/irm/update.sh --force

# Komplett-Reset (Container & Images neu, Datenbank bleibt erhalten)
sudo /opt/irm/update.sh --clean
```

Das Update-Script:
1. Prüft ob neue Commits auf GitHub vorliegen
2. Stoppt alle Container und räumt verwaiste Container/Images auf
3. Zieht den neuesten Code
4. Baut geänderte Container neu
5. Startet alle Services und wartet auf Health-Checks
6. Zeigt bei Fehlern automatisch die Logs der betroffenen Services

## 9.4 Portainer-Stack (Alternative)

Statt des Install-Scripts kann der Stack auch über Portainer deployed werden:

1. **Portainer** → **Stacks** → **Add Stack**
2. Name: `irm`
3. Build method: **Repository**
4. Repository URL: `https://github.com/Der-Daniel1980/IRM.git`
5. Compose path: `docker-compose.portainer.yml`
6. Reference: `refs/heads/main`
7. Environment Variables aus `.env.portainer.example` eintragen

## 9.5 URLs & Erst-Login

| Dienst | URL |
|---|---|
| Frontend (App) | `https://<SERVER-IP>/` — leitet zu Keycloak-Login weiter |
| API / Swagger | `https://<SERVER-IP>/api-docs/` |
| Keycloak Admin-Konsole | `https://<SERVER-IP>/auth/admin/master/console/` |

> **Hinweis:** Browser zeigt beim Self-Signed Zertifikat eine Warnung —
> "Erweitert" → "Fortfahren" klicken. Am besten Inkognito-Fenster nutzen.

### Zwei verschiedene Admin-Konten

1. **App-Login** (Realm `irm`, für die IRM-Oberfläche) — Seed-User aus `docker/keycloak/realm-irm.json`:

   | User | Passwort | Rolle |
   |---|---|---|
   | `admin` | `admin_change_me` | `irm-admin` (Vollzugriff, `/admin/users`) |
   | `disponent` | `disponent_change_me` | Disponent |
   | `mitarbeiter` | `mitarbeiter_change_me` | Mitarbeiter |

   ⚠️ **Diese Passwörter sind Default-Werte** — nach erstem Login unbedingt ändern (Keycloak Admin → Users → Credentials).

2. **Keycloak Master-Admin** (zum Verwalten von Keycloak selbst) — User `admin`, Passwort aus `/opt/irm/.env.portainer` (`KEYCLOAK_ADMIN_PASSWORD`).

## 9.5a Demo-Daten einspielen (optional)

Für erste Tests mit befüllten Stammdaten (Fähigkeiten, Tätigkeiten, Mitarbeiter, Immobilien, Aufträge):

```bash
cd /opt/irm/packages/backend
# Kurzlebiger Node-Container mit Netzwerkzugang zur DB
docker run --rm --network irm_irm-network \
  -v /opt/irm/packages/backend:/work -w /work \
  -e DATABASE_URL="$(grep ^DATABASE_URL /opt/irm/.env.portainer | cut -d= -f2-)" \
  node:20-alpine sh -c "apk add --no-cache openssl >/dev/null && \
    npm install --no-save --silent ts-node typescript @types/node && \
    npx prisma generate && npx prisma db seed"
```

Das Seed-Script ist idempotent (verwendet `upsert`) — mehrfaches Ausführen beschädigt keine Daten.

### Zusätzliche Demo-Bewegungsdaten (Kunden, Immobilien, Aufträge)

Für Kunden/Mitarbeiter/Immobilien/Maschinen/Aufträge gibt es einen Admin-Endpunkt:

- `POST /api/v1/admin/seed-demo` — legt 4 Kunden, 5 Immobilien, 5 Mitarbeiter, 7 Maschinen, 6 Aufträge an
- `DELETE /api/v1/admin/seed-demo` — räumt nur Datensätze mit Präfix `K-DEM`, `OBJ-DEM`, `MA-DEM` auf

Der Endpunkt ist per Default nur in Development (`APP_ENV=development`) aufrufbar. Für Demo auf einem Produktions-Deployment:

```bash
# 1. Kurzzeitig APP_ENV=development setzen
docker exec irm-backend sh -c 'export APP_ENV=development; kill -TERM 1' # Container startet neu, siehe unten
# Alternativ: in docker-compose.portainer.yml temporär APP_ENV: development ergänzen und Backend neu starten

# 2. Mit irm-admin-Token POST /api/v1/admin/seed-demo aufrufen

# 3. APP_ENV wieder entfernen und Backend neu starten
```

Die Demo-Datensätze tragen die Präfixe `K-DEM…`, `OBJ-DEM…`, `MA-DEM…` und können jederzeit via DELETE wieder entfernt werden.

## 9.6 Nützliche Befehle

```bash
# Service-Status
cd /opt/irm && docker compose -f docker-compose.portainer.yml ps

# Logs (alle Services)
cd /opt/irm && docker compose -f docker-compose.portainer.yml logs -f

# Logs (einzelner Service)
cd /opt/irm && docker compose -f docker-compose.portainer.yml logs -f backend

# Neustart
cd /opt/irm && docker compose -f docker-compose.portainer.yml --env-file .env.portainer restart

# Stoppen
cd /opt/irm && docker compose -f docker-compose.portainer.yml --env-file .env.portainer down
```

## 9.7 Troubleshooting & bekannte Bugfixes

Folgende Bugs wurden im ersten Deployment gefunden und gefixt — bei Re-Deployment aus älterem Branch ggf. erneut anwenden:

| Symptom | Ursache | Fix |
|---|---|---|
| Backend startet nicht (`Cannot find module '/app/dist/main'`) | `tsconfig.json` inkludiert `prisma/**/*` → `nest build` legt `dist/src/` statt `dist/` an | CMD in `docker/backend/Dockerfile` → `node dist/src/main` |
| Backend `EACCES: mkdir ./uploads/photos` | Named-Volume `upload_data` gehört nach Erstanlage root, Container-User ist `irm` | `mkdir -p /app/uploads/photos` **vor** `chown` im Dockerfile |
| `irm-init-ssl` Exit 127 | `alpine:3.20` hat kein `openssl` vorinstalliert | `apk add --no-cache openssl` am Anfang von `docker/nginx/init-ssl.sh` |
| Frontend bleibt "starting" | Healthcheck nutzt `localhost` → IPv6-Resolution scheitert, Next.js bindet nur IPv4 | `wget -qO- http://127.0.0.1:3000/` in Healthcheck |
| Login klappt, aber `/admin/users` zeigt „Fehler beim Laden" (Backend-Log: `Keycloak Admin-Token konnte nicht abgerufen werden`) | In `admin.service.ts` wurde `config.get('keycloak.url')` verwendet; `app.config.ts` registriert via `registerAs('app', ...)` → Pfad muss `app.keycloak.url` sein. Fallback auf `http://localhost:8080` schlug fehl. Zusätzlich fehlten `KEYCLOAK_ADMIN_USER/PASSWORD` in der Backend-Env. | Config-Pfade auf `app.keycloak.*` korrigiert; in `docker-compose.portainer.yml` Backend-Env um `KEYCLOAK_ADMIN_USER`/`KEYCLOAK_ADMIN_PASSWORD` ergänzt |
| Keycloak meldet `Realm 'irm' already exists. Import skipped` nach Änderung von `realm-irm.json` | `--import-realm` überschreibt nicht bei existierendem Realm | Volume löschen: `docker volume rm irm_keycloak_data`, dann `docker compose up -d keycloak` |
| Alte Postgres-Credentials nach Neu-Installation | `POSTGRES_PASSWORD` nur beim ersten Start des Volumes wirksam | Volume löschen: `docker volume rm irm_postgres_data` (⚠️ Datenverlust) |

### Diagnose-Workflow bei Problemen

```bash
# 1. Health-Übersicht
docker ps --format 'table {{.Names}}\t{{.Status}}'

# 2. Fehler-Logs des betroffenen Services
docker logs irm-backend --tail 50 2>&1 | grep -iE 'error|warn'

# 3. Env-Vars prüfen (nützlich bei "Config"-Problemen)
docker exec irm-backend printenv | grep -E 'KEYCLOAK|DATABASE|REDIS'

# 4. Interner Netzwerk-Zugriff testen (nützlich bei Connection-Refused)
docker exec irm-backend sh -c 'wget -qO- http://keycloak:8080/auth/realms/irm/.well-known/openid-configuration' | head -c 100
```

## 9.8 Docker-Architektur

```
┌─────────────────────────────────────────────────────────────┐
│  Nginx (Port 80/443, Self-Signed SSL)                       │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐               │
│  │ /        │→ │ Frontend │  │ Next.js:3000 │               │
│  │ /api/    │→ │ Backend  │  │ NestJS:3001  │               │
│  │ /auth/   │→ │ Keycloak │  │ KC:8080      │               │
│  │ /api-docs│→ │ Backend  │  │ Swagger      │               │
│  └─────────┘  └──────────┘  └──────────────┘               │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL:5432 │ Redis:6379 │ Meilisearch:7700            │
│  (PostGIS)       │ (BullMQ)   │ (Volltextsuche)             │
└─────────────────────────────────────────────────────────────┘
```

---

# 10. ERP-Integration (später)

Das IRM-System wird so gebaut, dass es später als Modul in das ERP integriert
werden kann:

- Gleiche Datenbank-Technologie (PostgreSQL)
- Gleiche Auth (Keycloak)
- Gleicher Tech-Stack (NestJS, React, Prisma)
- Gemeinsame Partner-Tabelle (ERP.partner → IRM.customer Mapping)
- Gemeinsame Nummernkreis-Logik
- Event-Bus-Kompatibilität (Redis Pub/Sub)
- Bei Integration: IRM wird ein NestJS-Modul im ERP-Monorepo

Migrationspfad:
1. IRM läuft standalone mit eigener DB
2. Bei ERP-Integration: DB-Schema wird in ERP-Schema gemerged
3. Kunden → Partner-Tabelle, Aufträge → gemeinsamer Belegfluss
4. Gemeinsames Auth, gemeinsames Dashboard
