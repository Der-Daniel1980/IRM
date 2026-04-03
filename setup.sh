#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║   IRM — Interaktives Ersteinrichtungs-Script                     ║
# ║   Immobilien- & Ressourcenmanagement System                      ║
# ╚══════════════════════════════════════════════════════════════════╝

# ─── Farb-Variablen ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Hilfsfunktionen ──────────────────────────────────────────────
print_step()    { echo -e "\n${BOLD}${BLUE}▶  $1${RESET}"; }
print_success() { echo -e "${GREEN}✔  $1${RESET}"; }
print_warning() { echo -e "${YELLOW}⚠  $1${RESET}"; }
print_error()   { echo -e "${RED}✘  $1${RESET}"; }
print_info()    { echo -e "${CYAN}ℹ  $1${RESET}"; }
print_line()    { echo -e "${BLUE}──────────────────────────────────────────────────────${RESET}"; }

# Passwort-maskierung für Ausgabe
mask() { echo "${1:0:2}$(printf '*%.0s' {1..8})"; }

# Sichere Zufalls-String-Generierung
gen_secret() {
  local length="${1:-48}"
  if command -v openssl &>/dev/null; then
    openssl rand -base64 "$length"
  else
    date +%s%N | sha256sum | head -c "$length"
  fi
}

# Eingabe mit Default-Wert
prompt_default() {
  local prompt="$1"
  local default="$2"
  local result
  if [ -n "$default" ]; then
    read -r -p "$(echo -e "  ${CYAN}${prompt}${RESET} [${YELLOW}${default}${RESET}]: ")" result
    echo "${result:-$default}"
  else
    read -r -p "$(echo -e "  ${CYAN}${prompt}${RESET}: ")" result
    echo "$result"
  fi
}

# Ja/Nein-Abfrage
prompt_yn() {
  local prompt="$1"
  local default="${2:-n}"
  local result
  local display
  if [ "$default" = "y" ]; then display="[Y/n]"; else display="[y/N]"; fi
  read -r -p "$(echo -e "  ${CYAN}${prompt}${RESET} ${display}: ")" result
  result="${result:-$default}"
  [[ "$result" =~ ^[Yy]$ ]]
}

# ══════════════════════════════════════════════════════════════════
# BANNER
# ══════════════════════════════════════════════════════════════════
clear
echo ""
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${BLUE}║${RESET}  ${CYAN}🏢  IRM — Ersteinrichtung${RESET}                          ${BOLD}${BLUE}║${RESET}"
echo -e "${BOLD}${BLUE}║${RESET}  ${RESET}Immobilien- & Ressourcenmanagement System${RESET}          ${BOLD}${BLUE}║${RESET}"
echo -e "${BOLD}${BLUE}║${RESET}                                                      ${BOLD}${BLUE}║${RESET}"
echo -e "${BOLD}${BLUE}║${RESET}  ${YELLOW}Version: v0.1.0   |   $(date '+%d.%m.%Y')${RESET}                   ${BOLD}${BLUE}║${RESET}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
print_info "Dieses Script richtet das IRM-System ein und erstellt eine .env Datei."
print_info "Drücke ENTER um Standardwerte zu übernehmen (in eckigen Klammern)."
echo ""

# ══════════════════════════════════════════════════════════════════
# SCHRITT 1: Voraussetzungs-Check
# ══════════════════════════════════════════════════════════════════
print_step "Schritt 1/8 — Voraussetzungen prüfen"
print_line

PREREQ_OK=true
for cmd in docker node npm git; do
  if command -v "$cmd" &>/dev/null; then
    version=$("$cmd" --version 2>/dev/null | head -1)
    print_success "$cmd gefunden: $version"
  else
    print_error "$cmd nicht gefunden — bitte installieren!"
    PREREQ_OK=false
  fi
done

# docker compose (plugin) oder docker-compose (standalone)
if docker compose version &>/dev/null 2>&1; then
  print_success "docker compose (plugin) gefunden: $(docker compose version --short 2>/dev/null)"
  DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  print_success "docker-compose gefunden: $(docker-compose --version | head -1)"
  DOCKER_COMPOSE_CMD="docker-compose"
else
  print_error "docker compose nicht gefunden — bitte Docker Desktop oder docker-compose-plugin installieren!"
  PREREQ_OK=false
fi

if [ "$PREREQ_OK" = false ]; then
  echo ""
  print_error "Nicht alle Voraussetzungen erfüllt. Bitte fehlende Tools installieren und erneut starten."
  exit 1
fi

print_success "Alle Voraussetzungen erfüllt!"
echo ""

# ══════════════════════════════════════════════════════════════════
# SCHRITT 2: Firmendaten
# ══════════════════════════════════════════════════════════════════
print_step "Schritt 2/8 — Firmendaten"
print_line

COMPANY_NAME=$(prompt_default "Firmenname" "Muster Hausverwaltung GmbH")
COMPANY_STREET=$(prompt_default "Straße + Hausnummer" "Musterstraße 1")
COMPANY_ZIP=$(prompt_default "PLZ" "12345")
COMPANY_CITY=$(prompt_default "Stadt" "Musterstadt")
COMPANY_PHONE=$(prompt_default "Telefon (optional)" "")
COMPANY_EMAIL=$(prompt_default "E-Mail" "info@firma.de")
COMPANY_WEBSITE=$(prompt_default "Website (optional)" "")

echo ""
print_info "Arbeitszeiten & Planung:"
WORK_DAY_START=$(prompt_default "Standard-Arbeitszeit von" "07:00")
WORK_DAY_END=$(prompt_default "Standard-Arbeitszeit bis" "17:00")
BUFFER_BETWEEN_ORDERS_MIN=$(prompt_default "Pufferzeit zwischen Aufträgen (Minuten)" "15")

# ══════════════════════════════════════════════════════════════════
# SCHRITT 3: Admin-Zugangsdaten
# ══════════════════════════════════════════════════════════════════
print_step "Schritt 3/8 — Admin-Zugangsdaten"
print_line

ADMIN_USER=$(prompt_default "Admin-Benutzername" "admin")

while true; do
  read -r -s -p "$(echo -e "  ${CYAN}Admin-Passwort${RESET} (mind. 8 Zeichen, Eingabe versteckt): ")" ADMIN_PASSWORD
  echo ""
  if [ -z "$ADMIN_PASSWORD" ]; then
    print_warning "Passwort darf nicht leer sein."
    continue
  fi
  if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
    print_warning "Passwort muss mindestens 8 Zeichen lang sein."
    continue
  fi
  read -r -s -p "$(echo -e "  ${CYAN}Passwort bestätigen${RESET}: ")" ADMIN_PASSWORD_CONFIRM
  echo ""
  if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; then
    print_warning "Passwörter stimmen nicht überein. Bitte erneut versuchen."
    continue
  fi
  print_success "Passwort gesetzt."
  break
done

# ══════════════════════════════════════════════════════════════════
# SCHRITT 4: Datenbank-Konfiguration
# ══════════════════════════════════════════════════════════════════
print_step "Schritt 4/8 — Datenbank-Konfiguration"
print_line

POSTGRES_USER="irm"
POSTGRES_DB=$(prompt_default "Datenbank-Name" "irm_prod")

read -r -s -p "$(echo -e "  ${CYAN}DB-Passwort${RESET} (leer lassen für Auto-Generierung): ")" POSTGRES_PASSWORD_INPUT
echo ""

if [ -z "$POSTGRES_PASSWORD_INPUT" ]; then
  POSTGRES_PASSWORD=$(gen_secret 24 | tr -dc 'A-Za-z0-9!@#$%' | head -c 24)
  print_success "DB-Passwort automatisch generiert."
else
  POSTGRES_PASSWORD="$POSTGRES_PASSWORD_INPUT"
  print_success "DB-Passwort übernommen."
fi

POSTGRES_HOST="postgres"
POSTGRES_PORT="5432"

# ══════════════════════════════════════════════════════════════════
# SCHRITT 5: Deployment-Art
# ══════════════════════════════════════════════════════════════════
print_step "Schritt 5/8 — Deployment-Art"
print_line

echo ""
echo -e "  ${BOLD}[1]${RESET} Lokale Entwicklung  ${CYAN}(APP_ENV=development, keine Domain nötig)${RESET}"
echo -e "  ${BOLD}[2]${RESET} Server / Produktion ${CYAN}(APP_ENV=production, Domain erforderlich)${RESET}"
echo ""

DEPLOY_CHOICE=""
while [[ ! "$DEPLOY_CHOICE" =~ ^[12]$ ]]; do
  read -r -p "$(echo -e "  ${CYAN}Deployment-Art wählen${RESET} [1/2]: ")" DEPLOY_CHOICE
done

if [ "$DEPLOY_CHOICE" = "1" ]; then
  APP_ENV="development"
  APP_DOMAIN="localhost"
  KEYCLOAK_URL="http://localhost:8080"
  NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
  NEXT_PUBLIC_KEYCLOAK_URL="http://localhost:8080"
  BACKEND_URL="http://localhost:3001"
  MEILISEARCH_HOST="http://localhost:7700"
  print_success "Lokale Entwicklung ausgewählt."
else
  APP_ENV="production"
  APP_DOMAIN=$(prompt_default "Domain (z.B. irm.meinefirma.de)" "irm.meinefirma.de")
  KEYCLOAK_URL="https://${APP_DOMAIN}/auth"
  NEXT_PUBLIC_API_URL="https://${APP_DOMAIN}/api/v1"
  NEXT_PUBLIC_KEYCLOAK_URL="https://${APP_DOMAIN}/auth"
  BACKEND_URL="https://${APP_DOMAIN}"
  MEILISEARCH_HOST="http://meilisearch:7700"
  print_success "Produktion ausgewählt — Domain: ${APP_DOMAIN}"
fi

APP_PORT="3001"
FRONTEND_PORT="3000"

# ══════════════════════════════════════════════════════════════════
# SCHRITT 6: Secrets generieren
# ══════════════════════════════════════════════════════════════════
print_step "Schritt 6/8 — Secrets generieren"
print_line

echo ""
print_info "Generiere kryptografisch sichere Zufallswerte..."

JWT_SECRET=$(gen_secret 48)
KEYCLOAK_CLIENT_SECRET=$(gen_secret 24)
MEILISEARCH_API_KEY=$(gen_secret 24)

# Keycloak-Admin-Passwort vom Admin-Passwort ableiten oder separat setzen
KEYCLOAK_ADMIN_USER="$ADMIN_USER"
KEYCLOAK_ADMIN_PASSWORD="$ADMIN_PASSWORD"

print_success "JWT_SECRET generiert ($(echo "$JWT_SECRET" | wc -c | tr -d ' ') Bytes)"
print_success "KEYCLOAK_CLIENT_SECRET generiert"
print_success "MEILISEARCH_API_KEY generiert"

DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

# Redis-Konfiguration
REDIS_HOST="redis"
REDIS_PORT="6379"

# Keycloak-Realm & Client-IDs
KEYCLOAK_REALM="irm"
KEYCLOAK_CLIENT_ID="irm-backend"
KEYCLOAK_FRONTEND_CLIENT_ID="irm-frontend"

# ══════════════════════════════════════════════════════════════════
# SCHRITT 7: Zusammenfassung
# ══════════════════════════════════════════════════════════════════
print_step "Schritt 7/8 — Zusammenfassung"
print_line

echo ""
echo -e "${BOLD}${CYAN}Firmendaten:${RESET}"
echo -e "  Firma:          ${COMPANY_NAME}"
echo -e "  Adresse:        ${COMPANY_STREET}, ${COMPANY_ZIP} ${COMPANY_CITY}"
[ -n "$COMPANY_PHONE" ]   && echo -e "  Telefon:        ${COMPANY_PHONE}"
echo -e "  E-Mail:         ${COMPANY_EMAIL}"
[ -n "$COMPANY_WEBSITE" ] && echo -e "  Website:        ${COMPANY_WEBSITE}"
echo ""
echo -e "${BOLD}${CYAN}Arbeitszeiten:${RESET}"
echo -e "  Arbeitszeit:    ${WORK_DAY_START} – ${WORK_DAY_END}"
echo -e "  Pufferzeit:     ${BUFFER_BETWEEN_ORDERS_MIN} Minuten"
echo ""
echo -e "${BOLD}${CYAN}Admin-Zugang:${RESET}"
echo -e "  Benutzername:   ${ADMIN_USER}"
echo -e "  Passwort:       $(mask "$ADMIN_PASSWORD")"
echo ""
echo -e "${BOLD}${CYAN}Datenbank:${RESET}"
echo -e "  Host:           ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo -e "  Datenbank:      ${POSTGRES_DB}"
echo -e "  Benutzer:       ${POSTGRES_USER}"
echo -e "  Passwort:       $(mask "$POSTGRES_PASSWORD")"
echo ""
echo -e "${BOLD}${CYAN}Deployment:${RESET}"
echo -e "  Umgebung:       ${APP_ENV}"
echo -e "  Domain:         ${APP_DOMAIN}"
echo -e "  Backend-Port:   ${APP_PORT}"
echo -e "  Frontend-Port:  ${FRONTEND_PORT}"
echo ""
echo -e "${BOLD}${CYAN}Secrets:${RESET}"
echo -e "  JWT_SECRET:             $(mask "$JWT_SECRET")"
echo -e "  KEYCLOAK_CLIENT_SECRET: $(mask "$KEYCLOAK_CLIENT_SECRET")"
echo -e "  MEILISEARCH_API_KEY:    $(mask "$MEILISEARCH_API_KEY")"
echo ""
print_line

if ! prompt_yn "Konfiguration korrekt? .env Datei erstellen?" "y"; then
  print_warning "Setup abgebrochen. Bitte erneut starten."
  exit 0
fi

# ══════════════════════════════════════════════════════════════════
# SCHRITT 8: .env Datei schreiben
# ══════════════════════════════════════════════════════════════════
print_step "Schritt 8/8 — .env Datei erstellen"
print_line

ENV_FILE="$(dirname "$0")/.env"

# Backup falls bereits vorhanden
if [ -f "$ENV_FILE" ]; then
  BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
  cp "$ENV_FILE" "$BACKUP_FILE"
  print_warning "Bestehende .env gesichert: ${BACKUP_FILE}"
fi

cat > "$ENV_FILE" <<EOF
# ════════════════════════════════════════════════════════════════
# IRM — Umgebungsvariablen
# Generiert am: $(date '+%d.%m.%Y %H:%M:%S')
# ACHTUNG: Diese Datei enthält Secrets — NIEMALS in Git committen!
# ════════════════════════════════════════════════════════════════

# ─── App ────────────────────────────────────────────────────────
APP_ENV=${APP_ENV}
APP_PORT=${APP_PORT}
APP_DOMAIN=${APP_DOMAIN}
JWT_SECRET=${JWT_SECRET}

# ─── Firmendaten ────────────────────────────────────────────────
COMPANY_NAME=${COMPANY_NAME}
COMPANY_STREET=${COMPANY_STREET}
COMPANY_ZIP=${COMPANY_ZIP}
COMPANY_CITY=${COMPANY_CITY}
COMPANY_PHONE=${COMPANY_PHONE}
COMPANY_EMAIL=${COMPANY_EMAIL}
COMPANY_WEBSITE=${COMPANY_WEBSITE}

# ─── Arbeitszeiten ──────────────────────────────────────────────
WORK_DAY_START=${WORK_DAY_START}
WORK_DAY_END=${WORK_DAY_END}
BUFFER_BETWEEN_ORDERS_MIN=${BUFFER_BETWEEN_ORDERS_MIN}

# ─── Datenbank (PostgreSQL 16 + PostGIS) ────────────────────────
POSTGRES_HOST=${POSTGRES_HOST}
POSTGRES_PORT=${POSTGRES_PORT}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
DATABASE_URL=${DATABASE_URL}

# ─── Redis ──────────────────────────────────────────────────────
REDIS_HOST=${REDIS_HOST}
REDIS_PORT=${REDIS_PORT}

# ─── Keycloak (Auth / SSO) ──────────────────────────────────────
KEYCLOAK_URL=${KEYCLOAK_URL}
KEYCLOAK_REALM=${KEYCLOAK_REALM}
KEYCLOAK_CLIENT_ID=${KEYCLOAK_CLIENT_ID}
KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET}
KEYCLOAK_ADMIN_USER=${KEYCLOAK_ADMIN_USER}
KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_ADMIN_PASSWORD}

# ─── Meilisearch ────────────────────────────────────────────────
MEILISEARCH_HOST=${MEILISEARCH_HOST}
MEILISEARCH_API_KEY=${MEILISEARCH_API_KEY}

# ─── Frontend (Next.js) ─────────────────────────────────────────
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
NEXT_PUBLIC_KEYCLOAK_URL=${NEXT_PUBLIC_KEYCLOAK_URL}
NEXT_PUBLIC_KEYCLOAK_REALM=${KEYCLOAK_REALM}
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=${KEYCLOAK_FRONTEND_CLIENT_ID}
BACKEND_URL=${BACKEND_URL}
FRONTEND_PORT=${FRONTEND_PORT}
EOF

chmod 600 "$ENV_FILE"
print_success ".env Datei erstellt: ${ENV_FILE}"
print_success "Dateiberechtigungen auf 600 gesetzt (nur Owner lesbar)."

# Prüfen ob .gitignore vorhanden und .env drin
GITIGNORE_FILE="$(dirname "$0")/.gitignore"
if [ -f "$GITIGNORE_FILE" ]; then
  if ! grep -q "^\.env$" "$GITIGNORE_FILE" 2>/dev/null; then
    echo ".env" >> "$GITIGNORE_FILE"
    print_success ".env zu .gitignore hinzugefügt."
  else
    print_info ".env ist bereits in .gitignore eingetragen."
  fi
else
  print_warning ".gitignore nicht gefunden — bitte .env manuell ausschließen!"
fi

# ══════════════════════════════════════════════════════════════════
# AKTIONEN
# ══════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${BLUE}║${RESET}  ${YELLOW}Aktionen${RESET}                                             ${BOLD}${BLUE}║${RESET}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""

PROJECT_DIR="$(dirname "$0")"

# Aktion 1: Docker starten
if prompt_yn "Docker-Infrastruktur starten? (PostgreSQL, Redis, Keycloak, Meilisearch)" "y"; then
  echo ""
  print_info "Starte Docker-Container..."
  if $DOCKER_COMPOSE_CMD -f "${PROJECT_DIR}/docker-compose.yml" --env-file "${ENV_FILE}" up -d; then
    print_success "Docker-Container gestartet!"
    echo ""
    print_info "Warte auf Datenbankbereitschaft (max. 60 Sekunden)..."
    WAIT_COUNT=0
    until $DOCKER_COMPOSE_CMD -f "${PROJECT_DIR}/docker-compose.yml" exec -T postgres \
        pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" &>/dev/null; do
      WAIT_COUNT=$((WAIT_COUNT + 1))
      if [ $WAIT_COUNT -ge 30 ]; then
        print_warning "Datenbank nach 60 Sekunden noch nicht bereit. Bitte manuell prüfen."
        break
      fi
      printf "."
      sleep 2
    done
    echo ""
    print_success "Datenbank ist bereit!"
  else
    print_error "Docker-Start fehlgeschlagen. Bitte Logs prüfen: ${DOCKER_COMPOSE_CMD} logs"
  fi
fi

# Aktion 2: Migrationen
if prompt_yn "Datenbank-Migrationen ausführen? (Prisma migrate deploy)" "y"; then
  echo ""
  print_info "Führe Prisma-Migrationen aus..."
  if cd "${PROJECT_DIR}" && DATABASE_URL="${DATABASE_URL}" npx prisma migrate deploy 2>&1; then
    print_success "Migrationen erfolgreich ausgeführt!"
  else
    print_warning "Migrationen fehlgeschlagen oder noch keine vorhanden."
    print_info "Manuell ausführen: cd ${PROJECT_DIR} && npx prisma migrate deploy"
  fi
fi

# Aktion 3: Basis-Daten
if prompt_yn "Basis-Daten laden? (Tätigkeitskatalog, Fähigkeiten, Rollen)" "y"; then
  echo ""
  print_info "Lade Basis-Daten..."
  SEED_SCRIPT="${PROJECT_DIR}/packages/backend/src/database/seeds/seed-base.ts"
  SEED_SCRIPT_ALT="${PROJECT_DIR}/prisma/seed.ts"
  if [ -f "$SEED_SCRIPT" ]; then
    if cd "${PROJECT_DIR}" && DATABASE_URL="${DATABASE_URL}" npx ts-node "$SEED_SCRIPT" 2>&1; then
      print_success "Basis-Daten geladen!"
    else
      print_warning "Seeding fehlgeschlagen. Bitte manuell ausführen."
    fi
  elif [ -f "$SEED_SCRIPT_ALT" ]; then
    if cd "${PROJECT_DIR}" && DATABASE_URL="${DATABASE_URL}" npx ts-node "$SEED_SCRIPT_ALT" 2>&1; then
      print_success "Basis-Daten geladen!"
    else
      print_warning "Seeding fehlgeschlagen. Bitte manuell ausführen."
    fi
  else
    print_warning "Kein Seed-Script gefunden. Bitte manuell ausführen wenn vorhanden."
  fi
fi

# Aktion 4: Demo-Daten
if prompt_yn "Demo-Daten laden? (Muster-Immobilien, Aufträge, Personal)" "n"; then
  echo ""
  print_info "Lade Demo-Daten..."
  DEMO_SCRIPT="${PROJECT_DIR}/packages/backend/src/database/seeds/seed-demo.ts"
  DEMO_SCRIPT_ALT="${PROJECT_DIR}/prisma/seed-demo.ts"
  if [ -f "$DEMO_SCRIPT" ]; then
    if cd "${PROJECT_DIR}" && DATABASE_URL="${DATABASE_URL}" npx ts-node "$DEMO_SCRIPT" 2>&1; then
      print_success "Demo-Daten geladen!"
    else
      print_warning "Demo-Seeding fehlgeschlagen. Bitte manuell ausführen."
    fi
  elif [ -f "$DEMO_SCRIPT_ALT" ]; then
    if cd "${PROJECT_DIR}" && DATABASE_URL="${DATABASE_URL}" npx ts-node "$DEMO_SCRIPT_ALT" 2>&1; then
      print_success "Demo-Daten geladen!"
    else
      print_warning "Demo-Seeding fehlgeschlagen. Bitte manuell ausführen."
    fi
  else
    print_warning "Kein Demo-Seed-Script gefunden."
  fi
fi

# ══════════════════════════════════════════════════════════════════
# ABSCHLUSS
# ══════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  ${BOLD}✔  Einrichtung abgeschlossen!${RESET}                       ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${BOLD}${CYAN}Nächste Schritte:${RESET}"
echo ""
echo -e "  ${BOLD}1.${RESET} Backend starten:"
echo -e "     ${YELLOW}cd ${PROJECT_DIR}/packages/backend && npm run start:dev${RESET}"
echo ""
echo -e "  ${BOLD}2.${RESET} Frontend starten:"
echo -e "     ${YELLOW}cd ${PROJECT_DIR}/packages/frontend && npm run dev${RESET}"
echo ""
echo -e "  ${BOLD}3.${RESET} Oder alles auf einmal (wenn npm workspaces eingerichtet):"
echo -e "     ${YELLOW}cd ${PROJECT_DIR} && npm run dev${RESET}"
echo ""
echo -e "${BOLD}${CYAN}URLs:${RESET}"
if [ "$APP_ENV" = "development" ]; then
  echo -e "  ${BOLD}Frontend:${RESET}     ${GREEN}http://localhost:${FRONTEND_PORT}${RESET}"
  echo -e "  ${BOLD}Backend API:${RESET}  ${GREEN}http://localhost:${APP_PORT}/api/v1${RESET}"
  echo -e "  ${BOLD}Swagger UI:${RESET}   ${GREEN}http://localhost:${APP_PORT}/api/docs${RESET}"
  echo -e "  ${BOLD}Keycloak:${RESET}     ${GREEN}http://localhost:8080${RESET}"
  echo -e "  ${BOLD}Meilisearch:${RESET}  ${GREEN}http://localhost:7700${RESET}"
else
  echo -e "  ${BOLD}Frontend:${RESET}     ${GREEN}https://${APP_DOMAIN}${RESET}"
  echo -e "  ${BOLD}Backend API:${RESET}  ${GREEN}https://${APP_DOMAIN}/api/v1${RESET}"
  echo -e "  ${BOLD}Swagger UI:${RESET}   ${GREEN}https://${APP_DOMAIN}/api/docs${RESET}"
  echo -e "  ${BOLD}Keycloak:${RESET}     ${GREEN}https://${APP_DOMAIN}/auth${RESET}"
fi
echo ""
echo -e "${BOLD}${CYAN}Admin-Login:${RESET}"
echo -e "  Benutzername: ${BOLD}${ADMIN_USER}${RESET}"
echo -e "  Passwort:     ${BOLD}$(mask "$ADMIN_PASSWORD")${RESET}  ${CYAN}(wie vergeben)${RESET}"
echo ""

# .env Datei maskiert anzeigen
echo -e "${BOLD}${CYAN}Erstellte .env Datei (Passwörter maskiert):${RESET}"
print_line
while IFS= read -r line; do
  # Zeilen mit sensiblen Keys maskieren
  if echo "$line" | grep -qiE '(PASSWORD|SECRET|KEY|JWT)=.+'; then
    KEY="${line%%=*}"
    VAL="${line#*=}"
    if [ -n "$VAL" ] && [[ "$VAL" != "change_me"* ]]; then
      echo -e "  ${KEY}=${YELLOW}$(mask "$VAL")${RESET}"
    else
      echo "  $line"
    fi
  elif [[ "$line" == "#"* ]] || [[ -z "$line" ]]; then
    echo -e "  ${CYAN}${line}${RESET}"
  else
    echo "  $line"
  fi
done < "$ENV_FILE"
print_line

echo ""
print_info "Konfigurationsdatei: ${ENV_FILE}"
print_info "Bei Problemen: https://github.com/Der-Daniel1980/IRM/issues"
echo ""
echo -e "${BOLD}${GREEN}Viel Erfolg mit IRM! 🏢${RESET}"
echo ""
