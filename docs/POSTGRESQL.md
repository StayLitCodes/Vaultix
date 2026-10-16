# PostgreSQL deployment

The backend supports SQLite for local development and PostgreSQL for production.

## Configuration

Set these variables in `apps/backend/.env`:

```dotenv
DATABASE_DRIVER=postgres
DATABASE_URL=postgres://vaultix:change-me@localhost:5432/vaultix
```

`DATABASE_DRIVER=sqlite` uses `DATABASE_PATH` and remains the default for local development. PostgreSQL connections use a pool with a maximum of 20 clients and a 30-second idle timeout.

## Docker

```bash
docker run --name vaultix-postgres \
  -e POSTGRES_USER=vaultix \
  -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=vaultix \
  -p 5432:5432 -d postgres:16
```

Run the backend migrations before starting the service:

```bash
cd apps/backend
DATABASE_DRIVER=postgres DATABASE_URL=postgres://vaultix:change-me@localhost:5432/vaultix npm run migration:run
```

The PostgreSQL migration entrypoint executes the existing migration history through a compatibility layer for SQLite date and boolean-default syntax. Future schema changes must be written with TypeORM APIs that support both drivers.

## Data migration

Create an export from the existing SQLite database:

```bash
DATABASE_PATH=./data/vaultix.db npm run data:migrate:sqlite-to-postgres -- ./data/vaultix-export.json
```

After the PostgreSQL schema is migrated, import that export:

```bash
DATABASE_DRIVER=postgres DATABASE_URL=postgres://vaultix:change-me@localhost:5432/vaultix \
npm run data:migrate:sqlite-to-postgres -- ./data/vaultix-export.json
```

The importer preserves table and column names, parses known JSON text columns for JSONB, and uses `ON CONFLICT DO NOTHING` so it can be rerun safely.

## Health checks

`GET /health/info` reports `databaseType` as `sqlite` or `postgres`, and the readiness probe verifies the active TypeORM connection.
