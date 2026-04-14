#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  IRM — Immobilien- & Ressourcenmanagement                               ║
# ║  Vollständiges Install-Script für Ubuntu 22.04 / 24.04                   ║
# ║                                                                          ║
# ║  Verwendung:                                                             ║
# ║    sudo ./install.sh                       (interaktiv)                  ║
# ║    sudo ./install.sh --auto 192.168.0.21   (nicht-interaktiv)            ║
# ╚══════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

# ── Hilfsfunktionen ──────────────────────────────────────────────────────────
info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
err()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
step()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${RESET}\n"; }

generate_secret() {
  openssl rand -base64 32 | tr -d '/+=' | head -c 40
}

# Interaktives Prompt mit Default-Wert
# Usage: ask "Label" "default_value" → Ergebnis in $REPLY
ask() {
  local label="$1" default="$2"
  if [ "$INTERACTIVE" = true ]; then
    read -rp "$(echo -e "  ${BOLD}${label}${RESET} [${default}]: ")" REPLY </dev/tty
    REPLY="${REPLY:-$default}"
  else
    REPLY="$default"
  fi
}

# Passwort-Prompt (versteckt Eingabe)
# Usage: ask_secret "Label" "default_value" → Ergebnis in $REPLY
ask_secret() {
  local label="$1" default="$2"
  if [ "$INTERACTIVE" = true ]; then
    echo -ne "  ${BOLD}${label}${RESET} [${default:0:8}...]: " >/dev/tty
    read -rs REPLY </dev/tty
    echo "" >/dev/tty
    REPLY="${REPLY:-$default}"
  else
    REPLY="$default"
  fi
}

# ── Root-Check ────────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  err "Dieses Script muss als root ausgeführt werden."
  echo "  sudo $0"
  exit 1
fi

# ── Betriebssystem prüfen ────────────────────────────────────────────────────
if ! grep -qi 'ubuntu\|debian' /etc/os-release 2>/dev/null; then
  warn "Dieses Script ist für Ubuntu/Debian optimiert. Andere Distros auf eigene Gefahr."
fi

# ── Argumente parsen ─────────────────────────────────────────────────────────
INTERACTIVE=true
AUTO_IP=""

while [ $# -gt 0 ]; do
  case "$1" in
    --auto)
      INTERACTIVE=false
      AUTO_IP="${2:-}"
      shift 2 || shift 1
      ;;
    *)
      AUTO_IP="$1"
      shift
      ;;
  esac
done

# Wenn stdin kein Terminal ist (curl|bash), automatisch non-interactive
if ! [ -t 0 ]; then
  INTERACTIVE=false
fi

# ── Konfiguration ────────────────────────────────────────────────────────────
IRM_DIR="/opt/irm"
REPO_URL="https://github.com/Der-Daniel1980/IRM.git"
BRANCH="main"
COMPOSE_FILE="docker-compose.portainer.yml"
ENV_FILE="$IRM_DIR/.env.portainer"

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║   IRM — Immobilien- & Ressourcenmanagement              ║${RESET}"
echo -e "${BOLD}${CYAN}║   Installations-Script                                  ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

if [ "$INTERACTIVE" = true ]; then
  info "Interaktiver Modus — du wirst nach Einstellungen gefragt."
  info "Enter drücken = Standardwert übernehmen."
else
  info "Automatischer Modus — Standardwerte werden verwendet."
fi
echo ""

# ══════════════════════════════════════════════════════════════════════════════
step "1/8 — Konfiguration abfragen"
# ══════════════════════════════════════════════════════════════════════════════

# ── Server-IP ────────────────────────────────────────────────────────────────
DEFAULT_IP="${AUTO_IP:-$(hostname -I | awk '{print $1}')}"
ask "Server-IP" "$DEFAULT_IP"
SERVER_IP="$REPLY"

if [ -z "$SERVER_IP" ]; then
  err "Konnte Server-IP nicht ermitteln. Bitte als Argument übergeben:"
  echo "  sudo ./install.sh 192.168.0.21"
  exit 1
fi
info "Server-IP: ${BOLD}${SERVER_IP}${RESET}"

# ── Datenbank ────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}${CYAN}── Datenbank (PostgreSQL) ──${RESET}"
ask "Datenbank-User" "irm"
CONF_PG_USER="$REPLY"

DEF_PG_PW=$(generate_secret)
ask_secret "Datenbank-Passwort" "$DEF_PG_PW"
CONF_PG_PASSWORD="$REPLY"

ask "Datenbank-Name" "irm"
CONF_PG_DB="$REPLY"

# ── Redis ────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}${CYAN}── Redis ──${RESET}"
DEF_REDIS_PW=$(generate_secret)
ask_secret "Redis-Passwort" "$DEF_REDIS_PW"
CONF_REDIS_PASSWORD="$REPLY"

# ── Keycloak ─────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}${CYAN}── Keycloak (Auth) ──${RESET}"
ask "Admin-Benutzer" "admin"
CONF_KC_USER="$REPLY"

DEF_KC_PW=$(generate_secret)
ask_secret "Admin-Passwort" "$DEF_KC_PW"
CONF_KC_PASSWORD="$REPLY"

ask "Realm" "irm"
CONF_KC_REALM="$REPLY"

ask "Backend Client-ID" "irm-backend"
CONF_KC_CLIENT="$REPLY"

ask "Frontend Client-ID" "irm-frontend"
CONF_KC_CLIENT_FE="$REPLY"

# ── Meilisearch ──────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}${CYAN}── Meilisearch (Suche) ──${RESET}"
DEF_MEILI_KEY=$(generate_secret)
ask_secret "API-Key" "$DEF_MEILI_KEY"
CONF_MEILI_KEY="$REPLY"

# ── Auth Secrets ─────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}${CYAN}── Auth / Security ──${RESET}"
DEF_JWT=$(generate_secret)
ask_secret "JWT-Secret" "$DEF_JWT"
CONF_JWT_SECRET="$REPLY"

DEF_NEXTAUTH=$(generate_secret)
ask_secret "NextAuth-Secret" "$DEF_NEXTAUTH"
CONF_NEXTAUTH_SECRET="$REPLY"

# ── Arbeitszeiten ────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}${CYAN}── Scheduling ──${RESET}"
ask "Arbeitsbeginn (HH:MM)" "07:00"
CONF_WORK_START="$REPLY"

ask "Arbeitsende (HH:MM)" "17:00"
CONF_WORK_END="$REPLY"

ask "Puffer zwischen Aufträgen (Min)" "15"
CONF_BUFFER="$REPLY"

# ── Zusammenfassung ──────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}═══ Zusammenfassung ═══${RESET}"
echo -e "    Server:       ${BOLD}${SERVER_IP}${RESET}"
echo -e "    DB:           ${CONF_PG_USER}@postgres/${CONF_PG_DB}"
echo -e "    Keycloak:     ${CONF_KC_USER} / Realm: ${CONF_KC_REALM}"
echo -e "    Arbeitszeit:  ${CONF_WORK_START} – ${CONF_WORK_END}"
echo ""

if [ "$INTERACTIVE" = true ]; then
  read -rp "$(echo -e "  ${BOLD}Installation starten? (j/N)${RESET}: ")" CONFIRM </dev/tty
  if [[ ! "$CONFIRM" =~ ^[jJyY]$ ]]; then
    info "Abgebrochen."
    exit 0
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
step "2/8 — System aktualisieren"
# ══════════════════════════════════════════════════════════════════════════════

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
ok "System aktualisiert"

# ══════════════════════════════════════════════════════════════════════════════
step "3/8 — Benötigte Pakete installieren"
# ══════════════════════════════════════════════════════════════════════════════

apt-get install -y -qq \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  openssl \
  ufw \
  htop \
  jq \
  unzip \
  wget \
  apt-transport-https \
  software-properties-common

ok "System-Pakete installiert"

# ══════════════════════════════════════════════════════════════════════════════
step "4/8 — Docker installieren"
# ══════════════════════════════════════════════════════════════════════════════

if command -v docker &>/dev/null; then
  ok "Docker ist bereits installiert: $(docker --version)"
else
  info "Installiere Docker..."

  # Docker GPG Key
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  # Docker Repository
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

  # Docker ohne sudo für aktuellen User (falls nicht root-Login)
  SUDO_USER_NAME="${SUDO_USER:-}"
  if [ -n "$SUDO_USER_NAME" ]; then
    usermod -aG docker "$SUDO_USER_NAME"
    info "User '$SUDO_USER_NAME' zur docker-Gruppe hinzugefügt (Neuanmeldung nötig)"
  fi

  systemctl enable docker
  systemctl start docker
  ok "Docker installiert: $(docker --version)"
fi

# Docker Compose prüfen
if docker compose version &>/dev/null; then
  ok "Docker Compose: $(docker compose version --short)"
else
  err "Docker Compose Plugin nicht gefunden!"
  exit 1
fi

# ══════════════════════════════════════════════════════════════════════════════
step "5/8 — IRM Repository klonen"
# ══════════════════════════════════════════════════════════════════════════════

if [ -d "$IRM_DIR/.git" ]; then
  info "Repository existiert bereits, aktualisiere..."
  cd "$IRM_DIR"
  git fetch origin
  git reset --hard "origin/${BRANCH}"
  ok "Repository aktualisiert"
else
  info "Klone Repository nach ${IRM_DIR}..."
  git clone --branch "$BRANCH" "$REPO_URL" "$IRM_DIR"
  ok "Repository geklont"
fi

cd "$IRM_DIR"

# ══════════════════════════════════════════════════════════════════════════════
step "6/8 — Environment-Datei erstellen"
# ══════════════════════════════════════════════════════════════════════════════

if [ -f "$ENV_FILE" ]; then
  warn ".env.portainer existiert bereits — erstelle Backup"
  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
fi

cat > "$ENV_FILE" <<ENVEOF
# ── IRM Environment — generiert am $(date '+%Y-%m-%d %H:%M:%S') ──────────
# Server
SERVER_IP=${SERVER_IP}

# PostgreSQL
POSTGRES_USER=${CONF_PG_USER}
POSTGRES_PASSWORD=${CONF_PG_PASSWORD}
POSTGRES_DB=${CONF_PG_DB}

# Redis
REDIS_PASSWORD=${CONF_REDIS_PASSWORD}

# Keycloak
KEYCLOAK_ADMIN_USER=${CONF_KC_USER}
KEYCLOAK_ADMIN_PASSWORD=${CONF_KC_PASSWORD}
KEYCLOAK_REALM=${CONF_KC_REALM}
KEYCLOAK_CLIENT_ID=${CONF_KC_CLIENT}
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_CLIENT_ID_FRONTEND=${CONF_KC_CLIENT_FE}

# Meilisearch
MEILISEARCH_API_KEY=${CONF_MEILI_KEY}

# Auth / Security
JWT_SECRET=${CONF_JWT_SECRET}
NEXTAUTH_SECRET=${CONF_NEXTAUTH_SECRET}

# Scheduling
WORK_DAY_START=${CONF_WORK_START}
WORK_DAY_END=${CONF_WORK_END}
BUFFER_BETWEEN_ORDERS_MIN=${CONF_BUFFER}
ENVEOF

chmod 600 "$ENV_FILE"

# Symlink .env → .env.portainer damit docker compose ohne --env-file funktioniert
ln -sf .env.portainer "$IRM_DIR/.env"

ok "Environment-Datei erstellt: ${ENV_FILE}"
ok "Symlink .env → .env.portainer erstellt"

# ══════════════════════════════════════════════════════════════════════════════
step "7/8 — Firewall konfigurieren"
# ══════════════════════════════════════════════════════════════════════════════

if command -v ufw &>/dev/null; then
  ufw --force reset >/dev/null 2>&1
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp    comment "SSH"
  ufw allow 80/tcp    comment "HTTP"
  ufw allow 443/tcp   comment "HTTPS"
  ufw allow 9000/tcp  comment "Portainer"
  ufw allow 9443/tcp  comment "Portainer HTTPS"
  ufw --force enable
  ok "Firewall konfiguriert (SSH, HTTP, HTTPS, Portainer)"
else
  warn "ufw nicht gefunden — Firewall manuell konfigurieren!"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "8/8 — IRM Stack starten"
# ══════════════════════════════════════════════════════════════════════════════

cd "$IRM_DIR"

info "Lade Docker-Images und baue Container..."
info "Das kann beim ersten Mal 5-15 Minuten dauern..."
echo ""

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache 2>&1 | tail -5

info "Starte alle Services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# ── Warte auf Health-Checks ─────────────────────────────────────────────────
echo ""
info "Warte auf Service-Start..."

SERVICES=("irm-postgres" "irm-redis" "irm-keycloak" "irm-meilisearch" "irm-backend" "irm-frontend" "irm-nginx")
MAX_WAIT=300
ELAPSED=0

all_healthy() {
  for svc in "${SERVICES[@]}"; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
    if [ "$status" != "healthy" ]; then
      return 1
    fi
  done
  return 0
}

while ! all_healthy; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    warn "Timeout nach ${MAX_WAIT}s — nicht alle Services sind healthy."
    warn "Prüfe mit: docker compose -f ${COMPOSE_FILE} ps"
    break
  fi
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  # Status-Übersicht
  echo -ne "\r  [${ELAPSED}s] "
  for svc in "${SERVICES[@]}"; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "?")
    name="${svc#irm-}"
    case "$status" in
      healthy)   echo -ne "${GREEN}${name}${RESET} " ;;
      starting)  echo -ne "${YELLOW}${name}${RESET} " ;;
      *)         echo -ne "${RED}${name}${RESET} " ;;
    esac
  done
done

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Ergebnis
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║   IRM wurde erfolgreich installiert!                    ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Zugriff:${RESET}"
echo -e "    Frontend:       ${CYAN}https://${SERVER_IP}${RESET}"
echo -e "    API / Swagger:  ${CYAN}https://${SERVER_IP}/api-docs/${RESET}"
echo -e "    Keycloak Admin: ${CYAN}https://${SERVER_IP}/auth/admin/${RESET}"
echo ""
echo -e "  ${BOLD}╔══ Generierte Zugangsdaten ══════════════════════════════╗${RESET}"
echo -e "  ${BOLD}║${RESET}  ${CYAN}PostgreSQL:${RESET}"
echo -e "  ${BOLD}║${RESET}    User:     ${BOLD}${CONF_PG_USER}${RESET}"
echo -e "  ${BOLD}║${RESET}    Passwort: ${BOLD}${CONF_PG_PASSWORD}${RESET}"
echo -e "  ${BOLD}║${RESET}    Datenbank:${BOLD}${CONF_PG_DB}${RESET}"
echo -e "  ${BOLD}║${RESET}"
echo -e "  ${BOLD}║${RESET}  ${CYAN}Redis:${RESET}"
echo -e "  ${BOLD}║${RESET}    Passwort: ${BOLD}${CONF_REDIS_PASSWORD}${RESET}"
echo -e "  ${BOLD}║${RESET}"
echo -e "  ${BOLD}║${RESET}  ${CYAN}Keycloak:${RESET}"
echo -e "  ${BOLD}║${RESET}    User:     ${BOLD}${CONF_KC_USER}${RESET}"
echo -e "  ${BOLD}║${RESET}    Passwort: ${BOLD}${CONF_KC_PASSWORD}${RESET}"
echo -e "  ${BOLD}║${RESET}    Realm:    ${BOLD}${CONF_KC_REALM}${RESET}"
echo -e "  ${BOLD}║${RESET}"
echo -e "  ${BOLD}║${RESET}  ${CYAN}Meilisearch:${RESET}"
echo -e "  ${BOLD}║${RESET}    API-Key:  ${BOLD}${CONF_MEILI_KEY}${RESET}"
echo -e "  ${BOLD}║${RESET}"
echo -e "  ${BOLD}║${RESET}  ${CYAN}JWT Secret:${RESET}"
echo -e "  ${BOLD}║${RESET}    ${BOLD}${CONF_JWT_SECRET}${RESET}"
echo -e "  ${BOLD}║${RESET}"
echo -e "  ${BOLD}║${RESET}  ${CYAN}NextAuth Secret:${RESET}"
echo -e "  ${BOLD}║${RESET}    ${BOLD}${CONF_NEXTAUTH_SECRET}${RESET}"
echo -e "  ${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${YELLOW}WICHTIG: Diese Passwörter werden nur EINMAL angezeigt!${RESET}"
echo -e "  ${YELLOW}Sichere sie JETZT an einem sicheren Ort!${RESET}"
echo -e "  ${YELLOW}Backup: ${ENV_FILE}${RESET}"
echo ""
echo -e "  ${BOLD}Dateien:${RESET}"
echo -e "    Installationsverzeichnis: ${CYAN}${IRM_DIR}${RESET}"
echo -e "    Environment-Datei:        ${CYAN}${ENV_FILE}${RESET}"
echo ""
echo -e "  ${BOLD}Nützliche Befehle:${RESET}"
echo -e "    Status:    ${CYAN}cd ${IRM_DIR} && docker compose -f ${COMPOSE_FILE} ps${RESET}"
echo -e "    Logs:      ${CYAN}cd ${IRM_DIR} && docker compose -f ${COMPOSE_FILE} logs -f${RESET}"
echo -e "    Neustart:  ${CYAN}cd ${IRM_DIR} && docker compose -f ${COMPOSE_FILE} restart${RESET}"
echo -e "    Stoppen:   ${CYAN}cd ${IRM_DIR} && docker compose -f ${COMPOSE_FILE} down${RESET}"
echo -e "    Update:    ${CYAN}sudo /opt/irm/update.sh${RESET}"
echo ""
echo -e "  ${YELLOW}Hinweis: Browser wird vor dem Self-Signed Zertifikat warnen —${RESET}"
echo -e "  ${YELLOW}einfach 'Erweitert' > 'Fortfahren' klicken.${RESET}"
echo ""
