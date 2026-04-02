.PHONY: up down restart logs ps clean

## Infrastruktur starten
up:
	docker compose up -d

## Infrastruktur stoppen
down:
	docker compose down

## Infrastruktur neu starten
restart:
	docker compose down && docker compose up -d

## Logs aller Services
logs:
	docker compose logs -f

## Status der Container
ps:
	docker compose ps

## Alle Container + Volumes löschen (Achtung: Datenverlust!)
clean:
	docker compose down -v --remove-orphans

## Nur PostgreSQL-Logs
logs-db:
	docker compose logs -f postgres

## Nur Keycloak-Logs
logs-keycloak:
	docker compose logs -f keycloak

## Postgres Shell
db-shell:
	docker compose exec postgres psql -U $${POSTGRES_USER:-irm} -d $${POSTGRES_DB:-irm_dev}

## Redis CLI
redis-cli:
	docker compose exec redis redis-cli

## Warten bis alle Services healthy sind
wait-healthy:
	@echo "Warte auf Datenbank..."
	@until docker compose exec -T postgres pg_isready -U $${POSTGRES_USER:-irm} -d $${POSTGRES_DB:-irm_dev} 2>/dev/null; do sleep 2; done
	@echo "Warte auf Redis..."
	@until docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do sleep 2; done
	@echo "Warte auf Meilisearch..."
	@until curl -sf http://localhost:7700/health 2>/dev/null; do sleep 2; done
	@echo "Alle Services bereit!"
