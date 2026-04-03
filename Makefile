# ╔══════════════════════════════════════════════════════════╗
# ║  IRM — Makefile                                          ║
# ║  Immobilien- & Ressourcenmanagement                      ║
# ╚══════════════════════════════════════════════════════════╝

.PHONY: setup install \
        up down restart logs ps db-shell redis-cli wait-healthy \
        logs-db logs-keycloak logs-meilisearch \
        prod-build prod-up prod-down prod-logs \
        migrate migrate-dev seed seed-demo db-reset backup \
        dev-backend dev-frontend dev \
        test test-backend test-frontend test-e2e \
        ssl-selfsigned ssl-letsencrypt \
        lint clean help

# ──────────────────────────────────────────────────────────
# Variablen
# ──────────────────────────────────────────────────────────
COMPOSE        := docker compose
COMPOSE_PROD   := docker compose -f docker-compose.prod.yml
BACKEND_DIR    := packages/backend
FRONTEND_DIR   := packages/frontend
API_BASE       := http://localhost:3001/api/v1

# .env laden, falls vorhanden
-include .env

# ══════════════════════════════════════════════════════════
# 🚀 ERSTEINRICHTUNG
# ══════════════════════════════════════════════════════════

setup: ## 🚀 Führt das Setup-Skript aus (Ersteinrichtung)
	@echo "🚀 Starte IRM-Ersteinrichtung..."
	@if [ ! -f .env ]; then \
		echo "📋 .env aus .env.example erstellen..."; \
		cp .env.example .env; \
		echo "⚠️  Bitte .env anpassen, dann erneut 'make setup' ausführen!"; \
		exit 1; \
	fi
	@bash IRM-SETUP.sh
	@echo "✅ Ersteinrichtung abgeschlossen"

install: ## 🚀 Installiert npm-Abhängigkeiten in allen Packages
	@echo "📦 Installiere Backend-Abhängigkeiten..."
	cd $(BACKEND_DIR) && npm install
	@echo "📦 Installiere Frontend-Abhängigkeiten..."
	cd $(FRONTEND_DIR) && npm install
	@echo "✅ Alle Abhängigkeiten installiert"

# ══════════════════════════════════════════════════════════
# 🐳 INFRASTRUKTUR (Dev)
# ══════════════════════════════════════════════════════════

up: ## 🐳 Startet alle Docker-Services (Dev)
	@echo "🚀 Starte IRM-Infrastruktur..."
	$(COMPOSE) up -d
	@echo "✅ Services gestartet — nutze 'make logs' für Ausgabe"

down: ## 🐳 Stoppt alle Docker-Services
	@echo "🛑 Stoppe IRM-Infrastruktur..."
	$(COMPOSE) down
	@echo "✅ Services gestoppt"

restart: ## 🐳 Startet alle Docker-Services neu
	@echo "🔄 Neustart IRM-Infrastruktur..."
	$(COMPOSE) down
	$(COMPOSE) up -d
	@echo "✅ Services neu gestartet"

logs: ## 🐳 Zeigt Live-Logs aller Services
	$(COMPOSE) logs -f

logs-db: ## 🐳 Zeigt nur PostgreSQL-Logs
	$(COMPOSE) logs -f postgres

logs-keycloak: ## 🐳 Zeigt nur Keycloak-Logs
	$(COMPOSE) logs -f keycloak

logs-meilisearch: ## 🐳 Zeigt nur Meilisearch-Logs
	$(COMPOSE) logs -f meilisearch

ps: ## 🐳 Zeigt Status aller Container
	$(COMPOSE) ps

db-shell: ## 🐳 Öffnet eine PostgreSQL-Shell
	@echo "🗄️  Verbinde mit PostgreSQL..."
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-irm} -d $${POSTGRES_DB:-irm_dev}

redis-cli: ## 🐳 Öffnet eine Redis-CLI
	@echo "📡 Verbinde mit Redis..."
	$(COMPOSE) exec redis redis-cli

wait-healthy: ## 🐳 Wartet bis alle Services bereit sind
	@echo "⏳ Warte auf PostgreSQL..."
	@until $(COMPOSE) exec -T postgres pg_isready -U $${POSTGRES_USER:-irm} -d $${POSTGRES_DB:-irm_dev} 2>/dev/null; do \
		printf '.'; sleep 2; \
	done
	@echo " ✅ PostgreSQL bereit"
	@echo "⏳ Warte auf Redis..."
	@until $(COMPOSE) exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do \
		printf '.'; sleep 2; \
	done
	@echo " ✅ Redis bereit"
	@echo "⏳ Warte auf Keycloak..."
	@until curl -sf http://localhost:8080/health/ready 2>/dev/null; do \
		printf '.'; sleep 5; \
	done
	@echo " ✅ Keycloak bereit"
	@echo "⏳ Warte auf Meilisearch..."
	@until curl -sf http://localhost:7700/health 2>/dev/null; do \
		printf '.'; sleep 2; \
	done
	@echo " ✅ Meilisearch bereit"
	@echo "✅ Alle Services sind bereit!"

# ══════════════════════════════════════════════════════════
# 🏭 PRODUKTION
# ══════════════════════════════════════════════════════════

prod-build: ## 🏭 Baut den Produktions-Stack
	@echo "🏭 Baue Produktions-Images..."
	$(COMPOSE_PROD) build --no-cache
	@echo "✅ Produktions-Images gebaut"

prod-up: ## 🏭 Startet den Produktions-Stack
	@echo "🏭 Starte Produktions-Stack..."
	$(COMPOSE_PROD) up -d
	@echo "✅ Produktions-Stack gestartet"

prod-down: ## 🏭 Stoppt den Produktions-Stack
	@echo "🛑 Stoppe Produktions-Stack..."
	$(COMPOSE_PROD) down
	@echo "✅ Produktions-Stack gestoppt"

prod-logs: ## 🏭 Zeigt Live-Logs des Produktions-Stacks
	$(COMPOSE_PROD) logs -f

# ══════════════════════════════════════════════════════════
# 🗄️ DATENBANK
# ══════════════════════════════════════════════════════════

migrate: ## 🗄️ Führt Prisma-Migrationen aus (deploy, für Prod/CI)
	@echo "🗄️  Führe Datenbankmigrationen aus..."
	cd $(BACKEND_DIR) && DATABASE_URL=$${DATABASE_URL} npx prisma migrate deploy
	@echo "✅ Migrationen abgeschlossen"

migrate-dev: ## 🗄️ Erstellt neue Prisma-Migration (für Entwicklung)
	@echo "🗄️  Erstelle Entwicklungs-Migration..."
	cd $(BACKEND_DIR) && npx prisma migrate dev
	@echo "✅ Migration erstellt und angewendet"

seed: ## 🗄️ Spielt Basis-Seed-Daten ein (Tätigkeiten, Fähigkeiten)
	@echo "🌱 Spiele Basis-Seed-Daten ein..."
	cd $(BACKEND_DIR) && npx prisma db seed
	@echo "✅ Seed-Daten eingespielt"

seed-demo: ## 🗄️ Spielt Demo-Daten über API ein (Kunden, Immobilien etc.)
	@echo "🌱 Spiele Demo-Daten über API ein..."
	@echo "  → Erstelle Demo-Kunden..."
	curl -sf -X POST $(API_BASE)/customers/seed-demo || echo "  ⚠️  Endpoint nicht verfügbar"
	@echo "  → Erstelle Demo-Immobilien..."
	curl -sf -X POST $(API_BASE)/properties/seed-demo || echo "  ⚠️  Endpoint nicht verfügbar"
	@echo "  → Erstelle Demo-Mitarbeiter..."
	curl -sf -X POST $(API_BASE)/staff/seed-demo || echo "  ⚠️  Endpoint nicht verfügbar"
	@echo "✅ Demo-Daten eingespielt"

db-reset: ## 🗄️ ⚠️  Setzt die Datenbank komplett zurück (DATENVERLUST!)
	@echo "⚠️  WARNUNG: Diese Aktion löscht ALLE Daten!"
	@echo "   Drücke Ctrl+C zum Abbrechen oder warte 5 Sekunden..."
	@sleep 5
	@echo "🗑️  Setze Datenbank zurück..."
	cd $(BACKEND_DIR) && npx prisma migrate reset --force
	@echo "✅ Datenbank zurückgesetzt und Basis-Seed eingespielt"

backup: ## 🗄️ Erstellt ein Datenbankbackup (pg_dump)
	@echo "💾 Erstelle Datenbankbackup..."
	@mkdir -p backups
	$(COMPOSE) exec -T postgres pg_dump \
		-U $${POSTGRES_USER:-irm} \
		-d $${POSTGRES_DB:-irm_dev} \
		--no-password \
		> backups/irm_backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup gespeichert in backups/"

# ══════════════════════════════════════════════════════════
# ⚙️ ENTWICKLUNG
# ══════════════════════════════════════════════════════════

dev-backend: ## ⚙️ Startet das Backend im Entwicklungsmodus (Watch)
	@echo "⚙️  Starte Backend (Port 3001)..."
	cd $(BACKEND_DIR) && npm run start:dev

dev-frontend: ## ⚙️ Startet das Frontend im Entwicklungsmodus (Watch)
	@echo "⚙️  Starte Frontend (Port 3002)..."
	cd $(FRONTEND_DIR) && npm run dev

dev: ## ⚙️ Startet Backend und Frontend parallel im Hintergrund
	@echo "⚙️  Starte Backend + Frontend parallel..."
	@$(MAKE) dev-backend &
	@$(MAKE) dev-frontend &
	@echo "✅ Backend: http://localhost:3001"
	@echo "✅ Frontend: http://localhost:3002"
	@echo "✅ API-Docs: http://localhost:3001/api/docs"
	@echo "   Stoppen: kill \$$(lsof -ti:3001,3002)"

# ══════════════════════════════════════════════════════════
# 🧪 TESTS
# ══════════════════════════════════════════════════════════

test: ## 🧪 Führt alle Tests aus (Backend + Frontend)
	@echo "🧪 Starte alle Tests..."
	@$(MAKE) test-backend
	@$(MAKE) test-frontend
	@echo "✅ Alle Tests abgeschlossen"

test-backend: ## 🧪 Führt Backend-Unit-Tests aus (Jest)
	@echo "🧪 Backend-Tests (Jest)..."
	cd $(BACKEND_DIR) && npm test
	@echo "✅ Backend-Tests abgeschlossen"

test-frontend: ## 🧪 Führt Frontend-Tests aus (Vitest)
	@echo "🧪 Frontend-Tests (Vitest)..."
	cd $(FRONTEND_DIR) && npm test -- --run
	@echo "✅ Frontend-Tests abgeschlossen"

test-e2e: ## 🧪 Führt End-to-End-Tests aus (Playwright)
	@echo "🧪 E2E-Tests (Playwright)..."
	@if [ -d "packages/e2e" ]; then \
		cd packages/e2e && npx playwright test; \
	else \
		cd $(BACKEND_DIR) && npm run test:e2e; \
	fi
	@echo "✅ E2E-Tests abgeschlossen"

test-coverage: ## 🧪 Führt Tests mit Coverage-Bericht aus
	@echo "🧪 Tests mit Coverage..."
	cd $(BACKEND_DIR) && npm run test:cov
	cd $(FRONTEND_DIR) && npm run test:coverage
	@echo "✅ Coverage-Berichte erstellt"

# ══════════════════════════════════════════════════════════
# 🔧 HILFSBEFEHLE
# ══════════════════════════════════════════════════════════

lint: ## 🔧 Führt ESLint auf Backend und Frontend aus
	@echo "🔍 Linting Backend..."
	cd $(BACKEND_DIR) && npm run lint
	@echo "🔍 Linting Frontend..."
	cd $(FRONTEND_DIR) && npm run lint
	@echo "✅ Linting abgeschlossen"

prisma-studio: ## 🔧 Öffnet Prisma Studio (Datenbankbrowser)
	@echo "🔧 Öffne Prisma Studio auf Port 5555..."
	cd $(BACKEND_DIR) && npx prisma studio

prisma-generate: ## 🔧 Generiert Prisma Client neu
	@echo "🔧 Generiere Prisma Client..."
	cd $(BACKEND_DIR) && npx prisma generate
	@echo "✅ Prisma Client generiert"

ssl-selfsigned: ## 🔐 Erstellt selbstsigniertes SSL-Zertifikat (nur für Dev/Test!)
	@echo "🔐 Erstelle self-signed Zertifikat..."
	@bash docker/ssl-selfsigned.sh
	@echo "✅ Zertifikat in docker/nginx/ssl/ gespeichert"

ssl-letsencrypt: ## 🔐 Fordert Let's Encrypt Zertifikat an (Produktion)
	@echo "🔐 Fordere Let's Encrypt Zertifikat an für: $${DOMAIN:-localhost}"
	@if [ -z "$${DOMAIN}" ] || [ "$${DOMAIN}" = "localhost" ]; then \
		echo "❌ DOMAIN muss in .env gesetzt sein (nicht 'localhost')"; \
		exit 1; \
	fi
	$(COMPOSE_PROD) exec certbot certbot certonly \
		--webroot -w /var/www/certbot \
		-d $${DOMAIN} \
		--email $${LETSENCRYPT_EMAIL:-admin@$${DOMAIN}} \
		--agree-tos --non-interactive
	@echo "✅ Zertifikat erhalten — nginx neu laden:"
	@echo "   make prod-down && make prod-up"

clean: ## 🔧 Löscht node_modules und Build-Artefakte
	@echo "🗑️  Lösche Build-Artefakte..."
	rm -rf $(BACKEND_DIR)/node_modules $(BACKEND_DIR)/dist $(BACKEND_DIR)/coverage
	rm -rf $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/coverage
	@echo "✅ Bereinigt"

clean-docker: ## 🔧 Löscht Container + Volumes (⚠️ Datenverlust!)
	@echo "⚠️  WARNUNG: Alle Docker-Volumes werden gelöscht!"
	@sleep 3
	$(COMPOSE) down -v --remove-orphans
	@echo "✅ Docker-Umgebung bereinigt"

# ══════════════════════════════════════════════════════════
# ❓ HILFE
# ══════════════════════════════════════════════════════════

help: ## ❓ Zeigt diese Hilfe an
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════╗"
	@echo "║  IRM — Immobilien- & Ressourcenmanagement                ║"
	@echo "║  Verfügbare Make-Targets                                  ║"
	@echo "╚══════════════════════════════════════════════════════════╝"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' Makefile | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' | \
		sort
	@echo ""
	@echo "  Beispiele:"
	@echo "    make up            → Infrastruktur starten"
	@echo "    make dev           → Backend + Frontend starten"
	@echo "    make test          → Alle Tests ausführen"
	@echo "    make migrate-dev   → Neue Migration erstellen"
	@echo ""

.DEFAULT_GOAL := help
