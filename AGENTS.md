# AGENTS.md

Инструкции для AI-агентов, работающих в репозитории `incident-lab`.

## О проекте

Учебное приложение «Магазин инженера»: каталог, поиск, корзина и оформление заказа.
Цены хранятся в копейках. Часть операций в исходной версии завершается ошибкой — это
ожидаемое поведение стенда, а не сбой окружения.

Стек: Node.js 26 (запуск TypeScript без сборки), pnpm 12, встроенный `node:sqlite`,
`@sentry/node` с файловым транспортом. Облачный Sentry, сервер Sentry и токены не нужны.

## Требования

- Node.js 26 и pnpm 12 — `mise install` (версии в `mise.toml`), затем `mise run setup`.
- Docker с Compose — только для целей `up`/`down`/`traffic`/`events`/`reset`.
- Рецепты Makefile написаны под POSIX sh. На Windows запускайте `make` из Git Bash или
  WSL, а не из cmd/PowerShell: там нет `sh`, `id` и подстановок `${VAR:-default}`.

## Команды из Makefile

| Команда | Что делает |
| --- | --- |
| `make setup` | `pnpm install --frozen-lockfile` |
| `make start` | `pnpm start` — приложение без Docker |
| `make test` | `pnpm test` — Vitest |
| `make lint` | `pnpm lint` — typecheck, oxlint, oxfmt --check |
| `make check` | `make lint` + `make test` |
| `make up` | создаёт `var`, собирает образ и поднимает Compose с ожиданием healthcheck |
| `make down` | останавливает контейнеры, данные в `var` сохраняются |
| `make traffic` | нагрузчик внутри контейнера, печатает статусы операций |
| `make events` | печатает события Sentry из `var/events.jsonl` |
| `make reset` | `make down` и удаление файлов стенда из `var` |

Полный набор проверок, как в CI: `mise run setup`, затем `mise run check`
(`hk check --all` + `pnpm test`). Форматирование: `mise run fix`.

## Переменные окружения

Для `make up`:

```sh
APP_PORT=8088 make up                       # другой порт на хосте
RELEASE=$(git rev-parse HEAD) make up       # версия = SHA коммита
RUN_ID=browser-01 make up                   # метка запросов без x-run-id
```

Для `make traffic`:

```sh
RUN_ID=attempt-01 make traffic              # runId прогона
ROUNDS=1 make traffic                       # число раундов, по умолчанию 3
TRAFFIC_RUN_ID=attempt-01 make traffic      # приоритетнее RUN_ID
```

`make traffic` передаёт `TRAFFIC_RUN_ID` и `ROUNDS` в контейнер через `-e`.
Если идентификатор не задан, нагрузчик создаёт случайный и печатает его в отчёте.
Учтите, что `make up` сам выставляет `LOCAL_UID`/`LOCAL_GID` через `id -u`/`id -g`;
значения по умолчанию в Compose — `1000:1000`.

## Запуск без Docker

```sh
DATA_DIR=var-dev PORT=8090 RELEASE=local RUN_ID=manual pnpm start
```

Не запускайте два процесса с одним `DATA_DIR`: SQLite-база одна на каталог.
Проверки `/health` в журнал запросов не пишутся.

## Журналы и диагностика

Каталог `var/` монтируется в контейнер и исключён из Git:

| Файл | Содержимое |
| --- | --- |
| `events.jsonl` | события SDK: исключение, стек, breadcrumbs, метки |
| `envelopes.jsonl` | исходные envelopes SDK |
| `requests.jsonl` | успешные и неуспешные HTTP-запросы |
| `shop.sqlite` | база приложения |

Связывайте запись из `requests.jsonl` с событием по `requestId` / `tags.request_id`.
Фильтруйте события по `release` и `tags.run_id`. `make events` печатает всё; для
отбора используйте `jq` или `FILTER_RUN_ID`/`FILTER_RELEASE` при прямом запуске:

```sh
docker compose exec -T -e FILTER_RUN_ID=attempt-01 app node scripts/events.ts
```

## Тесты

Тесты лежат в `tests/`, используют Vitest и сами поднимают сервер на свободном порту
с временным `DATA_DIR`. Для проверки записи событий включается `ENABLE_TEST_ERROR=1`
и маршрут `/__test__/error`.

Исправляя дефект, добавляйте регрессионный тест на исправляемое поведение. Существующие
тесты покрывают базовые функции и запись SDK, но не все дефекты стенда.

## Правила работы

- Ветка, регрессионный тест, исправление, `make check`, затем PR в `main` своего репозитория.
- Коммиты — conventional commits (`commitlint`), заголовок PR тоже.
- Перед контрольным прогоном коммитьте изменения: `RELEASE=$(git rev-parse HEAD) make up`.
  PR и отчёт проверки связывайте с точным SHA.
- Отсутствие новых ошибок не доказывает исправление: нужен успешный контрольный трафик.
- Не добавляйте ключ модели и GitHub token в `compose.yml`, Dockerfile, тесты и Actions.
- Не коммитьте `var/` и содержимое `.env`, не меняйте `pnpm-lock.yaml` вручную.
- Документация и сообщения в репозитории — на русском языке.
