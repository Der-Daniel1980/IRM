#!/bin/sh
# ── IRM — Self-Signed SSL Certificate Init Container ──────────────────────────
# Generiert ein Self-Signed Zertifikat falls noch keines existiert.
# Wird als Init-Container in docker-compose.portainer.yml verwendet.
set -e

SSL_DIR="/ssl"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"
SERVER_IP="${SERVER_IP:-192.168.0.21}"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "[init-ssl] Zertifikat existiert bereits — ueberspringe Generierung."
  echo "[init-ssl] Zum Erneuern: Volume 'ssl_certs' loeschen und Stack neu starten."
  exit 0
fi

echo "[init-ssl] Generiere Self-Signed Zertifikat fuer ${SERVER_IP}..."

# SAN (Subject Alternative Name) für IP-Zugriff
SAN="IP:${SERVER_IP},DNS:localhost,IP:127.0.0.1"

openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$KEY_FILE" \
  -out    "$CERT_FILE" \
  -days   825 \
  -nodes \
  -subj   "/C=DE/ST=Bayern/L=Muenchen/O=IRM System/OU=Local/CN=${SERVER_IP}" \
  -addext "subjectAltName=${SAN}" \
  -addext "basicConstraints=CA:FALSE" \
  -addext "keyUsage=digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth" \
  2>/dev/null

chmod 644 "$CERT_FILE"
chmod 600 "$KEY_FILE"

echo "[init-ssl] Zertifikat erstellt!"
echo "[init-ssl]   Cert: $CERT_FILE"
echo "[init-ssl]   Key:  $KEY_FILE"
echo "[init-ssl]   SAN:  $SAN"
echo "[init-ssl]   Gueltig: 825 Tage"
