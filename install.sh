#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  IRM — Immobilien- & Ressourcenmanagement                               ║
# ║  Vollständiges Install-Script für Ubuntu 22.04 / 24.04                   ║
# ║                                                                          ║
# ║  Verwendung:                                                             ║
# ║    curl -fsSL https://raw.githubusercontent.com/Der-Daniel1980/IRM/main/install.sh | bash  ║
# ║    oder:                                                                 ║
# ║    wget -qO- https://raw.githubusercontent.com/Der-Daniel1980/IRM/main/install.sh | bash   ║
# ║    oder:                                                                 ║
# ║    chmod +x install.sh && sudo ./install.sh                              ║
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

# ── Konfiguration ────────────────────────────────────────────────────────────
IRM_DIR="/opt/irm"
REPO_URL="https://github.com/Der-Daniel1980/IRM.git"
BRANCH="main"
COMPOSE_FILE="docker-compose.portainer.yml"

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║   IRM — Immobilien- & Ressourcenmanagement              ║${RESET}"
echo -e "${BOLD}${CYAN}║   Installations-Script                                  ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ── Server-IP ermitteln ──────────────────────────────────────────────────────
DEFAULT_IP=$(hostname -I | awk '{print $1}')
read -rp "$(echo -e "  ${BOLD}Server-IP${RESET} [${DEFAULT_IP}]: ")" INPUT_IP
SERVER_IP="${INPUT_IP:-$DEFAULT_IP}"
info "Verwende Server-IP: ${BOLD}${SERVER_IP}${RESET}"

# ══════════════════════════════════════════════════════════════════════════════
step "1/7 — System aktualisieren"
# ══════════════════════════════════════════════════════════════════════════════

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
ok "System aktualisiert"

# ══════════════════════════════════════════════════════════════════════════════
step "2/7 — Benötigte Pakete installieren"
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
step "3/7 — Docker installieren"
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
step "4/7 — IRM Repository klonen"
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
step "5/7 — Secrets generieren & .env erstellen"
# ══════════════════════════════════════════════════════════════════════════════

ENV_FILE="$IRM_DIR/.env.portainer"

generate_secret() {
  openssl rand -base64 32 | tr -d '/+=' | head -c 40
}

if [ -f "$ENV_FILE" ]; then
  warn ".env.portainer existiert bereits — wird NICHT überschrieben"
  warn "Zum Neuerstellen: rm $ENV_FILE && Script erneut ausführen"
else
  PG_PASSWORD=$(generate_secret)
  REDIS_PW=$(generate_secret)
  KC_PASSWORD=$(generate_secret)
  MEILI_KEY=$(generate_secret)
  JWT_SEC=$(generate_secret)
  NEXTAUTH_SEC=$(generate_secret)

  cat > "$ENV_FILE" <<ENVEOF
# ── IRM Environment — generiert am $(date '+%Y-%m-%d %H:%M:%S') ──────────
# Server
SERVER_IP=${SERVER_IP}

# PostgreSQL
POSTGRES_USER=irm
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=irm

# Redis
REDIS_PASSWORD=${REDIS_PW}

# Keycloak
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=${KC_PASSWORD}
KEYCLOAK_REALM=irm
KEYCLOAK_CLIENT_ID=irm-backend
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_CLIENT_ID_FRONTEND=irm-frontend

# Meilisearch
MEILISEARCH_API_KEY=${MEILI_KEY}

# Auth / Security
JWT_SECRET=${JWT_SEC}
NEXTAUTH_SECRET=${NEXTAUTH_SEC}

# Scheduling
WORK_DAY_START=07:00
WORK_DAY_END=17:00
BUFFER_BETWEEN_ORDERS_MIN=15
ENVEOF

  chmod 600 "$ENV_FILE"
  ok "Secrets generiert und in ${ENV_FILE} gespeichert"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "6/7 — Firewall konfigurieren"
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
step "7/7 — IRM Stack starten"
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
echo -e "  ${BOLD}Keycloak Admin Login:${RESET}"
echo -e "    User:     ${BOLD}admin${RESET}"
echo -e "    Passwort: ${BOLD}$(grep KEYCLOAK_ADMIN_PASSWORD "$ENV_FILE" | cut -d= -f2)${RESET}"
echo ""
echo -e "  ${BOLD}Dateien:${RESET}"
echo -e "    Installationsverzeichnis: ${CYAN}${IRM_DIR}${RESET}"
echo -e "    Environment-Datei:        ${CYAN}${ENV_FILE}${RESET}"
echo -e "    Alle Passwörter stehen in der .env.portainer Datei!"
echo ""
echo -e "  ${BOLD}Nützliche Befehle:${RESET}"
echo -e "    Status:    ${CYAN}cd ${IRM_DIR} && docker compose -f ${COMPOSE_FILE} ps${RESET}"
echo -e "    Logs:      ${CYAN}cd ${IRM_DIR} && docker compose -f ${COMPOSE_FILE} logs -f${RESET}"
echo -e "    Neustart:  ${CYAN}cd ${IRM_DIR} && docker compose -f ${COMPOSE_FILE} --env-file .env.portainer restart${RESET}"
echo -e "    Stoppen:   ${CYAN}cd ${IRM_DIR} && docker compose -f ${COMPOSE_FILE} --env-file .env.portainer down${RESET}"
echo -e "    Update:    ${CYAN}cd ${IRM_DIR} && git pull && docker compose -f ${COMPOSE_FILE} --env-file .env.portainer up -d --build${RESET}"
echo ""
echo -e "  ${YELLOW}Hinweis: Browser wird vor dem Self-Signed Zertifikat warnen —${RESET}"
echo -e "  ${YELLOW}einfach 'Erweitert' > 'Fortfahren' klicken.${RESET}"
echo ""
