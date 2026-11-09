.PHONY: setup start test lint check up down traffic events reset

setup:
	pnpm install --frozen-lockfile
start:
	pnpm start
test:
	pnpm test
lint:
	pnpm lint
check: lint test
up:
	mkdir -p var
	LOCAL_UID=$$(id -u) LOCAL_GID=$$(id -g) docker compose up --build -d --wait
down:
	docker compose down
traffic:
	docker compose exec -T -e TRAFFIC_RUN_ID="$${TRAFFIC_RUN_ID:-$${RUN_ID:-}}" -e ROUNDS="$${ROUNDS:-3}" app node scripts/traffic.ts
events:
	docker compose exec -T app node scripts/events.ts
reset:
	docker compose down
	LOCAL_UID=$$(id -u) LOCAL_GID=$$(id -g) docker compose run --rm --no-deps app node scripts/reset.ts
