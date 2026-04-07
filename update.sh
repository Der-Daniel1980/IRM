#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  IRM — Update-Script                                                    ║
# ║                                                                          ║
# ║  Aktualisiert IRM auf die neueste Version:                               ║
# ║    - Stoppt alle Container sauber                                        ║
# ║    - Räumt alte Container/Images auf                                     ║
# ║    - Zieht neuen Code von GitHub                                         ║
# ║    - Baut Container mit Änderungen neu                                   ║
# ║    - Führt Datenbank-Migrationen aus                                     ║
# ║    - Startet alle Services                                               ║
# ║                                                                          ║
# ║  Verwendung:                                                             ║
# ║    sudo /opt/irm/update.sh                                               ║
# ║    sudo /opt/irm/update.sh --force    (erzwingt Neuaufbau aller Images)  ║
# ║    sudo /opt/irm/update.sh --clean    (Komplett-Reset ohne Daten)        ║
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
CLEAN_MODE=false

# Argumente parsen
while [ $# -gt 0 ]; do
  case "$1" in
    --force|-f) FORCE_BUILD=true; shift ;;
    --clean|-c) CLEAN_MODE=true; FORCE_BUILD=true; shift ;;
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

if [ "$CLEAN_MODE" = true ]; then
  warn "CLEAN-Modus: Alle Container werden entfernt und neu aufgebaut"
  warn "Datenbank-Volumes bleiben erhalten!"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "1/6 — Aktuellen Stand prüfen"
# ══════════════════════════════════════════════════════════════════════════════

CURRENT_COMMIT=$(git rev-parse --short HEAD)
info "Aktueller Commit: ${BOLD}${CURRENT_COMMIT}${RESET}"

git fetch origin "$BRANCH" --quiet
REMOTE_COMMIT=$(git rev-parse --short "origin/${BRANCH}")

if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ] && [ "$FORCE_BUILD" = false ]; then
  ok "Bereits auf dem neuesten Stand (${CURRENT_COMMIT})"
  echo ""
  info "Zum erzwungenen Neuaufbau: sudo $0 --force"
  info "Zum Komplett-Reset:        sudo $0 --clean"
  exit 0
fi

if [ "$CURRENT_COMMIT" != "$REMOTE_COMMIT" ]; then
  info "Neuer Stand verfügbar: ${BOLD}${CURRENT_COMMIT} → ${REMOTE_COMMIT}${RESET}"
  echo ""
  info "Änderungen:"
  git log --oneline "${CURRENT_COMMIT}..origin/${BRANCH}" | head -20 | while read -r line; do
    echo -e "    ${GREEN}+${RESET} $line"
  done
  echo ""
fi

# ══════════════════════════════════════════════════════════════════════════════
step "2/6 — Alte Container stoppen & aufräumen"
# ══════════════════════════════════════════════════════════════════════════════

info "Stoppe laufende Container..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans 2>/dev/null || true
ok "Container gestoppt"

# Verwaiste IRM-Container entfernen (von früheren Versuchen)
ORPHAN_CONTAINERS=$(docker ps -a --filter "name=irm-" --format '{{.Names}}' 2>/dev/null || true)
if [ -n "$ORPHAN_CONTAINERS" ]; then
  info "Entferne verwaiste Container..."
  echo "$ORPHAN_CONTAINERS" | xargs -r docker rm -f 2>/dev/null || true
  ok "Verwaiste Container entfernt"
fi

if [ "$CLEAN_MODE" = true ]; then
  info "Entferne alte Build-Images..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --rmi local --remove-orphans 2>/dev/null || true

  # Auch manuell gebaute IRM-Images entfernen
  IRM_IMAGES=$(docker images --filter "reference=*irm*" --format '{{.ID}}' 2>/dev/null || true)
  if [ -n "$IRM_IMAGES" ]; then
    echo "$IRM_IMAGES" | xargs -r docker rmi -f 2>/dev/null || true
  fi
  ok "Alte Images entfernt"
fi

# Dangling images aufräumen
info "Räume Docker-Cache auf..."
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --filter "until=24h" >/dev/null 2>&1 || true
ok "Docker-Cache aufgeräumt"

# ══════════════════════════════════════════════════════════════════════════════
step "3/6 — Code aktualisieren"
# ══════════════════════════════════════════════════════════════════════════════

git reset --hard "origin/${BRANCH}"
NEW_COMMIT=$(git rev-parse --short HEAD)
ok "Code aktualisiert auf ${NEW_COMMIT}"

# ══════════════════════════════════════════════════════════════════════════════
step "4/6 — Container neu bauen"
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
step "5/6 — Services starten"
# ══════════════════════════════════════════════════════════════════════════════

info "Starte alle Services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans
ok "Services gestartet"

# ══════════════════════════════════════════════════════════════════════════════
step "6/6 — Health-Check"
# ══════════════════════════════════════════════════════════════════════════════

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

info "Warte auf Health-Checks..."

while ! all_healthy; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    warn "Timeout nach ${MAX_WAIT}s"
    echo ""
    echo ""
    warn "Service-Status:"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo ""

    # Zeige Logs der fehlerhaften Services
    for svc in "${SERVICES[@]}"; do
      status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
      if [ "$status" != "healthy" ]; then
        name="${svc#irm-}"
        echo ""
        warn "Logs von ${name} (letzte 20 Zeilen):"
        docker logs --tail 20 "$svc" 2>&1 | while read -r line; do
          echo "    $line"
        done
      fi
    done

    echo ""
    warn "Manuell debuggen:"
    echo "  docker compose -f ${COMPOSE_FILE} --env-file .env.portainer logs -f <service>"
    echo "  docker compose -f ${COMPOSE_FILE} --env-file .env.portainer ps"
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
      unhealthy) echo -ne "${RED}${name}${RESET} " ;;
      *)         echo -ne "${YELLOW}${name}?${RESET} " ;;
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
