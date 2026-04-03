#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  IRM — Self-Signed SSL Certificate Generator                            ║
# ║  Nur für Entwicklung / Tests — NICHT für Produktion!                    ║
# ║  In Produktion übernimmt Let's Encrypt (certbot) automatisch.           ║
# ╚══════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

# ── Verzeichnis sicherstellen ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$SCRIPT_DIR/nginx/ssl"
mkdir -p "$SSL_DIR"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║  IRM — Self-Signed Zertifikat                    ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${YELLOW}⚠️  Nur für Entwicklung / interne Tests!${RESET}"
echo -e "   In Produktion: Let's Encrypt läuft automatisch via certbot."
echo ""

# ── Domain ermitteln ─────────────────────────────────────────────────────────
ENV_FILE="$(dirname "$SCRIPT_DIR")/.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  DOMAIN_FROM_ENV=$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" || true)
fi
DEFAULT_DOMAIN="${DOMAIN_FROM_ENV:-localhost}"

read -rp "$(echo -e "  ${BOLD}Domain / IP${RESET} [${DEFAULT_DOMAIN}]: ")" INPUT_DOMAIN
DOMAIN="${INPUT_DOMAIN:-$DEFAULT_DOMAIN}"

# ── Gültigkeitsdauer ─────────────────────────────────────────────────────────
read -rp "$(echo -e "  ${BOLD}Gültigkeitsdauer in Tagen${RESET} [365]: ")" INPUT_DAYS
DAYS="${INPUT_DAYS:-365}"

CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

echo ""
echo -e "  Zertifikat für: ${BOLD}${DOMAIN}${RESET}"
echo -e "  Gültig für:     ${BOLD}${DAYS} Tage${RESET}"
echo -e "  Ausgabe nach:   ${BOLD}${SSL_DIR}/${RESET}"
echo ""

# ── Vorhandene Zertifikate sichern ───────────────────────────────────────────
if [ -f "$CERT_FILE" ] || [ -f "$KEY_FILE" ]; then
  BACKUP_SUFFIX="$(date +%Y%m%d_%H%M%S)"
  echo -e "  ${YELLOW}ℹ️  Vorhandene Zertifikate werden gesichert (.bak.${BACKUP_SUFFIX})${RESET}"
  [ -f "$CERT_FILE" ] && mv "$CERT_FILE" "${CERT_FILE}.bak.${BACKUP_SUFFIX}"
  [ -f "$KEY_FILE"  ] && mv "$KEY_FILE"  "${KEY_FILE}.bak.${BACKUP_SUFFIX}"
fi

# ── openssl prüfen ────────────────────────────────────────────────────────────
if ! command -v openssl &>/dev/null; then
  echo -e "${RED}❌ openssl nicht gefunden. Bitte zuerst installieren:${RESET}"
  echo "   Debian/Ubuntu: sudo apt install openssl"
  echo "   macOS:         brew install openssl"
  exit 1
fi

# ── Zertifikat generieren ─────────────────────────────────────────────────────
echo -e "  🔑 Generiere RSA-4096-Schlüssel + Zertifikat..."

# Subject Alternative Names für localhost + IP + Domain
SAN="DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1"
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  # Reine IP-Adresse
  SAN="IP:${DOMAIN},DNS:localhost,IP:127.0.0.1"
fi

openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$KEY_FILE" \
  -out    "$CERT_FILE" \
  -days   "$DAYS" \
  -nodes \
  -subj   "/C=DE/ST=Bayern/L=München/O=IRM System/OU=Dev/CN=${DOMAIN}" \
  -addext "subjectAltName=${SAN}" \
  -addext "basicConstraints=CA:FALSE" \
  -addext "keyUsage=digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth" \
  2>/dev/null

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

# ── Zertifikat-Info ausgeben ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✅ Zertifikat erfolgreich erstellt!${RESET}"
echo ""
echo -e "  ${BOLD}Dateien:${RESET}"
echo -e "    Zertifikat: ${CYAN}${CERT_FILE}${RESET}"
echo -e "    Schlüssel:  ${CYAN}${KEY_FILE}${RESET}"
echo ""

# Fingerprint anzeigen
FINGERPRINT=$(openssl x509 -in "$CERT_FILE" -noout -fingerprint -sha256 2>/dev/null | cut -d'=' -f2)
VALID_UNTIL=$(openssl x509 -in "$CERT_FILE" -noout -enddate 2>/dev/null | cut -d'=' -f2)
echo -e "  ${BOLD}SHA-256 Fingerprint:${RESET}"
echo -e "    ${FINGERPRINT}"
echo ""
echo -e "  ${BOLD}Gültig bis:${RESET} ${VALID_UNTIL}"
echo ""

# ── nginx.conf Hinweis ────────────────────────────────────────────────────────
echo -e "${YELLOW}${BOLD}📋 Nächste Schritte für Entwicklung/Test:${RESET}"
echo ""
echo -e "  1. nginx.conf anpassen — SSL-Pfade auf Self-Signed umstellen:"
echo -e "     ${CYAN}ssl_certificate     /etc/nginx/ssl/cert.pem;${RESET}"
echo -e "     ${CYAN}ssl_certificate_key /etc/nginx/ssl/key.pem;${RESET}"
echo ""
echo -e "  2. nginx.conf.selfsigned Template nutzen:"
echo -e "     ${CYAN}cp docker/nginx/nginx.conf docker/nginx/nginx.conf.letsencrypt.bak${RESET}"
echo -e "     ${CYAN}cp docker/nginx/nginx.conf.selfsigned docker/nginx/nginx.conf${RESET}"
echo ""
echo -e "  3. Produktions-Stack neu starten:"
echo -e "     ${CYAN}make prod-down && make prod-up${RESET}"
echo ""
echo -e "  ${YELLOW}⚠️  Browser wird das Zertifikat als nicht vertrauenswürdig anzeigen.${RESET}"
echo -e "     Das ist normal für Self-Signed — einfach die Ausnahme bestätigen."
echo ""
echo -e "${GREEN}${BOLD}Für Produktion: 'make prod-up' startet certbot automatisch.${RESET}"
echo -e "${GREEN}Erstes Let's Encrypt-Zertifikat anfordern:${RESET}"
echo ""
echo -e "  ${CYAN}docker compose -f docker-compose.prod.yml exec certbot \\"${RESET}
echo -e "  ${CYAN}  certbot certonly --webroot -w /var/www/certbot \\"${RESET}
echo -e "  ${CYAN}  -d ${DOMAIN} --email admin@${DOMAIN} --agree-tos --non-interactive${RESET}"
echo ""
