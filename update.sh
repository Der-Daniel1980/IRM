#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  IRM — Update-Script                                                    ║
# ║                                                                          ║
# ║  Aktualisiert IRM auf die neueste Version:                               ║
# ║    - Zieht neuen Code von GitHub                                         ║
# ║    - Baut Container mit Änderungen neu                                   ║
# ║    - Führt Datenbank-Migrationen aus                                     ║
# ║    - Startet betroffene Services neu                                     ║
# ║                                                                          ║
# ║  Verwendung:                                                             ║
# ║    sudo /opt/irm/update.sh                                               ║
# ║    sudo /opt/irm/update.sh --force    (erzwingt Neuaufbau aller Images)  ║
# ╚══════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

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

# ── Konfiguration ────────────────────────────────────────────────────────────
IRM_DIR="/opt/irm"
COMPOSE_FILE="docker-compose.portainer.yml"
ENV_FILE="$IRM_DIR/.env.portainer"
BRANCH="main"
FORCE_BUILD=false

# Argumente parsen
while [ $# -gt 0 ]; do
  case "$1" in
    --force|-f) FORCE_BUILD=true; shift ;;
    *) shift ;;
  esac
done

# ── Prüfungen ────────────────────────────────────────────────────────────────
if [ ! -d "$IRM_DIR/.git" ]; then
  err "IRM ist nicht installiert unter ${IRM_DIR}"
  err "Bitte zuerst install.sh ausführen."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  err "Environment-Datei nicht gefunden: ${ENV_FILE}"
  exit 1
fi

cd "$IRM_DIR"

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║   IRM — Update                                          ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
step "1/5 — Aktuellen Stand prüfen"
# ══════════════════════════════════════════════════════════════════════════════

CURRENT_COMMIT=$(git rev-parse --short HEAD)
info "Aktueller Commit: ${BOLD}${CURRENT_COMMIT}${RESET}"

git fetch origin "$BRANCH" --quiet
REMOTE_COMMIT=$(git rev-parse --short "origin/${BRANCH}")

if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ] && [ "$FORCE_BUILD" = false ]; then
  ok "Bereits auf dem neuesten Stand (${CURRENT_COMMIT})"
  echo ""
  info "Zum erzwungenen Neuaufbau: sudo $0 --force"
  exit 0
fi

if [ "$CURRENT_COMMIT" != "$REMOTE_COMMIT" ]; then
  info "Neuer Stand verfügbar: ${BOLD}${CURRENT_COMMIT} → ${REMOTE_COMMIT}${RESET}"
  echo ""
  # Zeige was sich geändert hat
  info "Änderungen:"
  git log --oneline "${CURRENT_COMMIT}..origin/${BRANCH}" | head -20 | while read -r line; do
    echo -e "    ${GREEN}+${RESET} $line"
  done
  echo ""
fi

# ══════════════════════════════════════════════════════════════════════════════
step "2/5 — Code aktualisieren"
# ══════════════════════════════════════════════════════════════════════════════

git reset --hard "origin/${BRANCH}"
NEW_COMMIT=$(git rev-parse --short HEAD)
ok "Code aktualisiert auf ${NEW_COMMIT}"

# ══════════════════════════════════════════════════════════════════════════════
step "3/5 — Container neu bauen"
# ══════════════════════════════════════════════════════════════════════════════

BUILD_ARGS=""
if [ "$FORCE_BUILD" = true ]; then
  BUILD_ARGS="--no-cache"
  info "Erzwungener Neuaufbau (--no-cache)"
fi

info "Baue Container... (das kann ein paar Minuten dauern)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build $BUILD_ARGS 2>&1 | tail -10
ok "Container gebaut"

# ══════════════════════════════════════════════════════════════════════════════
step "4/5 — Services aktualisieren"
# ══════════════════════════════════════════════════════════════════════════════

info "Starte aktualisierte Services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans
ok "Services gestartet"

# ══════════════════════════════════════════════════════════════════════════════
step "5/5 — Health-Check"
# ══════════════════════════════════════════════════════════════════════════════

SERVICES=("irm-postgres" "irm-redis" "irm-keycloak" "irm-meilisearch" "irm-backend" "irm-frontend" "irm-nginx")
MAX_WAIT=180
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

info "Warte auf Health-Checks..."

while ! all_healthy; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    warn "Timeout nach ${MAX_WAIT}s"
    echo ""
    warn "Service-Status:"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo ""
    warn "Logs der fehlerhaften Services prüfen mit:"
    echo "  docker compose -f ${COMPOSE_FILE} logs <service-name>"
    exit 1
  fi
  sleep 10
  ELAPSED=$((ELAPSED + 10))
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
echo ""

# ── Aufräumen ────────────────────────────────────────────────────────────────
info "Räume alte Docker-Images auf..."
docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true
ok "Aufgeräumt"

# ── Ergebnis ─────────────────────────────────────────────────────────────────
SERVER_IP=$(grep SERVER_IP "$ENV_FILE" | cut -d= -f2)

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║   IRM Update erfolgreich!                               ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  Version:  ${BOLD}${NEW_COMMIT}${RESET}"
echo -e "  Frontend: ${CYAN}https://${SERVER_IP}${RESET}"
echo ""
